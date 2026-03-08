import { NextResponse } from 'next/server'
import { syncQuestionsFromSpreadsheet } from '@/lib/operations/spreadsheet'
import { getQuestionSyncResolver } from './route-deps'

export async function GET() {
  try {
    const payload = await getQuestionSyncResolver()()

    return NextResponse.json(payload)
  } catch {
    const fallback = await syncQuestionsFromSpreadsheet()
    return NextResponse.json({
      ...fallback,
      warning: fallback.warning ?? 'question-sync-unexpected-error',
    })
  }
}
