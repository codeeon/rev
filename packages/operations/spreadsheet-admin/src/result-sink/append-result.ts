import type { GoogleSheetsClient } from '@workspace/google-sheets'
import { toResultSheetRow, type AnalysisResultRecord } from './result-schema'

export interface AppendAnalysisResultOptions {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  record: AnalysisResultRecord
}

export async function appendAnalysisResult(options: AppendAnalysisResultOptions): Promise<void> {
  const row = toResultSheetRow(options.record)

  await options.client.values.append({
    spreadsheetId: options.spreadsheetId,
    range: options.range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    values: [row],
  })
}
