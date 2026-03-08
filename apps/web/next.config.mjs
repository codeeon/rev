import path from 'node:path'
import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@workspace/base-ui'],
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  images: {
    unoptimized: true,
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  sourcemaps: {
    disable: true,
  },
})
