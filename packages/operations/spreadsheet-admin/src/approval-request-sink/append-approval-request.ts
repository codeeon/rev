import type { GoogleSheetsClient } from '@workspace/google-sheets'
import {
  APPROVAL_REQUEST_HEADERS,
  toApprovalRequestSheetRow,
  type ApprovalRequestRecord,
} from './approval-request-schema'

export interface AppendApprovalRequestOptions {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  record: ApprovalRequestRecord
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

function stringifyCell(cell: string | number | boolean | null | undefined): string {
  if (cell === null || typeof cell === 'undefined') {
    return ''
  }

  return String(cell)
}

function assertHeaderRow(row: string[]): void {
  const normalizedHeader = row.slice(0, APPROVAL_REQUEST_HEADERS.length)
  for (const [index, expected] of APPROVAL_REQUEST_HEADERS.entries()) {
    if (normalizedHeader[index] !== expected) {
      throw new Error(
        `Approval request sheet header mismatch at column ${index + 1}: expected=${expected}, got=${normalizedHeader[index] ?? ''}`,
      )
    }
  }
}

async function ensureApprovalRequestSheetHeader(
  client: GoogleSheetsClient,
  spreadsheetId: string,
  parsedRange: { sheetName: string; sheetTitle: string; startColumn: string; endColumn: string },
): Promise<void> {
  const spreadsheet = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })
  const hasSheet = spreadsheet.sheets?.some(sheet => sheet.properties?.title === parsedRange.sheetTitle) ?? false
  if (!hasSheet) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requests: [
        {
          addSheet: {
            properties: {
              title: parsedRange.sheetTitle,
            },
          },
        },
      ],
    })
  }

  const headerRange = buildRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, 1, 1)
  const headerResponse = await client.values.get({
    spreadsheetId,
    range: headerRange,
  })
  const headerRow = headerResponse.values?.[0]?.map(stringifyCell) ?? []
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
        values: [APPROVAL_REQUEST_HEADERS.map(header => header)],
      },
    ],
  })
}

export async function appendApprovalRequest(options: AppendApprovalRequestOptions): Promise<void> {
  const parsedRange = parseColumnRange(options.range)
  if (!parsedRange) {
    throw new Error(`Unsupported approval request range: ${options.range}`)
  }

  await ensureApprovalRequestSheetHeader(options.client, options.spreadsheetId, parsedRange)
  const row = toApprovalRequestSheetRow(options.record)

  await options.client.values.append({
    spreadsheetId: options.spreadsheetId,
    range: options.range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    values: [row],
  })
}
