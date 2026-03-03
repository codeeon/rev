import type { NormalizedQuestionSet } from '../question-source/normalize'
import type { LastKnownGoodStore } from './last-known-good'

export interface SyncQuestionSetWithFallbackOptions {
  loadLatest: () => Promise<NormalizedQuestionSet>
  store: LastKnownGoodStore
}

export interface SyncQuestionSetWithFallbackResult {
  questionSet: NormalizedQuestionSet
  source: 'latest' | 'last-known-good'
  usedFallback: boolean
}

export async function syncQuestionSetWithFallback(
  options: SyncQuestionSetWithFallbackOptions,
): Promise<SyncQuestionSetWithFallbackResult> {
  try {
    const latest = await options.loadLatest()
    await options.store.save(latest)
    return {
      questionSet: latest,
      source: 'latest',
      usedFallback: false,
    }
  } catch (error) {
    const fallback = await options.store.load()
    if (!fallback) {
      throw error
    }

    return {
      questionSet: fallback,
      source: 'last-known-good',
      usedFallback: true,
    }
  }
}
