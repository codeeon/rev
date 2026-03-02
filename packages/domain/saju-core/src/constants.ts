import type { HeavenlyStem, EarthlyBranch, FiveElement, YinYang } from './types'

// 10 천간 (Heavenly Stems)
export const HEAVENLY_STEMS: HeavenlyStem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

// 천간 한글
export const STEM_KR: Record<HeavenlyStem, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
}

// 천간 오행
export const STEM_ELEMENT: Record<HeavenlyStem, FiveElement> = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',
}

// 천간 음양
export const STEM_YINYANG: Record<HeavenlyStem, YinYang> = {
  '甲': 'yang', '乙': 'yin', '丙': 'yang', '丁': 'yin', '戊': 'yang',
  '己': 'yin', '庚': 'yang', '辛': 'yin', '壬': 'yang', '癸': 'yin',
}

// 12 지지 (Earthly Branches)
export const EARTHLY_BRANCHES: EarthlyBranch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// 지지 한글
export const BRANCH_KR: Record<EarthlyBranch, string> = {
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사',
  '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해',
}

// 지지 오행
export const BRANCH_ELEMENT: Record<EarthlyBranch, FiveElement> = {
  '子': 'water', '丑': 'earth', '寅': 'wood', '卯': 'wood',
  '辰': 'earth', '巳': 'fire', '午': 'fire', '未': 'earth',
  '申': 'metal', '酉': 'metal', '戌': 'earth', '亥': 'water',
}

// 12시진 시간 매핑 (시작 시간)
export const BRANCH_HOURS: Record<EarthlyBranch, { start: number; end: number; label: string }> = {
  '子': { start: 23, end: 1, label: '자시 (23:00~01:00)' },
  '丑': { start: 1, end: 3, label: '축시 (01:00~03:00)' },
  '寅': { start: 3, end: 5, label: '인시 (03:00~05:00)' },
  '卯': { start: 5, end: 7, label: '묘시 (05:00~07:00)' },
  '辰': { start: 7, end: 9, label: '진시 (07:00~09:00)' },
  '巳': { start: 9, end: 11, label: '사시 (09:00~11:00)' },
  '午': { start: 11, end: 13, label: '오시 (11:00~13:00)' },
  '未': { start: 13, end: 15, label: '미시 (13:00~15:00)' },
  '申': { start: 15, end: 17, label: '신시 (15:00~17:00)' },
  '酉': { start: 17, end: 19, label: '유시 (17:00~19:00)' },
  '戌': { start: 19, end: 21, label: '술시 (19:00~21:00)' },
  '亥': { start: 21, end: 23, label: '해시 (21:00~23:00)' },
}

// 오행 한글 이름
export const ELEMENT_KR: Record<FiveElement, string> = {
  wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)',
}

// 오행 색상 (Tailwind CSS용)
export const ELEMENT_COLORS: Record<FiveElement, { bg: string; text: string; hex: string }> = {
  wood: { bg: 'bg-wood', text: 'text-wood', hex: '#22c55e' },
  fire: { bg: 'bg-fire', text: 'text-fire', hex: '#ef4444' },
  earth: { bg: 'bg-earth', text: 'text-earth', hex: '#eab308' },
  metal: { bg: 'bg-metal', text: 'text-metal', hex: '#94a3b8' },
  water: { bg: 'bg-water', text: 'text-water', hex: '#3b82f6' },
}

// 시간(hour) → 지지 매핑
export function hourToBranch(hour: number): EarthlyBranch {
  if (hour === 23 || hour === 0) return '子'
  const index = Math.floor((hour + 1) / 2)
  return EARTHLY_BRANCHES[index]
}

// 일간(day stem) 기준 시주 천간 계산
// 갑기일 → 甲, 을경일 → 丙, 병신일 → 戊, 정임일 → 庚, 무계일 → 壬
export function getHourStem(dayStem: HeavenlyStem, hourBranch: EarthlyBranch): HeavenlyStem {
  const dayStemIndex = HEAVENLY_STEMS.indexOf(dayStem)
  const branchIndex = EARTHLY_BRANCHES.indexOf(hourBranch)
  const baseIndex = (dayStemIndex % 5) * 2
  const stemIndex = (baseIndex + branchIndex) % 10
  return HEAVENLY_STEMS[stemIndex]
}
