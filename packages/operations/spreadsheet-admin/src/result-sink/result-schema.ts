import type { SurveyAnswer } from '@workspace/time-inference'

export type BirthTimeKnowledge = 'known' | 'unknown' | 'approximate'

export interface InferenceResult {
  inferredZishi: string
  confidence: number
  isCusp: boolean
  topCandidates: Array<{
    branch: string
    branchKr: string
    score: number
    percentage: number
  }>
}

export interface MonitoringResult {
  top1Prob: number
  top2Gap: number
  stdSoftmax: number
  stdRawScore: number
  roleInfluence: Record<string, number>
  alerts: Record<string, boolean>
}

export interface AnalysisFeedback {
  rating?: number
  accuracy?: number | string
}

export interface AnalysisResultRecord {
  sessionId: string
  timestamp: string
  engineVersion: string
  questionVersion: string
  birthTimeKnowledge: BirthTimeKnowledge
  approximateRange?: {
    start: number
    end: number
  }
  surveyAnswers: SurveyAnswer[]
  inferenceResult: InferenceResult
  monitoring: MonitoringResult
  feedback?: AnalysisFeedback
}

export const RESULT_SHEET_HEADERS = [
  'sessionId',
  'timestamp',
  'engineVersion',
  'questionVersion',
  'birthTimeKnowledge',
  'approximateRangeJson',
  'surveyAnswersJson',
  'inferenceResultJson',
  'monitoringJson',
  'feedbackJson',
] as const

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required`)
  }
}

function assertFinite(value: number, fieldName: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`)
  }
}

export function validateAnalysisResultRecord(record: AnalysisResultRecord): void {
  assertNonEmpty(record.sessionId, 'sessionId')
  assertNonEmpty(record.timestamp, 'timestamp')
  assertNonEmpty(record.engineVersion, 'engineVersion')
  assertNonEmpty(record.questionVersion, 'questionVersion')

  assertFinite(record.inferenceResult.confidence, 'inferenceResult.confidence')
  assertFinite(record.monitoring.top1Prob, 'monitoring.top1Prob')
  assertFinite(record.monitoring.top2Gap, 'monitoring.top2Gap')
  assertFinite(record.monitoring.stdSoftmax, 'monitoring.stdSoftmax')
  assertFinite(record.monitoring.stdRawScore, 'monitoring.stdRawScore')
}

export function toResultSheetRow(record: AnalysisResultRecord): string[] {
  validateAnalysisResultRecord(record)

  return [
    record.sessionId,
    record.timestamp,
    record.engineVersion,
    record.questionVersion,
    record.birthTimeKnowledge,
    JSON.stringify(record.approximateRange ?? null),
    JSON.stringify(record.surveyAnswers),
    JSON.stringify(record.inferenceResult),
    JSON.stringify(record.monitoring),
    JSON.stringify(record.feedback ?? null),
  ]
}
