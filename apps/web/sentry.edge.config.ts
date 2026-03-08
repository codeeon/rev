import { createEdgeConfig } from '@workspace/sentry/edge'
import * as Sentry from '@sentry/nextjs'

const sentryEdgeConfig = createEdgeConfig('web')
Sentry.init(sentryEdgeConfig)

export default sentryEdgeConfig
