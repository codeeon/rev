import type { ListAnalysisResultsResponse, QuestionDraftDetail, QuestionSyncResponse } from '@workspace/spreadsheet-admin/server'
import { buildAdminAnalyticsSnapshot, summarizeQuestionSet, type DistributionItem, type QuestionSetSummary } from './admin-insights'
import { getAdminRoleMatrix, type AdminRoleMatrixRow } from './admin-roles'

export const ADMIN_ANALYTICS_WINDOWS = ['7d', '30d', '90d'] as const
export const ADMIN_DRAFT_WORKFLOW_STATUSES = ['draft', 'review-ready', 'published', 'archived'] as const
export const ADMIN_DRAFT_SHEET_NAME = 'QuestionDrafts'

export type AdminAnalyticsWindow = (typeof ADMIN_ANALYTICS_WINDOWS)[number]
export type AdminDraftWorkflowStatus = (typeof ADMIN_DRAFT_WORKFLOW_STATUSES)[number]
export type PublishChecklistStatus = 'ready' | 'planned' | 'blocked'

export interface AdminAnalyticsSummaryResponse {
  generatedAt: string
  sampleLimit: number
  supportedWindows: AdminAnalyticsWindow[]
  currentQuestionVersion: string
  currentQuestionSource: QuestionSyncResponse['source']
  currentVersionResultCount: number
  kpis: {
    sampleSize: number
    last7dCount: number
    last30dCount: number
    latestResultAt: string | null
    feedbackRate: number
    averageRating: number | null
    averageAccuracy: number | null
  }
  distributions: {
    questionVersion: DistributionItem[]
    birthTimeKnowledge: DistributionItem[]
    confidence: DistributionItem[]
    inferredZishi: DistributionItem[]
  }
  questionSetSummary: QuestionSetSummary
}

export interface PublishChecklistItem {
  id: string
  label: string
  status: PublishChecklistStatus
  detail: string
}

export interface AdminDraftModelContract {
  storage: 'sheet-tab'
  sheetName: string
  identityFields: string[]
  mutableFields: string[]
  metadataFields: string[]
  workflowStatuses: AdminDraftWorkflowStatus[]
  diffKeyFields: string[]
  bumpStrategy: 'manual-on-publish'
  rollbackStrategy: 'republish-previous-version'
}

export interface AdminPublishPreviewResponse {
  generatedAt: string
  publishedVersion: string
  questionSource: QuestionSyncResponse['source']
  questionSetSummary: QuestionSetSummary
  requiredRoles: {
    read: 'viewer'
    editDraft: 'editor'
    publish: 'owner'
    rollback: 'owner'
  }
  roleMatrix: AdminRoleMatrixRow[]
  draftModel: AdminDraftModelContract
  checklist: PublishChecklistItem[]
}

export interface AdminDraftPublishReviewResponse {
  draftId: string
  version: string
  sourceVersion: string
  status: string
  updatedBy: string
  updatedAt: string
  questionCount: number
  optionCount: number
  diff: QuestionDraftDetail['diff']
  checklist: PublishChecklistItem[]
}

export function getAdminDraftModelContract(): AdminDraftModelContract {
  return {
    storage: 'sheet-tab',
    sheetName: ADMIN_DRAFT_SHEET_NAME,
    identityFields: ['draftId', 'questionId', 'optionIndex'],
    mutableFields: ['structureRole', 'category', 'questionWeight', 'questionText', 'optionText', 'scoreMapJson', 'isActive'],
    metadataFields: ['version', 'sourceVersion', 'status', 'changeSummary', 'updatedBy', 'updatedAt'],
    workflowStatuses: [...ADMIN_DRAFT_WORKFLOW_STATUSES],
    diffKeyFields: ['questionId', 'optionIndex'],
    bumpStrategy: 'manual-on-publish',
    rollbackStrategy: 'republish-previous-version',
  }
}

export function buildAdminAnalyticsSummaryResponse(
  resultsPayload: ListAnalysisResultsResponse,
  questionPayload: QuestionSyncResponse,
  now: Date = new Date(),
): AdminAnalyticsSummaryResponse {
  const analytics = buildAdminAnalyticsSnapshot(resultsPayload.items, now)
  const questionSetSummary = summarizeQuestionSet(questionPayload.questions)
  const currentVersionResultCount =
    analytics.questionVersionDistribution.find(item => item.label === questionPayload.questionVersion)?.count ?? 0

  return {
    generatedAt: now.toISOString(),
    sampleLimit: resultsPayload.limit,
    supportedWindows: [...ADMIN_ANALYTICS_WINDOWS],
    currentQuestionVersion: questionPayload.questionVersion,
    currentQuestionSource: questionPayload.source,
    currentVersionResultCount,
    kpis: {
      sampleSize: analytics.sampleSize,
      last7dCount: analytics.last7dCount,
      last30dCount: analytics.last30dCount,
      latestResultAt: analytics.latestResultAt,
      feedbackRate: analytics.feedbackRate,
      averageRating: analytics.averageRating,
      averageAccuracy: analytics.averageAccuracy,
    },
    distributions: {
      questionVersion: analytics.questionVersionDistribution,
      birthTimeKnowledge: analytics.birthTimeKnowledgeDistribution,
      confidence: analytics.confidenceDistribution,
      inferredZishi: analytics.inferredZishiDistribution,
    },
    questionSetSummary,
  }
}

export function buildAdminPublishPreviewResponse(
  questionPayload: QuestionSyncResponse,
  now: Date = new Date(),
): AdminPublishPreviewResponse {
  const questionSetSummary = summarizeQuestionSet(questionPayload.questions)
  const draftModel = getAdminDraftModelContract()
  const checklist: PublishChecklistItem[] = [
    {
      id: 'role-coverage',
      label: '필수 role coverage',
      status: questionSetSummary.missingRoles.length > 0 ? 'blocked' : 'ready',
      detail:
        questionSetSummary.missingRoles.length > 0
          ? `누락 role: ${questionSetSummary.missingRoles.join(', ')}`
          : 'published 질문 세트가 현재 필수 role을 모두 충족합니다.',
    },
    {
      id: 'draft-storage',
      label: 'draft 저장 단위',
      status: 'ready',
      detail: `${draftModel.sheetName} 탭을 separate draft unit으로 두고 published Questions 탭과 분리합니다.`,
    },
    {
      id: 'diff-baseline',
      label: 'diff / reviewer 확인',
      status: 'planned',
      detail: `${draftModel.diffKeyFields.join(' + ')} 키 기준으로 published version과 row diff를 계산합니다.`,
    },
    {
      id: 'audit-fields',
      label: 'publishedBy / publishedAt 기록',
      status: 'planned',
      detail: `${draftModel.metadataFields.join(', ')} 필드와 publish 시점 메타데이터를 mutation 단계에서 남깁니다.`,
    },
    {
      id: 'rollback-policy',
      label: 'rollback 정책',
      status: 'ready',
      detail: '기존 published snapshot을 직접 수정하지 않고 이전 snapshot을 새 version으로 재배포합니다.',
    },
  ]

  return {
    generatedAt: now.toISOString(),
    publishedVersion: questionPayload.questionVersion,
    questionSource: questionPayload.source,
    questionSetSummary,
    requiredRoles: {
      read: 'viewer',
      editDraft: 'editor',
      publish: 'owner',
      rollback: 'owner',
    },
    roleMatrix: getAdminRoleMatrix(),
    draftModel,
    checklist,
  }
}

export function buildAdminDraftPublishReviewResponse(draftDetail: QuestionDraftDetail): AdminDraftPublishReviewResponse {
  const checklist: PublishChecklistItem[] = [
    {
      id: 'draft-status',
      label: 'draft status',
      status: draftDetail.status === 'review-ready' ? 'ready' : 'blocked',
      detail:
        draftDetail.status === 'review-ready'
          ? 'publish 검토를 시작할 수 있습니다.'
          : `현재 status=${draftDetail.status}. review-ready 전환이 먼저 필요합니다.`,
    },
    {
      id: 'role-coverage',
      label: '필수 role coverage',
      status: draftDetail.summary.missingRoles.length > 0 ? 'blocked' : 'ready',
      detail:
        draftDetail.summary.missingRoles.length > 0
          ? `누락 role: ${draftDetail.summary.missingRoles.join(', ')}`
          : 'draft가 현재 필수 role을 모두 충족합니다.',
    },
    {
      id: 'diff-summary',
      label: 'diff summary',
      status: draftDetail.diff.totalChangedQuestions > 0 ? 'ready' : 'planned',
      detail: `changed=${draftDetail.diff.totalChangedQuestions}, updated=${draftDetail.diff.updatedQuestionCount}, removed=${draftDetail.diff.removedQuestionCount}`,
    },
    {
      id: 'audit-fields',
      label: 'audit metadata',
      status: 'planned',
      detail: `updatedBy=${draftDetail.updatedBy}, updatedAt=${draftDetail.updatedAt}, changeSummary=${draftDetail.changeSummary}`,
    },
  ]

  return {
    draftId: draftDetail.draftId,
    version: draftDetail.version,
    sourceVersion: draftDetail.sourceVersion,
    status: draftDetail.status,
    updatedBy: draftDetail.updatedBy,
    updatedAt: draftDetail.updatedAt,
    questionCount: draftDetail.summary.questionCount,
    optionCount: draftDetail.summary.optionCount,
    diff: draftDetail.diff,
    checklist,
  }
}
