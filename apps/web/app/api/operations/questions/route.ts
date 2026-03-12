import { NextResponse } from 'next/server'
import { getQuestionSyncResolver } from './route-deps'

export async function GET() {
  try {
    const payload = await getQuestionSyncResolver()()

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
