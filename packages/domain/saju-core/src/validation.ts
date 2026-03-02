import { BRANCH_KR, EARTHLY_BRANCHES } from './constants'
import type { BirthInfo, EarthlyBranch, InferredHourPillar } from './types'

interface AnalyzeInput {
  birthInfo: BirthInfo
  inferredHour?: InferredHourPillar
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEarthlyBranch(value: unknown): value is EarthlyBranch {
  return typeof value === 'string' && EARTHLY_BRANCHES.includes(value as EarthlyBranch)
}

function isInferredMethod(value: unknown): value is InferredHourPillar['method'] {
  return value === 'known' || value === 'survey' || value === 'approximate'
}

function getDaysInGregorianMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function isValidBirthInfo(value: unknown): value is BirthInfo {
  if (!isRecord(value)) return false

  const year = value.year
  const month = value.month
  const day = value.day
  const isLunar = value.isLunar
  const gender = value.gender

  if (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > 2100) return false
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) return false
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1) return false
  if (typeof isLunar !== 'boolean') return false
  if (gender !== 'male' && gender !== 'female') return false

  const maxDay = isLunar ? 30 : getDaysInGregorianMonth(year, month)
  if (day > maxDay) return false

  const hour = value.hour
  const minute = value.minute

  if (hour !== undefined && (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23)) return false
  if (minute !== undefined && (typeof minute !== 'number' || !Number.isInteger(minute) || minute < 0 || minute > 59)) return false
  if (value.name !== undefined && typeof value.name !== 'string') return false
  if (value.birthPlace !== undefined && typeof value.birthPlace !== 'string') return false

  return true
}

export function isValidInferredHour(value: unknown): value is InferredHourPillar {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  if (!isEarthlyBranch(value.branch)) return false
  if (value.branchKr !== BRANCH_KR[value.branch]) return false
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 100) return false
  if (!isInferredMethod(value.method)) return false

  if (!Array.isArray(value.topCandidates)) return false
  for (const candidate of value.topCandidates) {
    if (!isRecord(candidate)) return false
    if (!isEarthlyBranch(candidate.branch)) return false
    if (candidate.branchKr !== BRANCH_KR[candidate.branch]) return false
    if (typeof candidate.score !== 'number') return false
    if (typeof candidate.percentage !== 'number' || candidate.percentage < 0 || candidate.percentage > 100) return false
  }

  if (value.isCusp !== undefined && typeof value.isCusp !== 'boolean') return false

  if (value.cuspCandidates !== undefined) {
    if (!Array.isArray(value.cuspCandidates) || value.cuspCandidates.length !== 2) return false
    if (!isEarthlyBranch(value.cuspCandidates[0]) || !isEarthlyBranch(value.cuspCandidates[1])) return false
  }

  if (value.mirroringData !== undefined) {
    if (!Array.isArray(value.mirroringData)) return false
    for (const signal of value.mirroringData) {
      if (!isRecord(signal)) return false
      if (typeof signal.questionText !== 'string' || typeof signal.selectedOptionText !== 'string') return false
    }
  }

  return true
}

export function parseAnalyzeInput(value: unknown): AnalyzeInput | null {
  if (!isRecord(value)) return null
  if (!isValidBirthInfo(value.birthInfo)) return null
  if (!isValidInferredHour(value.inferredHour)) return null

  return {
    birthInfo: value.birthInfo,
    inferredHour: value.inferredHour,
  }
}
