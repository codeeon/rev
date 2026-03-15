import type { GoogleSheetsClient } from '@workspace/google-sheets'
import { getQuestionDraftDetail } from '../draft-source/load-question-drafts'
import { toQuestionDraftSheetRow, type QuestionDraftStatus } from '../draft-source/draft-sheet-schema'
import { loadQuestionSetFromSheet } from '../question-source/load-question-set'

export interface UpdateQuestionDraftQuestionInput {
  draftId: string
  questionId: string
  version: string
  sourceVersion: string
  status?: QuestionDraftStatus
  structureRole: 'noise_reduction' | 'core' | 'fine_tune' | 'closing'
  category: string
  questionWeight: number
  questionText: string
  isActive: boolean
  changeSummary: string
  updatedBy: string
  updatedAt: string
  options: Array<{
    optionIndex: number
    optionText: string
    scoreMap: Record<string, number>
  }>
}

export interface UpdateQuestionDraftQuestionOptions {
  client: GoogleSheetsClient
  spreadsheetId: string
  draftRange: string
  questionsRange: string
  input: UpdateQuestionDraftQuestionInput
}

function unquoteSheetName(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }

  return trimmed
}

function parseColumnRange(range: string): { sheetName: string; sheetTitle: string; startColumn: string; endColumn: string } | null {
  const separatorIndex = range.lastIndexOf('!')
  if (separatorIndex === -1) {
    return null
  }

  const sheetName = range.slice(0, separatorIndex)
  const a1Range = range.slice(separatorIndex + 1).trim()
  const match = a1Range.match(/^([A-Z]+)(?:\d+)?:([A-Z]+)(?:\d+)?$/i)
  if (!match) {
    return null
  }

  return {
    sheetName,
    sheetTitle: unquoteSheetName(sheetName),
    startColumn: match[1].toUpperCase(),
    endColumn: match[2].toUpperCase(),
  }
}

function buildRowRange(sheetName: string, startColumn: string, endColumn: string, rowNumber: number): string {
  return `${sheetName}!${startColumn}${rowNumber}:${endColumn}${rowNumber}`
}

function serializeScoreMap(scoreMap: Record<string, number>): string {
  return JSON.stringify(
    Object.entries(scoreMap)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, number>>((result, [key, value]) => {
        result[key] = value
        return result
      }, {}),
  )
}

export async function updateQuestionDraftQuestion(options: UpdateQuestionDraftQuestionOptions): Promise<{ updatedRowCount: number }> {
  const parsedRange = parseColumnRange(options.draftRange)
  if (!parsedRange) {
    throw new Error(`Unsupported question draft range: ${options.draftRange}`)
  }

  const publishedQuestionSet = await loadQuestionSetFromSheet({
    client: options.client,
    spreadsheetId: options.spreadsheetId,
    range: options.questionsRange,
  })
  const draftDetail = await getQuestionDraftDetail({
    client: options.client,
    spreadsheetId: options.spreadsheetId,
    range: options.draftRange,
    draftId: options.input.draftId,
    publishedQuestionSet,
  })
  if (!draftDetail) {
    throw new Error('question-draft-not-found')
  }
  if (draftDetail.status === 'published' || draftDetail.status === 'archived') {
    throw new Error(`question-draft-question-update-not-allowed: ${draftDetail.status}`)
  }

  const targetQuestion = draftDetail.questions.find(question => question.id === options.input.questionId)
  if (!targetQuestion) {
    throw new Error(`question-draft-question-not-found: ${options.input.questionId}`)
  }

  const existingOptionIndexes = targetQuestion.options.map(option => option.optionIndex).sort((left, right) => left - right)
  const nextOptionIndexes = options.input.options.map(option => option.optionIndex).sort((left, right) => left - right)
  if (JSON.stringify(existingOptionIndexes) !== JSON.stringify(nextOptionIndexes)) {
    throw new Error('question-draft-option-index-mismatch')
  }

  const optionMap = new Map(options.input.options.map(option => [option.optionIndex, option]))
  const nextStatus = options.input.status ?? draftDetail.status
  const data = targetQuestion.options.map(option => {
    const nextOption = optionMap.get(option.optionIndex)
    if (!nextOption) {
      throw new Error(`question-draft-option-not-found: ${option.optionIndex}`)
    }

    return {
      range: buildRowRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, option.rowNumber),
      values: [
        toQuestionDraftSheetRow({
          draftId: draftDetail.draftId,
          version: options.input.version,
          sourceVersion: options.input.sourceVersion,
          status: nextStatus,
          questionId: options.input.questionId,
          structureRole: options.input.structureRole,
          category: options.input.category,
          questionWeight: options.input.questionWeight,
          questionText: options.input.questionText,
          optionIndex: nextOption.optionIndex,
          optionText: nextOption.optionText,
          scoreMap: JSON.parse(serializeScoreMap(nextOption.scoreMap)),
          isActive: options.input.isActive,
          changeSummary: options.input.changeSummary,
          updatedBy: options.input.updatedBy,
          updatedAt: options.input.updatedAt,
        }),
      ],
    }
  })

  await options.client.values.batchUpdate({
    spreadsheetId: options.spreadsheetId,
    valueInputOption: 'RAW',
    data,
  })

  return {
    updatedRowCount: data.length,
  }
}
