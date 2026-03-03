import { NextResponse } from 'next/server'
import { type AnalysisResultRecord, validateAnalysisResultRecord } from '@workspace/spreadsheet-admin/server'
import { saveAnalysisResultToSpreadsheet, type SaveResultResponse } from '@/lib/operations/spreadsheet'

type FeedbackResultSaver = (record: AnalysisResultRecord) => Promise<SaveResultResponse>

let feedbackResultSaverForTest: FeedbackResultSaver | null = null

export function __setFeedbackResultSaverForTest(saver: FeedbackResultSaver | null): void {
  feedbackResultSaverForTest = saver
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseStringNumberRecord(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) {
    return null
  }

  const parsed: Record<string, number> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      return null
    }
    parsed[key] = item
  }

  return parsed
}

function parseStringBooleanRecord(value: unknown): Record<string, boolean> | null {
  if (!isRecord(value)) {
    return null
  }

  const parsed: Record<string, boolean> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'boolean') {
      return null
    }
    parsed[key] = item
  }

  return parsed
}

function parseSurveyAnswers(value: unknown): AnalysisResultRecord['surveyAnswers'] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const parsed: AnalysisResultRecord['surveyAnswers'] = []
  for (const item of value) {
    if (!isRecord(item)) {
      return null
    }

    const questionId = readString(item, 'questionId')
    const optionIndex = readNumber(item, 'optionIndex')
    if (!questionId || optionIndex === null || !Number.isInteger(optionIndex) || optionIndex < 0) {
      return null
    }

    parsed.push({
      questionId,
      optionIndex,
    })
  }

  return parsed
}

function parseTopCandidates(value: unknown): AnalysisResultRecord['inferenceResult']['topCandidates'] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const parsed: AnalysisResultRecord['inferenceResult']['topCandidates'] = []
  for (const item of value) {
    if (!isRecord(item)) {
      return null
    }

    const branch = readString(item, 'branch')
    const branchKr = readString(item, 'branchKr')
    const score = readNumber(item, 'score')
    const percentage = readNumber(item, 'percentage')

    if (!branch || !branchKr || score === null || percentage === null) {
      return null
    }

    parsed.push({
      branch,
      branchKr,
      score,
      percentage,
    })
  }

  return parsed
}

function parseApproximateRange(value: unknown): AnalysisResultRecord['approximateRange'] | null {
  if (typeof value === 'undefined' || value === null) {
    return undefined
  }

  if (!isRecord(value)) {
    return null
  }

  const start = readNumber(value, 'start')
  const end = readNumber(value, 'end')
  if (start === null || end === null) {
    return null
  }

  return { start, end }
}

function parseFeedback(value: unknown): AnalysisResultRecord['feedback'] | null {
  if (typeof value === 'undefined' || value === null) {
    return undefined
  }

  if (!isRecord(value)) {
    return null
  }

  const ratingValue = value.rating
  const accuracyValue = value.accuracy

  const rating = typeof ratingValue === 'number' && Number.isFinite(ratingValue) ? ratingValue : undefined
  const accuracy =
    typeof accuracyValue === 'number' && Number.isFinite(accuracyValue)
      ? accuracyValue
      : typeof accuracyValue === 'string' && accuracyValue.trim()
        ? accuracyValue.trim()
        : undefined

  if (typeof rating === 'undefined' && typeof accuracy === 'undefined') {
    return undefined
  }

  return {
    rating,
    accuracy,
  }
}

function parseBirthTimeKnowledge(value: unknown): AnalysisResultRecord['birthTimeKnowledge'] | null {
  if (value === 'known' || value === 'unknown' || value === 'approximate') {
    return value
  }

  return null
}

function parseAnalysisResultRecord(input: unknown): AnalysisResultRecord | null {
  if (!isRecord(input)) {
    return null
  }

  const sessionId = readString(input, 'sessionId')
  const timestamp = readString(input, 'timestamp')
  const engineVersion = readString(input, 'engineVersion')
  const questionVersion = readString(input, 'questionVersion')
  const birthTimeKnowledge = parseBirthTimeKnowledge(input.birthTimeKnowledge)
  const approximateRange = parseApproximateRange(input.approximateRange)
  const surveyAnswers = parseSurveyAnswers(input.surveyAnswers)

  if (!sessionId || !timestamp || !engineVersion || !questionVersion || !birthTimeKnowledge || !surveyAnswers || approximateRange === null) {
    return null
  }

  const inferenceResultRaw = input.inferenceResult
  if (!isRecord(inferenceResultRaw)) {
    return null
  }

  const inferredZishi = readString(inferenceResultRaw, 'inferredZishi')
  const confidence = readNumber(inferenceResultRaw, 'confidence')
  const isCusp = inferenceResultRaw.isCusp
  const topCandidates = parseTopCandidates(inferenceResultRaw.topCandidates)
  if (!inferredZishi || confidence === null || typeof isCusp !== 'boolean' || !topCandidates) {
    return null
  }

  const monitoringRaw = input.monitoring
  if (!isRecord(monitoringRaw)) {
    return null
  }

  const top1Prob = readNumber(monitoringRaw, 'top1Prob')
  const top2Gap = readNumber(monitoringRaw, 'top2Gap')
  const stdSoftmax = readNumber(monitoringRaw, 'stdSoftmax')
  const stdRawScore = readNumber(monitoringRaw, 'stdRawScore')
  const roleInfluence = parseStringNumberRecord(monitoringRaw.roleInfluence)
  const alerts = parseStringBooleanRecord(monitoringRaw.alerts)

  if (
    top1Prob === null ||
    top2Gap === null ||
    stdSoftmax === null ||
    stdRawScore === null ||
    roleInfluence === null ||
    alerts === null
  ) {
    return null
  }

  const feedback = parseFeedback(input.feedback)
  if (feedback === null) {
    return null
  }

  return {
    sessionId,
    timestamp,
    engineVersion,
    questionVersion,
    birthTimeKnowledge,
    approximateRange,
    surveyAnswers,
    inferenceResult: {
      inferredZishi,
      confidence,
      isCusp,
      topCandidates,
    },
    monitoring: {
      top1Prob,
      top2Gap,
      stdSoftmax,
      stdRawScore,
      roleInfluence,
      alerts,
    },
    feedback,
  }
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsedRecord = parseAnalysisResultRecord(body)
  if (!parsedRecord) {
    return NextResponse.json({ error: 'Invalid feedback payload' }, { status: 400 })
  }

  try {
    validateAnalysisResultRecord(parsedRecord)
  } catch {
    return NextResponse.json({ error: 'Invalid feedback payload' }, { status: 400 })
  }

  const result = feedbackResultSaverForTest
    ? await feedbackResultSaverForTest(parsedRecord)
    : await saveAnalysisResultToSpreadsheet(parsedRecord)

  if (result.saved) {
    return NextResponse.json({ saved: true })
  }

  return NextResponse.json({ saved: false, reason: result.reason ?? 'save-failed' }, { status: 202 })
}
