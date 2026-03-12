import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../../route-deps'
import { GET } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('GET returns 401 when admin session is missing', async () => {
  setAdminRouteDepsForTest({
    auth: async () => null,
  })

  const response = await GET(new Request('http://localhost/api/admin/results/session-1'), {
    params: Promise.resolve({ sessionId: 'session-1' }),
  })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
})

test('GET returns 404 when sessionId is not found', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    getResultBySessionId: async () => null,
  })

  const response = await GET(new Request('http://localhost/api/admin/results/missing'), {
    params: Promise.resolve({ sessionId: 'missing' }),
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'not-found' })
})

test('GET returns the matching result payload', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    getResultBySessionId: async () => ({
      rowNumber: 2,
      sessionId: 'session-1',
      timestamp: '2026-03-10T00:00:00.000Z',
      engineVersion: '4.1',
      questionVersion: '4.1',
      birthTimeKnowledge: 'unknown',
      surveyAnswers: [],
      inferenceResult: {
        inferredZishi: '자시',
        confidence: 84,
        isCusp: false,
        topCandidates: [],
      },
      monitoring: {
        top1Prob: 0.84,
        top2Gap: 0.21,
        stdSoftmax: 0,
        stdRawScore: 0,
        roleInfluence: {},
        alerts: {},
      },
    }),
  })

  const response = await GET(new Request('http://localhost/api/admin/results/session-1'), {
    params: Promise.resolve({ sessionId: 'session-1' }),
  })

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.sessionId, 'session-1')
})
