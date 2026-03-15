import { auth } from '@/auth'
import type { Session } from 'next-auth'
import {
  createApprovalRequestFromSpreadsheet,
  createQuestionDraftFromSpreadsheet,
  getQuestionDraftDetailFromSpreadsheet,
  getAdminResultBySessionIdFromSpreadsheet,
  listApprovalLogEntriesFromSpreadsheet,
  listApprovalRequestsFromSpreadsheet,
  listAdminAuditEventsFromSpreadsheet,
  listAdminResultsFromSpreadsheet,
  listQuestionDraftsFromSpreadsheet,
  publishQuestionDraftFromSpreadsheet,
  rollbackApprovalFromSpreadsheet,
  syncQuestionsFromSpreadsheet,
  type AdminAuditActionFamily,
  type BirthTimeKnowledge,
  type CreateQuestionDraftInput,
  type CreateQuestionDraftResponse,
  type CreateApprovalRequestInput,
  type CreateApprovalRequestResponse,
  type ListApprovalLogEntriesResponse,
  type ListApprovalRequestsResponse,
  type ListAdminAuditEventsResponse,
  type ListQuestionDraftsResponse,
  type PublishQuestionDraftInput,
  type PublishQuestionDraftResponse,
  type RollbackApprovalInput,
  type RollbackApprovalResponse,
  type QuestionDraftDetail,
  type QuestionSyncResponse,
  type QuestionDraftStatus,
  type ApprovalRequestStatus,
  type StoredAnalysisResultRecord,
  type ListAnalysisResultsResponse,
  type UpdateApprovalRequestStatusInput,
  type UpdateApprovalRequestStatusResponse,
  type UpdateQuestionDraftInput,
  type UpdateQuestionDraftResponse,
  type UpdateQuestionDraftStatusInput,
  type UpdateQuestionDraftStatusResponse,
  updateApprovalRequestStatusFromSpreadsheet,
  updateQuestionDraftFromSpreadsheet,
  updateQuestionDraftStatusFromSpreadsheet,
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
  listDrafts: (options?: {
    draftId?: string
    version?: string
    status?: QuestionDraftStatus
  }) => Promise<ListQuestionDraftsResponse>
  listApprovalRequests: (options?: {
    limit?: number
    requestId?: string
    draftId?: string
    status?: ApprovalRequestStatus
  }) => Promise<ListApprovalRequestsResponse>
  createDraft: (input: CreateQuestionDraftInput) => Promise<CreateQuestionDraftResponse>
  createApprovalRequest: (input: CreateApprovalRequestInput) => Promise<CreateApprovalRequestResponse>
  getDraftDetail: (draftId: string) => Promise<QuestionDraftDetail | null>
  updateDraft: (input: UpdateQuestionDraftInput) => Promise<UpdateQuestionDraftResponse>
  updateDraftStatus: (input: UpdateQuestionDraftStatusInput) => Promise<UpdateQuestionDraftStatusResponse>
  updateApprovalRequestStatus: (input: UpdateApprovalRequestStatusInput) => Promise<UpdateApprovalRequestStatusResponse>
  publishDraft: (input: PublishQuestionDraftInput) => Promise<PublishQuestionDraftResponse>
  rollbackApproval: (input: RollbackApprovalInput) => Promise<RollbackApprovalResponse>
  listAudit: (options?: {
    limit?: number
    actionFamily?: AdminAuditActionFamily
    action?:
      | 'draft.create'
      | 'draft.update'
      | 'draft.status.update'
      | 'draft.approval.requested'
      | 'draft.approval.reviewed'
      | 'draft.publish'
      | 'draft.rollback'
      | 'access.denied'
    actorEmail?: string
    subjectType?: 'draft' | 'question' | 'admin-route'
  }) => Promise<ListAdminAuditEventsResponse>
  listApprovals: (options?: {
    limit?: number
    approvalId?: string
    actorEmail?: string
    draftId?: string
  }) => Promise<ListApprovalLogEntriesResponse>
}

const defaultDeps: AdminRouteDeps = {
  auth: () => auth(),
  listResults: listAdminResultsFromSpreadsheet,
  getResultBySessionId: getAdminResultBySessionIdFromSpreadsheet,
  listQuestions: syncQuestionsFromSpreadsheet,
  listDrafts: listQuestionDraftsFromSpreadsheet,
  listApprovalRequests: listApprovalRequestsFromSpreadsheet,
  createDraft: createQuestionDraftFromSpreadsheet,
  createApprovalRequest: createApprovalRequestFromSpreadsheet,
  getDraftDetail: getQuestionDraftDetailFromSpreadsheet,
  updateDraft: updateQuestionDraftFromSpreadsheet,
  updateDraftStatus: updateQuestionDraftStatusFromSpreadsheet,
  updateApprovalRequestStatus: updateApprovalRequestStatusFromSpreadsheet,
  publishDraft: publishQuestionDraftFromSpreadsheet,
  rollbackApproval: rollbackApprovalFromSpreadsheet,
  listAudit: listAdminAuditEventsFromSpreadsheet,
  listApprovals: listApprovalLogEntriesFromSpreadsheet,
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
