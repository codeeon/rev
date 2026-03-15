import { auth } from '@/auth'
import type { Session } from 'next-auth'
import {
  getAdminResultBySessionIdFromSpreadsheet,
  listAdminResultsFromSpreadsheet,
  syncQuestionsFromSpreadsheet,
  type BirthTimeKnowledge,
  type QuestionSyncResponse,
  type StoredAnalysisResultRecord,
  type ListAnalysisResultsResponse,
} from '@workspace/spreadsheet-admin/server'

export type AdminSession = Session | null
type AdminAuth = () => Promise<AdminSession>

interface AdminRouteDeps {
  auth: AdminAuth
  listResults: (options?: {
    limit?: number
    sessionId?: string
    questionVersion?: string
    birthTimeKnowledge?: BirthTimeKnowledge
  }) => Promise<ListAnalysisResultsResponse>
  getResultBySessionId: (sessionId: string) => Promise<StoredAnalysisResultRecord | null>
  listQuestions: () => Promise<QuestionSyncResponse>
}

const defaultDeps: AdminRouteDeps = {
  auth: () => auth(),
  listResults: listAdminResultsFromSpreadsheet,
  getResultBySessionId: getAdminResultBySessionIdFromSpreadsheet,
  listQuestions: syncQuestionsFromSpreadsheet,
}

let testDeps: Partial<AdminRouteDeps> | null = null

export function setAdminRouteDepsForTest(nextDeps: Partial<AdminRouteDeps> | null): void {
  testDeps = nextDeps
}

export function getAdminRouteDeps(): AdminRouteDeps {
  return {
    ...defaultDeps,
    ...testDeps,
  }
}
