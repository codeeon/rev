import { z } from 'zod'
import type { StructureRole, ZishiName } from '@workspace/time-inference'
import { STRUCTURE_ROLES, ZISHI_NAMES } from '../question-source/admin-sheet-schema'

export const QUESTION_DRAFT_STATUSES = ['draft', 'review-ready', 'published', 'archived'] as const
export const QUESTION_DRAFT_SHEET_HEADERS = [
  'draftId',
  'version',
  'sourceVersion',
  'status',
  'questionId',
  'structureRole',
  'category',
  'questionWeight',
  'questionText',
  'optionIndex',
  'optionText',
  'scoreMapJson',
  'isActive',
  'changeSummary',
  'updatedBy',
  'updatedAt',
] as const

export type QuestionDraftStatus = (typeof QUESTION_DRAFT_STATUSES)[number]
export type QuestionDraftSheetHeader = (typeof QUESTION_DRAFT_SHEET_HEADERS)[number]

export interface QuestionDraftSheetRowInput {
  draftId: string
  version: string
  sourceVersion: string
  status: string
  questionId: string
  structureRole: string
  category: string
  questionWeight: string
  questionText: string
  optionIndex: string
  optionText: string
  scoreMapJson: string
  isActive: string
  changeSummary: string
  updatedBy: string
  updatedAt: string
}

export interface QuestionDraftSheetRow {
  draftId: string
  version: string
  sourceVersion: string
  status: QuestionDraftStatus
  questionId: string
  structureRole: StructureRole
  category: string
  questionWeight: number
  questionText: string
  optionIndex: number
  optionText: string
  scoreMap: Partial<Record<ZishiName, number>>
  isActive: boolean
  changeSummary: string
  updatedBy: string
  updatedAt: string
}

const ZISHI_NAME_SET = new Set<string>(ZISHI_NAMES)
const BOOLEAN_TRUE = new Set(['1', 'true', 'yes', 'y'])
const BOOLEAN_FALSE = new Set(['0', 'false', 'no', 'n'])

const rawQuestionDraftRowSchema = z.object({
  draftId: z.string().trim().min(1, 'draftId is required'),
  version: z.string().trim().min(1, 'version is required'),
  sourceVersion: z.string().trim().min(1, 'sourceVersion is required'),
  status: z.enum(QUESTION_DRAFT_STATUSES),
  questionId: z.string().trim().min(1, 'questionId is required'),
  structureRole: z.enum(STRUCTURE_ROLES),
  category: z.string().trim().min(1, 'category is required'),
  questionWeight: z.string().trim().min(1, 'questionWeight is required'),
  questionText: z.string().trim().min(1, 'questionText is required'),
  optionIndex: z.string().trim().min(1, 'optionIndex is required'),
  optionText: z.string().trim().min(1, 'optionText is required'),
  scoreMapJson: z.string().trim().min(1, 'scoreMapJson is required'),
  isActive: z.string().trim().min(1, 'isActive is required'),
  changeSummary: z.string().trim().min(1, 'changeSummary is required'),
  updatedBy: z.string().trim().min(1, 'updatedBy is required'),
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

export function parseQuestionDraftSheetRow(input: QuestionDraftSheetRowInput, rowNumber: number): QuestionDraftSheetRow {
  const parsed = rawQuestionDraftRowSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Row ${rowNumber} is invalid: ${formatSchemaError(parsed.error)}`)
  }

  try {
    return {
      draftId: parsed.data.draftId,
      version: parsed.data.version,
      sourceVersion: parsed.data.sourceVersion,
      status: parsed.data.status,
      questionId: parsed.data.questionId,
      structureRole: parsed.data.structureRole,
      category: parsed.data.category,
      questionWeight: parseNonNegativeNumber(parsed.data.questionWeight, 'questionWeight'),
      questionText: parsed.data.questionText,
      optionIndex: parseNonNegativeInteger(parsed.data.optionIndex, 'optionIndex'),
      optionText: parsed.data.optionText,
      scoreMap: parseScoreMapJson(parsed.data.scoreMapJson),
      isActive: parseBooleanFlag(parsed.data.isActive),
      changeSummary: parsed.data.changeSummary,
      updatedBy: parsed.data.updatedBy,
      updatedAt: parsed.data.updatedAt,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error'
    throw new Error(`Row ${rowNumber} is invalid: ${message}`)
  }
}

export function toQuestionDraftSheetRow(row: QuestionDraftSheetRow): string[] {
  return [
    row.draftId,
    row.version,
    row.sourceVersion,
    row.status,
    row.questionId,
    row.structureRole,
    row.category,
    String(row.questionWeight),
    row.questionText,
    String(row.optionIndex),
    row.optionText,
    JSON.stringify(row.scoreMap),
    row.isActive ? 'true' : 'false',
    row.changeSummary,
    row.updatedBy,
    row.updatedAt,
  ]
}
