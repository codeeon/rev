import assert from 'node:assert/strict'
import test from 'node:test'
import { setAdminRouteDepsForTest } from '../route-deps'
import { GET } from './route'

test.afterEach(() => {
  setAdminRouteDepsForTest(null)
})

test('GET returns 403 when session lacks roles.manage capability', async () => {
  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'editor@example.com', isAdmin: true, role: 'editor' } }) as never,
  })

  const response = await GET(new Request('http://localhost/api/admin/approvals') as never)
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'insufficient-role' })
})

test('GET returns approval payload for owner session', async () => {
  let receivedOptions: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true, role: 'owner' } }) as never,
    listApprovals: async options => {
      receivedOptions = options
      return {
        items: [
          {
            rowNumber: 2,
            approvalId: 'approval-1',
            approvedAt: '2026-03-15T00:00:00.000Z',
            draftId: 'draft-1',
            draftVersion: '2026.03.16',
            sourceVersion: '2026.03.15',
            publishedVersion: '2026.03.16',
            actorEmail: 'owner@example.com',
            actorRole: 'owner',
            changeSummary: 'publish',
            approvalComment: 'LGTM',
          },
        ],
        limit: 10,
      }
    },
  })

  const response = await GET(new Request('http://localhost/api/admin/approvals?limit=10&draftId=draft-1') as never)
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.deepEqual(receivedOptions, {
    limit: 10,
    approvalId: undefined,
    actorEmail: undefined,
    draftId: 'draft-1',
  })
  assert.equal(payload.items[0]?.approvalId, 'approval-1')
})
