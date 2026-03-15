import { NextResponse } from 'next/server'
import { buildAdminAnalyticsSummaryResponse } from '@/lib/admin-contracts'
import { getRequiredCapabilityError } from '@/lib/admin-access'
import { getAdminRouteDeps } from '../../route-deps'

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
  const capabilityError = getRequiredCapabilityError(session, 'analytics.read')
  if (capabilityError) {
    return NextResponse.json({ error: capabilityError }, { status: capabilityError === 'unauthorized' ? 401 : 403 })
  }

  try {
    const url = new URL(request.url)
    const limit = readPositiveInteger(url.searchParams.get('limit'))
    const [resultsPayload, questionPayload] = await Promise.all([
      deps.listResults({ limit }),
      deps.listQuestions(),
    ])

    return NextResponse.json(buildAdminAnalyticsSummaryResponse(resultsPayload, questionPayload))
  } catch (error) {
    return NextResponse.json(
      {
        error: 'analytics-summary-load-failed',
        message: error instanceof Error ? error.message : 'Unknown analytics summary load error',
      },
      { status: 503 },
    )
  }
}
