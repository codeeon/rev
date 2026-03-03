import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryLastKnownGoodStore } from './last-known-good'
import { syncQuestionSetWithFallback } from './sync-from-sheet'

const QUESTION_SET = {
  version: '2026.03.03',
  generatedAt: '2026-03-03T00:00:00.000Z',
  questions: [
    {
      id: 'Q1',
      structure_role: 'noise_reduction' as const,
      category: 'Warm-up',
      question_weight: 1,
      text: '질문',
      options: [{ text: '옵션', score_map: { 자시: 1 } }],
    },
  ],
}

test('sync stores latest question set when fetch succeeds', async () => {
  const store = new InMemoryLastKnownGoodStore()

  const result = await syncQuestionSetWithFallback({
    store,
    loadLatest: async () => QUESTION_SET,
  })

  assert.equal(result.source, 'latest')
  assert.equal(result.usedFallback, false)
  const stored = await store.load()
  assert.ok(stored)
  assert.equal(stored?.version, QUESTION_SET.version)
})

test('sync returns fallback when latest load fails', async () => {
  const store = new InMemoryLastKnownGoodStore()
  await store.save(QUESTION_SET)

  const result = await syncQuestionSetWithFallback({
    store,
    loadLatest: async () => {
      throw new Error('network failed')
    },
  })

  assert.equal(result.source, 'last-known-good')
  assert.equal(result.usedFallback, true)
  assert.equal(result.questionSet.version, QUESTION_SET.version)
})

test('sync throws when latest load fails and no fallback exists', async () => {
  const store = new InMemoryLastKnownGoodStore()

  await assert.rejects(
    syncQuestionSetWithFallback({
      store,
      loadLatest: async () => {
        throw new Error('network failed')
      },
    }),
    /network failed/,
  )
})
