import { saveAdminAuditEventToSpreadsheet } from '@workspace/spreadsheet-admin/server'
import { getAdminSessionRole, normalizeEmail, type AdminSessionLike } from './admin-access'

export type AdminAuditAction =
  | 'draft.create'
  | 'draft.update'
  | 'draft.status.update'
  | 'draft.approval.requested'
  | 'draft.approval.reviewed'
  | 'draft.publish'
  | 'draft.rollback'
  | 'access.denied'

export interface AdminAuditEvent {
  eventId: string
  at: string
  action: AdminAuditAction
  actorEmail: string | null
  actorRole: string | null
  subjectType: 'draft' | 'question' | 'admin-route'
  subjectId: string
  metadata?: Record<string, unknown>
}

export function createAdminAuditEvent(input: {
  action: AdminAuditAction
  session: AdminSessionLike | null | undefined
  subjectType: AdminAuditEvent['subjectType']
  subjectId: string
  metadata?: Record<string, unknown>
}): AdminAuditEvent {
  return {
    eventId: globalThis.crypto?.randomUUID?.() ?? `audit-${Date.now()}`,
    at: new Date().toISOString(),
    action: input.action,
    actorEmail: normalizeEmail(input.session?.user?.email),
    actorRole: getAdminSessionRole(input.session),
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    metadata: input.metadata,
  }
}

export async function recordAdminAuditEvent(input: {
  action: AdminAuditAction
  session: AdminSessionLike | null | undefined
  subjectType: AdminAuditEvent['subjectType']
  subjectId: string
  metadata?: Record<string, unknown>
}): Promise<AdminAuditEvent> {
  const event = createAdminAuditEvent(input)
  console.info('[admin-audit]', event)

  try {
    const result = await saveAdminAuditEventToSpreadsheet({
      eventId: event.eventId,
      at: event.at,
      action: event.action,
      actorEmail: event.actorEmail,
      actorRole: event.actorRole,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      metadata: event.metadata,
    })

    if (!result.saved) {
      console.warn('[admin-audit] persistence skipped', {
        eventId: event.eventId,
        reason: result.reason,
      })
    }
  } catch (error) {
    console.warn('[admin-audit] persistence failed', {
      eventId: event.eventId,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  return event
}
