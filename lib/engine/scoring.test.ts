import test from 'node:test'
import assert from 'node:assert/strict'

import { ENGINE_QUESTIONS, ZISHI_LIST } from './loader'
import {
  calculateRawScores,
  softmax,
  evaluateCusp,
  inferZishi,
  calculateMonitoring,
  extractMirroringSignals,
} from './scoring'
import type { SurveyAnswer, ZishiName } from '../survey/types'

function zeroScores(): Record<ZishiName, number> {
  return ZISHI_LIST.reduce((acc, z) => {
    acc[z] = 0
    return acc
  }, {} as Record<ZishiName, number>)
}

// Doc mapping:
// - docs/migration/engine-v41-production-design.md (3) Production Question Set (20)
// - docs/migration/engine-implementation-design.md (2) 전체 질문 목록 (20문항)
test('engine question set is fixed to 20 (Q1~Q20)', () => {
  assert.equal(ENGINE_QUESTIONS.length, 20)
  assert.equal(ENGINE_QUESTIONS[0].id, 'Q1')
  assert.equal(ENGINE_QUESTIONS[19].id, 'Q20')
})

// Doc mapping:
// - engine-v41-production-design.md (5.1) score[z] += question_weight * option.score_map[z]
// - engine-implementation-design.md (3 Step 1) 원시 점수 누적 공식
test('calculateRawScores uses question_weight x score_map (documented formula)', () => {
  const answers: SurveyAnswer[] = [
    // Q4 option 2: 오전 시간 => 진시/사시 +4 each, weight 1.5 => +6 each
    { questionId: 'Q4', optionIndex: 2 },
    // Q5 option 1: 바로 잠들어요 => 자시 -6, 인시 +2 (weight 1.5)
    { questionId: 'Q5', optionIndex: 1 },
    // invalid entries should be ignored
    { questionId: 'UNKNOWN', optionIndex: 0 },
    { questionId: 'Q1', optionIndex: 999 },
  ]

  const raw = calculateRawScores(answers)
  assert.equal(raw.진시, 6)
  assert.equal(raw.사시, 6)
  assert.equal(raw.자시, -9)
  assert.equal(raw.인시, 3)
})

// Doc mapping:
// - engine-v41-production-design.md (5.2) Softmax Probability, T=1.2, numerical stability
// - engine-implementation-design.md (3 Step 2) max-shift softmax
test('softmax uses temperature and max-shift formula correctly', () => {
  const scores = zeroScores()
  scores.자시 = 3
  scores.축시 = 1
  // others = 0

  const probs = softmax(scores, 1.2)
  const maxVal = 3
  const expTop = Math.exp((3 - maxVal) / 1.2)
  const expSecond = Math.exp((1 - maxVal) / 1.2)
  const expRest = Math.exp((0 - maxVal) / 1.2)
  const expectedDenom = expTop + expSecond + expRest * 10

  assert.ok(Math.abs(probs.자시 - expTop / expectedDenom) < 1e-12)
  assert.ok(Math.abs(probs.축시 - expSecond / expectedDenom) < 1e-12)
  assert.ok(Math.abs(probs.인시 - expRest / expectedDenom) < 1e-12)

  const sum = ZISHI_LIST.reduce((acc, z) => acc + probs[z], 0)
  assert.ok(Math.abs(sum - 1) < 1e-12)
})

// Doc mapping:
// - engine-implementation-design.md (15 단위 검증) all-zero -> 균등 분포
test('softmax returns uniform distribution when all raw scores are zero', () => {
  const probs = softmax(zeroScores())
  for (const z of ZISHI_LIST) {
    assert.ok(Math.abs(probs[z] - 1 / 12) < 1e-12)
  }
})

// Doc mapping:
// - engine-v41-production-design.md (5.3) CUSP: gap < 0.05 and std > 0.8
// - engine-implementation-design.md (3 Step 3) CUSP AND 조건
test('evaluateCusp applies gap threshold AND std threshold', () => {
  // realistic near-tie probability distribution (sum=1)
  const probs = zeroScores()
  probs.자시 = 0.26
  probs.축시 = 0.25
  const remaining = (1 - probs.자시 - probs.축시) / 10
  for (const z of ZISHI_LIST) if (z !== '자시' && z !== '축시') probs[z] = remaining

  const cusp = evaluateCusp(probs)
  assert.equal(cusp.isCusp, false)
  assert.ok(cusp.gap < 0.05)
  assert.ok(cusp.stdDev < 0.8)
})

// Doc mapping:
// - engine-v41-production-design.md (9) core 2~3개 미러링 근거
// - engine-implementation-design.md (6) core-only, zero-impact 제외, 절대값 정렬
test('extractMirroringSignals keeps only core questions, excludes zero impact, sorts by absolute impact', () => {
  const answers: SurveyAnswer[] = [
    { questionId: 'Q1', optionIndex: 0 }, // non-core
    { questionId: 'Q4', optionIndex: 2 }, // top1=사시 기준 +6
    { questionId: 'Q5', optionIndex: 0 }, // top1=사시 기준 -4.5
    { questionId: 'Q6', optionIndex: 3 }, // empty score_map => 0 impact
    { questionId: 'Q7', optionIndex: 0 }, // top1=사시 기준 -3.6
    { questionId: 'Q8', optionIndex: 1 }, // non-core
  ]
  const signals = extractMirroringSignals(answers, '사시', 3)

  assert.equal(signals.length, 2)
  for (const s of signals) {
    assert.ok(['Q4', 'Q5', 'Q6', 'Q7'].includes(s.questionId))
    assert.notEqual(s.impactScore, 0)
    assert.equal(s.targetZishi, '사시')
  }
  assert.equal(signals[0].questionId, 'Q4')
  assert.ok(Math.abs(signals[0].impactScore) >= Math.abs(signals[1].impactScore))
})

// Doc mapping:
// - engine-v41-production-design.md (8) Monitoring and Guardrails
// - engine-implementation-design.md (5) 모니터링 Guardrails
test('calculateMonitoring computes role influence and guardrail alerts', () => {
  const answers: SurveyAnswer[] = [
    { questionId: 'Q4', optionIndex: 2 },
    { questionId: 'Q5', optionIndex: 1 },
    { questionId: 'Q6', optionIndex: 0 },
    { questionId: 'Q7', optionIndex: 0 },
  ]
  const raw = calculateRawScores(answers)
  const probs = softmax(raw)
  const monitoring = calculateMonitoring(raw, probs, answers)

  // all answers are core questions -> core influence should be 1
  assert.equal(monitoring.roleInfluence.core, 1)
  assert.equal(monitoring.roleInfluence.noise_reduction, 0)
  assert.equal(monitoring.roleInfluence.fine_tune, 0)
  assert.equal(monitoring.roleInfluence.closing, 0)

  assert.equal(monitoring.alerts.roleInfluenceOver, true)
  assert.ok(typeof monitoring.alerts.zishiMaxDiffOver === 'boolean')
  assert.ok(typeof monitoring.alerts.top1OutOfBand === 'boolean')
})

// Doc mapping:
// - engine-v41-production-design.md (7) confidence: top1 probability * 100 (rounded)
// - engine-implementation-design.md (4) confidence = Top1_prob × 100
test('inferZishi confidence follows top1 probability * 100 (rounded)', () => {
  const answers: SurveyAnswer[] = [
    { questionId: 'Q4', optionIndex: 1 }, // 인시/묘시 strongly positive
    { questionId: 'Q5', optionIndex: 1 }, // 자시/해시 negative, 인시/묘시 positive
    { questionId: 'Q6', optionIndex: 3 }, // no contribution
    { questionId: 'Q7', optionIndex: 3 }, // no contribution
  ]

  const result = inferZishi(answers)
  const expected = Math.round(result.topCandidates[0].probability * 100)
  assert.equal(result.confidence, expected)
})

// Doc mapping:
// - engine-v41-production-design.md (7, 9, 8) result contract + mirroring + monitoring
// - engine-implementation-design.md (3, 6, 5) 파이프라인 통합 결과
test('inferZishi end-to-end: returns top candidates, cusp, mirroring, monitoring', () => {
  const answers: SurveyAnswer[] = [{ questionId: 'Q4', optionIndex: 1 }, { questionId: 'Q5', optionIndex: 1 }]
  const result = inferZishi(answers)

  assert.equal(result.topCandidates.length, 3)
  assert.equal(typeof result.cusp.isCusp, 'boolean')
  assert.equal(typeof result.monitoring.top1Prob, 'number')
  assert.ok(result.mirroringSignals.length >= 1)
  assert.ok(result.mirroringSignals.length <= 3)
})

test('inferZishi applies approximate range prior softly for approximate mode', () => {
  const baseline = inferZishi([])
  const withApproximate = inferZishi([], {
    approximateRange: { start: 23, end: 1 },
  })

  assert.equal(baseline.topCandidates[0].probability, baseline.topCandidates[1].probability)
  assert.equal(withApproximate.topCandidates[0].zishi, '자시')
  assert.ok(withApproximate.topCandidates[0].probability > baseline.topCandidates[0].probability)
})
