import { streamText } from 'ai'
import { NextResponse } from 'next/server'
import { buildAnalysisPrompt } from '@/lib/ai/prompts'
import { analyzeSaju, parseAnalyzeInput } from '@workspace/saju-core'

declare global {
  var __analyzeRateLimitStore: Map<string, RateLimitEntry> | undefined
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 20
const RATE_LIMIT_MAX_KEYS = 5_000
const RATE_LIMIT_IP_HEADER_MAX_LENGTH = 256

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = globalThis.__analyzeRateLimitStore ?? new Map<string, RateLimitEntry>()
globalThis.__analyzeRateLimitStore = rateLimitStore

function pruneExpiredRateLimitEntries(now = Date.now()): void {
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

function enforceRateLimitCapacity(): void {
  if (rateLimitStore.size <= RATE_LIMIT_MAX_KEYS) {
    return
  }

  const overflowCount = rateLimitStore.size - RATE_LIMIT_MAX_KEYS
  const oldestEntries = [...rateLimitStore.entries()]
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, overflowCount)

  for (const [key] of oldestEntries) {
    rateLimitStore.delete(key)
  }
}

function getClientIp(req: Request): string {
  const isLikelyIpv4 = (value: string): boolean => {
    const parts = value.split('.')
    if (parts.length !== 4) return false
    return parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  }

  const isLikelyIpv6 = (value: string): boolean =>
    value.length <= 64 && /^[0-9a-fA-F:]+$/.test(value) && value.includes(':')

  const sanitizeCandidate = (value: string | null): string | null => {
    if (!value) return null
    if (value.length > RATE_LIMIT_IP_HEADER_MAX_LENGTH) return null

    const normalized = value.split(',')[0]?.trim()
    if (!normalized) return null
    if (isLikelyIpv4(normalized) || isLikelyIpv6(normalized)) {
      return normalized
    }

    return null
  }

  const realIp = sanitizeCandidate(req.headers.get('x-real-ip'))
  if (realIp) {
    return realIp
  }

  const forwardedFor = sanitizeCandidate(req.headers.get('x-forwarded-for'))
  if (forwardedFor) {
    return forwardedFor
  }

  return 'unknown-ip'
}

function getClientKey(req: Request): string {
  return getClientIp(req)
}

function isRateLimited(clientKey: string, now = Date.now()): boolean {
  const entry = rateLimitStore.get(clientKey)

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    enforceRateLimitCapacity()
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true
  }

  entry.count += 1
  return false
}

function getRetryAfterSeconds(clientKey: string, now = Date.now()): string {
  const entry = rateLimitStore.get(clientKey)
  if (!entry) return '60'

  const remainingMs = Math.max(1_000, entry.resetAt - now)
  return String(Math.ceil(remainingMs / 1_000))
}

export async function POST(req: Request) {
  pruneExpiredRateLimitEntries()
  const clientKey = getClientKey(req)
  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': getRetryAfterSeconds(clientKey) } },
    )
  }

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  }

  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsedInput = parseAnalyzeInput(body)
  if (!parsedInput) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
  }

  const { birthInfo, inferredHour } = parsedInput

  try {
    const sajuResult = analyzeSaju(birthInfo, inferredHour)
    const prompt = buildAnalysisPrompt({ sajuResult, inferredHour })

    const result = streamText({
      model: 'google/gemini-2.0-flash',
      prompt,
      maxOutputTokens: 2000,
      temperature: 0.7,
    })

    return result.toTextStreamResponse()
  } catch {
    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 })
  }
}
