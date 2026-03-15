import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../../../../route-deps'
import { GET, POST } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('GET returns approval requests for editor session', async () => {
  let receivedOptions: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'editor@example.com', isAdmin: true, role: 'editor' } }) as never,
    listApprovalRequests: async options => {
      receivedOptions = options as Record<string, unknown>
      return {
        items: [
          {
            rowNumber: 2,
            requestId: 'request-1',
            draftId: 'draft-1',
            version: '2026.03.17',
            sourceVersion: '2026.03.16',
            draftUpdatedAt: '2026-03-17T00:00:00.000Z',
            status: 'requested',
            requestedBy: 'editor@example.com',
            requestedAt: '2026-03-17T00:10:00.000Z',
            requestComment: 'please review',
            reviewedBy: null,
            reviewedAt: null,
            reviewComment: null,
          },
        ],
        limit: 10,
      }
    },
  })

  const response = await GET(new Request('http://localhost/api/admin/questions/drafts/draft-1/approval-requests?status=requested&limit=10') as never, {
    params: Promise.resolve({ draftId: 'draft-1' }),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(receivedOptions, {
    draftId: 'draft-1',
    limit: 10,
    status: 'requested',
  })
})

test('POST creates approval request for editor session', async () => {
  let receivedInput: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'editor@example.com', isAdmin: true, role: 'editor' } }) as never,
    createApprovalRequest: async input => {
      receivedInput = input as unknown as Record<string, unknown>
      return {
        requestId: 'request-1',
        draftId: 'draft-1',
        version: '2026.03.17',
        sourceVersion: '2026.03.16',
        draftUpdatedAt: '2026-03-17T00:00:00.000Z',
        status: 'requested',
        requestedBy: 'editor@example.com',
        requestedAt: '2026-03-17T00:10:00.000Z',
        requestComment: 'please review',
      }
    },
  })

  const response = await POST(
    new Request('http://localhost/api/admin/questions/drafts/draft-1/approval-requests', {
      method: 'POST',
      body: JSON.stringify({ requestComment: 'please review' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ draftId: 'draft-1' }),
    },
  )

  assert.equal(response.status, 201)
  assert.deepEqual(receivedInput, {
    draftId: 'draft-1',
    requestedBy: 'editor@example.com',
    requestComment: 'please review',
  })
})
