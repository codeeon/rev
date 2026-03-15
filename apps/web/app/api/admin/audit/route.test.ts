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

  const response = await GET(new Request('http://localhost/api/admin/audit') as never)
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'insufficient-role' })
})

test('GET returns audit payload for owner session', async () => {
  let receivedOptions: Record<string, unknown> | undefined

  setAdminRouteDepsForTest({
    auth: async () => ({ user: { email: 'owner@example.com', isAdmin: true, role: 'owner' } }) as never,
    listAudit: async options => {
      receivedOptions = options
      return {
        items: [
          {
            rowNumber: 2,
            eventId: 'audit-1',
            at: '2026-03-15T00:00:00.000Z',
            action: 'draft.publish',
            actionFamily: 'mutation',
            actorEmail: 'owner@example.com',
            actorRole: 'owner',
            subjectType: 'draft',
            subjectId: 'draft-1',
            metadata: { approvalComment: 'LGTM' },
          },
        ],
        limit: 10,
      }
    },
  })

  const response = await GET(new Request('http://localhost/api/admin/audit?actionFamily=mutation&limit=10') as never)
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.deepEqual(receivedOptions, {
    limit: 10,
    actionFamily: 'mutation',
    actorEmail: undefined,
  })
  assert.equal(payload.items[0]?.eventId, 'audit-1')
})
