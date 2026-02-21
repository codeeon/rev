import type { EarthlyBranch } from '../saju/types'
import type { SurveyAnswer, SurveyResult, SurveyQuestion } from './types'
import { BRANCH_KR, EARTHLY_BRANCHES } from '../saju/constants'
import { SURVEY_QUESTIONS } from './questions'

/**
 * 설문 답변을 기반으로 12시진별 가중치를 계산합니다.
 */
export function calculateWeights(answers: SurveyAnswer[]): Record<EarthlyBranch, number> {
  // 초기화
  const scores: Record<EarthlyBranch, number> = {} as Record<EarthlyBranch, number>
  for (const branch of EARTHLY_BRANCHES) {
    scores[branch] = 0
  }

  for (const answer of answers) {
    const question = SURVEY_QUESTIONS.find(q => q.id === answer.questionId)
    if (!question) continue

    let weights: Partial<Record<EarthlyBranch, number>> = {}

    switch (question.type) {
      case 'yn':
        if (question.weights) {
          weights = answer.value === 'yes' ? question.weights.yes : question.weights.no
        }
        break

      case 'choice':
      case 'select':
        if (question.options) {
          const option = question.options.find(o => o.value === answer.value)
          if (option) weights = option.weights
        }
        break

      case 'scale':
        if (question.scaleWeights) {
          const val = Number(answer.value)
          if (val <= 2) weights = question.scaleWeights.low
          else if (val === 3) weights = question.scaleWeights.mid
          else weights = question.scaleWeights.high
        }
        break
    }

    // 가중치 적용
    for (const [branch, weight] of Object.entries(weights)) {
      scores[branch as EarthlyBranch] += weight as number
    }
  }

  return scores
}

/**
 * 12시진 점수를 기반으로 추론 결과를 생성합니다.
 */
export function inferHourBranch(answers: SurveyAnswer[]): SurveyResult {
  const scores = calculateWeights(answers)

  // 점수 순으로 정렬
  const sorted = Object.entries(scores)
    .map(([branch, score]) => ({
      branch: branch as EarthlyBranch,
      branchKr: BRANCH_KR[branch as EarthlyBranch],
      score,
      percentage: 0,
    }))
    .sort((a, b) => b.score - a.score)

  // 총점 대비 비율 계산
  const totalScore = sorted.reduce((sum, item) => sum + item.score, 0) || 1
  for (const item of sorted) {
    item.percentage = Math.round((item.score / totalScore) * 100)
  }

  // 신뢰도 계산: (1위 - 2위) / 1위 * 100
  const top = sorted[0]
  const second = sorted[1]
  const confidence = top.score > 0
    ? Math.round(((top.score - second.score) / top.score) * 100)
    : 0

  // 상위 3개 후보
  const topCandidates = sorted.slice(0, 3)

  return {
    answers,
    inferredBranch: top.branch,
    inferredBranchKr: top.branchKr,
    confidence,
    topCandidates,
  }
}
