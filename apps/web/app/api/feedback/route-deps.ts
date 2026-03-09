import type { AnalysisResultRecord } from '@workspace/spreadsheet-admin/server'
import { saveAnalysisResultToSpreadsheet, type SaveResultResponse } from '@workspace/spreadsheet-admin/server'

type FeedbackResultSaver = (record: AnalysisResultRecord) => Promise<SaveResultResponse>

let feedbackResultSaver: FeedbackResultSaver = saveAnalysisResultToSpreadsheet

export function getFeedbackResultSaver(): FeedbackResultSaver {
  return feedbackResultSaver
}

export function setFeedbackResultSaverForTest(saver: FeedbackResultSaver | null): void {
  feedbackResultSaver = saver ?? saveAnalysisResultToSpreadsheet
}
