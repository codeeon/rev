import type { EarthlyBranch } from '../saju/types'

export type QuestionType = 'yn' | 'scale' | 'choice' | 'select'

export interface WeightMap {
  [key: string]: Partial<Record<EarthlyBranch, number>>
}

export interface QuestionOption {
  label: string
  value: string
  weights: Partial<Record<EarthlyBranch, number>>
}

export interface SurveyQuestion {
  id: string
  type: QuestionType
  text: string
  subText?: string
  category: string
  // YN 타입
  weights?: {
    yes: Partial<Record<EarthlyBranch, number>>
    no: Partial<Record<EarthlyBranch, number>>
  }
  // Choice/Select 타입
  options?: QuestionOption[]
  // Scale 타입 (1~5)
  scaleWeights?: {
    low: Partial<Record<EarthlyBranch, number>>    // 1~2점
    mid: Partial<Record<EarthlyBranch, number>>    // 3점
    high: Partial<Record<EarthlyBranch, number>>   // 4~5점
  }
  // Scale labels
  scaleLabels?: { low: string; high: string }
}

export interface SurveyAnswer {
  questionId: string
  value: string | number
}

export interface SurveyResult {
  answers: SurveyAnswer[]
  inferredBranch: EarthlyBranch
  inferredBranchKr: string
  confidence: number
  topCandidates: Array<{
    branch: EarthlyBranch
    branchKr: string
    score: number
    percentage: number
  }>
}
