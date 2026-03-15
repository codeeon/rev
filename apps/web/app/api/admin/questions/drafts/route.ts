import { NextResponse } from 'next/server'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../route-deps'

function readString(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function parseDraftStatus(value: string | null): 'draft' | 'review-ready' | 'published' | 'archived' | undefined | null {
  const trimmed = readString(value)
  if (!trimmed) {
    return undefined
  }

  if (trimmed === 'draft' || trimmed === 'review-ready' || trimmed === 'published' || trimmed === 'archived') {
    return trimmed
  }

  return null
}

interface CreateDraftRequestBody {
  version?: unknown
  sourceVersion?: unknown
  changeSummary?: unknown
}

function parseCreateDraftBody(body: CreateDraftRequestBody): { version: string; sourceVersion?: string; changeSummary: string } | null {
  const version = typeof body.version === 'string' ? body.version.trim() : ''
  const sourceVersion = typeof body.sourceVersion === 'string' ? body.sourceVersion.trim() : ''
  const changeSummary = typeof body.changeSummary === 'string' ? body.changeSummary.trim() : ''

  if (!version || !changeSummary) {
    return null
  }

  return {
    version,
    sourceVersion: sourceVersion || undefined,
    changeSummary,
  }
}

export async function GET(request: Request) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.edit')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'GET:/api/admin/questions/drafts',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  try {
    const url = new URL(request.url)
    const status = parseDraftStatus(url.searchParams.get('status'))
    if (status === null) {
      return NextResponse.json({ error: 'invalid-draft-status' }, { status: 400 })
    }

    const payload = await deps.listDrafts({
      draftId: readString(url.searchParams.get('draftId')),
      version: readString(url.searchParams.get('version')),
      status,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'question-draft-list-failed',
        message: error instanceof Error ? error.message : 'Unknown question draft list error',
      },
      { status: 503 },
    )
  }
}

export async function POST(request: Request) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.edit')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'POST:/api/admin/questions/drafts',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  let rawBody: CreateDraftRequestBody
  try {
    rawBody = (await request.json()) as CreateDraftRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }

  const payload = parseCreateDraftBody(rawBody)
  if (!payload) {
    return NextResponse.json({ error: 'invalid-draft-payload' }, { status: 400 })
  }

  try {
    const createdDraft = await deps.createDraft({
      ...payload,
      updatedBy: session?.user?.email ?? 'unknown',
    })
    await recordAdminAuditEvent({
      action: 'draft.create',
      session,
      subjectType: 'draft',
      subjectId: createdDraft.draftId,
      metadata: {
        version: createdDraft.version,
        sourceVersion: createdDraft.sourceVersion,
        questionCount: createdDraft.questionCount,
      },
    })

    return NextResponse.json(createdDraft, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'question-draft-create-failed',
        message: error instanceof Error ? error.message : 'Unknown question draft create error',
      },
      { status: 503 },
    )
  }
}
