import { NextResponse } from 'next/server'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../../../route-deps'

interface UpdateDraftStatusRequestBody {
  nextStatus?: unknown
  changeSummary?: unknown
}

type AllowedDraftStatus = 'draft' | 'review-ready' | 'archived'

function parseStatusBody(body: UpdateDraftStatusRequestBody) {
  const nextStatus = typeof body.nextStatus === 'string' ? body.nextStatus.trim() : ''
  const changeSummary = typeof body.changeSummary === 'string' ? body.changeSummary.trim() : ''

  if (
    nextStatus !== 'draft' &&
    nextStatus !== 'review-ready' &&
    nextStatus !== 'archived'
  ) {
    return null
  }

  return {
    nextStatus: nextStatus as AllowedDraftStatus,
    changeSummary: changeSummary || undefined,
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.edit')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'PATCH:/api/admin/questions/drafts/[draftId]/status',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  let rawBody: UpdateDraftStatusRequestBody
  try {
    rawBody = (await request.json()) as UpdateDraftStatusRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }

  const payload = parseStatusBody(rawBody)
  if (!payload) {
    return NextResponse.json({ error: 'invalid-draft-status-payload' }, { status: 400 })
  }

  try {
    const { draftId } = await params
    const result = await deps.updateDraftStatus({
      draftId,
      nextStatus: payload.nextStatus,
      changeSummary: payload.changeSummary,
      updatedBy: session?.user?.email ?? 'unknown',
    })
    await recordAdminAuditEvent({
      action: 'draft.status.update',
      session,
      subjectType: 'draft',
      subjectId: draftId,
      metadata: {
        nextStatus: payload.nextStatus,
        changeSummary: payload.changeSummary ?? null,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'question-draft-status-update-failed',
        message: error instanceof Error ? error.message : 'Unknown question draft status update error',
      },
      { status: 503 },
    )
  }
}
