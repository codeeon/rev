import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../../../../route-deps'
import { PATCH } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('PATCH approves approval request for owner session', async () => {
  let receivedInput: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true, role: 'owner' } }) as never,
    updateApprovalRequestStatus: async input => {
      receivedInput = input as unknown as Record<string, unknown>
      return {
        requestId: 'request-1',
        draftId: 'draft-1',
        status: 'approved',
        reviewedBy: 'owner@example.com',
        reviewedAt: '2026-03-17T00:20:00.000Z',
        reviewComment: 'approved',
      }
    },
  })

  const response = await PATCH(
    new Request('http://localhost/api/admin/questions/approval-requests/request-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ nextStatus: 'approved', reviewComment: 'approved' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ requestId: 'request-1' }),
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(receivedInput, {
    requestId: 'request-1',
    nextStatus: 'approved',
    reviewedBy: 'owner@example.com',
    reviewComment: 'approved',
  })
})

test('PATCH returns 403 when session lacks publish capability', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'editor@example.com', isAdmin: true, role: 'editor' } }) as never,
  })

  const response = await PATCH(
    new Request('http://localhost/api/admin/questions/approval-requests/request-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ nextStatus: 'approved' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ requestId: 'request-1' }),
    },
  )

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'insufficient-role' })
})
