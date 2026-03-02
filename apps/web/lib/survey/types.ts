import type { EarthlyBranch } from '../saju/types'

// 시진 (한글) — engine.json score_map 키와 동일
export type ZishiName =
  | '자시' | '축시' | '인시' | '묘시' | '진시' | '사시'
  | '오시' | '미시' | '신시' | '유시' | '술시' | '해시'

// 질문의 구조적 역할
export type StructureRole = 'noise_reduction' | 'core' | 'fine_tune' | 'closing'

// 사용자 응답 — optionIndex 기반 (옵션 텍스트 변경에 안전)
export interface SurveyAnswer {
  questionId: string   // "Q1" ~ "Q20"
  optionIndex: number  // 0-based
}

// CUSP 판정 결과
export interface CuspResult {
  isCusp: boolean
  gap: number      // top1_prob - top2_prob
  stdDev: number   // std(12 softmax probs)
}

// 시진 후보 (정렬된 결과)
export interface ZishiCandidate {
  zishi: ZishiName
  branch: EarthlyBranch
  branchKr: string
  rawScore: number
  probability: number   // 0~1
  percentage: number    // Math.round(probability * 100)
}

// 미러링 신호 — core 문항 중 top1 기여 상위 2~3개
export interface MirroringSignal {
  questionId: string
  questionText: string
  selectedOptionText: string
  impactScore: number    // question_weight × score_map[top1] (부호 포함)
  targetZishi: ZishiName
}

// 모니터링 지표
export interface MonitoringResult {
  zishiMaxDiff: number
  roleInfluence: Record<StructureRole, number>  // 4개 역할 전체
  top1Prob: number
  top2Gap: number
  stdSoftmax: number
  stdRawScore: number
  alerts: {
    zishiMaxDiffOver: boolean   // > 8
    roleInfluenceOver: boolean  // core > 0.65
    top1OutOfBand: boolean      // top1 < 0.5 또는 > 0.65
  }
}

// 최종 설문 결과
export interface SurveyResult {
  inferredZishi: ZishiName
  confidence: number                         // top1_prob × 100 (반올림)
  probabilities: Record<ZishiName, number>
  topCandidates: ZishiCandidate[]            // 상위 3개
  cusp: CuspResult
  mirroringSignals: MirroringSignal[]
  monitoring: MonitoringResult
}
