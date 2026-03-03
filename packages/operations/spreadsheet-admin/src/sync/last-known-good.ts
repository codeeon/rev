import type { NormalizedQuestionSet } from '../question-source/normalize'

export interface LastKnownGoodStore {
  load(): Promise<NormalizedQuestionSet | null>
  save(payload: NormalizedQuestionSet): Promise<void>
}

export class InMemoryLastKnownGoodStore implements LastKnownGoodStore {
  private payload: NormalizedQuestionSet | null = null

  async load(): Promise<NormalizedQuestionSet | null> {
    return this.payload
  }

  async save(payload: NormalizedQuestionSet): Promise<void> {
    this.payload = payload
  }
}
