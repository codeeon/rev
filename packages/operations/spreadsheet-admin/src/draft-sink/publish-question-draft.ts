import type { GoogleSheetsClient } from '@workspace/google-sheets'
import { ADMIN_SHEET_HEADERS } from '../question-source/admin-sheet-schema'
import { getQuestionDraftDetail } from '../draft-source/load-question-drafts'
import type { QuestionDraftStatus } from '../draft-source/draft-sheet-schema'
import { loadQuestionSetFromSheet } from '../question-source/load-question-set'

export interface PublishQuestionDraftInput {
  client: GoogleSheetsClient
  spreadsheetId: string
  questionsRange: string
  draftRange: string
  draftId: string
  publishedBy: string
  publishedAt: string
  allowedStatuses?: QuestionDraftStatus[]
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

function buildRange(sheetName: string, startColumn: string, endColumn: string, startRow: number, endRow: number): string {
  return `${sheetName}!${startColumn}${startRow}:${endColumn}${endRow}`
}

function toQuestionSheetRows(detail: NonNullable<Awaited<ReturnType<typeof getQuestionDraftDetail>>>, publishedAt: string): string[][] {
  return detail.questions.flatMap(question =>
    question.options.map(option => [
      detail.version,
      question.id,
      question.structureRole,
      question.category,
      String(question.questionWeight),
      question.text,
      String(option.optionIndex),
      option.text,
      JSON.stringify(option.scoreMap),
      question.isActive ? 'true' : 'false',
      publishedAt,
    ]),
  )
}

async function getSheetRowCount(client: GoogleSheetsClient, spreadsheetId: string, sheetTitle: string): Promise<number | null> {
  const response = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title,sheets.properties.gridProperties.rowCount',
  })

  const matchingSheet = response.sheets?.find(sheet => sheet.properties?.title === sheetTitle)
  return matchingSheet?.properties?.gridProperties?.rowCount ?? null
}

export async function publishQuestionDraft(input: PublishQuestionDraftInput): Promise<{
  publishedVersion: string
  sourceVersion: string
  questionCount: number
  optionCount: number
  updatedRowCount: number
}> {
  const publishedQuestionSet = await loadQuestionSetFromSheet({
    client: input.client,
    spreadsheetId: input.spreadsheetId,
    range: input.questionsRange,
  })
  const draftDetail = await getQuestionDraftDetail({
    client: input.client,
    spreadsheetId: input.spreadsheetId,
    range: input.draftRange,
    draftId: input.draftId,
    publishedQuestionSet,
  })
  if (!draftDetail) {
    throw new Error('question-draft-not-found')
  }
  const allowedStatuses = input.allowedStatuses ?? ['review-ready']
  if (!allowedStatuses.includes(draftDetail.status)) {
    throw new Error(`question-draft-not-ready-for-publish: ${draftDetail.status}`)
  }

  const parsedQuestionsRange = parseColumnRange(input.questionsRange)
  if (!parsedQuestionsRange) {
    throw new Error(`Unsupported questions range: ${input.questionsRange}`)
  }

  const rows = [ADMIN_SHEET_HEADERS.map(header => header), ...toQuestionSheetRows(draftDetail, input.publishedAt)]
  const sheetRowCount = await getSheetRowCount(input.client, input.spreadsheetId, parsedQuestionsRange.sheetTitle)
  const data: Array<{ range: string; values: string[][] }> = [
    {
      range: buildRange(parsedQuestionsRange.sheetName, parsedQuestionsRange.startColumn, parsedQuestionsRange.endColumn, 1, rows.length),
      values: rows,
    },
  ]

  if (sheetRowCount && sheetRowCount > rows.length) {
    data.push({
      range: buildRange(
        parsedQuestionsRange.sheetName,
        parsedQuestionsRange.startColumn,
        parsedQuestionsRange.endColumn,
        rows.length + 1,
        sheetRowCount,
      ),
      values: Array.from({ length: sheetRowCount - rows.length }, () => Array(ADMIN_SHEET_HEADERS.length).fill('')),
    })
  }

  await input.client.values.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    valueInputOption: 'RAW',
    data,
  })

  return {
    publishedVersion: draftDetail.version,
    sourceVersion: draftDetail.sourceVersion,
    questionCount: draftDetail.summary.questionCount,
    optionCount: draftDetail.summary.optionCount,
    updatedRowCount: rows.length - 1,
  }
}
