import type { TokenProvider } from '../auth/types'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type QueryValue = string | number | boolean

export type QueryParams = Record<string, QueryValue | QueryValue[] | undefined>

export interface GoogleSheetsRequest {
  method: HttpMethod
  path: string
  query?: QueryParams
  body?: unknown
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface GoogleSheetsTransport {
  request<T>(request: GoogleSheetsRequest): Promise<T>
}

export interface RetryPolicy {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterRatio: number
  retryableStatusCodes: number[]
}

export interface CreateGoogleApisTransportOptions {
  tokenProvider: TokenProvider
  fetchFn?: typeof fetch
  baseUrl?: string
  retryPolicy?: Partial<RetryPolicy>
  defaultTimeoutMs?: number
  userAgent?: string
}
