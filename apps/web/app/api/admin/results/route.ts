import { NextResponse } from 'next/server'
import { getAdminSessionStatus } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../route-deps'

function readPositiveInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

export async function GET(request: Request) {
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
    const url = new URL(request.url)
    const payload = await deps.listResults({
      limit: readPositiveInteger(url.searchParams.get('limit')),
      sessionId: url.searchParams.get('sessionId')?.trim() || undefined,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'results-load-failed',
        message: error instanceof Error ? error.message : 'Unknown results load error',
      },
      { status: 503 },
    )
  }
}
