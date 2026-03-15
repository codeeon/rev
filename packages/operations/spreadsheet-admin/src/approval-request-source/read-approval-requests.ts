import type { GoogleSheetsClient, SheetCell, SheetRow } from '@workspace/google-sheets/server'
import {
  APPROVAL_REQUEST_HEADERS,
  APPROVAL_REQUEST_STATUSES,
  type ApprovalRequestRecord,
  type ApprovalRequestStatus,
} from '../approval-request-sink/approval-request-schema'

const MAX_APPROVAL_REQUEST_LIMIT = 200
const MIN_APPROVAL_REQUEST_LIMIT = 1
const RECENT_APPROVAL_REQUEST_SCAN_WINDOW = 200
const MAX_APPROVAL_REQUEST_SCAN_WINDOWS = 5

export interface StoredApprovalRequestRecord extends ApprovalRequestRecord {
  rowNumber: number
}

export interface ListApprovalRequestsInput {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  limit?: number
  requestId?: string
  draftId?: string
  status?: ApprovalRequestStatus
}

export interface ListApprovalRequestsResponse {
  items: StoredApprovalRequestRecord[]
  limit: number
  matchedRequestId?: string
  matchedDraftId?: string
  matchedStatus?: ApprovalRequestStatus
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return MAX_APPROVAL_REQUEST_LIMIT
  }

  return Math.min(MAX_APPROVAL_REQUEST_LIMIT, Math.max(MIN_APPROVAL_REQUEST_LIMIT, Math.trunc(limit as number)))
}

function stringifyCell(cell: SheetCell): string {
  if (cell === null || typeof cell === 'undefined') {
    return ''
  }

  return String(cell)
}

function assertHeaderRow(headerRow: string[]): void {
  const normalizedHeader = headerRow.slice(0, APPROVAL_REQUEST_HEADERS.length)
  for (const [index, expected] of APPROVAL_REQUEST_HEADERS.entries()) {
    if (normalizedHeader[index] !== expected) {
      throw new Error(
        `Approval request sheet header mismatch at column ${index + 1}: expected=${expected}, got=${normalizedHeader[index] ?? ''}`,
      )
    }
  }
}

function parseApprovalRequestRow(row: SheetRow, rowNumber: number): StoredApprovalRequestRecord {
  const values = row.map(stringifyCell)
  const [requestId, draftId, version, sourceVersion, draftUpdatedAt, rawStatus, requestedBy, requestedAt, requestComment, reviewedBy, reviewedAt, reviewComment] =
    values
  if (!APPROVAL_REQUEST_STATUSES.includes(rawStatus as ApprovalRequestStatus)) {
    throw new Error(`Unsupported approval request status: ${rawStatus}`)
  }

  return {
    rowNumber,
    requestId: requestId.trim(),
    draftId: draftId.trim(),
    version: version.trim(),
    sourceVersion: sourceVersion.trim(),
    draftUpdatedAt: draftUpdatedAt.trim(),
    status: rawStatus as ApprovalRequestStatus,
    requestedBy: requestedBy.trim(),
    requestedAt: requestedAt.trim(),
    requestComment: requestComment.trim() || null,
    reviewedBy: reviewedBy.trim() || null,
    reviewedAt: reviewedAt.trim() || null,
    reviewComment: reviewComment.trim() || null,
  }
}

function parseApprovalRequestDataRows(headerRow: string[], rows: SheetRow[], startRowNumber: number): StoredApprovalRequestRecord[] {
  assertHeaderRow(headerRow)

  return rows
    .filter(row => row.some(cell => stringifyCell(cell).trim() !== ''))
    .map((row, index) => parseApprovalRequestRow(row, startRowNumber + index))
}

function unquoteSheetName(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }

  return trimmed
}

function parseColumnRange(range: string): { sheetName: string; sheetTitle: string; startColumn: string; endColumn: string } | null {
  const separatorIndex = range.lastIndexOf('!')
  if (separatorIndex === -1) {
    return null
  }

  const sheetName = range.slice(0, separatorIndex)
  const a1Range = range.slice(separatorIndex + 1).trim()
  const match = a1Range.match(/^([A-Z]+)(?:\d+)?:([A-Z]+)(?:\d+)?$/i)
  if (!match) {
    return null
  }

  return {
    sheetName,
    sheetTitle: unquoteSheetName(sheetName),
    startColumn: match[1].toUpperCase(),
    endColumn: match[2].toUpperCase(),
  }
}

function buildRange(sheetName: string, startColumn: string, endColumn: string, startRow: number, endRow: number): string {
  return `${sheetName}!${startColumn}${startRow}:${endColumn}${endRow}`
}

async function hasTargetSheet(client: GoogleSheetsClient, spreadsheetId: string, sheetTitle: string): Promise<boolean> {
  const response = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })

  return response.sheets?.some(sheet => sheet.properties?.title === sheetTitle) ?? false
}

async function getSheetRowCount(client: GoogleSheetsClient, spreadsheetId: string, sheetTitle: string): Promise<number | null> {
  const response = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title,sheets.properties.gridProperties.rowCount',
  })

  const matchingSheet = response.sheets?.find(sheet => sheet.properties?.title === sheetTitle)
  return matchingSheet?.properties?.gridProperties?.rowCount ?? null
}

function matchesFilters(
  item: StoredApprovalRequestRecord,
  filters: {
    requestId?: string
    draftId?: string
    status?: ApprovalRequestStatus
  },
): boolean {
  if (filters.requestId && item.requestId !== filters.requestId) {
    return false
  }
  if (filters.draftId && item.draftId !== filters.draftId) {
    return false
  }
  if (filters.status && item.status !== filters.status) {
    return false
  }

  return true
}

export async function listApprovalRequests(input: ListApprovalRequestsInput): Promise<ListApprovalRequestsResponse> {
  const parsedRange = parseColumnRange(input.range)
  if (!parsedRange) {
    throw new Error(`Unsupported approval request range: ${input.range}`)
  }

  const hasSheet = await hasTargetSheet(input.client, input.spreadsheetId, parsedRange.sheetTitle)
  if (!hasSheet) {
    return {
      items: [],
      limit: clampLimit(input.limit),
      matchedRequestId: input.requestId,
      matchedDraftId: input.draftId,
      matchedStatus: input.status,
    }
  }

  const headerRange = buildRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, 1, 1)
  const headerResponse = await input.client.values.get({
    spreadsheetId: input.spreadsheetId,
    range: headerRange,
  })
  const headerRow = headerResponse.values?.[0]?.map(stringifyCell) ?? []
  if (headerRow.length === 0) {
    return {
      items: [],
      limit: clampLimit(input.limit),
      matchedRequestId: input.requestId,
      matchedDraftId: input.draftId,
      matchedStatus: input.status,
    }
  }

  const sheetRowCount = await getSheetRowCount(input.client, input.spreadsheetId, parsedRange.sheetTitle)
  if (!sheetRowCount || sheetRowCount < 2) {
    return {
      items: [],
      limit: clampLimit(input.limit),
      matchedRequestId: input.requestId,
      matchedDraftId: input.draftId,
      matchedStatus: input.status,
    }
  }

  const limit = clampLimit(input.limit)
  const filters = {
    requestId: input.requestId,
    draftId: input.draftId,
    status: input.status,
  }
  const items: StoredApprovalRequestRecord[] = []
  let windowEnd = sheetRowCount
  let scannedWindows = 0

  while (windowEnd >= 2 && scannedWindows < MAX_APPROVAL_REQUEST_SCAN_WINDOWS && items.length < limit) {
    const windowStart = Math.max(2, windowEnd - RECENT_APPROVAL_REQUEST_SCAN_WINDOW + 1)
    const response = await input.client.values.get({
      spreadsheetId: input.spreadsheetId,
      range: buildRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, windowStart, windowEnd),
    })
    const parsedItems = parseApprovalRequestDataRows(headerRow, response.values ?? [], windowStart)
    for (let index = parsedItems.length - 1; index >= 0 && items.length < limit; index -= 1) {
      const item = parsedItems[index]
      if (item && matchesFilters(item, filters)) {
        items.push(item)
      }
    }

    scannedWindows += 1
    windowEnd = windowStart - 1
  }

  return {
    items,
    limit,
    matchedRequestId: input.requestId,
    matchedDraftId: input.draftId,
    matchedStatus: input.status,
  }
}
