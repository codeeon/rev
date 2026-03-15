export interface ApprovalLogRecord {
  approvalId: string
  approvedAt: string
  draftId: string
  draftVersion: string
  sourceVersion: string
  publishedVersion: string
  actorEmail?: string | null
  actorRole?: string | null
  changeSummary?: string | null
  approvalComment?: string | null
}

export const APPROVAL_LOG_HEADERS = [
  'approvalId',
  'approvedAt',
  'draftId',
  'draftVersion',
  'sourceVersion',
  'publishedVersion',
  'actorEmail',
  'actorRole',
  'changeSummary',
  'approvalComment',
] as const

function assertRequired(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required`)
  }
}

export function validateApprovalLogRecord(record: ApprovalLogRecord): void {
  assertRequired(record.approvalId, 'approvalId')
  assertRequired(record.approvedAt, 'approvedAt')
  assertRequired(record.draftId, 'draftId')
  assertRequired(record.draftVersion, 'draftVersion')
  assertRequired(record.sourceVersion, 'sourceVersion')
  assertRequired(record.publishedVersion, 'publishedVersion')
}

export function toApprovalLogSheetRow(record: ApprovalLogRecord): string[] {
  validateApprovalLogRecord(record)

  return [
    record.approvalId,
    record.approvedAt,
    record.draftId,
    record.draftVersion,
    record.sourceVersion,
    record.publishedVersion,
    record.actorEmail?.trim() ?? '',
    record.actorRole?.trim() ?? '',
    record.changeSummary?.trim() ?? '',
    record.approvalComment?.trim() ?? '',
  ]
}
