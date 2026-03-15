import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdminAnalyticsSummaryResponse, buildAdminPublishPreviewResponse, getAdminDraftModelContract } from './admin-contracts'

const QUESTION_PAYLOAD = {
  source: 'spreadsheet-latest' as const,
  questionVersion: '2026.03.15',
  questions: [
    {
      id: 'Q1',
      structure_role: 'noise_reduction' as const,
      category: 'habit',
      question_weight: 1,
      text: 'Q1',
      options: [{ text: 'A', score_map: {} }],
    },
    {
      id: 'Q2',
      structure_role: 'core' as const,
      category: 'habit',
      question_weight: 2,
      text: 'Q2',
      options: [{ text: 'A', score_map: {} }],
    },
    {
      id: 'Q3',
      structure_role: 'fine_tune' as const,
      category: 'sleep',
      question_weight: 3,
      text: 'Q3',
      options: [{ text: 'A', score_map: {} }],
    },
    {
      id: 'Q4',
      structure_role: 'closing' as const,
      category: 'sleep',
      question_weight: 4,
      text: 'Q4',
      options: [{ text: 'A', score_map: {} }],
    },
  ],
}

test('buildAdminAnalyticsSummaryResponse shapes analytics contract for routes', () => {
  const response = buildAdminAnalyticsSummaryResponse(
    {
      limit: 100,
      items: [
        {
          rowNumber: 2,
          sessionId: 'session-1',
          timestamp: '2026-03-15T00:00:00.000Z',
          engineVersion: '1.0',
          questionVersion: '2026.03.15',
          birthTimeKnowledge: 'known',
          surveyAnswers: [],
          inferenceResult: {
            inferredZishi: '자시',
            confidence: 91,
            isCusp: false,
            topCandidates: [],
          },
          monitoring: {
            top1Prob: 0.91,
            top2Gap: 0.12,
            stdSoftmax: 0.1,
            stdRawScore: 0.1,
            roleInfluence: {},
            alerts: {},
          },
          feedback: {
            rating: 5,
            accuracy: 4,
          },
        },
      ],
    },
    QUESTION_PAYLOAD,
    new Date('2026-03-15T00:00:00.000Z'),
  )

  assert.equal(response.generatedAt, '2026-03-15T00:00:00.000Z')
  assert.equal(response.currentQuestionVersion, '2026.03.15')
  assert.equal(response.currentVersionResultCount, 1)
  assert.deepEqual(response.supportedWindows, ['7d', '30d', '90d'])
  assert.equal(response.kpis.feedbackRate, 100)
  assert.equal(response.questionSetSummary.missingRoles.length, 0)
  assert.equal(response.distributions.questionVersion[0]?.label, '2026.03.15')
})

test('buildAdminPublishPreviewResponse exposes draft model and role matrix', () => {
  const response = buildAdminPublishPreviewResponse(QUESTION_PAYLOAD, new Date('2026-03-15T00:00:00.000Z'))
  const draftModel = getAdminDraftModelContract()

  assert.equal(response.generatedAt, '2026-03-15T00:00:00.000Z')
  assert.equal(response.publishedVersion, '2026.03.15')
  assert.equal(response.requiredRoles.publish, 'owner')
  assert.equal(response.roleMatrix.length, 3)
  assert.deepEqual(response.draftModel, draftModel)
  assert.equal(response.checklist[0]?.status, 'ready')
  assert.equal(response.checklist[1]?.status, 'ready')
  assert.equal(response.checklist[2]?.status, 'planned')
})
