import {
  createServiceAccountTokenProvider,
  createSheetsClient,
  GoogleSheetsHttpError,
  loadServiceAccountCredentialsFromEnv,
  type GoogleSheetsClient,
} from '@workspace/google-sheets/server'
import type { EngineQuestion } from '@workspace/time-inference'
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

declare global {
  var __spreadsheetAdminQuestionSetStore: InMemoryLastKnownGoodStore | undefined
}

const DEFAULT_QUESTIONS_RANGE = 'Questions!A:K'
const DEFAULT_RESULTS_RANGE = 'Results!A:J'

interface SpreadsheetAdminConfig {
  spreadsheetId: string
  questionsRange: string
  resultsRange: string
}

interface SpreadsheetAdminEnvDebugSummary {
  spreadsheetId: string | null
  questionsRange: string | null
  resultsRange: string | null
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

export interface ListAdminResultsOptions {
  limit?: number
  sessionId?: string
  questionVersion?: string
  birthTimeKnowledge?: BirthTimeKnowledge
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
