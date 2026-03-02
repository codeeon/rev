// 천간 (Heavenly Stems)
export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'

// 지지 (Earthly Branches)
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'

// 오행 (Five Elements)
export type FiveElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water'

// 음양 (Yin/Yang)
export type YinYang = 'yang' | 'yin'

// 하나의 기둥
export interface Pillar {
  stem: HeavenlyStem
  branch: EarthlyBranch
  stemKr: string
  branchKr: string
  stemElement: FiveElement
  branchElement: FiveElement
  yinYang: YinYang
}

// 사주 4기둥
export interface FourPillars {
  year: Pillar
  month: Pillar
  day: Pillar
  hour: Pillar
}

// 오행 분포
export interface FiveElementDistribution {
  wood: number
  fire: number
  earth: number
  metal: number
  water: number
}

// 사주 분석 입력
export interface BirthInfo {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  isLunar: boolean
  gender: 'male' | 'female'
  name?: string
  birthPlace?: string
}

// 시주 추론 결과
export interface InferredHourPillar {
  branch: EarthlyBranch
  branchKr: string
  confidence: number
  topCandidates: Array<{
    branch: EarthlyBranch
    branchKr: string
    score: number
    percentage: number
  }>
  method: 'known' | 'survey' | 'approximate'
  isCusp?: boolean
  cuspCandidates?: [EarthlyBranch, EarthlyBranch]
  mirroringData?: Array<{
    questionText: string
    selectedOptionText: string
  }>
}

// 전체 사주 계산 결과
export interface SajuResult {
  fourPillars: FourPillars
  fiveElements: FiveElementDistribution
  dominantElement: FiveElement
  weakestElement: FiveElement
  dayMaster: HeavenlyStem
  dayMasterElement: FiveElement
  dayMasterYinYang: YinYang
  inferredHour?: InferredHourPillar
}

// AI 분석 결과
export interface AnalysisSection {
  title: string
  content: string
}

export interface AnalysisResult {
  sections: AnalysisSection[]
  summary: string
  rawText: string
  parser?: {
    usedFallback: boolean
    sectionCount: number
  }
}
