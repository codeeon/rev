import { Solar, Lunar } from 'lunar-javascript'
import type {
  BirthInfo,
  FourPillars,
  Pillar,
  SajuResult,
  FiveElementDistribution,
  FiveElement,
  InferredHourPillar,
  HeavenlyStem,
  EarthlyBranch,
} from './types'
import {
  STEM_KR,
  STEM_ELEMENT,
  STEM_YINYANG,
  BRANCH_KR,
  BRANCH_ELEMENT,
  hourToBranch,
  getHourStem,
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

export function calculateFourPillars(info: BirthInfo, hourBranch?: EarthlyBranch): FourPillars {
  let solar: ReturnType<typeof Solar.fromYmd>

  if (info.isLunar) {
    const lunar = Lunar.fromYmd(info.year, info.month, info.day)
    solar = lunar.getSolar()
  } else {
    solar = Solar.fromYmd(info.year, info.month, info.day)
  }

  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()

  const yearStem = eightChar.getYearGan() as HeavenlyStem
  const yearBranch = eightChar.getYearZhi() as EarthlyBranch
  const year = makePillar(yearStem, yearBranch)

  const monthStem = eightChar.getMonthGan() as HeavenlyStem
  const monthBranch = eightChar.getMonthZhi() as EarthlyBranch
  const month = makePillar(monthStem, monthBranch)

  const dayStem = eightChar.getDayGan() as HeavenlyStem
  const dayBranch = eightChar.getDayZhi() as EarthlyBranch
  const day = makePillar(dayStem, dayBranch)

  let hBranch: EarthlyBranch
  if (hourBranch) {
    hBranch = hourBranch
  } else if (info.hour !== undefined) {
    hBranch = hourToBranch(info.hour)
  } else {
    hBranch = '午'
  }

  const hourStem = getHourStem(dayStem, hBranch)
  const hour = makePillar(hourStem, hBranch)

  return { year, month, day, hour }
}

export function calculateFiveElements(pillars: FourPillars): FiveElementDistribution {
  const counts: FiveElementDistribution = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }
  const allPillars = [pillars.year, pillars.month, pillars.day, pillars.hour]

  for (const pillar of allPillars) {
    counts[pillar.stemElement] += 1
    counts[pillar.branchElement] += 1
  }

  const total = 8
  return {
    wood: (counts.wood / total) * 100,
    fire: (counts.fire / total) * 100,
    earth: (counts.earth / total) * 100,
    metal: (counts.metal / total) * 100,
    water: (counts.water / total) * 100,
  }
}

export function analyzeSaju(info: BirthInfo, inferredHour?: InferredHourPillar): SajuResult {
  const hourBranch = inferredHour?.branch ?? (info.hour !== undefined ? hourToBranch(info.hour) : undefined)

  const fourPillars = calculateFourPillars(info, hourBranch)
  const fiveElements = calculateFiveElements(fourPillars)

  const dayMaster = fourPillars.day.stem
  const dayMasterElement = STEM_ELEMENT[dayMaster]
  const dayMasterYinYang = STEM_YINYANG[dayMaster]

  const entries = Object.entries(fiveElements) as [FiveElement, number][]
  const dominant = entries.reduce((a, b) => (a[1] >= b[1] ? a : b))
  const weakest = entries.reduce((a, b) => (a[1] <= b[1] ? a : b))

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
