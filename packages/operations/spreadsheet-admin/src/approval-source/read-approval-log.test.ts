import assert from 'node:assert/strict'
import test from 'node:test'
import { listApprovalLogEntries } from './read-approval-log'

function selectRowsForApprovalRange(rows: string[][], range: string): string[][] {
  if (range === 'ApprovalLog!A1:J1') {
    return [rows[0]!]
  }

  const match = range.match(/^ApprovalLog!A(\d+):J(\d+)$/)
  if (match) {
    const startRow = Number(match[1])
    const endRow = Number(match[2])
    return rows.slice(startRow - 1, endRow)
  }

  return []
}

test('listApprovalLogEntries returns latest matching approval rows first', async () => {
  const rows = [
    ['approvalId', 'approvedAt', 'draftId', 'draftVersion', 'sourceVersion', 'publishedVersion', 'actorEmail', 'actorRole', 'changeSummary', 'approvalComment'],
    ['approval-1', '2026-03-15T00:00:00.000Z', 'draft-1', '2026.03.16', '2026.03.15', '2026.03.16', 'owner@example.com', 'owner', 'publish', 'LGTM'],
    ['approval-2', '2026-03-16T00:00:00.000Z', 'draft-2', '2026.03.17', '2026.03.16', '2026.03.17', 'owner@example.com', 'owner', 'publish', 'Ship it'],
  ]

  const payload = await listApprovalLogEntries({
    spreadsheetId: 'sheet-id',
    range: 'ApprovalLog!A:J',
    limit: 1,
    client: {
      values: {
        get: async ({ range }) => ({ values: selectRowsForApprovalRange(rows, range) }),
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async () => ({ totalUpdatedRows: 0 }),
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({
          sheets: [
            {
              properties: {
                title: 'ApprovalLog',
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
  assert.equal(payload.items[0]?.approvalId, 'approval-2')
  assert.equal(payload.items[0]?.approvalComment, 'Ship it')
})

test('listApprovalLogEntries filters by approvalId when provided', async () => {
  const rows = [
    ['approvalId', 'approvedAt', 'draftId', 'draftVersion', 'sourceVersion', 'publishedVersion', 'actorEmail', 'actorRole', 'changeSummary', 'approvalComment'],
    ['approval-1', '2026-03-15T00:00:00.000Z', 'draft-1', '2026.03.16', '2026.03.15', '2026.03.16', 'owner@example.com', 'owner', 'publish', 'LGTM'],
    ['approval-2', '2026-03-16T00:00:00.000Z', 'draft-2', '2026.03.17', '2026.03.16', '2026.03.17', 'owner@example.com', 'owner', 'publish', 'Ship it'],
  ]

  const payload = await listApprovalLogEntries({
    spreadsheetId: 'sheet-id',
    range: 'ApprovalLog!A:J',
    approvalId: 'approval-1',
    client: {
      values: {
        get: async ({ range }) => ({ values: selectRowsForApprovalRange(rows, range) }),
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async () => ({ totalUpdatedRows: 0 }),
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({
          sheets: [
            {
              properties: {
                title: 'ApprovalLog',
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
  assert.equal(payload.items[0]?.approvalId, 'approval-1')
  assert.equal(payload.matchedApprovalId, 'approval-1')
})
