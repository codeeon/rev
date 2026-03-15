import type { GoogleSheetsClient, SheetCell, SheetRow } from '@workspace/google-sheets/server'
import {
  ADMIN_AUDIT_HEADERS,
  getAdminAuditActionFamily,
  type AdminAuditAction,
  type AdminAuditActionFamily,
  type AdminAuditRecord,
  type AdminAuditSubjectType,
} from '../audit-sink/admin-audit-schema'

const MAX_ADMIN_AUDIT_LIMIT = 200
const MIN_ADMIN_AUDIT_LIMIT = 1
const RECENT_AUDIT_SCAN_WINDOW = 200
const MAX_AUDIT_SCAN_WINDOWS = 5

export interface StoredAdminAuditRecord extends AdminAuditRecord {
  rowNumber: number
  actionFamily: AdminAuditActionFamily
}

export interface ListAdminAuditEventsInput {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  limit?: number
  actionFamily?: AdminAuditActionFamily
  action?: AdminAuditAction
  actorEmail?: string
  subjectType?: AdminAuditSubjectType
}

export interface ListAdminAuditEventsResponse {
  items: StoredAdminAuditRecord[]
  limit: number
  matchedActionFamily?: AdminAuditActionFamily
  matchedAction?: AdminAuditAction
  matchedActorEmail?: string
  matchedSubjectType?: AdminAuditSubjectType
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return MAX_ADMIN_AUDIT_LIMIT
  }

  return Math.min(MAX_ADMIN_AUDIT_LIMIT, Math.max(MIN_ADMIN_AUDIT_LIMIT, Math.trunc(limit as number)))
}

function stringifyCell(cell: SheetCell): string {
  if (cell === null || typeof cell === 'undefined') {
    return ''
  }

  return String(cell)
}

function parseMetadata(rawValue: string): Record<string, unknown> | undefined {
  if (!rawValue.trim()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }

    return parsed as Record<string, unknown>
  } catch {
    throw new Error('metadataJson must be valid JSON object')
  }
}

function assertHeaderRow(headerRow: string[]): void {
  const normalizedHeader = headerRow.slice(0, ADMIN_AUDIT_HEADERS.length)

  for (const [index, expected] of ADMIN_AUDIT_HEADERS.entries()) {
    if (normalizedHeader[index] !== expected) {
      throw new Error(`Admin audit sheet header mismatch at column ${index + 1}: expected=${expected}, got=${normalizedHeader[index] ?? ''}`)
    }
  }
}

function normalizeEmail(value: string): string | undefined {
  const trimmed = value.trim().toLowerCase()
  return trimmed || undefined
}

function parseAdminAuditRow(row: SheetRow, rowNumber: number): StoredAdminAuditRecord {
  const values = row.map(stringifyCell)
  const [eventId, at, rawAction, actorEmail, actorRole, rawSubjectType, subjectId, metadataJson] = values

  if (
    rawAction !== 'draft.create' &&
    rawAction !== 'draft.update' &&
    rawAction !== 'draft.status.update' &&
    rawAction !== 'draft.approval.requested' &&
    rawAction !== 'draft.approval.reviewed' &&
    rawAction !== 'draft.publish' &&
    rawAction !== 'draft.rollback' &&
    rawAction !== 'access.denied'
  ) {
    throw new Error(`Unsupported admin audit action: ${rawAction}`)
  }

  if (rawSubjectType !== 'draft' && rawSubjectType !== 'question' && rawSubjectType !== 'admin-route') {
    throw new Error(`Unsupported admin audit subjectType: ${rawSubjectType}`)
  }

  return {
    rowNumber,
    eventId: eventId.trim(),
    at: at.trim(),
    action: rawAction,
    actionFamily: getAdminAuditActionFamily(rawAction),
    actorEmail: normalizeEmail(actorEmail) ?? null,
    actorRole: actorRole.trim() || null,
    subjectType: rawSubjectType,
    subjectId: subjectId.trim(),
    metadata: parseMetadata(metadataJson),
  }
}

function parseAdminAuditDataRows(headerRow: string[], rows: SheetRow[], startRowNumber: number): StoredAdminAuditRecord[] {
  assertHeaderRow(headerRow)

  return rows
    .filter(row => row.some(cell => stringifyCell(cell).trim() !== ''))
    .map((row, index) => parseAdminAuditRow(row, startRowNumber + index))
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

async function getSheetRowCount(
  client: GoogleSheetsClient,
  spreadsheetId: string,
  sheetTitle: string,
): Promise<number | null> {
  const response = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title,sheets.properties.gridProperties.rowCount',
  })

  const matchingSheet = response.sheets?.find(sheet => sheet.properties?.title === sheetTitle)
  return matchingSheet?.properties?.gridProperties?.rowCount ?? null
}

function matchesFilters(
  item: StoredAdminAuditRecord,
  filters: {
    actionFamily?: AdminAuditActionFamily
    action?: AdminAuditAction
    actorEmail?: string
    subjectType?: AdminAuditSubjectType
  },
): boolean {
  if (filters.actionFamily && item.actionFamily !== filters.actionFamily) {
    return false
  }

  if (filters.action && item.action !== filters.action) {
    return false
  }

  if (filters.actorEmail && item.actorEmail !== filters.actorEmail.toLowerCase()) {
    return false
  }

  if (filters.subjectType && item.subjectType !== filters.subjectType) {
    return false
  }

  return true
}

export async function listAdminAuditEvents(input: ListAdminAuditEventsInput): Promise<ListAdminAuditEventsResponse> {
  const parsedRange = parseColumnRange(input.range)
  if (!parsedRange) {
    throw new Error(`Unsupported admin audit range: ${input.range}`)
  }

  const hasSheet = await hasTargetSheet(input.client, input.spreadsheetId, parsedRange.sheetTitle)
  if (!hasSheet) {
    return {
      items: [],
      limit: clampLimit(input.limit),
      matchedActionFamily: input.actionFamily,
      matchedAction: input.action,
      matchedActorEmail: input.actorEmail,
      matchedSubjectType: input.subjectType,
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
      matchedActionFamily: input.actionFamily,
      matchedAction: input.action,
      matchedActorEmail: input.actorEmail,
      matchedSubjectType: input.subjectType,
    }
  }

  const sheetRowCount = await getSheetRowCount(input.client, input.spreadsheetId, parsedRange.sheetTitle)
  if (!sheetRowCount || sheetRowCount < 2) {
    return {
      items: [],
      limit: clampLimit(input.limit),
      matchedActionFamily: input.actionFamily,
      matchedAction: input.action,
      matchedActorEmail: input.actorEmail,
      matchedSubjectType: input.subjectType,
    }
  }

  const filters = {
    actionFamily: input.actionFamily,
    action: input.action,
    actorEmail: input.actorEmail,
    subjectType: input.subjectType,
  }
  const limit = clampLimit(input.limit)
  const items: StoredAdminAuditRecord[] = []
  let windowEnd = sheetRowCount
  let scannedWindows = 0

  while (windowEnd >= 2 && scannedWindows < MAX_AUDIT_SCAN_WINDOWS && items.length < limit) {
    const windowStart = Math.max(2, windowEnd - RECENT_AUDIT_SCAN_WINDOW + 1)
    const response = await input.client.values.get({
      spreadsheetId: input.spreadsheetId,
      range: buildRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, windowStart, windowEnd),
    })
    const parsedItems = parseAdminAuditDataRows(headerRow, response.values ?? [], windowStart)
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
    matchedActionFamily: input.actionFamily,
    matchedAction: input.action,
    matchedActorEmail: input.actorEmail,
    matchedSubjectType: input.subjectType,
  }
}
