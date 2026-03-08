'use client'

import Script from 'next/script'
import { buildGaScriptTags, getGaMeasurementId } from '@workspace/ga'

export function GaScript() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()
  if (!measurementId) {
    return null
  }

  const { src, initScript } = buildGaScriptTags(getGaMeasurementId(process.env))

  return (
    <>
      <Script src={src} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {initScript}
      </Script>
    </>
  )
}
