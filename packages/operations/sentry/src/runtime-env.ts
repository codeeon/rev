export interface ObservabilityContext {
  service: string
  environment: 'development' | 'staging' | 'production'
  release?: string
}

export type PublicRuntimeEnv = Record<string, string | undefined> & {
  NEXT_PUBLIC_SENTRY_DSN?: string
  NEXT_PUBLIC_APP_ENV?: string
  NEXT_PUBLIC_APP_RELEASE?: string
}

function normalizeEnvironment(raw: string | undefined): ObservabilityContext['environment'] {
  const value = raw?.toLowerCase().trim()
  if (value === 'production') return 'production'
  if (value === 'staging') return 'staging'
  return 'development'
}

function readNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function resolveObservabilityContext(service: string, env: PublicRuntimeEnv): ObservabilityContext {
  return {
    service,
    environment: normalizeEnvironment(env.NEXT_PUBLIC_APP_ENV),
    release: readNonEmpty(env.NEXT_PUBLIC_APP_RELEASE),
  }
}
