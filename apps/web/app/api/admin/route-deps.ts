import { auth } from '@/auth'
import {
  getAdminResultBySessionIdFromSpreadsheet,
  listAdminResultsFromSpreadsheet,
  syncQuestionsFromSpreadsheet,
  type QuestionSyncResponse,
  type StoredAnalysisResultRecord,
  type ListAnalysisResultsResponse,
} from '@workspace/spreadsheet-admin/server'

export type AdminSession = Awaited<ReturnType<typeof auth>>

interface AdminRouteDeps {
  auth: typeof auth
  listResults: (options?: { limit?: number; sessionId?: string }) => Promise<ListAnalysisResultsResponse>
  getResultBySessionId: (sessionId: string) => Promise<StoredAnalysisResultRecord | null>
  listQuestions: () => Promise<QuestionSyncResponse>
}

const defaultDeps: AdminRouteDeps = {
  auth,
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
