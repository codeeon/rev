import { NextResponse } from 'next/server'
import type { BirthTimeKnowledge } from '@workspace/spreadsheet-admin/server'
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

function readString(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function parseBirthTimeKnowledge(value: string | null): BirthTimeKnowledge | undefined | null {
  const trimmed = readString(value)
  if (!trimmed) {
    return undefined
  }

  if (trimmed === 'known' || trimmed === 'unknown' || trimmed === 'approximate') {
    return trimmed
  }

  return null
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
    const birthTimeKnowledge = parseBirthTimeKnowledge(url.searchParams.get('birthTimeKnowledge'))
    if (birthTimeKnowledge === null) {
      return NextResponse.json({ error: 'invalid-birth-time-knowledge' }, { status: 400 })
    }

    const payload = await deps.listResults({
      limit: readPositiveInteger(url.searchParams.get('limit')),
      sessionId: readString(url.searchParams.get('sessionId')),
      questionVersion: readString(url.searchParams.get('questionVersion')),
      birthTimeKnowledge,
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
