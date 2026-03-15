import assert from 'node:assert/strict'
import test from 'node:test'
import { listAdminAuditEvents } from './read-admin-audit'

function selectRowsForAuditRange(rows: string[][], range: string): string[][] {
  if (range === 'AdminAuditLog!A1:H1') {
    return [rows[0]!]
  }

  const match = range.match(/^AdminAuditLog!A(\d+):H(\d+)$/)
  if (match) {
    const startRow = Number(match[1])
    const endRow = Number(match[2])
    return rows.slice(startRow - 1, endRow)
  }

  return []
}

test('listAdminAuditEvents returns latest matching audit rows first', async () => {
  const rows = [
    ['eventId', 'at', 'action', 'actorEmail', 'actorRole', 'subjectType', 'subjectId', 'metadataJson'],
    ['audit-1', '2026-03-15T00:00:00.000Z', 'draft.create', 'owner@example.com', 'owner', 'draft', 'draft-1', '{"version":"2026.03.16"}'],
    ['audit-2', '2026-03-15T01:00:00.000Z', 'access.denied', 'viewer@example.com', 'viewer', 'admin-route', 'GET:/api/admin/questions/drafts', '{"error":"insufficient-role"}'],
  ]

  const payload = await listAdminAuditEvents({
    spreadsheetId: 'sheet-id',
    range: 'AdminAuditLog!A:H',
    actionFamily: 'access',
    client: {
      values: {
        get: async ({ range }) => {
          return { values: selectRowsForAuditRange(rows, range) }
        },
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async () => ({ totalUpdatedRows: 0 }),
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({
          sheets: [
            {
              properties: {
                title: 'AdminAuditLog',
                gridProperties: {
                  rowCount: 1000,
                },
              },
            },
          ],
        }),
        batchUpdate: async () => ({ replies: [] }),
      },
    },
  })

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.eventId, 'audit-2')
  assert.equal(payload.items[0]?.actionFamily, 'access')
  assert.deepEqual(payload.items[0]?.metadata, { error: 'insufficient-role' })
})
