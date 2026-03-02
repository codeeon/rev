import assert from 'node:assert/strict'
import test from 'node:test'

import type { AnalysisResult } from '@workspace/saju-core'
import { initialState, reducer } from './store'

const FIRST_ANALYSIS_RESULT: AnalysisResult = {
  sections: [{ title: 'first', content: 'first content' }],
  summary: 'first summary',
  rawText: 'first raw text',
}

test('stale analysis is cleared before a second run and not restored on failure', () => {
  let state = initialState

  state = reducer(state, { type: 'SET_ANALYSIS_RESULT', payload: FIRST_ANALYSIS_RESULT })
  state = reducer(state, { type: 'APPEND_ANALYSIS_TEXT', payload: FIRST_ANALYSIS_RESULT.rawText })

  assert.equal(state.analysisResult?.rawText, 'first raw text')
  assert.equal(state.analysisText, 'first raw text')

  state = reducer(state, { type: 'SET_ANALYZING', payload: true })
  assert.equal(state.analysisResult, null)
  assert.equal(state.analysisText, '')

  state = reducer(state, { type: 'SET_ANALYZING', payload: false })
  assert.equal(state.analysisResult, null)
  assert.equal(state.analysisText, '')
})
