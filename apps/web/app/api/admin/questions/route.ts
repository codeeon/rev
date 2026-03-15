import { NextResponse } from 'next/server'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../route-deps'

export async function GET() {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'questions.read')
  if (capabilityError) {
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  try {
    const payload = await deps.listQuestions()

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'question-sync-failed',
        message: error instanceof Error ? error.message : 'Unknown question sync error',
      },
      { status: 503 },
    )
  }
}
