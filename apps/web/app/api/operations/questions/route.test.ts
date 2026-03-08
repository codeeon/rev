import assert from 'node:assert/strict'
import test from 'node:test'
import { ENGINE_SETTINGS } from '@workspace/time-inference'
import { setQuestionSyncResolverForTest } from './route-deps'
import { GET } from './route'

const ENV_KEYS = [
  'GOOGLE_SPREADSHEET_ADMIN_ID',
  'GOOGLE_SPREADSHEET_QUESTIONS_RANGE',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
] as const

const envBackup: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}

test.beforeEach(() => {
  for (const key of ENV_KEYS) {
    envBackup[key] = process.env[key]
    delete process.env[key]
  }
})

test.afterEach(() => {
  setQuestionSyncResolverForTest(null)

  for (const key of ENV_KEYS) {
    const value = envBackup[key]
    if (typeof value === 'undefined') {
      delete process.env[key]
      continue
    }
    process.env[key] = value
  }
})

test('GET returns engine-default questions when spreadsheet sync is not configured', async () => {
  const response = await GET()
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.source, 'engine-default')
  assert.equal(payload.questionVersion, ENGINE_SETTINGS.version)
  assert.ok(Array.isArray(payload.questions))
  assert.ok(payload.questions.length > 0)
})

test('GET uses injected resolver payload in tests', async () => {
  setQuestionSyncResolverForTest(async () => ({
    source: 'spreadsheet-latest',
    questionVersion: '2026.03.03',
    questions: [],
  }))

  const response = await GET()
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.source, 'spreadsheet-latest')
  assert.equal(payload.questionVersion, '2026.03.03')
})

test('GET falls back to default response when injected resolver throws', async () => {
  setQuestionSyncResolverForTest(async () => {
    throw new Error('resolver failed')
  })

  const response = await GET()
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.source, 'engine-default')
  assert.equal(payload.warning, 'question-sync-unexpected-error')
})
