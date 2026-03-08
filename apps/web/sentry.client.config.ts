import { createBrowserConfig } from '@workspace/sentry/browser'
import * as Sentry from '@sentry/nextjs'

const sentryClientConfig = createBrowserConfig('web')
const replayIntegration = getReplayIntegration()

Sentry.init({
  ...sentryClientConfig,
  integrations: (defaultIntegrations) => {
    if (!(shouldEnableReplay(sentryClientConfig) && replayIntegration)) {
      return defaultIntegrations
    }

    return [...defaultIntegrations, replayIntegration] as typeof defaultIntegrations
  },
})

export default sentryClientConfig

function shouldEnableReplay(config: typeof sentryClientConfig): boolean {
  return Boolean(config.replaysSessionSampleRate || config.replaysOnErrorSampleRate)
}

function getReplayIntegration(): unknown | null {
  const replayFactory = (Sentry as typeof Sentry & { replayIntegration?: () => unknown }).replayIntegration
  if (!replayFactory) {
    return null
  }

  return replayFactory()
}
