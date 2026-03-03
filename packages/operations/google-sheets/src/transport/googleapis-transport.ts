import { GoogleSheetsHttpError } from '../errors'
import { withRetry } from './retry'
import type { CreateGoogleApisTransportOptions, GoogleSheetsRequest, GoogleSheetsTransport, QueryParams, QueryValue } from './types'

const DEFAULT_BASE_URL = 'https://sheets.googleapis.com/v4'
const DEFAULT_TIMEOUT_MS = 15_000

function appendQueryParam(params: URLSearchParams, key: string, value: QueryValue | QueryValue[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      params.append(key, String(item))
    }
    return
  }

  params.append(key, String(value))
}

function buildRequestUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${baseUrl}${normalizedPath}`)

  if (!query) {
    return url.toString()
  }

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'undefined') {
      continue
    }
    appendQueryParam(url.searchParams, key, value)
  }

  return url.toString()
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function toGoogleSheetsHttpError(response: Response, method: string, url: string): Promise<GoogleSheetsHttpError> {
  const payload = await parseResponsePayload(response)
  return new GoogleSheetsHttpError(response.status, `Google Sheets API request failed: ${method} ${url}`, payload)
}

export function createGoogleApisTransport(options: CreateGoogleApisTransportOptions): GoogleSheetsTransport {
  const fetchFn = options.fetchFn ?? fetch
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async request<T>(request: GoogleSheetsRequest): Promise<T> {
      return withRetry(async () => {
        const token = await options.tokenProvider.getAccessToken()
        const url = buildRequestUrl(baseUrl, request.path, request.query)
        const timeoutMs = request.timeoutMs ?? defaultTimeoutMs

        const abortController = new AbortController()
        const timeout = setTimeout(() => abortController.abort(), timeoutMs)

        try {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${token.token}`,
            Accept: 'application/json',
            ...request.headers,
          }

          if (options.userAgent) {
            headers['User-Agent'] = options.userAgent
          }

          const body =
            typeof request.body === 'undefined'
              ? undefined
              : typeof request.body === 'string'
                ? request.body
                : JSON.stringify(request.body)

          if (typeof request.body !== 'undefined' && typeof request.body !== 'string') {
            headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
          }

          const response = await fetchFn(url, {
            method: request.method,
            headers,
            body,
            signal: abortController.signal,
          })

          if (!response.ok) {
            throw await toGoogleSheetsHttpError(response, request.method, url)
          }

          if (response.status === 204) {
            return undefined as T
          }

          const payload = await parseResponsePayload(response)
          return payload as T
        } finally {
          clearTimeout(timeout)
        }
      }, options.retryPolicy)
    },
  }
}
