import type { EngineQuestion } from '@workspace/time-inference'
import type { StoredAnalysisResultRecord } from '@workspace/spreadsheet-admin/server'
import { STRUCTURE_ROLES } from '@workspace/spreadsheet-admin/server'

export interface DistributionItem {
  label: string
  count: number
  share: number
}

export interface AdminAnalyticsSnapshot {
  sampleSize: number
  last7dCount: number
  last30dCount: number
  latestResultAt: string | null
  feedbackRate: number
  averageRating: number | null
  averageAccuracy: number | null
  questionVersionDistribution: DistributionItem[]
  birthTimeKnowledgeDistribution: DistributionItem[]
  confidenceDistribution: DistributionItem[]
  inferredZishiDistribution: DistributionItem[]
}

export interface QuestionSetSummary {
  totalQuestions: number
  totalOptions: number
  averageOptionsPerQuestion: number
  totalWeight: number
  averageWeight: number
  roleDistribution: DistributionItem[]
  categoryDistribution: DistributionItem[]
  missingRoles: string[]
  heaviestQuestionIds: string[]
}

interface ConfidenceBucket {
  label: string
  min: number
  max: number
}

const CONFIDENCE_BUCKETS: ConfidenceBucket[] = [
  { label: '0-59', min: 0, max: 59.999 },
  { label: '60-74', min: 60, max: 74.999 },
  { label: '75-89', min: 75, max: 89.999 },
  { label: '90-100', min: 90, max: Number.POSITIVE_INFINITY },
]

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

function toShare(count: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return roundToSingleDecimal((count / total) * 100)
}

function toDistribution(map: Map<string, number>, total: number): DistributionItem[] {
  return [...map.entries()]
    .map(([label, count]) => ({
      label,
      count,
      share: toShare(count, total),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNumericValue(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function findConfidenceBucket(confidence: number): string {
  return (
    CONFIDENCE_BUCKETS.find(bucket => confidence >= bucket.min && confidence <= bucket.max)?.label ??
    CONFIDENCE_BUCKETS[CONFIDENCE_BUCKETS.length - 1]!.label
  )
}

export function buildAdminAnalyticsSnapshot(
  items: StoredAnalysisResultRecord[],
  now: Date = new Date(),
): AdminAnalyticsSnapshot {
  const sampleSize = items.length
  const nowMs = now.getTime()
  const last7dThreshold = nowMs - 7 * 24 * 60 * 60 * 1000
  const last30dThreshold = nowMs - 30 * 24 * 60 * 60 * 1000
  const questionVersionCounts = new Map<string, number>()
  const birthTimeKnowledgeCounts = new Map<string, number>()
  const confidenceCounts = new Map<string, number>()
  const inferredZishiCounts = new Map<string, number>()

  let latestTimestamp: number | null = null
  let last7dCount = 0
  let last30dCount = 0
  let feedbackCount = 0
  const ratingValues: number[] = []
  const accuracyValues: number[] = []

  for (const item of items) {
    increment(questionVersionCounts, item.questionVersion)
    increment(birthTimeKnowledgeCounts, item.birthTimeKnowledge)
    increment(confidenceCounts, findConfidenceBucket(item.inferenceResult.confidence))
    increment(inferredZishiCounts, item.inferenceResult.inferredZishi)

    const timestamp = parseTimestamp(item.timestamp)
    if (timestamp !== null) {
      latestTimestamp = latestTimestamp === null ? timestamp : Math.max(latestTimestamp, timestamp)

      if (timestamp >= last7dThreshold) {
        last7dCount += 1
      }

      if (timestamp >= last30dThreshold) {
        last30dCount += 1
      }
    }

    if (item.feedback) {
      feedbackCount += 1

      const rating = parseNumericValue(item.feedback.rating)
      if (rating !== null) {
        ratingValues.push(rating)
      }

      const accuracy = parseNumericValue(item.feedback.accuracy)
      if (accuracy !== null) {
        accuracyValues.push(accuracy)
      }
    }
  }

  const averageRating =
    ratingValues.length > 0 ? roundToSingleDecimal(ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length) : null
  const averageAccuracy =
    accuracyValues.length > 0
      ? roundToSingleDecimal(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length)
      : null

  return {
    sampleSize,
    last7dCount,
    last30dCount,
    latestResultAt: latestTimestamp === null ? null : new Date(latestTimestamp).toISOString(),
    feedbackRate: toShare(feedbackCount, sampleSize),
    averageRating,
    averageAccuracy,
    questionVersionDistribution: toDistribution(questionVersionCounts, sampleSize),
    birthTimeKnowledgeDistribution: toDistribution(birthTimeKnowledgeCounts, sampleSize),
    confidenceDistribution: toDistribution(confidenceCounts, sampleSize),
    inferredZishiDistribution: toDistribution(inferredZishiCounts, sampleSize),
  }
}

export function summarizeQuestionSet(questions: EngineQuestion[]): QuestionSetSummary {
  const totalQuestions = questions.length
  const totalOptions = questions.reduce((sum, question) => sum + question.options.length, 0)
  const totalWeight = questions.reduce((sum, question) => sum + question.question_weight, 0)
  const roleCounts = new Map<string, number>()
  const categoryCounts = new Map<string, number>()

  for (const question of questions) {
    increment(roleCounts, question.structure_role)
    increment(categoryCounts, question.category)
  }

  const sortedByWeight = [...questions]
    .sort((left, right) => right.question_weight - left.question_weight || left.id.localeCompare(right.id))
    .slice(0, 3)
    .map(question => question.id)

  return {
    totalQuestions,
    totalOptions,
    averageOptionsPerQuestion: totalQuestions > 0 ? roundToSingleDecimal(totalOptions / totalQuestions) : 0,
    totalWeight: roundToSingleDecimal(totalWeight),
    averageWeight: totalQuestions > 0 ? roundToSingleDecimal(totalWeight / totalQuestions) : 0,
    roleDistribution: toDistribution(roleCounts, totalQuestions),
    categoryDistribution: toDistribution(categoryCounts, totalQuestions),
    missingRoles: STRUCTURE_ROLES.filter(role => !roleCounts.has(role)),
    heaviestQuestionIds: sortedByWeight,
  }
}
