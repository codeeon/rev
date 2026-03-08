import { resolveSentryBaseConfig, type SentryBaseConfig } from './types'

export interface SentryEdgeConfig extends SentryBaseConfig {}

export function createEdgeConfig(service: string): SentryEdgeConfig {
  return {
    ...resolveSentryBaseConfig(service),
  }
}
