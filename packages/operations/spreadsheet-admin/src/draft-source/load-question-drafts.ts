import type { EngineQuestion, StructureRole, ZishiName } from '@workspace/time-inference'
import type { GoogleSheetsClient, SheetCell, SheetRow } from '@workspace/google-sheets'
import { STRUCTURE_ROLES, type AdminSheetRow } from '../question-source/admin-sheet-schema'
import { normalizeAdminSheetRows, type NormalizedQuestionSet } from '../question-source/normalize'
import {
  QUESTION_DRAFT_SHEET_HEADERS,
  QUESTION_DRAFT_STATUSES,
  parseQuestionDraftSheetRow,
  type QuestionDraftSheetHeader,
  type QuestionDraftSheetRow,
  type QuestionDraftSheetRowInput,
  type QuestionDraftStatus,
} from './draft-sheet-schema'

export interface QuestionDraftSummary {
  draftId: string
  version: string
  sourceVersion: string
  status: QuestionDraftStatus
  changeSummary: string
  updatedBy: string
  updatedAt: string
  questionCount: number
  optionCount: number
  missingRoles: string[]
}

export interface ListQuestionDraftsInput {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  draftId?: string
  version?: string
  status?: QuestionDraftStatus
}

export interface ListQuestionDraftsResponse {
  items: QuestionDraftSummary[]
  matchedDraftId?: string
  matchedVersion?: string
  matchedStatus?: QuestionDraftStatus
}

export interface StoredQuestionDraftSheetRow extends QuestionDraftSheetRow {
  rowNumber: number
}

export interface EditableQuestionDraftOption {
  rowNumber: number
  optionIndex: number
  text: string
  scoreMap: Partial<Record<ZishiName, number>>
}

export interface EditableQuestionDraft {
  id: string
  structureRole: StructureRole
  category: string
  questionWeight: number
  text: string
  isActive: boolean
  options: EditableQuestionDraftOption[]
}

export interface QuestionDraftDiffItem {
  questionId: string
  changeType: 'added' | 'removed' | 'updated'
  changedFields: string[]
}

export interface QuestionDraftDiffSummary {
  totalChangedQuestions: number
  addedQuestionCount: number
  removedQuestionCount: number
  updatedQuestionCount: number
  items: QuestionDraftDiffItem[]
}

export interface QuestionDraftDetail {
  summary: QuestionDraftSummary
  draftId: string
  version: string
  sourceVersion: string
  status: QuestionDraftStatus
  changeSummary: string
  updatedBy: string
  updatedAt: string
  questions: EditableQuestionDraft[]
  diff: QuestionDraftDiffSummary
}

function toCellString(value: SheetCell | undefined): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return ''
}

function createHeaderIndex(headerRow: SheetRow): Map<QuestionDraftSheetHeader, number> {
  const headerIndex = new Map<QuestionDraftSheetHeader, number>()
  for (let index = 0; index < headerRow.length; index += 1) {
    const cell = toCellString(headerRow[index])
    if (!cell) {
      continue
    }

    if (QUESTION_DRAFT_SHEET_HEADERS.includes(cell as QuestionDraftSheetHeader)) {
      headerIndex.set(cell as QuestionDraftSheetHeader, index)
    }
  }

  return headerIndex
}

function assertRequiredHeaders(headerIndex: Map<QuestionDraftSheetHeader, number>): void {
  const missingHeaders = QUESTION_DRAFT_SHEET_HEADERS.filter(header => !headerIndex.has(header))
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`)
  }
}

function toQuestionDraftSheetRowInput(
  headerIndex: Map<QuestionDraftSheetHeader, number>,
  row: SheetRow,
): QuestionDraftSheetRowInput {
  const get = (header: QuestionDraftSheetHeader): string => {
    const index = headerIndex.get(header)
    if (typeof index !== 'number') {
      return ''
    }

    return toCellString(row[index])
  }

  return {
    draftId: get('draftId'),
    version: get('version'),
    sourceVersion: get('sourceVersion'),
    status: get('status'),
    questionId: get('questionId'),
    structureRole: get('structureRole'),
    category: get('category'),
    questionWeight: get('questionWeight'),
    questionText: get('questionText'),
    optionIndex: get('optionIndex'),
    optionText: get('optionText'),
    scoreMapJson: get('scoreMapJson'),
    isActive: get('isActive'),
    changeSummary: get('changeSummary'),
    updatedBy: get('updatedBy'),
    updatedAt: get('updatedAt'),
  }
}

function isEmptyRow(row: SheetRow): boolean {
  return row.every(cell => toCellString(cell) === '')
}

function unquoteSheetName(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }

  return trimmed
}

function parseSheetTitle(range: string): string | null {
  const separatorIndex = range.lastIndexOf('!')
  if (separatorIndex === -1) {
    return null
  }

  return unquoteSheetName(range.slice(0, separatorIndex))
}

async function hasTargetSheet(client: GoogleSheetsClient, spreadsheetId: string, range: string): Promise<boolean> {
  const sheetTitle = parseSheetTitle(range)
  if (!sheetTitle) {
    return true
  }

  const response = await client.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })

  return response.sheets?.some(sheet => sheet.properties?.title === sheetTitle) ?? false
}

function matchesFilters(
  row: QuestionDraftSheetRow,
  filters: {
    draftId?: string
    version?: string
    status?: QuestionDraftStatus
  },
): boolean {
  if (filters.draftId && row.draftId !== filters.draftId) {
    return false
  }

  if (filters.version && row.version !== filters.version) {
    return false
  }

  if (filters.status && row.status !== filters.status) {
    return false
  }

  return true
}

function toAdminSheetRow(row: QuestionDraftSheetRow): AdminSheetRow {
  return {
    version: row.version,
    questionId: row.questionId,
    structureRole: row.structureRole,
    category: row.category,
    questionWeight: row.questionWeight,
    questionText: row.questionText,
    optionIndex: row.optionIndex,
    optionText: row.optionText,
    scoreMap: row.scoreMap,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
  }
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildQuestionDraftSummary(rows: QuestionDraftSheetRow[]): QuestionDraftSummary {
  if (rows.length === 0) {
    throw new Error('Question draft group cannot be empty')
  }

  const first = rows[0]!
  for (const row of rows) {
    if (row.version !== first.version) {
      throw new Error(`Draft version mismatch detected for draftId=${first.draftId}`)
    }
    if (row.sourceVersion !== first.sourceVersion) {
      throw new Error(`Draft sourceVersion mismatch detected for draftId=${first.draftId}`)
    }
    if (row.status !== first.status) {
      throw new Error(`Draft status mismatch detected for draftId=${first.draftId}`)
    }
  }

  const latestMetadataRow = [...rows].sort((left, right) => parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt))[0] ?? first
  const normalized = normalizeAdminSheetRows(rows.map(toAdminSheetRow))
  const roleSet = new Set(normalized.questions.map(question => question.structure_role))

  return {
    draftId: first.draftId,
    version: first.version,
    sourceVersion: first.sourceVersion,
    status: first.status,
    changeSummary: latestMetadataRow.changeSummary,
    updatedBy: latestMetadataRow.updatedBy,
    updatedAt: latestMetadataRow.updatedAt,
    questionCount: normalized.questions.length,
    optionCount: normalized.questions.reduce((sum, question) => sum + question.options.length, 0),
    missingRoles: STRUCTURE_ROLES.filter(role => !roleSet.has(role)),
  }
}

function toStoredQuestionDraftRows(dataRows: SheetRow[], headerIndex: Map<QuestionDraftSheetHeader, number>): StoredQuestionDraftSheetRow[] {
  return dataRows
    .filter(row => !isEmptyRow(row))
    .map((row, rowIndex) => ({
      ...parseQuestionDraftSheetRow(toQuestionDraftSheetRowInput(headerIndex, row), rowIndex + 2),
      rowNumber: rowIndex + 2,
    }))
}

function buildEditableQuestionDrafts(rows: StoredQuestionDraftSheetRow[]): EditableQuestionDraft[] {
  const questionMap = new Map<string, EditableQuestionDraft>()

  for (const row of rows) {
    const current = questionMap.get(row.questionId)
    if (!current) {
      questionMap.set(row.questionId, {
        id: row.questionId,
        structureRole: row.structureRole,
        category: row.category,
        questionWeight: row.questionWeight,
        text: row.questionText,
        isActive: row.isActive,
        options: [
          {
            rowNumber: row.rowNumber,
            optionIndex: row.optionIndex,
            text: row.optionText,
            scoreMap: row.scoreMap,
          },
        ],
      })
      continue
    }

    const metadataChanged =
      current.structureRole !== row.structureRole ||
      current.category !== row.category ||
      current.questionWeight !== row.questionWeight ||
      current.text !== row.questionText ||
      current.isActive !== row.isActive
    if (metadataChanged) {
      throw new Error(`Question draft metadata mismatch for questionId=${row.questionId}`)
    }

    const hasDuplicateOption = current.options.some(option => option.optionIndex === row.optionIndex)
    if (hasDuplicateOption) {
      throw new Error(`Duplicate draft optionIndex detected: questionId=${row.questionId}, optionIndex=${row.optionIndex}`)
    }

    current.options.push({
      rowNumber: row.rowNumber,
      optionIndex: row.optionIndex,
      text: row.optionText,
      scoreMap: row.scoreMap,
    })
  }

  return [...questionMap.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(question => ({
      ...question,
      options: [...question.options].sort((left, right) => left.optionIndex - right.optionIndex),
    }))
}

function toEngineQuestions(questions: EditableQuestionDraft[]): EngineQuestion[] {
  return questions
    .filter(question => question.isActive)
    .map<EngineQuestion>(question => ({
      id: question.id,
      structure_role: question.structureRole,
      category: question.category,
      question_weight: question.questionWeight,
      text: question.text,
      options: question.options.map(option => ({
        text: option.text,
        score_map: option.scoreMap,
      })),
    }))
}

function serializeScoreMap(scoreMap: Partial<Record<ZishiName, number>>): string {
  return JSON.stringify(
    Object.entries(scoreMap)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, number>>((result, [key, value]) => {
        result[key] = value
        return result
      }, {}),
  )
}

function compareQuestion(left: EngineQuestion, right: EngineQuestion): string[] {
  const changedFields: string[] = []

  if (left.structure_role !== right.structure_role) {
    changedFields.push('structureRole')
  }
  if (left.category !== right.category) {
    changedFields.push('category')
  }
  if (left.question_weight !== right.question_weight) {
    changedFields.push('questionWeight')
  }
  if (left.text !== right.text) {
    changedFields.push('questionText')
  }
  if (left.options.length !== right.options.length) {
    changedFields.push('options.length')
    return changedFields
  }

  for (let index = 0; index < left.options.length; index += 1) {
    const leftOption = left.options[index]
    const rightOption = right.options[index]
    if (!leftOption || !rightOption) {
      changedFields.push(`option.${index}`)
      continue
    }
    if (leftOption.text !== rightOption.text) {
      changedFields.push(`option.${index}.text`)
    }
    if (serializeScoreMap(leftOption.score_map) !== serializeScoreMap(rightOption.score_map)) {
      changedFields.push(`option.${index}.scoreMap`)
    }
  }

  return changedFields
}

function buildQuestionDraftDiff(
  publishedQuestionSet: NormalizedQuestionSet,
  draftQuestions: EditableQuestionDraft[],
): QuestionDraftDiffSummary {
  const publishedById = new Map(publishedQuestionSet.questions.map(question => [question.id, question]))
  const draftById = new Map(toEngineQuestions(draftQuestions).map(question => [question.id, question]))
  const questionIds = new Set([...publishedById.keys(), ...draftById.keys()])
  const items: QuestionDraftDiffItem[] = []

  for (const questionId of [...questionIds].sort((left, right) => left.localeCompare(right))) {
    const publishedQuestion = publishedById.get(questionId)
    const draftQuestion = draftById.get(questionId)

    if (!publishedQuestion && draftQuestion) {
      items.push({
        questionId,
        changeType: 'added',
        changedFields: ['question'],
      })
      continue
    }

    if (publishedQuestion && !draftQuestion) {
      items.push({
        questionId,
        changeType: 'removed',
        changedFields: ['question'],
      })
      continue
    }

    if (publishedQuestion && draftQuestion) {
      const changedFields = compareQuestion(publishedQuestion, draftQuestion)
      if (changedFields.length > 0) {
        items.push({
          questionId,
          changeType: 'updated',
          changedFields,
        })
      }
    }
  }

  return {
    totalChangedQuestions: items.length,
    addedQuestionCount: items.filter(item => item.changeType === 'added').length,
    removedQuestionCount: items.filter(item => item.changeType === 'removed').length,
    updatedQuestionCount: items.filter(item => item.changeType === 'updated').length,
    items,
  }
}

export async function getQuestionDraftDetail(input: {
  client: GoogleSheetsClient
  spreadsheetId: string
  range: string
  draftId: string
  publishedQuestionSet: NormalizedQuestionSet
}): Promise<QuestionDraftDetail | null> {
  const sheetExists = await hasTargetSheet(input.client, input.spreadsheetId, input.range)
  if (!sheetExists) {
    return null
  }

  const response = await input.client.values.get({
    spreadsheetId: input.spreadsheetId,
    range: input.range,
  })
  const values = response.values ?? []
  if (values.length < 2) {
    return null
  }

  const [headerRow, ...dataRows] = values
  const headerIndex = createHeaderIndex(headerRow)
  assertRequiredHeaders(headerIndex)

  const rows = toStoredQuestionDraftRows(dataRows, headerIndex).filter(row => row.draftId === input.draftId)
  if (rows.length === 0) {
    return null
  }

  const summary = buildQuestionDraftSummary(rows)
  const questions = buildEditableQuestionDrafts(rows)

  return {
    summary,
    draftId: summary.draftId,
    version: summary.version,
    sourceVersion: summary.sourceVersion,
    status: summary.status,
    changeSummary: summary.changeSummary,
    updatedBy: summary.updatedBy,
    updatedAt: summary.updatedAt,
    questions,
    diff: buildQuestionDraftDiff(input.publishedQuestionSet, questions),
  }
}

export async function listQuestionDrafts(input: ListQuestionDraftsInput): Promise<ListQuestionDraftsResponse> {
  const filters = {
    draftId: input.draftId,
    version: input.version,
    status: input.status,
  }

  const sheetExists = await hasTargetSheet(input.client, input.spreadsheetId, input.range)
  if (!sheetExists) {
    return {
      items: [],
      matchedDraftId: input.draftId,
      matchedVersion: input.version,
      matchedStatus: input.status,
    }
  }

  const response = await input.client.values.get({
    spreadsheetId: input.spreadsheetId,
    range: input.range,
  })
  const values = response.values ?? []
  if (values.length < 2) {
    return {
      items: [],
      matchedDraftId: input.draftId,
      matchedVersion: input.version,
      matchedStatus: input.status,
    }
  }

  const [headerRow, ...dataRows] = values
  const headerIndex = createHeaderIndex(headerRow)
  assertRequiredHeaders(headerIndex)

  const parsedRows = toStoredQuestionDraftRows(dataRows, headerIndex).filter(row => matchesFilters(row, filters))

  const groupedRows = new Map<string, QuestionDraftSheetRow[]>()
  for (const row of parsedRows) {
    const group = groupedRows.get(row.draftId)
    if (group) {
      group.push(row)
      continue
    }
    groupedRows.set(row.draftId, [row])
  }

  const items = [...groupedRows.values()]
    .map(rows => buildQuestionDraftSummary(rows))
    .sort((left, right) => parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt))

  return {
    items,
    matchedDraftId: input.draftId,
    matchedVersion: input.version,
    matchedStatus: input.status,
  }
}
