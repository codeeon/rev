import { z } from 'zod'
import type { StructureRole, ZishiName } from '@workspace/time-inference'

export const STRUCTURE_ROLES = ['noise_reduction', 'core', 'fine_tune', 'closing'] as const
export const ZISHI_NAMES = ['자시', '축시', '인시', '묘시', '진시', '사시', '오시', '미시', '신시', '유시', '술시', '해시'] as const

export const ADMIN_SHEET_HEADERS = [
  'version',
  'questionId',
  'structureRole',
  'category',
  'questionWeight',
  'questionText',
  'optionIndex',
  'optionText',
  'scoreMapJson',
  'isActive',
  'updatedAt',
] as const

export type AdminSheetHeader = (typeof ADMIN_SHEET_HEADERS)[number]

export interface AdminSheetRowInput {
  version: string
  questionId: string
  structureRole: string
  category: string
  questionWeight: string
  questionText: string
  optionIndex: string
  optionText: string
  scoreMapJson: string
  isActive: string
  updatedAt: string
}

export interface AdminSheetRow {
  version: string
  questionId: string
  structureRole: StructureRole
  category: string
  questionWeight: number
  questionText: string
  optionIndex: number
  optionText: string
  scoreMap: Partial<Record<ZishiName, number>>
  isActive: boolean
  updatedAt: string
}

const ZISHI_NAME_SET = new Set<string>(ZISHI_NAMES)
const BOOLEAN_TRUE = new Set(['1', 'true', 'yes', 'y'])
const BOOLEAN_FALSE = new Set(['0', 'false', 'no', 'n'])

const rawAdminSheetRowSchema = z.object({
  version: z.string().trim().min(1, 'version is required'),
  questionId: z.string().trim().min(1, 'questionId is required'),
  structureRole: z.enum(STRUCTURE_ROLES),
  category: z.string().trim().min(1, 'category is required'),
  questionWeight: z.string().trim().min(1, 'questionWeight is required'),
  questionText: z.string().trim().min(1, 'questionText is required'),
  optionIndex: z.string().trim().min(1, 'optionIndex is required'),
  optionText: z.string().trim().min(1, 'optionText is required'),
  scoreMapJson: z.string().trim().min(1, 'scoreMapJson is required'),
  isActive: z.string().trim().min(1, 'isActive is required'),
  updatedAt: z.string().trim().min(1, 'updatedAt is required'),
})

function parseNonNegativeNumber(rawValue: string, fieldName: string): number {
  const value = Number(rawValue)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number`)
  }
  return value
}

function parseNonNegativeInteger(rawValue: string, fieldName: string): number {
  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`)
  }
  return value
}

function parseBooleanFlag(rawValue: string): boolean {
  const normalized = rawValue.trim().toLowerCase()
  if (BOOLEAN_TRUE.has(normalized)) {
    return true
  }
  if (BOOLEAN_FALSE.has(normalized)) {
    return false
  }
  throw new Error('isActive must be one of: true/false/1/0/yes/no/y/n')
}

function parseScoreMapJson(rawValue: string): Partial<Record<ZishiName, number>> {
  let payload: unknown
  try {
    payload = JSON.parse(rawValue)
  } catch {
    throw new Error('scoreMapJson must be valid JSON')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('scoreMapJson must be an object')
  }

  const scoreMap: Partial<Record<ZishiName, number>> = {}
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (!ZISHI_NAME_SET.has(key)) {
      throw new Error(`scoreMapJson contains unsupported zishi key: ${key}`)
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`scoreMapJson value for ${key} must be a finite number`)
    }
    scoreMap[key as ZishiName] = value
  }

  return scoreMap
}

function formatSchemaError(error: z.ZodError): string {
  return error.issues.map(issue => issue.message).join(', ')
}

export function parseAdminSheetRow(input: AdminSheetRowInput, rowNumber: number): AdminSheetRow {
  const parsed = rawAdminSheetRowSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Row ${rowNumber} is invalid: ${formatSchemaError(parsed.error)}`)
  }

  try {
    return {
      version: parsed.data.version,
      questionId: parsed.data.questionId,
      structureRole: parsed.data.structureRole,
      category: parsed.data.category,
      questionWeight: parseNonNegativeNumber(parsed.data.questionWeight, 'questionWeight'),
      questionText: parsed.data.questionText,
      optionIndex: parseNonNegativeInteger(parsed.data.optionIndex, 'optionIndex'),
      optionText: parsed.data.optionText,
      scoreMap: parseScoreMapJson(parsed.data.scoreMapJson),
      isActive: parseBooleanFlag(parsed.data.isActive),
      updatedAt: parsed.data.updatedAt,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error'
    throw new Error(`Row ${rowNumber} is invalid: ${message}`)
  }
}
