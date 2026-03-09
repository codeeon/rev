import { requirePublicEnv, resolveObservabilityContext, type PublicRuntimeEnv } from './runtime-env'

export interface GaPageView {
  page_path: string
  page_title?: string
  page_location?: string
}

export interface GaEvent {
  action: string
  category?: string
  label?: string
  value?: number
  [key: string]: string | number | undefined
}

interface WindowWithGtag extends Window {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

function getWindow(): WindowWithGtag | null {
  if (typeof window === 'undefined') return null
  return window as WindowWithGtag
}

export function getGaMeasurementId(env: PublicRuntimeEnv = process.env): string {
  return requirePublicEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', env)
}

export function buildGaScriptTags(measurementId: string): { src: string; initScript: string } {
  return {
    src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
    initScript: [
      'window.dataLayer = window.dataLayer || [];',
      'function gtag(){dataLayer.push(arguments);}',
      'gtag("js", new Date());',
      `gtag("config", "${measurementId}", { send_page_view: false });`,
    ].join('\n'),
  }
}

export function trackPageView(pageView: GaPageView): void {
  const win = getWindow()
  if (!win) return

  invokeGtag(win, 'event', 'page_view', pageView)
}

export function trackEvent(event: GaEvent): void {
  const win = getWindow()
  if (!win) return

  const payload = {
    event_category: event.category,
    event_label: event.label,
    value: event.value,
    ...event,
  }

  invokeGtag(win, 'event', event.action, payload)
}

export function createGaMeta(service: string, env: PublicRuntimeEnv = process.env): Record<string, string> {
  const context = resolveObservabilityContext(service, env)
  return {
    service: context.service,
    environment: context.environment,
    release: context.release ?? 'unknown',
  }
}

function invokeGtag(win: WindowWithGtag, ...args: unknown[]): void {
  if (win.gtag) {
    win.gtag(...args)
    return
  }

  win.dataLayer = win.dataLayer ?? []
  win.dataLayer.push(args)
}
