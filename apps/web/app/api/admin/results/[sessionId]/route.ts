import { NextResponse } from 'next/server'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../route-deps'

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'results.read')
  if (capabilityError) {
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  const { sessionId } = await context.params
  if (!sessionId.trim()) {
    return NextResponse.json({ error: 'invalid-session-id' }, { status: 400 })
  }

  try {
    const result = await deps.getResultBySessionId(sessionId)

    if (!result) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'result-load-failed',
        message: error instanceof Error ? error.message : 'Unknown result load error',
      },
      { status: 503 },
    )
  }
}
