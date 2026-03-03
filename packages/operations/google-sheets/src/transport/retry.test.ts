import assert from 'node:assert/strict'
import test from 'node:test'
import { GoogleSheetsHttpError } from '../errors'
import { calculateBackoffDelayMs, resolveRetryPolicy, withRetry } from './retry'

test('retry delay respects cap and deterministic jitter', () => {
  const policy = resolveRetryPolicy({
    initialDelayMs: 100,
    maxDelayMs: 150,
    backoffMultiplier: 2,
    jitterRatio: 0,
  })

  assert.equal(calculateBackoffDelayMs(1, policy, () => 0.5), 100)
  assert.equal(calculateBackoffDelayMs(2, policy, () => 0.5), 150)
  assert.equal(calculateBackoffDelayMs(3, policy, () => 0.5), 150)
})

test('withRetry retries on retryable status and returns success', async () => {
  let attempts = 0
  const value = await withRetry(
    async () => {
      attempts += 1
      if (attempts < 3) {
        throw new GoogleSheetsHttpError(429, 'rate limited')
      }
      return 'ok'
    },
    {
      maxAttempts: 4,
      jitterRatio: 0,
    },
    {
      sleep: async () => {},
      random: () => 0.5,
    },
  )

  assert.equal(value, 'ok')
  assert.equal(attempts, 3)
})

test('withRetry does not retry non-retryable status', async () => {
  let attempts = 0
  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1
        throw new GoogleSheetsHttpError(400, 'bad request')
      },
      {
        maxAttempts: 4,
      },
      {
        sleep: async () => {},
      },
    ),
    GoogleSheetsHttpError,
  )

  assert.equal(attempts, 1)
})
