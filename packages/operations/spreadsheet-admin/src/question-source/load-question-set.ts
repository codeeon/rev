import type { GoogleSheetsClient, SheetCell, SheetRow } from '@workspace/google-sheets'
import { ADMIN_SHEET_HEADERS, type AdminSheetHeader, type AdminSheetRowInput, parseAdminSheetRow } from './admin-sheet-schema'
import { normalizeAdminSheetRows, type NormalizedQuestionSet } from './normalize'

export interface LoadQuestionSetFromSheetOptions {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
}

function toCellString(value: SheetCell | undefined): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function createHeaderIndex(headerRow: SheetRow): Map<AdminSheetHeader, number> {
  const headerIndex = new Map<AdminSheetHeader, number>()
  for (let index = 0; index < headerRow.length; index += 1) {
    const cell = toCellString(headerRow[index])
    if (!cell) {
      continue
    }

    if (ADMIN_SHEET_HEADERS.includes(cell as AdminSheetHeader)) {
      headerIndex.set(cell as AdminSheetHeader, index)
    }
  }
  return headerIndex
}

function assertRequiredHeaders(headerIndex: Map<AdminSheetHeader, number>): void {
  const missingHeaders = ADMIN_SHEET_HEADERS.filter(header => !headerIndex.has(header))
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`)
  }
}

function toAdminSheetRowInput(headerIndex: Map<AdminSheetHeader, number>, row: SheetRow): AdminSheetRowInput {
  const get = (header: AdminSheetHeader): string => {
    const index = headerIndex.get(header)
    if (typeof index !== 'number') {
      return ''
    }
    return toCellString(row[index])
  }

  return {
    version: get('version'),
    questionId: get('questionId'),
    structureRole: get('structureRole'),
    category: get('category'),
    questionWeight: get('questionWeight'),
    questionText: get('questionText'),
    optionIndex: get('optionIndex'),
    optionText: get('optionText'),
    scoreMapJson: get('scoreMapJson'),
    isActive: get('isActive'),
    updatedAt: get('updatedAt'),
  }
}

function isEmptyRow(row: SheetRow): boolean {
  return row.every(cell => toCellString(cell) === '')
}

export async function loadQuestionSetFromSheet(options: LoadQuestionSetFromSheetOptions): Promise<NormalizedQuestionSet> {
  const response = await options.client.values.get({
    spreadsheetId: options.spreadsheetId,
    range: options.range,
  })

  const values = response.values ?? []
  if (values.length < 2) {
    throw new Error('Question sheet does not contain header + data rows')
  }

  const [headerRow, ...dataRows] = values
  const headerIndex = createHeaderIndex(headerRow)
  assertRequiredHeaders(headerIndex)

  const parsedRows = dataRows
    .filter(row => !isEmptyRow(row))
    .map((row, rowIndex) => parseAdminSheetRow(toAdminSheetRowInput(headerIndex, row), rowIndex + 2))

  return normalizeAdminSheetRows(parsedRows)
}
