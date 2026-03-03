import type { EngineOption, EngineQuestion, StructureRole } from '@workspace/time-inference'
import { STRUCTURE_ROLES, type AdminSheetRow } from './admin-sheet-schema'

interface QuestionAccumulator {
  id: string
  structure_role: StructureRole
  category: string
  question_weight: number
  text: string
  options: Array<{ optionIndex: number; option: EngineOption }>
}

export interface NormalizedQuestionSet {
  version: string
  questions: EngineQuestion[]
  generatedAt: string
}

function compareQuestionId(left: string, right: string): number {
  const leftNumber = Number(left.replace(/[^0-9]/g, ''))
  const rightNumber = Number(right.replace(/[^0-9]/g, ''))

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }

  return left.localeCompare(right)
}

function assertSameQuestionMeta(base: QuestionAccumulator, row: AdminSheetRow): void {
  const metadataChanged =
    base.structure_role !== row.structureRole ||
    base.category !== row.category ||
    base.question_weight !== row.questionWeight ||
    base.text !== row.questionText

  if (metadataChanged) {
    throw new Error(`Question metadata mismatch for questionId=${row.questionId}`)
  }
}

function ensureRequiredStructureRoles(questions: EngineQuestion[]): void {
  const roleSet = new Set(questions.map(question => question.structure_role))
  const missing = STRUCTURE_ROLES.filter(role => !roleSet.has(role))

  if (missing.length > 0) {
    throw new Error(`Missing required structure roles: ${missing.join(', ')}`)
  }
}

export function normalizeAdminSheetRows(rows: AdminSheetRow[]): NormalizedQuestionSet {
  const activeRows = rows.filter(row => row.isActive)
  if (activeRows.length === 0) {
    throw new Error('No active rows found in admin sheet data')
  }

  const version = activeRows[0].version
  for (const row of activeRows) {
    if (row.version !== version) {
      throw new Error(`Version mismatch detected: expected=${version}, got=${row.version}`)
    }
  }

  const questionMap = new Map<string, QuestionAccumulator>()
  for (const row of activeRows) {
    const accumulator = questionMap.get(row.questionId)

    if (!accumulator) {
      questionMap.set(row.questionId, {
        id: row.questionId,
        structure_role: row.structureRole,
        category: row.category,
        question_weight: row.questionWeight,
        text: row.questionText,
        options: [
          {
            optionIndex: row.optionIndex,
            option: {
              text: row.optionText,
              score_map: row.scoreMap,
            },
          },
        ],
      })
      continue
    }

    assertSameQuestionMeta(accumulator, row)

    const hasDuplicateOption = accumulator.options.some(option => option.optionIndex === row.optionIndex)
    if (hasDuplicateOption) {
      throw new Error(`Duplicate optionIndex detected: questionId=${row.questionId}, optionIndex=${row.optionIndex}`)
    }

    accumulator.options.push({
      optionIndex: row.optionIndex,
      option: {
        text: row.optionText,
        score_map: row.scoreMap,
      },
    })
  }

  const questions = [...questionMap.values()]
    .sort((left, right) => compareQuestionId(left.id, right.id))
    .map<EngineQuestion>(question => ({
      id: question.id,
      structure_role: question.structure_role,
      category: question.category,
      question_weight: question.question_weight,
      text: question.text,
      options: question.options
        .sort((left, right) => left.optionIndex - right.optionIndex)
        .map(option => option.option),
    }))

  ensureRequiredStructureRoles(questions)

  return {
    version,
    questions,
    generatedAt: new Date().toISOString(),
  }
}
