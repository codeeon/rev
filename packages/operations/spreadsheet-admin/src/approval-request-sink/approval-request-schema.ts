export const APPROVAL_REQUEST_STATUSES = ['requested', 'approved', 'rejected'] as const

export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number]

export interface ApprovalRequestRecord {
  requestId: string
  draftId: string
  version: string
  sourceVersion: string
  draftUpdatedAt: string
  status: ApprovalRequestStatus
  requestedBy: string
  requestedAt: string
  requestComment?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewComment?: string | null
}

export const APPROVAL_REQUEST_HEADERS = [
  'requestId',
  'draftId',
  'version',
  'sourceVersion',
  'draftUpdatedAt',
  'status',
  'requestedBy',
  'requestedAt',
  'requestComment',
  'reviewedBy',
  'reviewedAt',
  'reviewComment',
] as const

function assertRequired(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required`)
  }
}

export function validateApprovalRequestRecord(record: ApprovalRequestRecord): void {
  assertRequired(record.requestId, 'requestId')
  assertRequired(record.draftId, 'draftId')
  assertRequired(record.version, 'version')
  assertRequired(record.sourceVersion, 'sourceVersion')
  assertRequired(record.draftUpdatedAt, 'draftUpdatedAt')
  assertRequired(record.status, 'status')
  assertRequired(record.requestedBy, 'requestedBy')
  assertRequired(record.requestedAt, 'requestedAt')
}

export function toApprovalRequestSheetRow(record: ApprovalRequestRecord): string[] {
  validateApprovalRequestRecord(record)

  return [
    record.requestId,
    record.draftId,
    record.version,
    record.sourceVersion,
    record.draftUpdatedAt,
    record.status,
    record.requestedBy,
    record.requestedAt,
    record.requestComment?.trim() ?? '',
    record.reviewedBy?.trim() ?? '',
    record.reviewedAt?.trim() ?? '',
    record.reviewComment?.trim() ?? '',
  ]
}
