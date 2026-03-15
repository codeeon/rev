'use client'

import Script from 'next/script'
import { buildGaScriptTags } from '@workspace/ga'

export interface GaScriptTags {
  src: string
  initScript: string
}

type GaRuntimeEnv = Record<string, string | undefined> & {
  NEXT_PUBLIC_GA_MEASUREMENT_ID?: string
}

export function resolveGaScriptTags(env: GaRuntimeEnv = process.env): GaScriptTags | null {
  const measurementId = env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()
  if (!measurementId) {
    return null
  }

  return buildGaScriptTags(measurementId)
}

export function GaScript() {
  const tags = resolveGaScriptTags()
  if (!tags) {
    return null
  }

  const { src, initScript } = tags

  return (
    <>
      <Script src={src} strategy="afterInteractive" />
      <Script id="ga-init" strategy="beforeInteractive">
        {initScript}
      </Script>
    </>
  )
}
