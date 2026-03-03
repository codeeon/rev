import { GoogleSheetsConfigError } from '../errors'
import type { GoogleSheetsTransport } from '../transport/types'

export type MajorDimension = 'ROWS' | 'COLUMNS'
export type ValueInputOption = 'RAW' | 'USER_ENTERED'

export type SheetCell = string | number | boolean | null
export type SheetRow = SheetCell[]

export interface ValueRange {
  range?: string
  majorDimension?: MajorDimension
  values?: SheetRow[]
}

export interface BatchGetValuesResponse {
  spreadsheetId?: string
  valueRanges?: ValueRange[]
}

export interface BatchUpdateValueRange {
  range: string
  majorDimension?: MajorDimension
  values: SheetRow[]
}

export interface BatchUpdateValuesResponse {
  spreadsheetId?: string
  totalUpdatedRows?: number
  totalUpdatedColumns?: number
  totalUpdatedCells?: number
  totalUpdatedSheets?: number
}

export interface AppendValuesResponse {
  spreadsheetId?: string
  tableRange?: string
  updates?: {
    spreadsheetId?: string
    updatedRange?: string
    updatedRows?: number
    updatedColumns?: number
    updatedCells?: number
  }
}

export interface GetValuesInput {
  spreadsheetId: string
  range: string
  majorDimension?: MajorDimension
  valueRenderOption?: string
  dateTimeRenderOption?: string
}

export interface BatchGetValuesInput {
  spreadsheetId: string
  ranges: string[]
  majorDimension?: MajorDimension
  valueRenderOption?: string
  dateTimeRenderOption?: string
}

export interface BatchUpdateValuesInput {
  spreadsheetId: string
  valueInputOption: ValueInputOption
  data: BatchUpdateValueRange[]
  includeValuesInResponse?: boolean
}

export interface AppendValuesInput {
  spreadsheetId: string
  range: string
  values: SheetRow[]
  valueInputOption: ValueInputOption
  insertDataOption?: 'INSERT_ROWS' | 'OVERWRITE'
  includeValuesInResponse?: boolean
}

function assertRequired(value: string, key: string): void {
  if (!value.trim()) {
    throw new GoogleSheetsConfigError(`${key} is required`)
  }
}

function encodeRange(range: string): string {
  return encodeURIComponent(range)
}

export interface ValuesResource {
  get(input: GetValuesInput): Promise<ValueRange>
  batchGet(input: BatchGetValuesInput): Promise<BatchGetValuesResponse>
  batchUpdate(input: BatchUpdateValuesInput): Promise<BatchUpdateValuesResponse>
  append(input: AppendValuesInput): Promise<AppendValuesResponse>
}

export function createValuesResource(transport: GoogleSheetsTransport): ValuesResource {
  return {
    async get(input) {
      assertRequired(input.spreadsheetId, 'spreadsheetId')
      assertRequired(input.range, 'range')

      return transport.request<ValueRange>({
        method: 'GET',
        path: `/spreadsheets/${input.spreadsheetId}/values/${encodeRange(input.range)}`,
        query: {
          majorDimension: input.majorDimension,
          valueRenderOption: input.valueRenderOption,
          dateTimeRenderOption: input.dateTimeRenderOption,
        },
      })
    },

    async batchGet(input) {
      assertRequired(input.spreadsheetId, 'spreadsheetId')
      if (input.ranges.length === 0) {
        throw new GoogleSheetsConfigError('ranges must include at least one range')
      }

      return transport.request<BatchGetValuesResponse>({
        method: 'GET',
        path: `/spreadsheets/${input.spreadsheetId}/values:batchGet`,
        query: {
          ranges: input.ranges,
          majorDimension: input.majorDimension,
          valueRenderOption: input.valueRenderOption,
          dateTimeRenderOption: input.dateTimeRenderOption,
        },
      })
    },

    async batchUpdate(input) {
      assertRequired(input.spreadsheetId, 'spreadsheetId')
      if (input.data.length === 0) {
        throw new GoogleSheetsConfigError('data must include at least one value range')
      }

      return transport.request<BatchUpdateValuesResponse>({
        method: 'POST',
        path: `/spreadsheets/${input.spreadsheetId}/values:batchUpdate`,
        body: {
          valueInputOption: input.valueInputOption,
          includeValuesInResponse: input.includeValuesInResponse,
          data: input.data,
        },
      })
    },

    async append(input) {
      assertRequired(input.spreadsheetId, 'spreadsheetId')
      assertRequired(input.range, 'range')

      return transport.request<AppendValuesResponse>({
        method: 'POST',
        path: `/spreadsheets/${input.spreadsheetId}/values/${encodeRange(input.range)}:append`,
        query: {
          valueInputOption: input.valueInputOption,
          insertDataOption: input.insertDataOption,
          includeValuesInResponse: input.includeValuesInResponse,
        },
        body: {
          majorDimension: 'ROWS',
          values: input.values,
        },
      })
    },
  }
}
