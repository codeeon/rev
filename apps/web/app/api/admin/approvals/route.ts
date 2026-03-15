import { NextResponse } from 'next/server'
import { getRequiredCapabilityError } from '@/lib/admin-access'
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

function readString(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export async function GET(request: Request) {
  const deps = getAdminRouteDeps()
  const session = await deps.auth()
  const capabilityError = getRequiredCapabilityError(session, 'roles.manage')
  if (capabilityError) {
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  try {
    const url = new URL(request.url)
    const payload = await deps.listApprovals({
      limit: readPositiveInteger(url.searchParams.get('limit')),
      approvalId: readString(url.searchParams.get('approvalId')),
      actorEmail: readString(url.searchParams.get('actorEmail')),
      draftId: readString(url.searchParams.get('draftId')),
    })

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'approval-log-load-failed',
        message: error instanceof Error ? error.message : 'Unknown approval log load error',
      },
      { status: 503 },
    )
  }
}
