import { NextResponse } from 'next/server'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../../../route-deps'

interface UpdateApprovalRequestStatusBody {
  nextStatus?: unknown
  reviewComment?: unknown
}

function parseBody(body: UpdateApprovalRequestStatusBody) {
  const nextStatus = typeof body.nextStatus === 'string' ? body.nextStatus.trim() : ''
  const reviewComment = typeof body.reviewComment === 'string' ? body.reviewComment.trim() : ''
  if (nextStatus !== 'approved' && nextStatus !== 'rejected') {
    return null
  }

  return {
    nextStatus,
    reviewComment: reviewComment || undefined,
  } as const
}

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.publish')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'PATCH:/api/admin/questions/approval-requests/[requestId]/status',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  const rawBody = (await request.json().catch(() => ({}))) as UpdateApprovalRequestStatusBody
  const payload = parseBody(rawBody)
  if (!payload) {
    return NextResponse.json({ error: 'invalid-approval-request-status-payload' }, { status: 400 })
  }

  try {
    const { requestId } = await params
    const result = await deps.updateApprovalRequestStatus({
      requestId,
      nextStatus: payload.nextStatus,
      reviewedBy: session?.user?.email ?? 'unknown',
      reviewComment: payload.reviewComment,
    })
    await recordAdminAuditEvent({
      action: 'draft.approval.reviewed',
      session,
      subjectType: 'draft',
      subjectId: result.draftId,
      metadata: {
        requestId,
        nextStatus: result.status,
        reviewComment: result.reviewComment ?? null,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'approval-request-status-update-failed',
        message: error instanceof Error ? error.message : 'Unknown approval request status update error',
      },
      { status: 503 },
    )
  }
}
