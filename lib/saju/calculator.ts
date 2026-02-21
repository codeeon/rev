import { Solar, Lunar } from 'lunar-javascript'
import type { BirthInfo, FourPillars, Pillar, SajuResult, FiveElementDistribution, FiveElement, InferredHourPillar } from './types'
import type { HeavenlyStem, EarthlyBranch } from './types'
import {
  STEM_KR, STEM_ELEMENT, STEM_YINYANG,
  BRANCH_KR, BRANCH_ELEMENT,
  hourToBranch, getHourStem,
  HEAVENLY_STEMS, EARTHLY_BRANCHES,
} from './constants'

function makePillar(stem: HeavenlyStem, branch: EarthlyBranch): Pillar {
  return {
    stem,
    branch,
    stemKr: STEM_KR[stem],
    branchKr: BRANCH_KR[branch],
    stemElement: STEM_ELEMENT[stem],
    branchElement: BRANCH_ELEMENT[branch],
    yinYang: STEM_YINYANG[stem],
  }
}

/**
 * 사주 4기둥을 계산합니다.
 * lunar-javascript 라이브러리를 사용하여 만세력 기반 정확한 계산을 수행합니다.
 */
export function calculateFourPillars(
  info: BirthInfo,
  hourBranch?: EarthlyBranch
): FourPillars {
  let solar: ReturnType<typeof Solar.fromYmd>

  if (info.isLunar) {
    // 음력 → 양력 변환
    const lunar = Lunar.fromYmd(info.year, info.month, info.day)
    solar = lunar.getSolar()
  } else {
    solar = Solar.fromYmd(info.year, info.month, info.day)
  }

  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()

  // 년주
  const yearStem = eightChar.getYearGan() as HeavenlyStem
  const yearBranch = eightChar.getYearZhi() as EarthlyBranch
  const year = makePillar(yearStem, yearBranch)

  // 월주
  const monthStem = eightChar.getMonthGan() as HeavenlyStem
  const monthBranch = eightChar.getMonthZhi() as EarthlyBranch
  const month = makePillar(monthStem, monthBranch)

  // 일주
  const dayStem = eightChar.getDayGan() as HeavenlyStem
  const dayBranch = eightChar.getDayZhi() as EarthlyBranch
  const day = makePillar(dayStem, dayBranch)

  // 시주
  let hBranch: EarthlyBranch
  if (hourBranch) {
    hBranch = hourBranch
  } else if (info.hour !== undefined) {
    hBranch = hourToBranch(info.hour)
  } else {
    // 기본값: 자시 (noon과 가까운 시간으로 사주 계산에서 흔히 사용)
    hBranch = '午'
  }
  const hourStem = getHourStem(dayStem, hBranch)
  const hour = makePillar(hourStem, hBranch)

  return { year, month, day, hour }
}

/**
 * 오행 분포를 계산합니다.
 */
export function calculateFiveElements(pillars: FourPillars): FiveElementDistribution {
  const counts: FiveElementDistribution = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }
  const allPillars = [pillars.year, pillars.month, pillars.day, pillars.hour]

  for (const pillar of allPillars) {
    counts[pillar.stemElement] += 1
    counts[pillar.branchElement] += 1
  }

  // 비율로 변환 (총 8글자)
  const total = 8
  return {
    wood: (counts.wood / total) * 100,
    fire: (counts.fire / total) * 100,
    earth: (counts.earth / total) * 100,
    metal: (counts.metal / total) * 100,
    water: (counts.water / total) * 100,
  }
}

/**
 * 전체 사주 분석을 수행합니다.
 */
export function analyzeSaju(
  info: BirthInfo,
  inferredHour?: InferredHourPillar
): SajuResult {
  const hourBranch = inferredHour?.branch ??
    (info.hour !== undefined ? hourToBranch(info.hour) : undefined)

  const fourPillars = calculateFourPillars(info, hourBranch)
  const fiveElements = calculateFiveElements(fourPillars)

  // 일간 (일주의 천간)
  const dayMaster = fourPillars.day.stem
  const dayMasterElement = STEM_ELEMENT[dayMaster]
  const dayMasterYinYang = STEM_YINYANG[dayMaster]

  // 최다/최소 오행
  const entries = Object.entries(fiveElements) as [FiveElement, number][]
  const dominant = entries.reduce((a, b) => a[1] >= b[1] ? a : b)
  const weakest = entries.reduce((a, b) => a[1] <= b[1] ? a : b)

  return {
    fourPillars,
    fiveElements,
    dominantElement: dominant[0],
    weakestElement: weakest[0],
    dayMaster,
    dayMasterElement,
    dayMasterYinYang,
    inferredHour,
  }
}
