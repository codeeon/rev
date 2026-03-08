import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AppProvider } from '@/lib/store'
import { GaScript } from '@/components/analytics/ga-script'
import './globals.css'

export const metadata: Metadata = {
  title: '역사주 - 태어난 시간을 몰라도 사주를 알 수 있어요',
  description: 'AI가 당신의 삶의 패턴을 분석해 생시를 추론하고, 정확한 사주 분석을 제공합니다.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3182f6',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-sans antialiased">
        <GaScript />
        <AppProvider>
          <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
            {children}
          </main>
        </AppProvider>
        <Analytics />
      </body>
    </html>
  )
}
