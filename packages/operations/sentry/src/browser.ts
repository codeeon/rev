import { resolveSentryBaseConfig, type SentryBaseConfig } from './types'

export interface SentryBrowserConfig extends SentryBaseConfig {}

export function createBrowserConfig(service: string): SentryBrowserConfig {
  return {
    ...resolveSentryBaseConfig(service),
  }
}
