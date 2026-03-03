import { GoogleSheetsConfigError } from '../errors'
import type { GoogleSheetsTransport } from '../transport/types'

export interface BatchUpdateSpreadsheetInput {
  spreadsheetId: string
  requests: Array<Record<string, unknown>>
  includeSpreadsheetInResponse?: boolean
  responseRanges?: string[]
}

export interface BatchUpdateSpreadsheetResponse {
  spreadsheetId?: string
  replies?: Array<Record<string, unknown>>
}

export interface SpreadsheetsResource {
  batchUpdate(input: BatchUpdateSpreadsheetInput): Promise<BatchUpdateSpreadsheetResponse>
}

function assertRequired(value: string, key: string): void {
  if (!value.trim()) {
    throw new GoogleSheetsConfigError(`${key} is required`)
  }
}

export function createSpreadsheetsResource(transport: GoogleSheetsTransport): SpreadsheetsResource {
  return {
    async batchUpdate(input) {
      assertRequired(input.spreadsheetId, 'spreadsheetId')
      if (input.requests.length === 0) {
        throw new GoogleSheetsConfigError('requests must include at least one update')
      }

      return transport.request<BatchUpdateSpreadsheetResponse>({
        method: 'POST',
        path: `/spreadsheets/${input.spreadsheetId}:batchUpdate`,
        body: {
          requests: input.requests,
          includeSpreadsheetInResponse: input.includeSpreadsheetInResponse,
          responseRanges: input.responseRanges,
        },
      })
    },
  }
}
