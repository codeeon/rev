import type { GoogleSheetsClient, SheetCell, SheetRow } from '@workspace/google-sheets/server'
import { APPROVAL_LOG_HEADERS, type ApprovalLogRecord } from '../approval-sink/approval-log-schema'

const MAX_APPROVAL_LOG_LIMIT = 200
const MIN_APPROVAL_LOG_LIMIT = 1
const RECENT_APPROVAL_SCAN_WINDOW = 200
const MAX_APPROVAL_SCAN_WINDOWS = 5

export interface StoredApprovalLogRecord extends ApprovalLogRecord {
  rowNumber: number
}

export interface ListApprovalLogEntriesInput {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  limit?: number
  approvalId?: string
  actorEmail?: string
  draftId?: string
}

export interface ListApprovalLogEntriesResponse {
  items: StoredApprovalLogRecord[]
  limit: number
  matchedApprovalId?: string
  matchedActorEmail?: string
  matchedDraftId?: string
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return MAX_APPROVAL_LOG_LIMIT
  }

  return Math.min(MAX_APPROVAL_LOG_LIMIT, Math.max(MIN_APPROVAL_LOG_LIMIT, Math.trunc(limit as number)))
}

function stringifyCell(cell: SheetCell): string {
  if (cell === null || typeof cell === 'undefined') {
    return ''
  }

  return String(cell)
}

function normalizeEmail(value: string): string | undefined {
  const trimmed = value.trim().toLowerCase()
  return trimmed || undefined
}

function assertHeaderRow(headerRow: string[]): void {
  const normalizedHeader = headerRow.slice(0, APPROVAL_LOG_HEADERS.length)

  for (const [index, expected] of APPROVAL_LOG_HEADERS.entries()) {
    if (normalizedHeader[index] !== expected) {
      throw new Error(`Approval log sheet header mismatch at column ${index + 1}: expected=${expected}, got=${normalizedHeader[index] ?? ''}`)
    }
  }
}

function parseApprovalLogRow(row: SheetRow, rowNumber: number): StoredApprovalLogRecord {
  const values = row.map(stringifyCell)
  const [approvalId, approvedAt, draftId, draftVersion, sourceVersion, publishedVersion, actorEmail, actorRole, changeSummary, approvalComment] =
    values

  return {
    rowNumber,
    approvalId: approvalId.trim(),
    approvedAt: approvedAt.trim(),
    draftId: draftId.trim(),
    draftVersion: draftVersion.trim(),
    sourceVersion: sourceVersion.trim(),
    publishedVersion: publishedVersion.trim(),
    actorEmail: normalizeEmail(actorEmail) ?? null,
    actorRole: actorRole.trim() || null,
    changeSummary: changeSummary.trim() || null,
    approvalComment: approvalComment.trim() || null,
  }
}

function parseApprovalLogDataRows(headerRow: string[], rows: SheetRow[], startRowNumber: number): StoredApprovalLogRecord[] {
  assertHeaderRow(headerRow)

  return rows
    .filter(row => row.some(cell => stringifyCell(cell).trim() !== ''))
    .map((row, index) => parseApprovalLogRow(row, startRowNumber + index))
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
  item: StoredApprovalLogRecord,
  filters: {
    approvalId?: string
    actorEmail?: string
    draftId?: string
  },
): boolean {
  if (filters.approvalId && item.approvalId !== filters.approvalId) {
    return false
  }

  if (filters.actorEmail && item.actorEmail !== filters.actorEmail.toLowerCase()) {
    return false
  }

  if (filters.draftId && item.draftId !== filters.draftId) {
    return false
  }

  return true
}

export async function listApprovalLogEntries(input: ListApprovalLogEntriesInput): Promise<ListApprovalLogEntriesResponse> {
  const parsedRange = parseColumnRange(input.range)
  if (!parsedRange) {
    throw new Error(`Unsupported approval log range: ${input.range}`)
  }

  const hasSheet = await hasTargetSheet(input.client, input.spreadsheetId, parsedRange.sheetTitle)
  if (!hasSheet) {
    return {
      items: [],
      limit: clampLimit(input.limit),
      matchedApprovalId: input.approvalId,
      matchedActorEmail: input.actorEmail,
      matchedDraftId: input.draftId,
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
      matchedApprovalId: input.approvalId,
      matchedActorEmail: input.actorEmail,
      matchedDraftId: input.draftId,
    }
  }

  const sheetRowCount = await getSheetRowCount(input.client, input.spreadsheetId, parsedRange.sheetTitle)
  if (!sheetRowCount || sheetRowCount < 2) {
    return {
      items: [],
      limit: clampLimit(input.limit),
      matchedApprovalId: input.approvalId,
      matchedActorEmail: input.actorEmail,
      matchedDraftId: input.draftId,
    }
  }

  const limit = clampLimit(input.limit)
  const filters = {
    approvalId: input.approvalId,
    actorEmail: input.actorEmail,
    draftId: input.draftId,
  }
  const items: StoredApprovalLogRecord[] = []
  let windowEnd = sheetRowCount
  let scannedWindows = 0

  while (windowEnd >= 2 && scannedWindows < MAX_APPROVAL_SCAN_WINDOWS && items.length < limit) {
    const windowStart = Math.max(2, windowEnd - RECENT_APPROVAL_SCAN_WINDOW + 1)
    const response = await input.client.values.get({
      spreadsheetId: input.spreadsheetId,
      range: buildRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, windowStart, windowEnd),
    })
    const parsedItems = parseApprovalLogDataRows(headerRow, response.values ?? [], windowStart)
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
    matchedApprovalId: input.approvalId,
    matchedActorEmail: input.actorEmail,
    matchedDraftId: input.draftId,
  }
}
