import { GoogleSheetsConfigError } from '../errors'
import type { GoogleSheetsTransport } from '../transport/types'

export interface BatchUpdateSpreadsheetInput {
  spreadsheetId: string
  requests: Array<Record<string, unknown>>
  includeSpreadsheetInResponse?: boolean
  responseRanges?: string[]
}

export interface GetSpreadsheetInput {
  spreadsheetId: string
  ranges?: string[]
  includeGridData?: boolean
  fields?: string
}

export interface SpreadsheetGridProperties {
  rowCount?: number
  columnCount?: number
}

export interface SpreadsheetSheetProperties {
  title?: string
  gridProperties?: SpreadsheetGridProperties
}

export interface SpreadsheetSheet {
  properties?: SpreadsheetSheetProperties
}

export interface GetSpreadsheetResponse {
  spreadsheetId?: string
  sheets?: SpreadsheetSheet[]
}

export interface BatchUpdateSpreadsheetResponse {
  spreadsheetId?: string
  replies?: Array<Record<string, unknown>>
}

export interface SpreadsheetsResource {
  get(input: GetSpreadsheetInput): Promise<GetSpreadsheetResponse>
  batchUpdate(input: BatchUpdateSpreadsheetInput): Promise<BatchUpdateSpreadsheetResponse>
}

function assertRequired(value: string, key: string): void {
  if (!value.trim()) {
    throw new GoogleSheetsConfigError(`${key} is required`)
  }
}

export function createSpreadsheetsResource(transport: GoogleSheetsTransport): SpreadsheetsResource {
  return {
    async get(input) {
      assertRequired(input.spreadsheetId, 'spreadsheetId')

      return transport.request<GetSpreadsheetResponse>({
        method: 'GET',
        path: `/spreadsheets/${input.spreadsheetId}`,
        query: {
          ranges: input.ranges,
          includeGridData: input.includeGridData,
          fields: input.fields,
        },
      })
    },

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
