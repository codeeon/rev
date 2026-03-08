import { resolveSentryBaseConfig, type SentryBaseConfig } from './types'

export interface SentryServerConfig extends SentryBaseConfig {
  attachStacktrace?: boolean
}

export function createServerConfig(service: string): SentryServerConfig {
  return {
    ...resolveSentryBaseConfig(service),
    attachStacktrace: true,
  }
}
