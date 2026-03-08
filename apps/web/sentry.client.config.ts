import { createBrowserConfig } from '@workspace/sentry/browser'
import * as Sentry from '@sentry/nextjs'

const sentryClientConfig = createBrowserConfig('web')
Sentry.init(sentryClientConfig)

export default sentryClientConfig
