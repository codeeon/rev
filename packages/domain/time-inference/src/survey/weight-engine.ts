import { BRANCH_KR, type InferredHourPillar } from '@workspace/saju-core'
import { inferZishi } from '../engine/scoring'
import { ZISHI_TO_BRANCH } from './zishi-mapping'
import type { SurveyResult } from './types'

export { inferZishi }

export function toInferredHourPillar(result: SurveyResult): InferredHourPillar {
  const branch = ZISHI_TO_BRANCH[result.inferredZishi]
  return {
    branch,
    branchKr: BRANCH_KR[branch],
    confidence: result.confidence,
    topCandidates: result.topCandidates.map(c => ({
      branch: c.branch,
      branchKr: c.branchKr,
      score: c.rawScore,
      percentage: c.percentage,
    })),
    method: 'survey',
    isCusp: result.cusp.isCusp,
    cuspCandidates: result.cusp.isCusp
      ? [result.topCandidates[0].branch, result.topCandidates[1].branch]
      : undefined,
    mirroringData: result.mirroringSignals.map(s => ({
      questionText: s.questionText,
      selectedOptionText: s.selectedOptionText,
    })),
  }
}
