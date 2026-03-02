import { ENGINE_SETTINGS, ZISHI_LIST, QUESTION_MAP, CORE_QUESTIONS } from './loader'
import { ZISHI_TO_BRANCH } from '../survey/zishi-mapping'
import { BRANCH_KR } from '../saju/constants'
import type {
  SurveyAnswer,
  ZishiName,
  StructureRole,
  CuspResult,
  ZishiCandidate,
  MirroringSignal,
  MonitoringResult,
  SurveyResult,
} from '../survey/types'

interface ApproximateRange {
  start: number
  end: number
}

interface InferenceOptions {
  approximateRange?: ApproximateRange | null
}

const ZISHI_PEAK_HOUR: Record<ZishiName, number> = {
  자시: 23,
  축시: 1,
  인시: 3,
  묘시: 5,
  진시: 7,
  사시: 9,
  오시: 11,
  미시: 13,
  신시: 15,
  유시: 17,
  술시: 19,
  해시: 21,
}

function initZeroScores(): Record<ZishiName, number> {
  const scores = {} as Record<ZishiName, number>
  for (const z of ZISHI_LIST) scores[z] = 0
  return scores
}

function isHourInRange(hour: number, range: ApproximateRange): boolean {
  if (range.start === range.end) return true
  if (range.start < range.end) {
    return hour >= range.start && hour < range.end
  }
  return hour >= range.start || hour < range.end
}

function applyApproximateRangePrior(
  rawScores: Record<ZishiName, number>,
  range: ApproximateRange,
  priorBoost = 0.8
): Record<ZishiName, number> {
  const adjusted = { ...rawScores }

  for (const z of ZISHI_LIST) {
    if (isHourInRange(ZISHI_PEAK_HOUR[z], range)) {
      adjusted[z] += priorBoost
    }
  }

  return adjusted
}

// Step 1: 원시 점수 누적
export function calculateRawScores(answers: SurveyAnswer[]): Record<ZishiName, number> {
  const scores = initZeroScores()

  for (const answer of answers) {
    const question = QUESTION_MAP.get(answer.questionId)
    if (!question) continue

    const option = question.options[answer.optionIndex]
    if (!option) continue

    // question_weight는 문항별로 직접 읽음 (role 기반 고정 상수 사용 금지)
    for (const [zishi, score] of Object.entries(option.score_map) as [ZishiName, number][]) {
      scores[zishi] += question.question_weight * score
    }
  }

  return scores
}

// Step 2: Softmax 변환 (수치 안정성을 위해 max 빼기 적용)
export function softmax(
  scores: Record<ZishiName, number>,
  temperature: number = ENGINE_SETTINGS.default_temperature
): Record<ZishiName, number> {
  const vals = ZISHI_LIST.map(z => scores[z])
  const maxVal = Math.max(...vals)

  const exps = {} as Record<ZishiName, number>
  let sumExp = 0
  for (const z of ZISHI_LIST) {
    exps[z] = Math.exp((scores[z] - maxVal) / temperature)
    sumExp += exps[z]
  }

  const probs = {} as Record<ZishiName, number>
  for (const z of ZISHI_LIST) {
    probs[z] = exps[z] / sumExp
  }

  return probs
}

// Step 3: CUSP 판정
export function evaluateCusp(probs: Record<ZishiName, number>): CuspResult {
  const sorted = ZISHI_LIST.map(z => probs[z]).sort((a, b) => b - a)
  const gap = sorted[0] - sorted[1]

  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / sorted.length
  const stdDev = Math.sqrt(variance)

  const { gap_threshold, min_score_std } = ENGINE_SETTINGS.cusp_logic

  return {
    isCusp: gap < gap_threshold && stdDev > min_score_std,
    gap,
    stdDev,
  }
}

// 상위 N개 후보 추출
export function getTopCandidates(
  probs: Record<ZishiName, number>,
  rawScores: Record<ZishiName, number>,
  n = 3
): ZishiCandidate[] {
  return ZISHI_LIST
    .map(z => ({
      zishi: z,
      branch: ZISHI_TO_BRANCH[z],
      branchKr: BRANCH_KR[ZISHI_TO_BRANCH[z]],
      rawScore: rawScores[z],
      probability: probs[z],
      percentage: Math.round(probs[z] * 100),
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n)
}

// 모니터링 지표 계산
export function calculateMonitoring(
  rawScores: Record<ZishiName, number>,
  probs: Record<ZishiName, number>,
  answers: SurveyAnswer[]
): MonitoringResult {
  const rawVals = ZISHI_LIST.map(z => rawScores[z])
  const zishiMaxDiff = Math.max(...rawVals) - Math.min(...rawVals)

  // role별 절대 기여합
  const roleAbsSum: Record<StructureRole, number> = {
    noise_reduction: 0, core: 0, fine_tune: 0, closing: 0,
  }
  let totalAbsSum = 0

  for (const answer of answers) {
    const question = QUESTION_MAP.get(answer.questionId)
    if (!question) continue
    const option = question.options[answer.optionIndex]
    if (!option) continue

    const absContrib = Object.values(option.score_map).reduce(
      (s, v) => s + Math.abs(question.question_weight * (v ?? 0)), 0
    )
    roleAbsSum[question.structure_role] += absContrib
    totalAbsSum += absContrib
  }

  const roleInfluence: Record<StructureRole, number> = {
    noise_reduction: totalAbsSum > 0 ? roleAbsSum.noise_reduction / totalAbsSum : 0,
    core: totalAbsSum > 0 ? roleAbsSum.core / totalAbsSum : 0,
    fine_tune: totalAbsSum > 0 ? roleAbsSum.fine_tune / totalAbsSum : 0,
    closing: totalAbsSum > 0 ? roleAbsSum.closing / totalAbsSum : 0,
  }

  const sortedProbs = ZISHI_LIST.map(z => probs[z]).sort((a, b) => b - a)
  const top1Prob = sortedProbs[0]
  const top2Gap = sortedProbs[0] - sortedProbs[1]

  const probMean = 1 / ZISHI_LIST.length
  const stdSoftmax = Math.sqrt(
    ZISHI_LIST.map(z => probs[z]).reduce((s, v) => s + (v - probMean) ** 2, 0) / ZISHI_LIST.length
  )

  const rawMean = rawVals.reduce((s, v) => s + v, 0) / rawVals.length
  const stdRawScore = Math.sqrt(
    rawVals.reduce((s, v) => s + (v - rawMean) ** 2, 0) / rawVals.length
  )

  const { alert_if_zishi_max_diff_over, alert_if_role_influence_over } = ENGINE_SETTINGS.score_monitoring
  const [bandLow, bandHigh] = ENGINE_SETTINGS.distribution_monitoring.target_top1_band

  return {
    zishiMaxDiff,
    roleInfluence,
    top1Prob,
    top2Gap,
    stdSoftmax,
    stdRawScore,
    alerts: {
      zishiMaxDiffOver: zishiMaxDiff > alert_if_zishi_max_diff_over,
      roleInfluenceOver: roleInfluence.core > alert_if_role_influence_over,
      top1OutOfBand: top1Prob < bandLow || top1Prob > bandHigh,
    },
  }
}

// 미러링 신호 추출 — core 문항(Q4~Q7) 중 top1 기여 상위 2~3개
export function extractMirroringSignals(
  answers: SurveyAnswer[],
  top1Zishi: ZishiName,
  maxCount = 3
): MirroringSignal[] {
  const coreIds = new Set(CORE_QUESTIONS.map(q => q.id))

  return answers
    .filter(a => coreIds.has(a.questionId))
    .map(answer => {
      const question = QUESTION_MAP.get(answer.questionId)!
      const option = question.options[answer.optionIndex]
      const rawScore = option.score_map[top1Zishi] ?? 0
      const impactScore = question.question_weight * rawScore

      return {
        questionId: answer.questionId,
        questionText: question.text,
        selectedOptionText: option.text,
        impactScore,
        targetZishi: top1Zishi,
      }
    })
    .filter(s => s.impactScore !== 0)
    .sort((a, b) => Math.abs(b.impactScore) - Math.abs(a.impactScore))
    .slice(0, maxCount)
}

// 전체 파이프라인 — 외부 진입점
export function inferZishi(answers: SurveyAnswer[], options?: InferenceOptions): SurveyResult {
  const baseRawScores = calculateRawScores(answers)
  const rawScores = options?.approximateRange
    ? applyApproximateRangePrior(baseRawScores, options.approximateRange)
    : baseRawScores
  const probs = softmax(rawScores)
  const cusp = evaluateCusp(probs)
  const topCandidates = getTopCandidates(probs, rawScores)
  const top1 = topCandidates[0]
  const mirroringSignals = extractMirroringSignals(answers, top1.zishi)
  const monitoring = calculateMonitoring(rawScores, probs, answers)

  // 모니터링 알림 로그
  if (Object.values(monitoring.alerts).some(Boolean)) {
    console.warn('[Engine Monitor]', JSON.stringify(monitoring, null, 2))
  }

  return {
    inferredZishi: top1.zishi,
    confidence: Math.round(top1.probability * 100),
    probabilities: probs,
    topCandidates,
    cusp,
    mirroringSignals,
    monitoring,
  }
}
