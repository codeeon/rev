import assert from 'node:assert/strict'
import test from 'node:test'
import { listApprovalRequests } from './read-approval-requests'

function selectRowsForApprovalRequestRange(rows: string[][], range: string): string[][] {
  if (range === 'ApprovalRequests!A1:L1') {
    return [rows[0]!]
  }

  const match = range.match(/^ApprovalRequests!A(\d+):L(\d+)$/)
  if (match) {
    const startRow = Number(match[1])
    const endRow = Number(match[2])
    return rows.slice(startRow - 1, endRow)
  }

  return []
}

test('listApprovalRequests returns latest matching requests first', async () => {
  const rows = [
    ['requestId', 'draftId', 'version', 'sourceVersion', 'draftUpdatedAt', 'status', 'requestedBy', 'requestedAt', 'requestComment', 'reviewedBy', 'reviewedAt', 'reviewComment'],
    ['request-1', 'draft-1', '2026.03.17', '2026.03.16', '2026-03-17T00:00:00.000Z', 'requested', 'editor@example.com', '2026-03-17T00:10:00.000Z', 'please review', '', '', ''],
    ['request-2', 'draft-1', '2026.03.17', '2026.03.16', '2026-03-17T00:20:00.000Z', 'approved', 'editor@example.com', '2026-03-17T00:21:00.000Z', 'please review again', 'owner@example.com', '2026-03-17T00:30:00.000Z', 'ok'],
  ]

  const payload = await listApprovalRequests({
    spreadsheetId: 'sheet-id',
    range: 'ApprovalRequests!A:L',
    limit: 1,
    client: {
      values: {
        get: async ({ range }) => ({ values: selectRowsForApprovalRequestRange(rows, range) }),
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async () => ({ totalUpdatedRows: 0 }),
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({
          sheets: [
            {
              properties: {
                title: 'ApprovalRequests',
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
  assert.equal(payload.items[0]?.requestId, 'request-2')
  assert.equal(payload.items[0]?.status, 'approved')
})

test('listApprovalRequests filters by draftId and status', async () => {
  const rows = [
    ['requestId', 'draftId', 'version', 'sourceVersion', 'draftUpdatedAt', 'status', 'requestedBy', 'requestedAt', 'requestComment', 'reviewedBy', 'reviewedAt', 'reviewComment'],
    ['request-1', 'draft-1', '2026.03.17', '2026.03.16', '2026-03-17T00:00:00.000Z', 'requested', 'editor@example.com', '2026-03-17T00:10:00.000Z', 'please review', '', '', ''],
    ['request-2', 'draft-1', '2026.03.17', '2026.03.16', '2026-03-17T00:20:00.000Z', 'approved', 'editor@example.com', '2026-03-17T00:21:00.000Z', 'please review again', 'owner@example.com', '2026-03-17T00:30:00.000Z', 'ok'],
  ]

  const payload = await listApprovalRequests({
    spreadsheetId: 'sheet-id',
    range: 'ApprovalRequests!A:L',
    draftId: 'draft-1',
    status: 'requested',
    client: {
      values: {
        get: async ({ range }) => ({ values: selectRowsForApprovalRequestRange(rows, range) }),
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async () => ({ totalUpdatedRows: 0 }),
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({
          sheets: [
            {
              properties: {
                title: 'ApprovalRequests',
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
  assert.equal(payload.items[0]?.requestId, 'request-1')
  assert.equal(payload.items[0]?.status, 'requested')
})
