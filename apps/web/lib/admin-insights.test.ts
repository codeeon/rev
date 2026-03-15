import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdminAnalyticsSnapshot, summarizeQuestionSet } from './admin-insights'

test('buildAdminAnalyticsSnapshot summarizes counts and distributions', () => {
  const snapshot = buildAdminAnalyticsSnapshot(
    [
      {
        rowNumber: 2,
        sessionId: 'session-1',
        timestamp: '2026-03-14T00:00:00.000Z',
        engineVersion: '1.0',
        questionVersion: '2026.03.01',
        birthTimeKnowledge: 'known',
        surveyAnswers: [],
        inferenceResult: {
          inferredZishi: '자시',
          confidence: 92,
          isCusp: false,
          topCandidates: [],
        },
        monitoring: {
          top1Prob: 0.92,
          top2Gap: 0.14,
          stdSoftmax: 0.2,
          stdRawScore: 0.1,
          roleInfluence: {},
          alerts: {},
        },
        feedback: {
          rating: 4,
          accuracy: '5',
        },
      },
      {
        rowNumber: 3,
        sessionId: 'session-2',
        timestamp: '2026-03-10T00:00:00.000Z',
        engineVersion: '1.0',
        questionVersion: '2026.03.01',
        birthTimeKnowledge: 'unknown',
        surveyAnswers: [],
        inferenceResult: {
          inferredZishi: '자시',
          confidence: 73,
          isCusp: false,
          topCandidates: [],
        },
        monitoring: {
          top1Prob: 0.73,
          top2Gap: 0.11,
          stdSoftmax: 0.2,
          stdRawScore: 0.1,
          roleInfluence: {},
          alerts: {},
        },
      },
      {
        rowNumber: 4,
        sessionId: 'session-3',
        timestamp: '2026-02-01T00:00:00.000Z',
        engineVersion: '1.0',
        questionVersion: '2026.02.01',
        birthTimeKnowledge: 'approximate',
        surveyAnswers: [],
        inferenceResult: {
          inferredZishi: '축시',
          confidence: 58,
          isCusp: false,
          topCandidates: [],
        },
        monitoring: {
          top1Prob: 0.58,
          top2Gap: 0.06,
          stdSoftmax: 0.2,
          stdRawScore: 0.1,
          roleInfluence: {},
          alerts: {},
        },
        feedback: {
          rating: 2,
          accuracy: 'invalid',
        },
      },
    ],
    new Date('2026-03-15T00:00:00.000Z'),
  )

  assert.equal(snapshot.sampleSize, 3)
  assert.equal(snapshot.last7dCount, 2)
  assert.equal(snapshot.last30dCount, 2)
  assert.equal(snapshot.latestResultAt, '2026-03-14T00:00:00.000Z')
  assert.equal(snapshot.feedbackRate, 66.7)
  assert.equal(snapshot.averageRating, 3)
  assert.equal(snapshot.averageAccuracy, 5)
  assert.deepEqual(snapshot.questionVersionDistribution, [
    { label: '2026.03.01', count: 2, share: 66.7 },
    { label: '2026.02.01', count: 1, share: 33.3 },
  ])
  assert.deepEqual(snapshot.birthTimeKnowledgeDistribution, [
    { label: 'approximate', count: 1, share: 33.3 },
    { label: 'known', count: 1, share: 33.3 },
    { label: 'unknown', count: 1, share: 33.3 },
  ])
  assert.deepEqual(snapshot.confidenceDistribution, [
    { label: '0-59', count: 1, share: 33.3 },
    { label: '60-74', count: 1, share: 33.3 },
    { label: '90-100', count: 1, share: 33.3 },
  ])
  assert.deepEqual(snapshot.inferredZishiDistribution, [
    { label: '자시', count: 2, share: 66.7 },
    { label: '축시', count: 1, share: 33.3 },
  ])
})

test('summarizeQuestionSet tracks role and category coverage', () => {
  const summary = summarizeQuestionSet([
    {
      id: 'Q1',
      structure_role: 'noise_reduction',
      category: 'time-sense',
      question_weight: 1,
      text: 'Q1',
      options: [
        { text: 'A', score_map: {} },
        { text: 'B', score_map: {} },
      ],
    },
    {
      id: 'Q2',
      structure_role: 'core',
      category: 'sleep',
      question_weight: 2,
      text: 'Q2',
      options: [{ text: 'A', score_map: {} }],
    },
    {
      id: 'Q3',
      structure_role: 'core',
      category: 'sleep',
      question_weight: 3,
      text: 'Q3',
      options: [{ text: 'A', score_map: {} }],
    },
  ])

  assert.equal(summary.totalQuestions, 3)
  assert.equal(summary.totalOptions, 4)
  assert.equal(summary.averageOptionsPerQuestion, 1.3)
  assert.equal(summary.totalWeight, 6)
  assert.equal(summary.averageWeight, 2)
  assert.deepEqual(summary.roleDistribution, [
    { label: 'core', count: 2, share: 66.7 },
    { label: 'noise_reduction', count: 1, share: 33.3 },
  ])
  assert.deepEqual(summary.categoryDistribution, [
    { label: 'sleep', count: 2, share: 66.7 },
    { label: 'time-sense', count: 1, share: 33.3 },
  ])
  assert.deepEqual(summary.missingRoles, ['fine_tune', 'closing'])
  assert.deepEqual(summary.heaviestQuestionIds, ['Q3', 'Q2', 'Q1'])
})
