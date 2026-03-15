import { NextResponse } from 'next/server'
import { buildAdminPublishPreviewResponse } from '@/lib/admin-contracts'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../route-deps'

export async function GET() {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.read')
  if (capabilityError) {
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  try {
    const questionPayload = await deps.listQuestions()
    return NextResponse.json(buildAdminPublishPreviewResponse(questionPayload))
  } catch (error) {
    return NextResponse.json(
      {
        error: 'publish-preview-load-failed',
        message: error instanceof Error ? error.message : 'Unknown publish preview load error',
      },
      { status: 503 },
    )
  }
}
