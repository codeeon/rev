import type { GoogleSheetsClient } from '@workspace/google-sheets'
import type { NormalizedQuestionSet } from '../question-source/normalize'
import {
  QUESTION_DRAFT_SHEET_HEADERS,
  toQuestionDraftSheetRow,
  type QuestionDraftSheetRow,
  type QuestionDraftStatus,
} from '../draft-source/draft-sheet-schema'

export interface CreateQuestionDraftSnapshotInput {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  questionSet: NormalizedQuestionSet
  draftId: string
  version: string
  sourceVersion: string
  status: QuestionDraftStatus
  changeSummary: string
  updatedBy: string
  updatedAt: string
}

function stringifyCells(row: Array<string | number | boolean | null | undefined>): string[] {
  return row.map(cell => (cell === null || typeof cell === 'undefined' ? '' : String(cell)))
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

function assertHeaderRow(row: string[]): void {
  const normalizedHeader = row.slice(0, QUESTION_DRAFT_SHEET_HEADERS.length)
  for (const [index, expected] of QUESTION_DRAFT_SHEET_HEADERS.entries()) {
    if (normalizedHeader[index] !== expected) {
      throw new Error(
        `Question draft sheet header mismatch at column ${index + 1}: expected=${expected}, got=${normalizedHeader[index] ?? ''}`,
      )
    }
  }
}

async function ensureDraftSheetExists(client: GoogleSheetsClient, spreadsheetId: string, sheetTitle: string): Promise<void> {
  const spreadsheet = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })
  const hasSheet = spreadsheet.sheets?.some(sheet => sheet.properties?.title === sheetTitle) ?? false
  if (hasSheet) {
    return
  }

  await client.spreadsheets.batchUpdate({
    spreadsheetId,
    requests: [
      {
        addSheet: {
          properties: {
            title: sheetTitle,
          },
        },
      },
    ],
  })
}

async function ensureDraftSheetHeader(
  client: GoogleSheetsClient,
  spreadsheetId: string,
  parsedRange: { sheetName: string; sheetTitle: string; startColumn: string; endColumn: string },
): Promise<void> {
  await ensureDraftSheetExists(client, spreadsheetId, parsedRange.sheetTitle)

  const headerRange = buildRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, 1, 1)
  const response = await client.values.get({
    spreadsheetId,
    range: headerRange,
  })
  const headerRow = stringifyCells(response.values?.[0] ?? [])
  if (headerRow.length > 0) {
    assertHeaderRow(headerRow)
    return
  }

  await client.values.batchUpdate({
    spreadsheetId,
    valueInputOption: 'RAW',
    data: [
      {
        range: headerRange,
        values: [QUESTION_DRAFT_SHEET_HEADERS.map(header => header)],
      },
    ],
  })
}

function toDraftRows(input: CreateQuestionDraftSnapshotInput): QuestionDraftSheetRow[] {
  const rows: QuestionDraftSheetRow[] = []

  for (const question of input.questionSet.questions) {
    question.options.forEach((option, optionIndex) => {
      rows.push({
        draftId: input.draftId,
        version: input.version,
        sourceVersion: input.sourceVersion,
        status: input.status,
        questionId: question.id,
        structureRole: question.structure_role,
        category: question.category,
        questionWeight: question.question_weight,
        questionText: question.text,
        optionIndex,
        optionText: option.text,
        scoreMap: option.score_map,
        isActive: true,
        changeSummary: input.changeSummary,
        updatedBy: input.updatedBy,
        updatedAt: input.updatedAt,
      })
    })
  }

  return rows
}

export async function createQuestionDraftSnapshot(input: CreateQuestionDraftSnapshotInput): Promise<{ appendedRowCount: number }> {
  const parsedRange = parseColumnRange(input.range)
  if (!parsedRange) {
    throw new Error(`Unsupported question draft range: ${input.range}`)
  }

  await ensureDraftSheetHeader(input.client, input.spreadsheetId, parsedRange)

  const rows = toDraftRows(input).map(row => toQuestionDraftSheetRow(row))
  await input.client.values.append({
    spreadsheetId: input.spreadsheetId,
    range: input.range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    values: rows,
  })

  return {
    appendedRowCount: rows.length,
  }
}
