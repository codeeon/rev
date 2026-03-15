import {
  createServiceAccountTokenProvider,
  createSheetsClient,
  GoogleSheetsHttpError,
  loadServiceAccountCredentialsFromEnv,
  type GoogleSheetsClient,
} from '@workspace/google-sheets/server'
import type { EngineQuestion } from '@workspace/time-inference'
import { appendAdminAuditEvent } from '../audit-sink/append-admin-audit'
import {
  getAdminAuditActionFamily,
  type AdminAuditActionFamily,
  type AdminAuditRecord,
} from '../audit-sink/admin-audit-schema'
import {
  listAdminAuditEvents,
  type ListAdminAuditEventsResponse,
} from '../audit-source/read-admin-audit'
import { appendApprovalLogEntry } from '../approval-sink/append-approval-log'
import type { ApprovalLogRecord } from '../approval-sink/approval-log-schema'
import {
  listApprovalLogEntries,
  type StoredApprovalLogRecord,
  type ListApprovalLogEntriesResponse,
} from '../approval-source/read-approval-log'
import { appendApprovalRequest } from '../approval-request-sink/append-approval-request'
import type {
  ApprovalRequestRecord,
  ApprovalRequestStatus,
} from '../approval-request-sink/approval-request-schema'
import {
  listApprovalRequests,
  type ListApprovalRequestsResponse,
  type StoredApprovalRequestRecord,
} from '../approval-request-source/read-approval-requests'
import { createQuestionDraftSnapshot } from '../draft-sink/create-question-draft'
import {
  getQuestionDraftDetail,
  listQuestionDrafts,
  type QuestionDraftDetail,
  type ListQuestionDraftsResponse,
} from '../draft-source/load-question-drafts'
import type { QuestionDraftStatus } from '../draft-source/draft-sheet-schema'
import { loadQuestionSetFromSheet } from '../question-source/load-question-set'
import type { NormalizedQuestionSet } from '../question-source/normalize'
import { appendAnalysisResult } from '../result-sink/append-result'
import type { AnalysisResultRecord, BirthTimeKnowledge } from '../result-sink/result-schema'
import {
  getAnalysisResultBySessionId,
  listAnalysisResults,
  type ListAnalysisResultsResponse,
  type StoredAnalysisResultRecord,
} from '../result-source/read-results'
import { InMemoryLastKnownGoodStore, type LastKnownGoodStore } from '../sync/last-known-good'
import { syncQuestionSetWithFallback } from '../sync/sync-from-sheet'
import { updateQuestionDraftQuestion } from '../draft-sink/update-question-draft'
import { updateQuestionDraftStatus } from '../draft-sink/update-question-draft-status'
import { publishQuestionDraft } from '../draft-sink/publish-question-draft'

declare global {
  var __spreadsheetAdminQuestionSetStore: InMemoryLastKnownGoodStore | undefined
}

const DEFAULT_QUESTIONS_RANGE = 'Questions!A:K'
const DEFAULT_RESULTS_RANGE = 'Results!A:J'
const DEFAULT_QUESTION_DRAFTS_RANGE = 'QuestionDrafts!A:P'
const DEFAULT_ADMIN_AUDIT_RANGE = 'AdminAuditLog!A:H'
const DEFAULT_ADMIN_ACCESS_AUDIT_RANGE = 'AdminAccessLog!A:H'
const DEFAULT_ADMIN_MUTATION_AUDIT_RANGE = 'AdminMutationLog!A:H'
const DEFAULT_APPROVAL_LOG_RANGE = 'ApprovalLog!A:J'
const DEFAULT_APPROVAL_REQUESTS_RANGE = 'ApprovalRequests!A:L'

interface SpreadsheetAdminConfig {
  spreadsheetId: string
  questionsRange: string
  resultsRange: string
  questionDraftsRange: string
  adminAuditRange: string
  adminAccessAuditRange: string
  adminMutationAuditRange: string
  approvalLogRange: string
  approvalRequestsRange: string
}

interface SpreadsheetAdminEnvDebugSummary {
  spreadsheetId: string | null
  questionsRange: string | null
  resultsRange: string | null
  questionDraftsRange: string | null
  adminAuditRange: string | null
  adminAccessAuditRange: string | null
  adminMutationAuditRange: string | null
  approvalLogRange: string | null
  approvalRequestsRange: string | null
  serviceAccountEmail: string | null
  serviceAccountPrivateKeyPresent: boolean
  serviceAccountPrivateKeyIdPresent: boolean
  serviceAccountSubjectPresent: boolean
  serviceAccountPrivateKeyDiagnostics: {
    hasBeginMarker: boolean
    hasEndMarker: boolean
    actualNewlineCount: number
    escapedNewlineCount: number
    hasWrappingQuotes: boolean
    startsWithBeginMarkerAfterTrim: boolean
    endsWithEndMarkerAfterTrim: boolean
  }
}

export interface QuestionSyncResponse {
  source: 'spreadsheet-latest' | 'spreadsheet-fallback'
  questionVersion: string
  questions: EngineQuestion[]
  warning?: string
}

export interface SaveResultResponse {
  saved: boolean
  reason?: 'not-configured' | 'save-failed'
}

export interface SaveAdminAuditResponse {
  saved: boolean
  reason?: 'not-configured' | 'save-failed'
}

export interface SaveApprovalLogResponse {
  saved: boolean
  reason?: 'not-configured' | 'save-failed'
}

export interface SaveApprovalRequestResponse {
  saved: boolean
  reason?: 'not-configured' | 'save-failed'
}

export interface ListAdminAuditOptions {
  limit?: number
  actionFamily?: AdminAuditActionFamily
  action?: AdminAuditRecord['action']
  actorEmail?: string
  subjectType?: AdminAuditRecord['subjectType']
}

export interface ListApprovalLogOptions {
  limit?: number
  approvalId?: string
  actorEmail?: string
  draftId?: string
}

export interface ListApprovalRequestsOptions {
  limit?: number
  requestId?: string
  draftId?: string
  status?: ApprovalRequestStatus
}

export interface ListAdminResultsOptions {
  limit?: number
  sessionId?: string
  questionVersion?: string
  birthTimeKnowledge?: BirthTimeKnowledge
}

export interface ListQuestionDraftsOptions {
  draftId?: string
  version?: string
  status?: QuestionDraftStatus
}

export interface CreateQuestionDraftInput {
  version: string
  sourceVersion?: string
  changeSummary: string
  updatedBy: string
}

export interface CreateQuestionDraftResponse {
  draftId: string
  version: string
  sourceVersion: string
  status: QuestionDraftStatus
  changeSummary: string
  updatedBy: string
  updatedAt: string
  questionCount: number
  optionCount: number
  appendedRowCount: number
  missingRoles: string[]
}

export interface UpdateQuestionDraftInput {
  draftId: string
  questionId: string
  version: string
  sourceVersion: string
  structureRole: 'noise_reduction' | 'core' | 'fine_tune' | 'closing'
  category: string
  questionWeight: number
  questionText: string
  isActive: boolean
  changeSummary: string
  updatedBy: string
  options: Array<{
    optionIndex: number
    optionText: string
    scoreMap: Record<string, number>
  }>
}

export interface UpdateQuestionDraftResponse {
  draftId: string
  questionId: string
  updatedBy: string
  updatedAt: string
  updatedRowCount: number
  missingRoles: string[]
}

export interface UpdateQuestionDraftStatusInput {
  draftId: string
  nextStatus: QuestionDraftStatus
  updatedBy: string
  changeSummary?: string
}

export interface UpdateQuestionDraftStatusResponse {
  draftId: string
  status: QuestionDraftStatus
  updatedBy: string
  updatedAt: string
  updatedRowCount: number
}

export interface PublishQuestionDraftInput {
  draftId: string
  approvalRequestId?: string
  publishedBy: string
  publishedByRole?: string | null
  changeSummary?: string
  approvalComment?: string
}

export interface PublishQuestionDraftResponse {
  draftId: string
  publishedVersion: string
  sourceVersion: string
  updatedRowCount: number
  questionCount: number
  optionCount: number
  publishedBy: string
  publishedAt: string
}

export interface RollbackApprovalInput {
  approvalId: string
  rolledBackBy: string
  rolledBackByRole?: string | null
  changeSummary?: string
  approvalComment?: string
}

export interface RollbackApprovalResponse extends PublishQuestionDraftResponse {
  sourceApprovalId: string
  rollbackApprovalId: string
  sourceDraftId: string
  sourcePublishedVersion: string
}

export interface CreateApprovalRequestInput {
  draftId: string
  requestedBy: string
  requestComment?: string
}

export interface CreateApprovalRequestResponse {
  requestId: string
  draftId: string
  version: string
  sourceVersion: string
  draftUpdatedAt: string
  status: ApprovalRequestStatus
  requestedBy: string
  requestedAt: string
  requestComment?: string | null
}

export interface UpdateApprovalRequestStatusInput {
  requestId: string
  nextStatus: Extract<ApprovalRequestStatus, 'approved' | 'rejected'>
  reviewedBy: string
  reviewComment?: string
}

export interface UpdateApprovalRequestStatusResponse {
  requestId: string
  draftId: string
  status: Extract<ApprovalRequestStatus, 'approved' | 'rejected'>
  reviewedBy: string
  reviewedAt: string
  reviewComment?: string | null
}

export interface SpreadsheetAdminRuntimeDeps {
  createClient?: (env: NodeJS.ProcessEnv) => GoogleSheetsClient
  store?: LastKnownGoodStore
}

const defaultQuestionSetStore = globalThis.__spreadsheetAdminQuestionSetStore ?? new InMemoryLastKnownGoodStore()
globalThis.__spreadsheetAdminQuestionSetStore = defaultQuestionSetStore

function readEnvValue(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key]?.trim()
  return value ? value : null
}

function shouldLogDebug(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'development' || env.DEBUG_SPREADSHEET_ADMIN === 'true'
}

function maskValue(value: string | null, visibleStart = 4, visibleEnd = 4): string | null {
  if (!value) {
    return null
  }

  if (value.length <= visibleStart + visibleEnd) {
    return `${value.slice(0, 1)}***`
  }

  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`
}

function maskEmail(value: string | null): string | null {
  if (!value) {
    return null
  }

  const [localPart, domain] = value.split('@')
  if (!domain) {
    return maskValue(value, 2, 2)
  }

  const visibleLocal = localPart.length <= 2 ? `${localPart.slice(0, 1)}***` : `${localPart.slice(0, 2)}***`
  return `${visibleLocal}@${domain}`
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length
}

function getPrivateKeyDiagnostics(rawValue: string | undefined): SpreadsheetAdminEnvDebugSummary['serviceAccountPrivateKeyDiagnostics'] {
  const value = rawValue ?? ''
  const trimmed = value.trim()

  return {
    hasBeginMarker: value.includes('-----BEGIN PRIVATE KEY-----'),
    hasEndMarker: value.includes('-----END PRIVATE KEY-----'),
    actualNewlineCount: countMatches(value, /\n/g),
    escapedNewlineCount: countMatches(value, /\\n/g),
    hasWrappingQuotes:
      (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")),
    startsWithBeginMarkerAfterTrim: trimmed.startsWith('-----BEGIN PRIVATE KEY-----'),
    endsWithEndMarkerAfterTrim: trimmed.endsWith('-----END PRIVATE KEY-----') || trimmed.endsWith('-----END PRIVATE KEY-----\\n'),
  }
}

function getEnvDebugSummary(env: NodeJS.ProcessEnv): SpreadsheetAdminEnvDebugSummary {
  return {
    spreadsheetId: maskValue(readEnvValue(env, 'GOOGLE_SPREADSHEET_ADMIN_ID')),
    questionsRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_QUESTIONS_RANGE') ?? DEFAULT_QUESTIONS_RANGE,
    resultsRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_RESULTS_RANGE') ?? DEFAULT_RESULTS_RANGE,
    questionDraftsRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_QUESTION_DRAFTS_RANGE') ?? DEFAULT_QUESTION_DRAFTS_RANGE,
    adminAuditRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_ADMIN_AUDIT_RANGE') ?? DEFAULT_ADMIN_AUDIT_RANGE,
    adminAccessAuditRange:
      readEnvValue(env, 'GOOGLE_SPREADSHEET_ADMIN_ACCESS_AUDIT_RANGE') ?? DEFAULT_ADMIN_ACCESS_AUDIT_RANGE,
    adminMutationAuditRange:
      readEnvValue(env, 'GOOGLE_SPREADSHEET_ADMIN_MUTATION_AUDIT_RANGE') ?? DEFAULT_ADMIN_MUTATION_AUDIT_RANGE,
    approvalLogRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_APPROVAL_LOG_RANGE') ?? DEFAULT_APPROVAL_LOG_RANGE,
    approvalRequestsRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_APPROVAL_REQUESTS_RANGE') ?? DEFAULT_APPROVAL_REQUESTS_RANGE,
    serviceAccountEmail: maskEmail(readEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_EMAIL')),
    serviceAccountPrivateKeyPresent: Boolean(readEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')),
    serviceAccountPrivateKeyIdPresent: Boolean(readEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID')),
    serviceAccountSubjectPresent: Boolean(readEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_SUBJECT')),
    serviceAccountPrivateKeyDiagnostics: getPrivateKeyDiagnostics(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getErrorDebugPayload(error: unknown): Record<string, unknown> {
  if (error instanceof GoogleSheetsHttpError) {
    return {
      errorCode: error.code,
      errorStatus: error.status,
      errorDetails: error.details,
    }
  }

  if (error instanceof Error) {
    return {
      errorCode: 'ERROR',
      errorName: error.name,
    }
  }

  return {
    errorCode: 'UNKNOWN',
  }
}

function debugLog(env: NodeJS.ProcessEnv, message: string, payload?: unknown): void {
  if (!shouldLogDebug(env)) {
    return
  }

  if (payload) {
    console.info(`[spreadsheet-admin] ${message}`, payload)
    return
  }

  console.info(`[spreadsheet-admin] ${message}`)
}

function warnLog(env: NodeJS.ProcessEnv, message: string, payload?: unknown): void {
  if (!shouldLogDebug(env)) {
    return
  }

  if (payload) {
    console.warn(`[spreadsheet-admin] ${message}`, payload)
    return
  }

  console.warn(`[spreadsheet-admin] ${message}`)
}

function errorLog(env: NodeJS.ProcessEnv, message: string, payload?: unknown): void {
  if (!shouldLogDebug(env)) {
    return
  }

  if (payload) {
    console.error(`[spreadsheet-admin] ${message}`, payload)
    return
  }

  console.error(`[spreadsheet-admin] ${message}`)
}

function isServiceAccountConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(readEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_EMAIL') && readEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'))
}

function getSpreadsheetAdminConfig(env: NodeJS.ProcessEnv): SpreadsheetAdminConfig | null {
  const spreadsheetId = readEnvValue(env, 'GOOGLE_SPREADSHEET_ADMIN_ID')
  if (!spreadsheetId) {
    return null
  }

  return {
    spreadsheetId,
    questionsRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_QUESTIONS_RANGE') ?? DEFAULT_QUESTIONS_RANGE,
    resultsRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_RESULTS_RANGE') ?? DEFAULT_RESULTS_RANGE,
    questionDraftsRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_QUESTION_DRAFTS_RANGE') ?? DEFAULT_QUESTION_DRAFTS_RANGE,
    adminAuditRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_ADMIN_AUDIT_RANGE') ?? DEFAULT_ADMIN_AUDIT_RANGE,
    adminAccessAuditRange:
      readEnvValue(env, 'GOOGLE_SPREADSHEET_ADMIN_ACCESS_AUDIT_RANGE') ?? DEFAULT_ADMIN_ACCESS_AUDIT_RANGE,
    adminMutationAuditRange:
      readEnvValue(env, 'GOOGLE_SPREADSHEET_ADMIN_MUTATION_AUDIT_RANGE') ?? DEFAULT_ADMIN_MUTATION_AUDIT_RANGE,
    approvalLogRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_APPROVAL_LOG_RANGE') ?? DEFAULT_APPROVAL_LOG_RANGE,
    approvalRequestsRange: readEnvValue(env, 'GOOGLE_SPREADSHEET_APPROVAL_REQUESTS_RANGE') ?? DEFAULT_APPROVAL_REQUESTS_RANGE,
  }
}

function createGoogleSheetsClientFromEnv(env: NodeJS.ProcessEnv): GoogleSheetsClient {
  const credentials = loadServiceAccountCredentialsFromEnv(env)
  const tokenProvider = createServiceAccountTokenProvider({ credentials })

  return createSheetsClient({
    tokenProvider,
    userAgent: 'rev-workspace/spreadsheet-admin',
  })
}

function toQuestionResponse(questionSet: NormalizedQuestionSet, source: 'latest' | 'last-known-good'): QuestionSyncResponse {
  return {
    source: source === 'latest' ? 'spreadsheet-latest' : 'spreadsheet-fallback',
    questionVersion: questionSet.version,
    questions: questionSet.questions,
  }
}

function getClient(env: NodeJS.ProcessEnv, deps: SpreadsheetAdminRuntimeDeps): GoogleSheetsClient {
  return deps.createClient ? deps.createClient(env) : createGoogleSheetsClientFromEnv(env)
}

function getStore(deps: SpreadsheetAdminRuntimeDeps): LastKnownGoodStore {
  return deps.store ?? defaultQuestionSetStore
}

function getQuestionSetMissingRoles(questionSet: NormalizedQuestionSet): string[] {
  const requiredRoles = ['noise_reduction', 'core', 'fine_tune', 'closing']
  const roleSet = new Set(questionSet.questions.map(question => question.structure_role))

  return requiredRoles.filter(role => !roleSet.has(role as EngineQuestion['structure_role']))
}

export async function syncQuestionsFromSpreadsheet(
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<QuestionSyncResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'question sync env summary', envSummary)

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'question sync aborted because spreadsheet env is incomplete', {
      ...envSummary,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-sync-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const synced = await syncQuestionSetWithFallback({
      store: getStore(deps),
      loadLatest: async () =>
        loadQuestionSetFromSheet({
          client,
          spreadsheetId: config.spreadsheetId,
          range: config.questionsRange,
        }),
    })

    debugLog(env, 'question sync completed', {
      ...envSummary,
      source: synced.source,
      questionVersion: synced.questionSet.version,
      questionCount: synced.questionSet.questions.length,
    })

    return toQuestionResponse(synced.questionSet, synced.source)
  } catch (error) {
    errorLog(env, 'question sync failed', {
      ...envSummary,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function saveAnalysisResultToSpreadsheet(
  record: AnalysisResultRecord,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<SaveResultResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'result save env summary', {
    ...envSummary,
    sessionId: record.sessionId,
    questionVersion: record.questionVersion,
    birthTimeKnowledge: record.birthTimeKnowledge,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'result save skipped because spreadsheet env is incomplete', {
      ...envSummary,
      sessionId: record.sessionId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    return { saved: false, reason: 'not-configured' }
  }

  try {
    const client = getClient(env, deps)
    await appendAnalysisResult({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.resultsRange,
      record,
    })

    debugLog(env, 'result save completed', {
      ...envSummary,
      sessionId: record.sessionId,
      resultsRange: config.resultsRange,
    })

    return { saved: true }
  } catch (error) {
    errorLog(env, 'result save failed', {
      ...envSummary,
      sessionId: record.sessionId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    return { saved: false, reason: 'save-failed' }
  }
}

export async function saveAdminAuditEventToSpreadsheet(
  record: AdminAuditRecord,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<SaveAdminAuditResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'admin audit save env summary', {
    ...envSummary,
    eventId: record.eventId,
    action: record.action,
    actionFamily: getAdminAuditActionFamily(record.action),
    subjectId: record.subjectId,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'admin audit save skipped because spreadsheet env is incomplete', {
      ...envSummary,
      eventId: record.eventId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    return { saved: false, reason: 'not-configured' }
  }

  try {
    const client = getClient(env, deps)
    const actionFamily = getAdminAuditActionFamily(record.action)
    const primaryRange = actionFamily === 'access' ? config.adminAccessAuditRange : config.adminMutationAuditRange

    await appendAdminAuditEvent({
      client,
      spreadsheetId: config.spreadsheetId,
      range: primaryRange,
      record,
    })

    await appendAdminAuditEvent({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.adminAuditRange,
      record,
    })

    debugLog(env, 'admin audit save completed', {
      ...envSummary,
      eventId: record.eventId,
      adminAuditRange: config.adminAuditRange,
      splitAuditRange: primaryRange,
    })

    return { saved: true }
  } catch (error) {
    errorLog(env, 'admin audit save failed', {
      ...envSummary,
      eventId: record.eventId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    return { saved: false, reason: 'save-failed' }
  }
}

export async function saveApprovalLogEntryToSpreadsheet(
  record: ApprovalLogRecord,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<SaveApprovalLogResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'approval log save env summary', {
    ...envSummary,
    approvalId: record.approvalId,
    draftId: record.draftId,
    publishedVersion: record.publishedVersion,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'approval log save skipped because spreadsheet env is incomplete', {
      ...envSummary,
      approvalId: record.approvalId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    return { saved: false, reason: 'not-configured' }
  }

  try {
    const client = getClient(env, deps)
    await appendApprovalLogEntry({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.approvalLogRange,
      record,
    })

    debugLog(env, 'approval log save completed', {
      ...envSummary,
      approvalId: record.approvalId,
      approvalLogRange: config.approvalLogRange,
    })

    return { saved: true }
  } catch (error) {
    errorLog(env, 'approval log save failed', {
      ...envSummary,
      approvalId: record.approvalId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    return { saved: false, reason: 'save-failed' }
  }
}

export async function saveApprovalRequestToSpreadsheet(
  record: ApprovalRequestRecord,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<SaveApprovalRequestResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'approval request save env summary', {
    ...envSummary,
    requestId: record.requestId,
    draftId: record.draftId,
    status: record.status,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'approval request save skipped because spreadsheet env is incomplete', {
      ...envSummary,
      requestId: record.requestId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    return { saved: false, reason: 'not-configured' }
  }

  try {
    const client = getClient(env, deps)
    await appendApprovalRequest({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.approvalRequestsRange,
      record,
    })

    debugLog(env, 'approval request save completed', {
      ...envSummary,
      requestId: record.requestId,
      approvalRequestsRange: config.approvalRequestsRange,
    })

    return { saved: true }
  } catch (error) {
    errorLog(env, 'approval request save failed', {
      ...envSummary,
      requestId: record.requestId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    return { saved: false, reason: 'save-failed' }
  }
}

export async function listAdminAuditEventsFromSpreadsheet(
  options: ListAdminAuditOptions = {},
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<ListAdminAuditEventsResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'admin audit list env summary', {
    ...envSummary,
    limit: options.limit ?? null,
    actionFamily: options.actionFamily ?? null,
    action: options.action ?? null,
    actorEmail: maskEmail(options.actorEmail ?? null),
    subjectType: options.subjectType ?? null,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'admin audit list aborted because spreadsheet env is incomplete', {
      ...envSummary,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-admin-audit-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const auditRange =
      options.actionFamily === 'access'
        ? config.adminAccessAuditRange
        : options.actionFamily === 'mutation'
          ? config.adminMutationAuditRange
          : config.adminAuditRange
    const payload = await listAdminAuditEvents({
      client,
      spreadsheetId: config.spreadsheetId,
      range: auditRange,
      limit: options.limit,
      actionFamily: options.actionFamily,
      action: options.action,
      actorEmail: options.actorEmail,
      subjectType: options.subjectType,
    })

    debugLog(env, 'admin audit list completed', {
      ...envSummary,
      returnedCount: payload.items.length,
      limit: payload.limit,
      auditRange,
    })

    return payload
  } catch (error) {
    errorLog(env, 'admin audit list failed', {
      ...envSummary,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function listApprovalLogEntriesFromSpreadsheet(
  options: ListApprovalLogOptions = {},
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<ListApprovalLogEntriesResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'approval log list env summary', {
    ...envSummary,
    limit: options.limit ?? null,
    approvalId: options.approvalId ?? null,
    actorEmail: maskEmail(options.actorEmail ?? null),
    draftId: options.draftId ?? null,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'approval log list aborted because spreadsheet env is incomplete', {
      ...envSummary,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-approval-log-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const payload = await listApprovalLogEntries({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.approvalLogRange,
      limit: options.limit,
      approvalId: options.approvalId,
      actorEmail: options.actorEmail,
      draftId: options.draftId,
    })

    debugLog(env, 'approval log list completed', {
      ...envSummary,
      returnedCount: payload.items.length,
      limit: payload.limit,
    })

    return payload
  } catch (error) {
    errorLog(env, 'approval log list failed', {
      ...envSummary,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function listApprovalRequestsFromSpreadsheet(
  options: ListApprovalRequestsOptions = {},
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<ListApprovalRequestsResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'approval request list env summary', {
    ...envSummary,
    limit: options.limit ?? null,
    requestId: options.requestId ?? null,
    draftId: options.draftId ?? null,
    status: options.status ?? null,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'approval request list aborted because spreadsheet env is incomplete', {
      ...envSummary,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-approval-requests-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const payload = await listApprovalRequests({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.approvalRequestsRange,
      limit: options.limit,
      requestId: options.requestId,
      draftId: options.draftId,
      status: options.status,
    })

    debugLog(env, 'approval request list completed', {
      ...envSummary,
      returnedCount: payload.items.length,
      limit: payload.limit,
    })

    return payload
  } catch (error) {
    errorLog(env, 'approval request list failed', {
      ...envSummary,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function listAdminResultsFromSpreadsheet(
  options: ListAdminResultsOptions = {},
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<ListAnalysisResultsResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'result list env summary', {
    ...envSummary,
    limit: options.limit ?? null,
    sessionId: options.sessionId ?? null,
    questionVersion: options.questionVersion ?? null,
    birthTimeKnowledge: options.birthTimeKnowledge ?? null,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'result list aborted because spreadsheet env is incomplete', {
      ...envSummary,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-results-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const payload = await listAnalysisResults({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.resultsRange,
      limit: options.limit,
      sessionId: options.sessionId,
      questionVersion: options.questionVersion,
      birthTimeKnowledge: options.birthTimeKnowledge,
    })

    debugLog(env, 'result list completed', {
      ...envSummary,
      returnedCount: payload.items.length,
      limit: payload.limit,
      matchedSessionId: payload.matchedSessionId ?? null,
      matchedQuestionVersion: payload.matchedQuestionVersion ?? null,
      matchedBirthTimeKnowledge: payload.matchedBirthTimeKnowledge ?? null,
    })

    return payload
  } catch (error) {
    errorLog(env, 'result list failed', {
      ...envSummary,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function getAdminResultBySessionIdFromSpreadsheet(
  sessionId: string,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<StoredAnalysisResultRecord | null> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'result detail env summary', {
    ...envSummary,
    sessionId,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'result detail aborted because spreadsheet env is incomplete', {
      ...envSummary,
      sessionId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-results-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const result = await getAnalysisResultBySessionId({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.resultsRange,
      sessionId,
    })

    debugLog(env, 'result detail completed', {
      ...envSummary,
      sessionId,
      found: Boolean(result),
    })

    return result
  } catch (error) {
    errorLog(env, 'result detail failed', {
      ...envSummary,
      sessionId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function listQuestionDraftsFromSpreadsheet(
  options: ListQuestionDraftsOptions = {},
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<ListQuestionDraftsResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'question draft list env summary', {
    ...envSummary,
    draftId: options.draftId ?? null,
    version: options.version ?? null,
    status: options.status ?? null,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'question draft list aborted because spreadsheet env is incomplete', {
      ...envSummary,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-question-drafts-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const payload = await listQuestionDrafts({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.questionDraftsRange,
      draftId: options.draftId,
      version: options.version,
      status: options.status,
    })

    debugLog(env, 'question draft list completed', {
      ...envSummary,
      returnedCount: payload.items.length,
      matchedDraftId: payload.matchedDraftId ?? null,
      matchedVersion: payload.matchedVersion ?? null,
      matchedStatus: payload.matchedStatus ?? null,
    })

    return payload
  } catch (error) {
    errorLog(env, 'question draft list failed', {
      ...envSummary,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function createQuestionDraftFromSpreadsheet(
  input: CreateQuestionDraftInput,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<CreateQuestionDraftResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'question draft create env summary', {
    ...envSummary,
    version: input.version,
    sourceVersion: input.sourceVersion ?? null,
    updatedBy: maskEmail(input.updatedBy),
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'question draft create aborted because spreadsheet env is incomplete', {
      ...envSummary,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-question-drafts-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const questionSet = await loadQuestionSetFromSheet({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.questionsRange,
    })
    const sourceVersion = input.sourceVersion ?? questionSet.version
    if (sourceVersion !== questionSet.version) {
      throw new Error(`source-version-mismatch: expected=${questionSet.version}, got=${sourceVersion}`)
    }

    const updatedAt = new Date().toISOString()
    const draftId = globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}`
    const result = await createQuestionDraftSnapshot({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.questionDraftsRange,
      questionSet,
      draftId,
      version: input.version,
      sourceVersion,
      status: 'draft',
      changeSummary: input.changeSummary,
      updatedBy: input.updatedBy,
      updatedAt,
    })

    debugLog(env, 'question draft create completed', {
      ...envSummary,
      draftId,
      version: input.version,
      sourceVersion,
      appendedRowCount: result.appendedRowCount,
    })

    return {
      draftId,
      version: input.version,
      sourceVersion,
      status: 'draft',
      changeSummary: input.changeSummary,
      updatedBy: input.updatedBy,
      updatedAt,
      questionCount: questionSet.questions.length,
      optionCount: questionSet.questions.reduce((sum, question) => sum + question.options.length, 0),
      appendedRowCount: result.appendedRowCount,
      missingRoles: getQuestionSetMissingRoles(questionSet),
    }
  } catch (error) {
    errorLog(env, 'question draft create failed', {
      ...envSummary,
      version: input.version,
      sourceVersion: input.sourceVersion ?? null,
      updatedBy: maskEmail(input.updatedBy),
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function getQuestionDraftDetailFromSpreadsheet(
  draftId: string,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<QuestionDraftDetail | null> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'question draft detail env summary', {
    ...envSummary,
    draftId,
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'question draft detail aborted because spreadsheet env is incomplete', {
      ...envSummary,
      draftId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-question-drafts-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const publishedQuestionSet = await loadQuestionSetFromSheet({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.questionsRange,
    })
    const payload = await getQuestionDraftDetail({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.questionDraftsRange,
      draftId,
      publishedQuestionSet,
    })

    debugLog(env, 'question draft detail completed', {
      ...envSummary,
      draftId,
      found: Boolean(payload),
    })

    return payload
  } catch (error) {
    errorLog(env, 'question draft detail failed', {
      ...envSummary,
      draftId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function updateQuestionDraftFromSpreadsheet(
  input: UpdateQuestionDraftInput,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<UpdateQuestionDraftResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'question draft update env summary', {
    ...envSummary,
    draftId: input.draftId,
    questionId: input.questionId,
    version: input.version,
    updatedBy: maskEmail(input.updatedBy),
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'question draft update aborted because spreadsheet env is incomplete', {
      ...envSummary,
      draftId: input.draftId,
      questionId: input.questionId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-question-drafts-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const updatedAt = new Date().toISOString()
    const updateResult = await updateQuestionDraftQuestion({
      client,
      spreadsheetId: config.spreadsheetId,
      draftRange: config.questionDraftsRange,
      questionsRange: config.questionsRange,
      input: {
        ...input,
        updatedAt,
      },
    })
    const detail = await getQuestionDraftDetailFromSpreadsheet(input.draftId, env, {
      ...deps,
      createClient: () => client,
    })
    if (!detail) {
      throw new Error('question-draft-not-found-after-update')
    }

    debugLog(env, 'question draft update completed', {
      ...envSummary,
      draftId: input.draftId,
      questionId: input.questionId,
      updatedRowCount: updateResult.updatedRowCount,
    })

    return {
      draftId: input.draftId,
      questionId: input.questionId,
      updatedBy: input.updatedBy,
      updatedAt,
      updatedRowCount: updateResult.updatedRowCount,
      missingRoles: detail.summary.missingRoles,
    }
  } catch (error) {
    errorLog(env, 'question draft update failed', {
      ...envSummary,
      draftId: input.draftId,
      questionId: input.questionId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function updateQuestionDraftStatusFromSpreadsheet(
  input: UpdateQuestionDraftStatusInput,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<UpdateQuestionDraftStatusResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'question draft status update env summary', {
    ...envSummary,
    draftId: input.draftId,
    nextStatus: input.nextStatus,
    updatedBy: maskEmail(input.updatedBy),
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'question draft status update aborted because spreadsheet env is incomplete', {
      ...envSummary,
      draftId: input.draftId,
      nextStatus: input.nextStatus,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-question-drafts-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const updatedAt = new Date().toISOString()
    const result = await updateQuestionDraftStatus({
      client,
      spreadsheetId: config.spreadsheetId,
      draftRange: config.questionDraftsRange,
      questionsRange: config.questionsRange,
      input: {
        draftId: input.draftId,
        nextStatus: input.nextStatus,
        updatedBy: input.updatedBy,
        updatedAt,
        changeSummary: input.changeSummary,
      },
    })

    debugLog(env, 'question draft status update completed', {
      ...envSummary,
      draftId: input.draftId,
      nextStatus: input.nextStatus,
      updatedRowCount: result.updatedRowCount,
    })

    return {
      draftId: input.draftId,
      status: input.nextStatus,
      updatedBy: input.updatedBy,
      updatedAt,
      updatedRowCount: result.updatedRowCount,
    }
  } catch (error) {
    errorLog(env, 'question draft status update failed', {
      ...envSummary,
      draftId: input.draftId,
      nextStatus: input.nextStatus,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
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

function buildSingleRowRange(sheetName: string, startColumn: string, endColumn: string, rowNumber: number): string {
  return `${sheetName}!${startColumn}${rowNumber}:${endColumn}${rowNumber}`
}

async function loadCurrentQuestionDraftDetail(
  client: GoogleSheetsClient,
  config: SpreadsheetAdminConfig,
  draftId: string,
): Promise<QuestionDraftDetail | null> {
  const publishedQuestionSet = await loadQuestionSetFromSheet({
    client,
    spreadsheetId: config.spreadsheetId,
    range: config.questionsRange,
  })

  return getQuestionDraftDetail({
    client,
    spreadsheetId: config.spreadsheetId,
    range: config.questionDraftsRange,
    draftId,
    publishedQuestionSet,
  })
}

export async function createApprovalRequestFromSpreadsheet(
  input: CreateApprovalRequestInput,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<CreateApprovalRequestResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'approval request create env summary', {
    ...envSummary,
    draftId: input.draftId,
    requestedBy: maskEmail(input.requestedBy),
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'approval request create aborted because spreadsheet env is incomplete', {
      ...envSummary,
      draftId: input.draftId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-approval-requests-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const draftDetail = await loadCurrentQuestionDraftDetail(client, config, input.draftId)
    if (!draftDetail) {
      throw new Error('question-draft-not-found')
    }
    if (draftDetail.status !== 'review-ready') {
      throw new Error(`approval-request-not-allowed-for-draft-status: ${draftDetail.status}`)
    }

    const existingRequests = await listApprovalRequests({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.approvalRequestsRange,
      draftId: input.draftId,
      status: 'requested',
      limit: 20,
    })
    if (existingRequests.items.some(item => item.draftUpdatedAt === draftDetail.updatedAt)) {
      throw new Error('approval-request-already-pending')
    }

    const requestedAt = new Date().toISOString()
    const requestId = globalThis.crypto?.randomUUID?.() ?? `approval-request-${Date.now()}`
    const record: ApprovalRequestRecord = {
      requestId,
      draftId: draftDetail.draftId,
      version: draftDetail.version,
      sourceVersion: draftDetail.sourceVersion,
      draftUpdatedAt: draftDetail.updatedAt,
      status: 'requested',
      requestedBy: input.requestedBy,
      requestedAt,
      requestComment: input.requestComment?.trim() || null,
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
    }
    const saveResult = await saveApprovalRequestToSpreadsheet(record, env, {
      ...deps,
      createClient: () => client,
    })
    if (!saveResult.saved) {
      throw new Error(`approval-request-save-failed:${saveResult.reason ?? 'unknown'}`)
    }

    debugLog(env, 'approval request create completed', {
      ...envSummary,
      requestId,
      draftId: input.draftId,
    })

    return {
      requestId,
      draftId: draftDetail.draftId,
      version: draftDetail.version,
      sourceVersion: draftDetail.sourceVersion,
      draftUpdatedAt: draftDetail.updatedAt,
      status: 'requested',
      requestedBy: input.requestedBy,
      requestedAt,
      requestComment: input.requestComment?.trim() || null,
    }
  } catch (error) {
    errorLog(env, 'approval request create failed', {
      ...envSummary,
      draftId: input.draftId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function updateApprovalRequestStatusFromSpreadsheet(
  input: UpdateApprovalRequestStatusInput,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<UpdateApprovalRequestStatusResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'approval request status update env summary', {
    ...envSummary,
    requestId: input.requestId,
    nextStatus: input.nextStatus,
    reviewedBy: maskEmail(input.reviewedBy),
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'approval request status update aborted because spreadsheet env is incomplete', {
      ...envSummary,
      requestId: input.requestId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-approval-requests-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const approvalRequests = await listApprovalRequests({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.approvalRequestsRange,
      requestId: input.requestId,
      limit: 1,
    })
    const targetRequest = approvalRequests.items[0]
    if (!targetRequest) {
      throw new Error('approval-request-not-found')
    }
    if (targetRequest.status !== 'requested') {
      throw new Error(`approval-request-status-transition-not-allowed: ${targetRequest.status} -> ${input.nextStatus}`)
    }

    const parsedRange = parseColumnRange(config.approvalRequestsRange)
    if (!parsedRange) {
      throw new Error(`Unsupported approval requests range: ${config.approvalRequestsRange}`)
    }

    const reviewedAt = new Date().toISOString()
    await client.values.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      valueInputOption: 'RAW',
      data: [
        {
          range: buildSingleRowRange(parsedRange.sheetName, parsedRange.startColumn, parsedRange.endColumn, targetRequest.rowNumber),
          values: [
            [
              targetRequest.requestId,
              targetRequest.draftId,
              targetRequest.version,
              targetRequest.sourceVersion,
              targetRequest.draftUpdatedAt,
              input.nextStatus,
              targetRequest.requestedBy,
              targetRequest.requestedAt,
              targetRequest.requestComment ?? '',
              input.reviewedBy,
              reviewedAt,
              input.reviewComment?.trim() ?? '',
            ],
          ],
        },
      ],
    })

    debugLog(env, 'approval request status update completed', {
      ...envSummary,
      requestId: input.requestId,
      nextStatus: input.nextStatus,
    })

    return {
      requestId: targetRequest.requestId,
      draftId: targetRequest.draftId,
      status: input.nextStatus,
      reviewedBy: input.reviewedBy,
      reviewedAt,
      reviewComment: input.reviewComment?.trim() || null,
    }
  } catch (error) {
    errorLog(env, 'approval request status update failed', {
      ...envSummary,
      requestId: input.requestId,
      nextStatus: input.nextStatus,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function publishQuestionDraftFromSpreadsheet(
  input: PublishQuestionDraftInput,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<PublishQuestionDraftResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'question draft publish env summary', {
    ...envSummary,
    draftId: input.draftId,
    approvalRequestId: input.approvalRequestId ?? null,
    publishedBy: maskEmail(input.publishedBy),
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'question draft publish aborted because spreadsheet env is incomplete', {
      ...envSummary,
      draftId: input.draftId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-question-drafts-not-configured')
  }

  try {
    const client = getClient(env, deps)
    if (!input.approvalRequestId?.trim()) {
      throw new Error('approval-request-required')
    }

    const draftDetail = await loadCurrentQuestionDraftDetail(client, config, input.draftId)
    if (!draftDetail) {
      throw new Error('question-draft-not-found')
    }

    const approvalRequests = await listApprovalRequests({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.approvalRequestsRange,
      requestId: input.approvalRequestId,
      limit: 1,
    })
    const approvalRequest = approvalRequests.items[0]
    if (!approvalRequest) {
      throw new Error('approval-request-not-found')
    }
    if (approvalRequest.draftId !== input.draftId) {
      throw new Error('approval-request-draft-mismatch')
    }
    if (approvalRequest.status !== 'approved') {
      throw new Error(`approval-request-not-approved: ${approvalRequest.status}`)
    }
    if (approvalRequest.draftUpdatedAt !== draftDetail.updatedAt) {
      throw new Error('approval-request-stale')
    }

    const publishedAt = new Date().toISOString()
    const approvalId = globalThis.crypto?.randomUUID?.() ?? `approval-${Date.now()}`
    const published = await publishQuestionDraft({
      client,
      spreadsheetId: config.spreadsheetId,
      questionsRange: config.questionsRange,
      draftRange: config.questionDraftsRange,
      draftId: input.draftId,
      publishedBy: input.publishedBy,
      publishedAt,
    })

    await updateQuestionDraftStatus({
      client,
      spreadsheetId: config.spreadsheetId,
      draftRange: config.questionDraftsRange,
      questionsRange: config.questionsRange,
      input: {
        draftId: input.draftId,
        nextStatus: 'published',
        updatedBy: input.publishedBy,
        updatedAt: publishedAt,
        changeSummary: input.changeSummary,
      },
    })

    const approvalSaveResult = await saveApprovalLogEntryToSpreadsheet(
      {
        approvalId,
        approvedAt: publishedAt,
        draftId: input.draftId,
        draftVersion: published.publishedVersion,
        sourceVersion: published.sourceVersion,
        publishedVersion: published.publishedVersion,
        actorEmail: input.publishedBy,
        actorRole: input.publishedByRole ?? null,
        changeSummary: input.changeSummary ?? null,
        approvalComment: input.approvalComment ?? null,
      },
      env,
      {
        ...deps,
        createClient: () => client,
      },
    )

    debugLog(env, 'question draft publish completed', {
      ...envSummary,
      draftId: input.draftId,
      publishedVersion: published.publishedVersion,
      updatedRowCount: published.updatedRowCount,
      approvalLogged: approvalSaveResult.saved,
    })

    return {
      draftId: input.draftId,
      publishedVersion: published.publishedVersion,
      sourceVersion: published.sourceVersion,
      updatedRowCount: published.updatedRowCount,
      questionCount: published.questionCount,
      optionCount: published.optionCount,
      publishedBy: input.publishedBy,
      publishedAt,
    }
  } catch (error) {
    errorLog(env, 'question draft publish failed', {
      ...envSummary,
      draftId: input.draftId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}

export async function rollbackApprovalFromSpreadsheet(
  input: RollbackApprovalInput,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpreadsheetAdminRuntimeDeps = {},
): Promise<RollbackApprovalResponse> {
  const config = getSpreadsheetAdminConfig(env)
  const serviceAccountConfigured = isServiceAccountConfigured(env)
  const envSummary = getEnvDebugSummary(env)

  debugLog(env, 'question draft rollback env summary', {
    ...envSummary,
    approvalId: input.approvalId,
    rolledBackBy: maskEmail(input.rolledBackBy),
  })

  if (!config || !serviceAccountConfigured) {
    warnLog(env, 'question draft rollback aborted because spreadsheet env is incomplete', {
      ...envSummary,
      approvalId: input.approvalId,
      hasSpreadsheetConfig: Boolean(config),
      serviceAccountConfigured,
    })
    throw new Error('spreadsheet-question-drafts-not-configured')
  }

  try {
    const client = getClient(env, deps)
    const approvalPayload = await listApprovalLogEntries({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.approvalLogRange,
      limit: 1,
      approvalId: input.approvalId,
    })
    const targetApproval = approvalPayload.items[0]
    if (!targetApproval) {
      throw new Error('approval-log-entry-not-found')
    }

    const publishedAt = new Date().toISOString()
    const rollbackApprovalId = globalThis.crypto?.randomUUID?.() ?? `approval-${Date.now()}`
    const effectiveChangeSummary = input.changeSummary?.trim() || `rollback to ${targetApproval.publishedVersion}`
    const published = await publishQuestionDraft({
      client,
      spreadsheetId: config.spreadsheetId,
      questionsRange: config.questionsRange,
      draftRange: config.questionDraftsRange,
      draftId: targetApproval.draftId,
      publishedBy: input.rolledBackBy,
      publishedAt,
      allowedStatuses: ['review-ready', 'published'],
    })

    await updateQuestionDraftStatus({
      client,
      spreadsheetId: config.spreadsheetId,
      draftRange: config.questionDraftsRange,
      questionsRange: config.questionsRange,
      input: {
        draftId: targetApproval.draftId,
        nextStatus: 'published',
        updatedBy: input.rolledBackBy,
        updatedAt: publishedAt,
        changeSummary: effectiveChangeSummary,
      },
    })

    const approvalSaveResult = await saveApprovalLogEntryToSpreadsheet(
      {
        approvalId: rollbackApprovalId,
        approvedAt: publishedAt,
        draftId: targetApproval.draftId,
        draftVersion: published.publishedVersion,
        sourceVersion: published.sourceVersion,
        publishedVersion: published.publishedVersion,
        actorEmail: input.rolledBackBy,
        actorRole: input.rolledBackByRole ?? null,
        changeSummary: effectiveChangeSummary,
        approvalComment: input.approvalComment ?? null,
      },
      env,
      {
        ...deps,
        createClient: () => client,
      },
    )

    debugLog(env, 'question draft rollback completed', {
      ...envSummary,
      approvalId: input.approvalId,
      targetDraftId: targetApproval.draftId,
      publishedVersion: published.publishedVersion,
      updatedRowCount: published.updatedRowCount,
      approvalLogged: approvalSaveResult.saved,
    })

    return {
      sourceApprovalId: targetApproval.approvalId,
      rollbackApprovalId,
      sourceDraftId: targetApproval.draftId,
      sourcePublishedVersion: targetApproval.publishedVersion,
      draftId: targetApproval.draftId,
      publishedVersion: published.publishedVersion,
      sourceVersion: published.sourceVersion,
      updatedRowCount: published.updatedRowCount,
      questionCount: published.questionCount,
      optionCount: published.optionCount,
      publishedBy: input.rolledBackBy,
      publishedAt,
    }
  } catch (error) {
    errorLog(env, 'question draft rollback failed', {
      ...envSummary,
      approvalId: input.approvalId,
      error: getErrorMessage(error),
      ...getErrorDebugPayload(error),
    })
    throw error
  }
}
