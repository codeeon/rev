import { createServerConfig } from '@workspace/sentry/server'
import * as Sentry from '@sentry/nextjs'

const sentryServerConfig = createServerConfig('web')
Sentry.init(sentryServerConfig)

export default sentryServerConfig
