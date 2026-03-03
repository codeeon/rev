import { createGoogleApisTransport } from './transport/googleapis-transport'
import type { CreateGoogleApisTransportOptions, GoogleSheetsTransport } from './transport/types'
import { createSpreadsheetsResource, type SpreadsheetsResource } from './resources/spreadsheets'
import { createValuesResource, type ValuesResource } from './resources/values'
import { GoogleSheetsConfigError } from './errors'

export * from './auth/types'
export * from './auth/oauth-user'
export * from './auth/service-account'
export * from './errors'
export * from './transport/types'
export * from './transport/retry'
export * from './resources/values'
export * from './resources/spreadsheets'

export interface GoogleSheetsClient {
  values: ValuesResource
  spreadsheets: SpreadsheetsResource
}

export interface CreateGoogleSheetsClientOptions extends Omit<CreateGoogleApisTransportOptions, 'tokenProvider'> {
  tokenProvider?: CreateGoogleApisTransportOptions['tokenProvider']
  transport?: GoogleSheetsTransport
}

export function createSheetsClient(options: CreateGoogleSheetsClientOptions): GoogleSheetsClient {
  const transport = options.transport
    ? options.transport
    : (() => {
        if (!options.tokenProvider) {
          throw new GoogleSheetsConfigError('tokenProvider is required when transport is not provided')
        }

        return createGoogleApisTransport({
          tokenProvider: options.tokenProvider,
          fetchFn: options.fetchFn,
          baseUrl: options.baseUrl,
          retryPolicy: options.retryPolicy,
          defaultTimeoutMs: options.defaultTimeoutMs,
          userAgent: options.userAgent,
        })
      })()

  return {
    values: createValuesResource(transport),
    spreadsheets: createSpreadsheetsResource(transport),
  }
}
