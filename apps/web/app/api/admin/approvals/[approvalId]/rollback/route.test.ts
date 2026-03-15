import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../../../route-deps'
import { POST } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('POST rolls back an approved draft with owner session', async () => {
  let receivedInput: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true, role: 'owner' } }) as never,
    rollbackApproval: async input => {
      receivedInput = input as unknown as Record<string, unknown>
      return {
        sourceApprovalId: 'approval-1',
        rollbackApprovalId: 'approval-2',
        sourceDraftId: 'draft-1',
        sourcePublishedVersion: '2026.03.15',
        draftId: 'draft-1',
        publishedVersion: '2026.03.15',
        sourceVersion: '2026.03.14',
        updatedRowCount: 4,
        questionCount: 4,
        optionCount: 4,
        publishedBy: 'owner@example.com',
        publishedAt: '2026-03-15T00:00:00.000Z',
      }
    },
  })

  const response = await POST(
    new Request('http://localhost/api/admin/approvals/approval-1/rollback', {
      method: 'POST',
      body: JSON.stringify({ changeSummary: 'rollback to 2026.03.15', approvalComment: 'restore stable version' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ approvalId: 'approval-1' }),
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(receivedInput, {
    approvalId: 'approval-1',
    rolledBackBy: 'owner@example.com',
    rolledBackByRole: 'owner',
    changeSummary: 'rollback to 2026.03.15',
    approvalComment: 'restore stable version',
  })
})

test('POST returns 403 when session lacks questions.publish capability', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'editor@example.com', isAdmin: true, role: 'editor' } }) as never,
  })

  const response = await POST(
    new Request('http://localhost/api/admin/approvals/approval-1/rollback', {
      method: 'POST',
      body: JSON.stringify({ changeSummary: 'rollback to 2026.03.15' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ approvalId: 'approval-1' }),
    },
  )

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'insufficient-role' })
})
