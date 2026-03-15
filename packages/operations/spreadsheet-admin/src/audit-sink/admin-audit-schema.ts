export type AdminAuditAction =
  | 'draft.create'
  | 'draft.update'
  | 'draft.status.update'
  | 'draft.approval.requested'
  | 'draft.approval.reviewed'
  | 'draft.publish'
  | 'draft.rollback'
  | 'access.denied'

export type AdminAuditActionFamily = 'access' | 'mutation'
export type AdminAuditSubjectType = 'draft' | 'question' | 'admin-route'

export interface AdminAuditRecord {
  eventId: string
  at: string
  action: AdminAuditAction
  actorEmail?: string | null
  actorRole?: string | null
  subjectType: AdminAuditSubjectType
  subjectId: string
  metadata?: Record<string, unknown>
}

export const ADMIN_AUDIT_HEADERS = [
  'eventId',
  'at',
  'action',
  'actorEmail',
  'actorRole',
  'subjectType',
  'subjectId',
  'metadataJson',
] as const

function assertRequired(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required`)
  }
}

export function validateAdminAuditRecord(record: AdminAuditRecord): void {
  assertRequired(record.eventId, 'eventId')
  assertRequired(record.at, 'at')
  assertRequired(record.action, 'action')
  assertRequired(record.subjectType, 'subjectType')
  assertRequired(record.subjectId, 'subjectId')
}

export function toAdminAuditSheetRow(record: AdminAuditRecord): string[] {
  validateAdminAuditRecord(record)

  return [
    record.eventId,
    record.at,
    record.action,
    record.actorEmail?.trim() ?? '',
    record.actorRole?.trim() ?? '',
    record.subjectType,
    record.subjectId,
    JSON.stringify(record.metadata ?? null),
  ]
}

export function getAdminAuditActionFamily(action: AdminAuditAction): AdminAuditActionFamily {
  return action === 'access.denied' ? 'access' : 'mutation'
}
