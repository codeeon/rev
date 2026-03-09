import { syncQuestionsFromSpreadsheet, type QuestionSyncResponse } from '@workspace/spreadsheet-admin/server'

type QuestionSyncResolver = () => Promise<QuestionSyncResponse>

let questionSyncResolver: QuestionSyncResolver = syncQuestionsFromSpreadsheet

export function getQuestionSyncResolver(): QuestionSyncResolver {
  return questionSyncResolver
}

export function setQuestionSyncResolverForTest(resolver: QuestionSyncResolver | null): void {
  questionSyncResolver = resolver ?? syncQuestionsFromSpreadsheet
}
