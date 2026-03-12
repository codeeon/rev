import { NextResponse } from 'next/server'
import { getAdminSessionStatus } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../route-deps'

export async function GET() {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const sessionStatus = getAdminSessionStatus(session)

  if (sessionStatus === 'unauthorized') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (sessionStatus === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
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
