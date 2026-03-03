import { GoogleSheetsHttpError } from '../errors'
import type { RetryPolicy } from './types'

const DEFAULT_RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  initialDelayMs: 200,
  maxDelayMs: 3_000,
  backoffMultiplier: 2,
  jitterRatio: 0.2,
  retryableStatusCodes: [...DEFAULT_RETRYABLE_STATUS_CODES],
}

export interface RetryExecutionOptions {
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function resolveRetryPolicy(override?: Partial<RetryPolicy>): RetryPolicy {
  return {
    maxAttempts: Math.max(1, Math.floor(override?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts)),
    initialDelayMs: Math.max(0, Math.floor(override?.initialDelayMs ?? DEFAULT_RETRY_POLICY.initialDelayMs)),
    maxDelayMs: Math.max(0, Math.floor(override?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs)),
    backoffMultiplier: Math.max(1, override?.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier),
    jitterRatio: Math.min(1, Math.max(0, override?.jitterRatio ?? DEFAULT_RETRY_POLICY.jitterRatio)),
    retryableStatusCodes: override?.retryableStatusCodes ?? [...DEFAULT_RETRY_POLICY.retryableStatusCodes],
  }
}

function isRetryableStatusCode(status: number, policy: RetryPolicy): boolean {
  return policy.retryableStatusCodes.includes(status)
}

function isRetryableError(error: unknown, policy: RetryPolicy): boolean {
  if (error instanceof GoogleSheetsHttpError) {
    return isRetryableStatusCode(error.status, policy)
  }

  if (error instanceof TypeError) {
    return true
  }

  if (error instanceof DOMException) {
    return error.name === 'AbortError'
  }

  return false
}

export function calculateBackoffDelayMs(attempt: number, policy: RetryPolicy, random = Math.random): number {
  const exponentialBase = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, Math.max(0, attempt - 1))
  const capped = Math.min(exponentialBase, policy.maxDelayMs)
  const jitterWidth = capped * policy.jitterRatio
  const jitter = jitterWidth === 0 ? 0 : (random() * 2 - 1) * jitterWidth
  return Math.max(0, Math.round(capped + jitter))
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policyInput?: Partial<RetryPolicy>,
  executionOptions?: RetryExecutionOptions,
): Promise<T> {
  const policy = resolveRetryPolicy(policyInput)
  const sleepFn = executionOptions?.sleep ?? sleep
  const randomFn = executionOptions?.random ?? Math.random

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      const shouldRetry = attempt < policy.maxAttempts && isRetryableError(error, policy)
      if (!shouldRetry) {
        throw error
      }

      const delayMs = calculateBackoffDelayMs(attempt, policy, randomFn)
      await sleepFn(delayMs)
    }
  }

  throw new Error('Retry loop exhausted unexpectedly')
}
