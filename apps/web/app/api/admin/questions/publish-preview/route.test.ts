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

  const response = await GET()
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
})

test('GET returns publish preview payload for admin session', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
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

  const response = await GET()
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.publishedVersion, '2026.03.15')
  assert.equal(payload.requiredRoles.publish, 'owner')
  assert.equal(payload.draftModel.sheetName, 'QuestionDrafts')
  assert.equal(payload.roleMatrix.length, 3)
  assert.equal(payload.checklist[0]?.status, 'ready')
})

test('GET returns 503 when publish preview loading fails', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    listQuestions: async () => {
      throw new Error('publish preview failed')
    },
  })

  const response = await GET()
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    error: 'publish-preview-load-failed',
    message: 'publish preview failed',
  })
})
