import { NextResponse } from 'next/server'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../../route-deps'

interface RollbackApprovalRequestBody {
  changeSummary?: unknown
  approvalComment?: unknown
}

function parseRollbackBody(body: RollbackApprovalRequestBody) {
  const changeSummary = typeof body.changeSummary === 'string' ? body.changeSummary.trim() : ''
  const approvalComment = typeof body.approvalComment === 'string' ? body.approvalComment.trim() : ''

  return {
    changeSummary: changeSummary || undefined,
    approvalComment: approvalComment || undefined,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ approvalId: string }> }) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.publish')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'POST:/api/admin/approvals/[approvalId]/rollback',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  const rawBody = (await request.json().catch(() => ({}))) as RollbackApprovalRequestBody
  const payload = parseRollbackBody(rawBody)

  try {
    const { approvalId } = await params
    const result = await deps.rollbackApproval({
      approvalId,
      rolledBackBy: session?.user?.email ?? 'unknown',
      rolledBackByRole: session?.user?.role ?? null,
      changeSummary: payload.changeSummary,
      approvalComment: payload.approvalComment,
    })
    await recordAdminAuditEvent({
      action: 'draft.rollback',
      session,
      subjectType: 'draft',
      subjectId: result.sourceDraftId,
      metadata: {
        sourceApprovalId: result.sourceApprovalId,
        sourcePublishedVersion: result.sourcePublishedVersion,
        rollbackApprovalId: result.rollbackApprovalId,
        approvalComment: payload.approvalComment ?? null,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'question-draft-rollback-failed',
        message: error instanceof Error ? error.message : 'Unknown question draft rollback error',
      },
      { status: 503 },
    )
  }
}
