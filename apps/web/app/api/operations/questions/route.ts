import { NextResponse } from 'next/server'
import { syncQuestionsFromSpreadsheet, type QuestionSyncResponse } from '@/lib/operations/spreadsheet'

type QuestionSyncResolver = () => Promise<QuestionSyncResponse>

let questionSyncResolverForTest: QuestionSyncResolver | null = null

export function __setQuestionSyncResolverForTest(resolver: QuestionSyncResolver | null): void {
  questionSyncResolverForTest = resolver
}

export async function GET() {
  try {
    const payload = questionSyncResolverForTest
      ? await questionSyncResolverForTest()
      : await syncQuestionsFromSpreadsheet()

    return NextResponse.json(payload)
  } catch {
    const fallback = await syncQuestionsFromSpreadsheet()
    return NextResponse.json({
      ...fallback,
      warning: fallback.warning ?? 'question-sync-unexpected-error',
    })
  }
}
