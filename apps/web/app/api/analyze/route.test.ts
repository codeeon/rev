import assert from 'node:assert/strict'
import test from 'node:test'

import { POST } from './route'

declare global {
  var __analyzeRateLimitStore: Map<string, { count: number; resetAt: number }> | undefined
}

function clearRateLimitStore(): void {
  globalThis.__analyzeRateLimitStore?.clear()
}

function requestWithBody(
  body: string,
  contentType = 'application/json',
  headers?: Record<string, string>,
): Request {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'user-agent': 'route-test-agent',
      ...headers,
    },
    body,
  })
}

test('POST returns 400 for malformed JSON body', async () => {
  clearRateLimitStore()
  const response = await POST(requestWithBody('{'))

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Invalid JSON body' })
})

test('POST returns 400 for invalid payload shape', async () => {
  clearRateLimitStore()
  const response = await POST(requestWithBody(JSON.stringify({ birthInfo: { year: 1995 } })))

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Invalid request payload' })
})

test('POST rate-limits repeated requests from same client key', async () => {
  clearRateLimitStore()
  const headers = { 'x-real-ip': '203.0.113.10' }

  for (let i = 0; i < 20; i += 1) {
    const response = await POST(requestWithBody('{', 'application/json', headers))
    assert.notEqual(response.status, 429)
  }

  const limited = await POST(requestWithBody('{', 'application/json', headers))
  assert.equal(limited.status, 429)
  assert.ok(limited.headers.get('Retry-After'))
})

test('POST prunes expired rate-limit entries during request', async () => {
  clearRateLimitStore()

  const now = Date.now()
  globalThis.__analyzeRateLimitStore?.set('expired-client', { count: 1, resetAt: now - 1_000 })
  globalThis.__analyzeRateLimitStore?.set('active-client', { count: 1, resetAt: now + 60_000 })

  const response = await POST(requestWithBody('{', 'application/json', { 'x-real-ip': '198.51.100.2' }))
  assert.equal(response.status, 400)

  assert.equal(globalThis.__analyzeRateLimitStore?.has('expired-client'), false)
  assert.equal(globalThis.__analyzeRateLimitStore?.has('active-client'), true)
})

test('POST normalizes invalid client IP headers into unknown bucket', async () => {
  clearRateLimitStore()

  const invalidHeaderA = { 'x-real-ip': 'not-an-ip' }
  const invalidHeaderB = { 'x-forwarded-for': '999.999.999.999,127.0.0.1' }

  for (let i = 0; i < 20; i += 1) {
    const headers = i % 2 === 0 ? invalidHeaderA : invalidHeaderB
    const response = await POST(requestWithBody('{', 'application/json', headers))
    assert.notEqual(response.status, 429)
  }

  const limited = await POST(requestWithBody('{', 'application/json', invalidHeaderA))
  assert.equal(limited.status, 429)
})
