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

  const response = await GET(new Request('http://localhost/api/admin/results?limit=10') as never)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
})

test('GET returns 403 when session is not admin', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'guest@example.com', isAdmin: false } }) as never,
  })

  const response = await GET(new Request('http://localhost/api/admin/results') as never)
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'forbidden' })
})

test('GET returns results payload when admin session is valid', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    listResults: async () => ({
      items: [
        {
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
        },
      ],
      limit: 10,
    }),
  })

  const response = await GET(new Request('http://localhost/api/admin/results?limit=10') as never)
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.sessionId, 'session-1')
  assert.equal(payload.limit, 10)
})

test('GET returns 503 when results loading fails', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    listResults: async () => {
      throw new Error('results failed')
    },
  })

  const response = await GET(new Request('http://localhost/api/admin/results') as never)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: 'results-load-failed',
    message: 'results failed',
  })
})
