import type { EarthlyBranch } from '../saju/types'
import type { ZishiName } from './types'

export const ZISHI_TO_BRANCH: Record<ZishiName, EarthlyBranch> = {
  자시: '子', 축시: '丑', 인시: '寅', 묘시: '卯',
  진시: '辰', 사시: '巳', 오시: '午', 미시: '未',
  신시: '申', 유시: '酉', 술시: '戌', 해시: '亥',
}

export const BRANCH_TO_ZISHI: Record<EarthlyBranch, ZishiName> = {
  子: '자시', 丑: '축시', 寅: '인시', 卯: '묘시',
  辰: '진시', 巳: '사시', 午: '오시', 未: '미시',
  申: '신시', 酉: '유시', 戌: '술시', 亥: '해시',
}
