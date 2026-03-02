import type { EarthlyBranch } from '@workspace/saju-core'

export type ZishiName =
  | '자시' | '축시' | '인시' | '묘시' | '진시' | '사시'
  | '오시' | '미시' | '신시' | '유시' | '술시' | '해시'

export type StructureRole = 'noise_reduction' | 'core' | 'fine_tune' | 'closing'

export interface SurveyAnswer {
  questionId: string
  optionIndex: number
}

export interface CuspResult {
  isCusp: boolean
  gap: number
  stdDev: number
}

export interface ZishiCandidate {
  zishi: ZishiName
  branch: EarthlyBranch
  branchKr: string
  rawScore: number
  probability: number
  percentage: number
}

export interface MirroringSignal {
  questionId: string
  questionText: string
  selectedOptionText: string
  impactScore: number
  targetZishi: ZishiName
}

export interface MonitoringResult {
  zishiMaxDiff: number
  roleInfluence: Record<StructureRole, number>
  top1Prob: number
  top2Gap: number
  stdSoftmax: number
  stdRawScore: number
  alerts: {
    zishiMaxDiffOver: boolean
    roleInfluenceOver: boolean
    top1OutOfBand: boolean
  }
}

export interface SurveyResult {
  inferredZishi: ZishiName
  confidence: number
  probabilities: Record<ZishiName, number>
  topCandidates: ZishiCandidate[]
  cusp: CuspResult
  mirroringSignals: MirroringSignal[]
  monitoring: MonitoringResult
}
