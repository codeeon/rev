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

  const response = await GET(new Request('http://localhost/api/admin/analytics/summary') as never)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
})

test('GET returns analytics summary payload for admin session', async () => {
  let receivedLimit: number | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    listResults: async (options) => {
      receivedLimit = options?.limit
      return {
        limit: options?.limit ?? 100,
        items: [
          {
            rowNumber: 2,
            sessionId: 'session-1',
            timestamp: '2026-03-15T00:00:00.000Z',
            engineVersion: '1.0',
            questionVersion: '2026.03.15',
            birthTimeKnowledge: 'known',
            surveyAnswers: [],
            inferenceResult: {
              inferredZishi: '자시',
              confidence: 88,
              isCusp: false,
              topCandidates: [],
            },
            monitoring: {
              top1Prob: 0.88,
              top2Gap: 0.12,
              stdSoftmax: 0.1,
              stdRawScore: 0.1,
              roleInfluence: {},
              alerts: {},
            },
          },
        ],
      }
    },
    listQuestions: async () => ({
      source: 'spreadsheet-latest',
      questionVersion: '2026.03.15',
      questions: [
        {
          id: 'Q1',
          structure_role: 'noise_reduction',
          category: 'habit',
          question_weight: 1,
          text: 'Q1',
          options: [{ text: 'A', score_map: {} }],
        },
        {
          id: 'Q2',
          structure_role: 'core',
          category: 'habit',
          question_weight: 1,
          text: 'Q2',
          options: [{ text: 'A', score_map: {} }],
        },
        {
          id: 'Q3',
          structure_role: 'fine_tune',
          category: 'sleep',
          question_weight: 1,
          text: 'Q3',
          options: [{ text: 'A', score_map: {} }],
        },
        {
          id: 'Q4',
          structure_role: 'closing',
          category: 'sleep',
          question_weight: 1,
          text: 'Q4',
          options: [{ text: 'A', score_map: {} }],
        },
      ],
    }),
  })

  const response = await GET(new Request('http://localhost/api/admin/analytics/summary?limit=25') as never)
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(receivedLimit, 25)
  assert.equal(payload.sampleLimit, 25)
  assert.equal(payload.currentQuestionVersion, '2026.03.15')
  assert.equal(payload.currentVersionResultCount, 1)
  assert.equal(payload.kpis.sampleSize, 1)
})

test('GET returns 503 when analytics summary loading fails', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    listResults: async () => {
      throw new Error('analytics failed')
    },
  })

  const response = await GET(new Request('http://localhost/api/admin/analytics/summary') as never)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: 'analytics-summary-load-failed',
    message: 'analytics failed',
  })
})
