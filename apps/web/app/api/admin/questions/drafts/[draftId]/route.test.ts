import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../../../route-deps'
import { GET, PATCH } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('GET returns 404 when draft detail is missing', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    getDraftDetail: async () => null,
  })

  const response = await GET(new Request('http://localhost/api/admin/questions/drafts/draft-1') as never, {
    params: Promise.resolve({ draftId: 'draft-1' }),
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'not-found' })
})

test('GET returns draft detail payload', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    getDraftDetail: async () => ({
      draftId: 'draft-1',
      version: '2026.03.16',
      sourceVersion: '2026.03.15',
      status: 'draft',
      changeSummary: 'copy',
      updatedBy: 'owner@example.com',
      updatedAt: '2026-03-15T00:00:00.000Z',
      summary: {
        draftId: 'draft-1',
        version: '2026.03.16',
        sourceVersion: '2026.03.15',
        status: 'draft',
        changeSummary: 'copy',
        updatedBy: 'owner@example.com',
        updatedAt: '2026-03-15T00:00:00.000Z',
        questionCount: 4,
        optionCount: 4,
        missingRoles: [],
      },
      questions: [],
      diff: {
        totalChangedQuestions: 0,
        addedQuestionCount: 0,
        removedQuestionCount: 0,
        updatedQuestionCount: 0,
        items: [],
      },
    }),
  })

  const response = await GET(new Request('http://localhost/api/admin/questions/drafts/draft-1') as never, {
    params: Promise.resolve({ draftId: 'draft-1' }),
  })

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.draftId, 'draft-1')
})

test('PATCH returns 400 for invalid payload', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
  })

  const response = await PATCH(
    new Request('http://localhost/api/admin/questions/drafts/draft-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ draftId: 'draft-1' }),
    },
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid-draft-update-payload' })
})

test('PATCH forwards update payload with session email', async () => {
  let receivedInput: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    updateDraft: async input => {
      receivedInput = input as unknown as Record<string, unknown>
      return {
        draftId: 'draft-1',
        questionId: 'Q1',
        updatedBy: 'owner@example.com',
        updatedAt: '2026-03-15T00:00:00.000Z',
        updatedRowCount: 1,
        missingRoles: [],
      }
    },
  })

  const response = await PATCH(
    new Request('http://localhost/api/admin/questions/drafts/draft-1', {
      method: 'PATCH',
      body: JSON.stringify({
        version: '2026.03.16',
        sourceVersion: '2026.03.15',
        questionId: 'Q1',
        structureRole: 'core',
        category: 'habit',
        questionWeight: 2,
        questionText: '변경된 질문',
        isActive: true,
        changeSummary: 'manual update',
        options: [{ optionIndex: 0, optionText: '새 옵션', scoreMap: { 자시: 2 } }],
      }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ draftId: 'draft-1' }),
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(receivedInput, {
    draftId: 'draft-1',
    version: '2026.03.16',
    sourceVersion: '2026.03.15',
    questionId: 'Q1',
    structureRole: 'core',
    category: 'habit',
    questionWeight: 2,
    questionText: '변경된 질문',
    isActive: true,
    changeSummary: 'manual update',
    options: [{ optionIndex: 0, optionText: '새 옵션', scoreMap: { 자시: 2 } }],
    updatedBy: 'owner@example.com',
  })
})
