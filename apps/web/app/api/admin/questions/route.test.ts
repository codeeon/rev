import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../route-deps'
import { GET } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('GET returns 401 when admin session is missing', async () => {
  setAdminRouteDepsForTest({
    auth: async () => null,
  })

  const response = await GET()
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
})

test('GET returns question payload for admin session', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    listQuestions: async () => ({
      source: 'spreadsheet-latest',
      questionVersion: '4.1',
      questions: [],
    }),
  })

  const response = await GET()
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.source, 'spreadsheet-latest')
  assert.equal(payload.questionVersion, '4.1')
})

test('GET returns 503 when question loading fails', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    listQuestions: async () => {
      throw new Error('questions failed')
    },
  })

  const response = await GET()
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: 'question-sync-failed',
    message: 'questions failed',
  })
})
