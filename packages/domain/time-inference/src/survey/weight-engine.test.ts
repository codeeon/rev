import test from 'node:test'
import assert from 'node:assert/strict'

import { inferZishi, toInferredHourPillar } from './weight-engine'
import type { SurveyAnswer } from './types'

test('inferZishi applies approximateRange prior with current options signature', () => {
  const answers: SurveyAnswer[] = []

  const withoutPrior = inferZishi(answers)
  const withPrior = inferZishi(answers, { approximateRange: { start: 9, end: 13 } })

  assert.ok(Math.abs(withoutPrior.probabilities.사시 - 1 / 12) < 1e-12)
  assert.ok(Math.abs(withoutPrior.probabilities.오시 - 1 / 12) < 1e-12)

  assert.ok(withPrior.probabilities.사시 > withoutPrior.probabilities.사시)
  assert.ok(withPrior.probabilities.오시 > withoutPrior.probabilities.오시)
})

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

  assert.equal(inferredHour.topCandidates[0].score, surveyResult.topCandidates[0].rawScore)

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

test('toInferredHourPillar keeps explicit inference method metadata', () => {
  const surveyResult = inferZishi([])

  const approximate = toInferredHourPillar(surveyResult, 'approximate')
  assert.equal(approximate.method, 'approximate')

  const survey = toInferredHourPillar(surveyResult)
  assert.equal(survey.method, 'survey')
})
