import test from 'node:test'
import assert from 'node:assert/strict'

import { inferZishi, toInferredHourPillar } from './weight-engine'
import type { SurveyAnswer } from './types'

// Doc mapping:
// - docs/migration/engine-logic-migration-plan.md (7.4) approximate range를 prior로 반영
test('inferZishi applies approximateRange prior with current options signature', () => {
  const answers: SurveyAnswer[] = []

  const withoutPrior = inferZishi(answers)
  const withPrior = inferZishi(answers, { approximateRange: { start: 9, end: 13 } })

  // No answers => uniform
  assert.ok(Math.abs(withoutPrior.probabilities.사시 - 1 / 12) < 1e-12)
  assert.ok(Math.abs(withoutPrior.probabilities.오시 - 1 / 12) < 1e-12)

  // Prior range [9,13) should boost 사시(9), 오시(11)
  assert.ok(withPrior.probabilities.사시 > withoutPrior.probabilities.사시)
  assert.ok(withPrior.probabilities.오시 > withoutPrior.probabilities.오시)
})

// Doc mapping:
// - docs/migration/engine-implementation-design.md (13) SurveyResult -> InferredHourPillar 연결
test('toInferredHourPillar maps SurveyResult fields to current InferredHourPillar contract', () => {
  const answers: SurveyAnswer[] = [
    { questionId: 'Q4', optionIndex: 2 },
    { questionId: 'Q5', optionIndex: 1 },
    { questionId: 'Q6', optionIndex: 3 },
    { questionId: 'Q7', optionIndex: 3 },
  ]

  const surveyResult = inferZishi(answers)
  const inferredHour = toInferredHourPillar(surveyResult)

  assert.equal(inferredHour.method, 'survey')
  assert.equal(inferredHour.confidence, surveyResult.confidence)
  assert.equal(inferredHour.topCandidates.length, 3)
  assert.equal(inferredHour.isCusp, surveyResult.cusp.isCusp)

  // rawScore -> score field mapping
  assert.equal(inferredHour.topCandidates[0].score, surveyResult.topCandidates[0].rawScore)

  // mirroringSignals -> mirroringData mapping
  assert.equal(inferredHour.mirroringData?.length, surveyResult.mirroringSignals.length)
  if ((inferredHour.mirroringData?.length ?? 0) > 0) {
    assert.equal(
      inferredHour.mirroringData?.[0].questionText,
      surveyResult.mirroringSignals[0].questionText
    )
    assert.equal(
      inferredHour.mirroringData?.[0].selectedOptionText,
      surveyResult.mirroringSignals[0].selectedOptionText
    )
  }
})
