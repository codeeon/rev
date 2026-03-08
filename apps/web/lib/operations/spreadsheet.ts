import 'server-only'

import {
  createServiceAccountTokenProvider,
  createSheetsClient,
  loadServiceAccountCredentialsFromEnv,
  type GoogleSheetsClient,
} from '@workspace/google-sheets/server'
import {
  InMemoryLastKnownGoodStore,
  appendAnalysisResult,
  loadQuestionSetFromSheet,
  syncQuestionSetWithFallback,
  type AnalysisResultRecord,
  type NormalizedQuestionSet,
} from '@workspace/spreadsheet-admin/server'
import { ENGINE_QUESTIONS, ENGINE_SETTINGS, type EngineQuestion } from '@workspace/time-inference'

declare global {
  var __spreadsheetQuestionSetStore: InMemoryLastKnownGoodStore | undefined
}

const DEFAULT_QUESTIONS_RANGE = 'Questions!A:K'
const DEFAULT_RESULTS_RANGE = 'Results!A:J'

interface SpreadsheetAdminConfig {
  spreadsheetId: string
  questionsRange: string
  resultsRange: string
}

export interface QuestionSyncResponse {
  source: 'spreadsheet-latest' | 'spreadsheet-fallback' | 'engine-default'
  questionVersion: string
  questions: EngineQuestion[]
  warning?: string
}

export interface SaveResultResponse {
  saved: boolean
  reason?: 'not-configured' | 'save-failed'
}

const questionSetStore = globalThis.__spreadsheetQuestionSetStore ?? new InMemoryLastKnownGoodStore()
globalThis.__spreadsheetQuestionSetStore = questionSetStore

function readEnvValue(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key]?.trim()
  return value ? value : null
}

function isServiceAccountConfigured(env: NodeJS.ProcessEnv): boolean {
  return !!readEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_EMAIL') && !!readEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
}

function getSpreadsheetAdminConfig(env: NodeJS.ProcessEnv = process.env): SpreadsheetAdminConfig | null {
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

function createGoogleSheetsClientFromEnv(env: NodeJS.ProcessEnv = process.env): GoogleSheetsClient {
  const credentials = loadServiceAccountCredentialsFromEnv(env)
  const tokenProvider = createServiceAccountTokenProvider({ credentials })

  return createSheetsClient({
    tokenProvider,
    userAgent: 'rev-workspace/web-spreadsheet-admin',
  })
}

function toDefaultQuestionResponse(warning?: string): QuestionSyncResponse {
  return {
    source: 'engine-default',
    questionVersion: ENGINE_SETTINGS.version,
    questions: ENGINE_QUESTIONS,
    warning,
  }
}

function toQuestionResponse(questionSet: NormalizedQuestionSet, source: 'latest' | 'last-known-good'): QuestionSyncResponse {
  return {
    source: source === 'latest' ? 'spreadsheet-latest' : 'spreadsheet-fallback',
    questionVersion: questionSet.version,
    questions: questionSet.questions,
  }
}

export async function syncQuestionsFromSpreadsheet(env: NodeJS.ProcessEnv = process.env): Promise<QuestionSyncResponse> {
  const config = getSpreadsheetAdminConfig(env)
  if (!config || !isServiceAccountConfigured(env)) {
    return toDefaultQuestionResponse()
  }

  try {
    const client = createGoogleSheetsClientFromEnv(env)
    const synced = await syncQuestionSetWithFallback({
      store: questionSetStore,
      loadLatest: async () =>
        loadQuestionSetFromSheet({
          client,
          spreadsheetId: config.spreadsheetId,
          range: config.questionsRange,
        }),
    })

    return toQuestionResponse(synced.questionSet, synced.source)
  } catch {
    return toDefaultQuestionResponse('question-sync-failed')
  }
}

export async function saveAnalysisResultToSpreadsheet(
  record: AnalysisResultRecord,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SaveResultResponse> {
  const config = getSpreadsheetAdminConfig(env)
  if (!config || !isServiceAccountConfigured(env)) {
    return { saved: false, reason: 'not-configured' }
  }

  try {
    const client = createGoogleSheetsClientFromEnv(env)
    await appendAnalysisResult({
      client,
      spreadsheetId: config.spreadsheetId,
      range: config.resultsRange,
      record,
    })
    return { saved: true }
  } catch {
    return { saved: false, reason: 'save-failed' }
  }
}
