import assert from 'node:assert/strict'
import test from 'node:test'
import { POST, __setFeedbackResultSaverForTest } from './route'

function createValidPayload() {
  return {
    sessionId: 'session-1',
    timestamp: '2026-03-03T00:00:00.000Z',
    engineVersion: '4.1',
    questionVersion: '4.1',
    birthTimeKnowledge: 'unknown',
    surveyAnswers: [{ questionId: 'Q1', optionIndex: 0 }],
    inferenceResult: {
      inferredZishi: '자시',
      confidence: 84,
      isCusp: false,
      topCandidates: [{ branch: '子', branchKr: '자', score: 1.2, percentage: 84 }],
    },
    monitoring: {
      top1Prob: 0.84,
      top2Gap: 0.21,
      stdSoftmax: 0,
      stdRawScore: 0,
      roleInfluence: {},
      alerts: {},
    },
    feedback: {
      rating: 5,
      accuracy: 'accurate',
    },
  }
}

function requestWithBody(
  body: string,
  contentType = 'application/json',
): Request {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'user-agent': 'feedback-route-test-agent',
    },
    body,
  })
}

test.afterEach(() => {
  __setFeedbackResultSaverForTest(null)
})

test('POST returns 415 for unsupported content type', async () => {
  const response = await POST(requestWithBody('hello', 'text/plain'))
  assert.equal(response.status, 415)
  assert.deepEqual(await response.json(), { error: 'Unsupported content type' })
})

test('POST returns 400 for malformed JSON payload', async () => {
  const response = await POST(requestWithBody('{'))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Invalid JSON body' })
})

test('POST returns 400 for invalid feedback payload shape', async () => {
  const response = await POST(requestWithBody(JSON.stringify({ sessionId: 'only-one-field' })))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Invalid feedback payload' })
})

test('POST returns 200 when save succeeds', async () => {
  __setFeedbackResultSaverForTest(async () => ({ saved: true }))

  const response = await POST(requestWithBody(JSON.stringify(createValidPayload())))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { saved: true })
})

test('POST returns 202 when save is skipped', async () => {
  __setFeedbackResultSaverForTest(async () => ({ saved: false, reason: 'not-configured' }))

  const response = await POST(requestWithBody(JSON.stringify(createValidPayload())))
  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { saved: false, reason: 'not-configured' })
})
