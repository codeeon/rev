'use client'

import { trackEvent, trackPageView, type GaEvent } from '@workspace/ga'

export type FunnelEventName =
  | 'start_analysis'
  | 'submit_birth_info'
  | 'select_birth_time_knowledge'
  | 'submit_known_time'
  | 'submit_approximate_time'
  | 'complete_survey'
  | 'analysis_success'
  | 'analysis_failure'
  | 'view_result'
  | 'submit_feedback'

export function trackFunnelEvent(action: FunnelEventName, payload: Omit<GaEvent, 'action'> = {}): void {
  try {
    const commonParams = getCommonEventParams()

    trackEvent({
      action,
      category: 'funnel',
      ...commonParams,
      ...payload,
    })
  } catch {
    // Never let analytics block the user flow.
  }
}

export function trackPage(path: string, title?: string): void {
  try {
    trackPageView({
      page_path: path,
      page_title: title,
      page_location: typeof window !== 'undefined' ? window.location.href : undefined,
    })
  } catch {
    // Never let analytics block the user flow.
  }
}

const SESSION_KEY = 'rev_analytics_session_id'

function getCommonEventParams(): Omit<GaEvent, 'action'> {
  return {
    session_id: getSessionId(),
    app_env: process.env.NEXT_PUBLIC_APP_ENV ?? 'development',
    app_release: process.env.NEXT_PUBLIC_APP_RELEASE ?? 'unknown',
    page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
  }
}

function getSessionId(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const stored = window.localStorage.getItem(SESSION_KEY)
    if (stored) {
      return stored
    }

    const created =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `session-${Date.now()}`
    window.localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return undefined
  }
}
