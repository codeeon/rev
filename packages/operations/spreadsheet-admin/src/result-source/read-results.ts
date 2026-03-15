import type { GoogleSheetsClient, SheetCell, SheetRow } from '@workspace/google-sheets/server'
import {
  RESULT_SHEET_HEADERS,
  validateAnalysisResultRecord,
  type AnalysisResultRecord,
  type BirthTimeKnowledge,
} from '../result-sink/result-schema'

const MAX_ADMIN_RESULTS_LIMIT = 100
const MIN_ADMIN_RESULTS_LIMIT = 1
const RECENT_RESULTS_SCAN_WINDOW = 200
const MAX_RESULTS_SCAN_WINDOWS = 5

export interface StoredAnalysisResultRecord extends AnalysisResultRecord {
  rowNumber: number
}

export interface ListAnalysisResultsInput {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  limit?: number
  sessionId?: string
  questionVersion?: string
  birthTimeKnowledge?: BirthTimeKnowledge
}

export interface ListAnalysisResultsResponse {
  items: StoredAnalysisResultRecord[]
  limit: number
  matchedSessionId?: string
  matchedQuestionVersion?: string
  matchedBirthTimeKnowledge?: BirthTimeKnowledge
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return MAX_ADMIN_RESULTS_LIMIT
  }

  return Math.min(MAX_ADMIN_RESULTS_LIMIT, Math.max(MIN_ADMIN_RESULTS_LIMIT, Math.trunc(limit as number)))
}

function stringifyCell(cell: SheetCell): string {
  if (cell === null || typeof cell === 'undefined') {
    return ''
  }

  return String(cell)
}

function parseJsonCell<T>(rawValue: string, fieldName: string): T {
  try {
    return JSON.parse(rawValue) as T
  } catch {
    throw new Error(`${fieldName} must be valid JSON`)
  }
}

function parseBirthTimeKnowledge(rawValue: string, fieldName: string): BirthTimeKnowledge {
  if (rawValue === 'known' || rawValue === 'unknown' || rawValue === 'approximate') {
    return rawValue
  }

  throw new Error(`${fieldName} must be one of: known, unknown, approximate`)
}

function assertHeaderRow(headerRow: string[]): void {
  const normalizedHeader = headerRow.slice(0, RESULT_SHEET_HEADERS.length)

  for (const [index, expected] of RESULT_SHEET_HEADERS.entries()) {
    if (normalizedHeader[index] !== expected) {
      throw new Error(`Result sheet header mismatch at column ${index + 1}: expected=${expected}, got=${normalizedHeader[index] ?? ''}`)
    }
  }
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

function parseResultRow(row: SheetRow, rowNumber: number): StoredAnalysisResultRecord {
  const values = row.map(stringifyCell)
  const [
    sessionId,
    timestamp,
    engineVersion,
    questionVersion,
    rawBirthTimeKnowledge,
    rawApproximateRange,
    rawSurveyAnswers,
    rawInferenceResult,
    rawMonitoring,
    rawFeedback,
  ] = values

  const record: StoredAnalysisResultRecord = {
    rowNumber,
    sessionId: sessionId?.trim() ?? '',
    timestamp: timestamp?.trim() ?? '',
    engineVersion: engineVersion?.trim() ?? '',
    questionVersion: questionVersion?.trim() ?? '',
    birthTimeKnowledge: parseBirthTimeKnowledge(rawBirthTimeKnowledge?.trim() ?? '', 'birthTimeKnowledge'),
    approximateRange: parseJsonCell<AnalysisResultRecord['approximateRange']>(rawApproximateRange || 'null', 'approximateRangeJson') ?? undefined,
    surveyAnswers: parseJsonCell<AnalysisResultRecord['surveyAnswers']>(rawSurveyAnswers || '[]', 'surveyAnswersJson'),
    inferenceResult: parseJsonCell<AnalysisResultRecord['inferenceResult']>(rawInferenceResult || '{}', 'inferenceResultJson'),
    monitoring: parseJsonCell<AnalysisResultRecord['monitoring']>(rawMonitoring || '{}', 'monitoringJson'),
    feedback: parseJsonCell<AnalysisResultRecord['feedback']>(rawFeedback || 'null', 'feedbackJson') ?? undefined,
  }

  validateAnalysisResultRecord(record)
  return record
}

function parseResultDataRows(headerRow: string[], rows: SheetRow[], startRowNumber: number): StoredAnalysisResultRecord[] {
  assertHeaderRow(headerRow)

  return rows
    .filter(row => row.some(cell => stringifyCell(cell).trim() !== ''))
    .map((row, index) => parseResultRow(row, startRowNumber + index))
}

function parseResultRows(rows: SheetRow[]): StoredAnalysisResultRecord[] {
  if (rows.length === 0) {
    return []
  }

  const [headerRow, ...dataRows] = rows
  return parseResultDataRows(headerRow.map(stringifyCell), dataRows, 2)
}

function matchesFilters(
  item: StoredAnalysisResultRecord,
  filters: {
    sessionId?: string
    questionVersion?: string
    birthTimeKnowledge?: BirthTimeKnowledge
  },
): boolean {
  if (filters.sessionId && item.sessionId !== filters.sessionId) {
    return false
  }

  if (filters.questionVersion && item.questionVersion !== filters.questionVersion) {
    return false
  }

  if (filters.birthTimeKnowledge && item.birthTimeKnowledge !== filters.birthTimeKnowledge) {
    return false
  }

  return true
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

async function listRecentAnalysisResults(input: {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  limit: number
  sessionId?: string
  questionVersion?: string
  birthTimeKnowledge?: BirthTimeKnowledge
}): Promise<ListAnalysisResultsResponse | null> {
  const parsedRange = parseColumnRange(input.range)
  if (!parsedRange) {
    return null
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
      limit: input.limit,
      matchedSessionId: input.sessionId,
      matchedQuestionVersion: input.questionVersion,
      matchedBirthTimeKnowledge: input.birthTimeKnowledge,
    }
  }

  const sheetRowCount = await getSheetRowCount(input.client, input.spreadsheetId, parsedRange.sheetTitle)
  if (!sheetRowCount || sheetRowCount < 2) {
    return {
      items: [],
      limit: input.limit,
      matchedSessionId: input.sessionId,
      matchedQuestionVersion: input.questionVersion,
      matchedBirthTimeKnowledge: input.birthTimeKnowledge,
    }
  }

  const filters = {
    sessionId: input.sessionId,
    questionVersion: input.questionVersion,
    birthTimeKnowledge: input.birthTimeKnowledge,
  }
  const items: StoredAnalysisResultRecord[] = []
  let windowEnd = sheetRowCount
  let scannedWindows = 0

  while (windowEnd >= 2 && scannedWindows < MAX_RESULTS_SCAN_WINDOWS && items.length < input.limit) {
    const windowStart = Math.max(2, windowEnd - RECENT_RESULTS_SCAN_WINDOW + 1)
    const response = await input.client.values.get({
      spreadsheetId: input.spreadsheetId,
      range: buildRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, windowStart, windowEnd),
    })
    const parsedItems = parseResultDataRows(headerRow, response.values ?? [], windowStart)
    for (let index = parsedItems.length - 1; index >= 0 && items.length < input.limit; index -= 1) {
      const item = parsedItems[index]
      if (item && matchesFilters(item, filters)) {
        items.push(item)
      }
    }

    windowEnd = windowStart - 1
    scannedWindows += 1
  }

  return {
    items,
    limit: input.limit,
    matchedSessionId: input.sessionId,
    matchedQuestionVersion: input.questionVersion,
    matchedBirthTimeKnowledge: input.birthTimeKnowledge,
  }
}

export async function listAnalysisResults(input: ListAnalysisResultsInput): Promise<ListAnalysisResultsResponse> {
  const limit = clampLimit(input.limit)
  const normalizedSessionId = input.sessionId?.trim() || undefined
  const normalizedQuestionVersion = input.questionVersion?.trim() || undefined
  const recentPayload = await listRecentAnalysisResults({
    client: input.client,
    spreadsheetId: input.spreadsheetId,
    range: input.range,
    limit,
    sessionId: normalizedSessionId,
    questionVersion: normalizedQuestionVersion,
    birthTimeKnowledge: input.birthTimeKnowledge,
  })
  if (!recentPayload) {
    throw new Error('results-range-must-use-column-span')
  }

  return recentPayload
}

export async function getAnalysisResultBySessionId(
  input: Omit<ListAnalysisResultsInput, 'limit'> & { sessionId: string },
): Promise<StoredAnalysisResultRecord | null> {
  const normalizedSessionId = input.sessionId.trim()
  const recentPayload = await listRecentAnalysisResults({
    client: input.client,
    spreadsheetId: input.spreadsheetId,
    range: input.range,
    limit: 1,
    sessionId: normalizedSessionId,
  })
  if (!recentPayload) {
    throw new Error('results-range-must-use-column-span')
  }

  return recentPayload.items[0] ?? null
}
