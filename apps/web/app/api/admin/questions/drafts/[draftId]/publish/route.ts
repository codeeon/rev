import { NextResponse } from 'next/server'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../../../route-deps'

interface PublishDraftRequestBody {
  changeSummary?: unknown
  approvalComment?: unknown
  approvalRequestId?: unknown
}

function parsePublishBody(body: PublishDraftRequestBody) {
  const changeSummary = typeof body.changeSummary === 'string' ? body.changeSummary.trim() : ''
  const approvalComment = typeof body.approvalComment === 'string' ? body.approvalComment.trim() : ''
  const approvalRequestId = typeof body.approvalRequestId === 'string' ? body.approvalRequestId.trim() : ''
  return {
    changeSummary: changeSummary || undefined,
    approvalComment: approvalComment || undefined,
    approvalRequestId: approvalRequestId || undefined,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.publish')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'POST:/api/admin/questions/drafts/[draftId]/publish',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  const rawBody = await request.json().catch(() => ({})) as PublishDraftRequestBody

  const payload = parsePublishBody(rawBody)

  try {
    const { draftId } = await params
    const result = await deps.publishDraft({
      draftId,
      approvalRequestId: payload.approvalRequestId,
      publishedBy: session?.user?.email ?? 'unknown',
      publishedByRole: session?.user?.role ?? null,
      changeSummary: payload.changeSummary,
      approvalComment: payload.approvalComment,
    })
    await recordAdminAuditEvent({
      action: 'draft.publish',
      session,
      subjectType: 'draft',
      subjectId: draftId,
      metadata: {
        approvalRequestId: payload.approvalRequestId ?? null,
        publishedVersion: result.publishedVersion,
        updatedRowCount: result.updatedRowCount,
        approvalComment: payload.approvalComment ?? null,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'question-draft-publish-failed',
        message: error instanceof Error ? error.message : 'Unknown question draft publish error',
      },
      { status: 503 },
    )
  }
}
