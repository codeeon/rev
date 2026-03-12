import type { GoogleSheetsClient, SheetCell, SheetRow } from '@workspace/google-sheets/server'
import {
  RESULT_SHEET_HEADERS,
  validateAnalysisResultRecord,
  type AnalysisResultRecord,
  type BirthTimeKnowledge,
} from '../result-sink/result-schema'

const MAX_ADMIN_RESULTS_LIMIT = 100
const MIN_ADMIN_RESULTS_LIMIT = 1

export interface StoredAnalysisResultRecord extends AnalysisResultRecord {
  rowNumber: number
}

export interface ListAnalysisResultsInput {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  limit?: number
  sessionId?: string
}

export interface ListAnalysisResultsResponse {
  items: StoredAnalysisResultRecord[]
  limit: number
  matchedSessionId?: string
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

function parseResultRows(rows: SheetRow[]): StoredAnalysisResultRecord[] {
  if (rows.length === 0) {
    return []
  }

  const [headerRow, ...dataRows] = rows
  assertHeaderRow(headerRow.map(stringifyCell))

  return dataRows
    .filter(row => row.some(cell => stringifyCell(cell).trim() !== ''))
    .map((row, index) => parseResultRow(row, index + 2))
}

export async function listAnalysisResults(input: ListAnalysisResultsInput): Promise<ListAnalysisResultsResponse> {
  const limit = clampLimit(input.limit)
  const response = await input.client.values.get({
    spreadsheetId: input.spreadsheetId,
    range: input.range,
  })
  const rows = response.values ?? []
  const parsed = parseResultRows(rows)
  const filtered = input.sessionId
    ? parsed.filter(item => item.sessionId === input.sessionId)
    : parsed

  return {
    items: filtered.reverse().slice(0, limit),
    limit,
    matchedSessionId: input.sessionId?.trim() || undefined,
  }
}

export async function getAnalysisResultBySessionId(
  input: Omit<ListAnalysisResultsInput, 'limit'> & { sessionId: string },
): Promise<StoredAnalysisResultRecord | null> {
  const response = await input.client.values.get({
    spreadsheetId: input.spreadsheetId,
    range: input.range,
  })
  const rows = response.values ?? []
  const parsed = parseResultRows(rows)
  const normalizedSessionId = input.sessionId.trim()

  return parsed.reverse().find(item => item.sessionId === normalizedSessionId) ?? null
}
