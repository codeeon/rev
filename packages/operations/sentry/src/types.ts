import { resolveObservabilityContext, type PublicRuntimeEnv } from './runtime-env'

export interface SentryBaseConfig {
  dsn?: string
  enabled: boolean
  environment: 'development' | 'staging' | 'production'
  release?: string
  tracesSampleRate: number
  replaysSessionSampleRate?: number
  replaysOnErrorSampleRate?: number
}

function readNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

export function resolveSentryBaseConfig(service: string, env: PublicRuntimeEnv = process.env): SentryBaseConfig {
  const context = resolveObservabilityContext(service, env)
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN?.trim()

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: context.environment,
    release: context.release,
    tracesSampleRate: readNumber(process.env.SENTRY_TRACES_SAMPLE_RATE, context.environment === 'production' ? 0.2 : 1),
    replaysSessionSampleRate: readNumber(process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE, context.environment === 'production' ? 0.01 : 0),
    replaysOnErrorSampleRate: readNumber(process.env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 1),
  }
}
