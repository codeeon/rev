'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import './globals.css'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ko">
      <head>
        <title>문제가 발생했습니다</title>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-sans antialiased">
        <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-[0.18em] text-red-600 uppercase">Application Error</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">페이지를 표시하지 못했습니다.</h1>
            <p className="text-sm leading-6 text-slate-600">
              일시적인 문제일 수 있습니다. 잠시 후 다시 시도해주세요.
            </p>
            {error.digest ? (
              <p className="text-xs tracking-[0.08em] text-slate-400">오류 식별자 {error.digest}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-[#3182f6] px-6 text-base font-semibold text-white transition hover:bg-[#1f6be0]"
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  )
}
