import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../../../../route-deps'
import { POST } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('POST publishes a draft with session email', async () => {
  let receivedInput: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true } }) as never,
    publishDraft: async input => {
      receivedInput = input as unknown as Record<string, unknown>
      return {
        draftId: 'draft-1',
        publishedVersion: '2026.03.16',
        sourceVersion: '2026.03.15',
        updatedRowCount: 4,
        questionCount: 4,
        optionCount: 4,
        publishedBy: 'owner@example.com',
        publishedAt: '2026-03-15T00:00:00.000Z',
      }
    },
  })

  const response = await POST(
    new Request('http://localhost/api/admin/questions/drafts/draft-1/publish', {
      method: 'POST',
      body: JSON.stringify({ changeSummary: 'publish approved', approvalComment: 'LGTM' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ draftId: 'draft-1' }),
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(receivedInput, {
    draftId: 'draft-1',
    approvalRequestId: undefined,
    publishedBy: 'owner@example.com',
    publishedByRole: 'owner',
    changeSummary: 'publish approved',
    approvalComment: 'LGTM',
  })
})

test('POST forwards approvalRequestId when provided', async () => {
  let receivedInput: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true, role: 'owner' } }) as never,
    publishDraft: async input => {
      receivedInput = input as unknown as Record<string, unknown>
      return {
        draftId: 'draft-1',
        publishedVersion: '2026.03.16',
        sourceVersion: '2026.03.15',
        updatedRowCount: 4,
        questionCount: 4,
        optionCount: 4,
        publishedBy: 'owner@example.com',
        publishedAt: '2026-03-15T00:00:00.000Z',
      }
    },
  })

  const response = await POST(
    new Request('http://localhost/api/admin/questions/drafts/draft-1/publish', {
      method: 'POST',
      body: JSON.stringify({ approvalRequestId: 'request-1' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ draftId: 'draft-1' }),
    },
  )

  assert.equal(response.status, 200)
  assert.equal(receivedInput?.approvalRequestId, 'request-1')
})

test('POST returns 403 when session lacks questions.publish capability', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'editor@example.com', isAdmin: true, role: 'editor' } }) as never,
  })

  const response = await POST(
    new Request('http://localhost/api/admin/questions/drafts/draft-1/publish', {
      method: 'POST',
      body: JSON.stringify({ changeSummary: 'publish approved' }),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {
      params: Promise.resolve({ draftId: 'draft-1' }),
    },
  )

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'insufficient-role' })
})
