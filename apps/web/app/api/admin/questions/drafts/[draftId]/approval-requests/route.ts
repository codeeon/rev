import { NextResponse } from 'next/server'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../../../route-deps'

interface CreateApprovalRequestBody {
  requestComment?: unknown
}

function readString(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function parseApprovalRequestStatus(value: string | null): 'requested' | 'approved' | 'rejected' | undefined | null {
  const trimmed = readString(value)
  if (!trimmed) {
    return undefined
  }

  if (trimmed === 'requested' || trimmed === 'approved' || trimmed === 'rejected') {
    return trimmed
  }

  return null
}

function parseCreateBody(body: CreateApprovalRequestBody): { requestComment?: string } {
  const requestComment = typeof body.requestComment === 'string' ? body.requestComment.trim() : ''
  return {
    requestComment: requestComment || undefined,
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.edit')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'GET:/api/admin/questions/drafts/[draftId]/approval-requests',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  try {
    const { draftId } = await params
    const url = new URL(request.url)
    const status = parseApprovalRequestStatus(url.searchParams.get('status'))
    if (status === null) {
      return NextResponse.json({ error: 'invalid-approval-request-status' }, { status: 400 })
    }

    const payload = await deps.listApprovalRequests({
      draftId,
      limit: Number(url.searchParams.get('limit')) || undefined,
      status,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'approval-request-list-failed',
        message: error instanceof Error ? error.message : 'Unknown approval request list error',
      },
      { status: 503 },
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.edit')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'POST:/api/admin/questions/drafts/[draftId]/approval-requests',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  const rawBody = (await request.json().catch(() => ({}))) as CreateApprovalRequestBody
  const payload = parseCreateBody(rawBody)

  try {
    const { draftId } = await params
    const result = await deps.createApprovalRequest({
      draftId,
      requestedBy: session?.user?.email ?? 'unknown',
      requestComment: payload.requestComment,
    })
    await recordAdminAuditEvent({
      action: 'draft.approval.requested',
      session,
      subjectType: 'draft',
      subjectId: draftId,
      metadata: {
        requestId: result.requestId,
        requestComment: result.requestComment ?? null,
      },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'approval-request-create-failed',
        message: error instanceof Error ? error.message : 'Unknown approval request create error',
      },
      { status: 503 },
    )
  }
}
