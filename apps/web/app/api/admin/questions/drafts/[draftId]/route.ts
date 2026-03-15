import { NextResponse } from 'next/server'
import { recordAdminAuditEvent } from '@/lib/admin-audit'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../../route-deps'

interface UpdateDraftRequestBody {
  version?: unknown
  sourceVersion?: unknown
  structureRole?: unknown
  category?: unknown
  questionWeight?: unknown
  questionText?: unknown
  isActive?: unknown
  changeSummary?: unknown
  questionId?: unknown
  options?: unknown
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseUpdateDraftBody(body: UpdateDraftRequestBody) {
  const version = typeof body.version === 'string' ? body.version.trim() : ''
  const sourceVersion = typeof body.sourceVersion === 'string' ? body.sourceVersion.trim() : ''
  const structureRole = typeof body.structureRole === 'string' ? body.structureRole.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const questionText = typeof body.questionText === 'string' ? body.questionText.trim() : ''
  const questionId = typeof body.questionId === 'string' ? body.questionId.trim() : ''
  const changeSummary = typeof body.changeSummary === 'string' ? body.changeSummary.trim() : ''
  const questionWeight =
    typeof body.questionWeight === 'number' ? body.questionWeight : typeof body.questionWeight === 'string' ? Number(body.questionWeight) : NaN
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : body.isActive === 'true'
  const options: Array<{ optionIndex: number; optionText: string; scoreMap: Record<string, number> }> = Array.isArray(body.options)
    ? body.options.flatMap(option => {
        if (!isObjectRecord(option)) {
          return []
        }

        const optionIndex =
          typeof option.optionIndex === 'number'
            ? option.optionIndex
            : typeof option.optionIndex === 'string'
              ? Number(option.optionIndex)
              : NaN
        const optionText = typeof option.optionText === 'string' ? option.optionText.trim() : ''
        const scoreMap = (() => {
          if (!isObjectRecord(option.scoreMap)) {
            return null
          }

          const parsedScoreMap: Record<string, number> = {}
          for (const [key, value] of Object.entries(option.scoreMap)) {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
              return null
            }
            parsedScoreMap[key] = value
          }

          return parsedScoreMap
        })()

        if (!Number.isInteger(optionIndex) || optionIndex < 0 || !optionText || !scoreMap) {
          return []
        }

        return [
          {
            optionIndex,
            optionText,
            scoreMap,
          },
        ]
      })
    : []

  const validStructureRole =
    structureRole === 'noise_reduction' || structureRole === 'core' || structureRole === 'fine_tune' || structureRole === 'closing'
  if (!version || !sourceVersion || !questionId || !changeSummary || !category || !questionText || !validStructureRole) {
    return null
  }
  if (!Number.isFinite(questionWeight) || questionWeight < 0 || options.length === 0) {
    return null
  }

  return {
    version,
    sourceVersion,
    questionId,
    changeSummary,
    structureRole: structureRole as 'noise_reduction' | 'core' | 'fine_tune' | 'closing',
    category,
    questionText,
    questionWeight,
    isActive,
    options,
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.edit')
  if (capabilityError) {
    await recordAdminAuditEvent({
      action: 'access.denied',
      session,
      subjectType: 'admin-route',
      subjectId: 'GET:/api/admin/questions/drafts/[draftId]',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  try {
    const { draftId } = await params
    const payload = await deps.getDraftDetail(draftId)
    if (!payload) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'question-draft-detail-failed',
        message: error instanceof Error ? error.message : 'Unknown question draft detail error',
      },
      { status: 503 },
    )
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
      subjectId: 'PATCH:/api/admin/questions/drafts/[draftId]',
      metadata: { error: capabilityError },
    })
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  let rawBody: UpdateDraftRequestBody
  try {
    rawBody = (await request.json()) as UpdateDraftRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }

  const payload = parseUpdateDraftBody(rawBody)
  if (!payload) {
    return NextResponse.json({ error: 'invalid-draft-update-payload' }, { status: 400 })
  }

  try {
    const { draftId } = await params
    const result = await deps.updateDraft({
      draftId,
      ...payload,
      updatedBy: session?.user?.email ?? 'unknown',
    })
    await recordAdminAuditEvent({
      action: 'draft.update',
      session,
      subjectType: 'question',
      subjectId: `${draftId}:${payload.questionId}`,
      metadata: {
        version: payload.version,
        changeSummary: payload.changeSummary,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'question-draft-update-failed',
        message: error instanceof Error ? error.message : 'Unknown question draft update error',
      },
      { status: 503 },
    )
  }
}
