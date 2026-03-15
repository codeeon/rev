import type { GoogleSheetsClient } from '@workspace/google-sheets'
import { getQuestionDraftDetail } from '../draft-source/load-question-drafts'
import { toQuestionDraftSheetRow, type QuestionDraftStatus } from '../draft-source/draft-sheet-schema'
import { loadQuestionSetFromSheet } from '../question-source/load-question-set'

export interface UpdateQuestionDraftStatusInput {
  draftId: string
  nextStatus: QuestionDraftStatus
  updatedBy: string
  updatedAt: string
  changeSummary?: string
}

export interface UpdateQuestionDraftStatusOptions {
  client: GoogleSheetsClient
  spreadsheetId: string
  draftRange: string
  questionsRange: string
  input: UpdateQuestionDraftStatusInput
}

function unquoteSheetName(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }

  return trimmed
}

function parseColumnRange(range: string): { sheetName: string; startColumn: string; endColumn: string } | null {
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
    sheetName: unquoteSheetName(sheetName) === sheetName ? sheetName : sheetName,
    startColumn: match[1].toUpperCase(),
    endColumn: match[2].toUpperCase(),
  }
}

function buildRowRange(sheetName: string, startColumn: string, endColumn: string, rowNumber: number): string {
  return `${sheetName}!${startColumn}${rowNumber}:${endColumn}${rowNumber}`
}

function assertAllowedStatusTransition(currentStatus: QuestionDraftStatus, nextStatus: QuestionDraftStatus): void {
  if (currentStatus === nextStatus) {
    return
  }

  const allowedTransitions: Record<QuestionDraftStatus, QuestionDraftStatus[]> = {
    draft: ['review-ready', 'archived'],
    'review-ready': ['draft', 'published', 'archived'],
    published: ['archived'],
    archived: ['draft'],
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new Error(`question-draft-status-transition-not-allowed: ${currentStatus} -> ${nextStatus}`)
  }
}

export async function updateQuestionDraftStatus(options: UpdateQuestionDraftStatusOptions): Promise<{ updatedRowCount: number }> {
  const parsedRange = parseColumnRange(options.draftRange)
  if (!parsedRange) {
    throw new Error(`Unsupported question draft range: ${options.draftRange}`)
  }

  const publishedQuestionSet = await loadQuestionSetFromSheet({
    client: options.client,
    spreadsheetId: options.spreadsheetId,
    range: options.questionsRange,
  })
  const detail = await getQuestionDraftDetail({
    client: options.client,
    spreadsheetId: options.spreadsheetId,
    range: options.draftRange,
    draftId: options.input.draftId,
    publishedQuestionSet,
  })
  if (!detail) {
    throw new Error('question-draft-not-found')
  }

  assertAllowedStatusTransition(detail.status, options.input.nextStatus)

  const questionById = new Map(detail.questions.map(question => [question.id, question]))
  const nextChangeSummary = options.input.changeSummary?.trim() || detail.changeSummary
  const data = detail.questions.flatMap(question => {
    const current = questionById.get(question.id)
    if (!current) {
      return []
    }

    return current.options.map(option => ({
      range: buildRowRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, option.rowNumber),
      values: [
        toQuestionDraftSheetRow({
          draftId: detail.draftId,
          version: detail.version,
          sourceVersion: detail.sourceVersion,
          status: options.input.nextStatus,
          questionId: current.id,
          structureRole: current.structureRole,
          category: current.category,
          questionWeight: current.questionWeight,
          questionText: current.text,
          optionIndex: option.optionIndex,
          optionText: option.text,
          scoreMap: option.scoreMap,
          isActive: current.isActive,
          changeSummary: nextChangeSummary,
          updatedBy: options.input.updatedBy,
          updatedAt: options.input.updatedAt,
        }),
      ],
    }))
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
