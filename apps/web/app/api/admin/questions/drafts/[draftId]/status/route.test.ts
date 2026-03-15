import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../../../../route-deps'
import { PATCH } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('PATCH returns 400 for invalid status payload', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
  })

  const response = await PATCH(
    new Request('http://localhost/api/admin/questions/drafts/draft-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ nextStatus: 'invalid' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ draftId: 'draft-1' }),
    },
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid-draft-status-payload' })
})

test('PATCH updates a draft status with session email', async () => {
  let receivedInput: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    updateDraftStatus: async input => {
      receivedInput = input as unknown as Record<string, unknown>
      return {
        draftId: 'draft-1',
        status: 'review-ready',
        updatedBy: 'owner@example.com',
        updatedAt: '2026-03-15T00:00:00.000Z',
        updatedRowCount: 4,
      }
    },
  })

  const response = await PATCH(
    new Request('http://localhost/api/admin/questions/drafts/draft-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ nextStatus: 'review-ready', changeSummary: 'ready for review' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ draftId: 'draft-1' }),
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(receivedInput, {
    draftId: 'draft-1',
    nextStatus: 'review-ready',
    changeSummary: 'ready for review',
    updatedBy: 'owner@example.com',
  })
})
