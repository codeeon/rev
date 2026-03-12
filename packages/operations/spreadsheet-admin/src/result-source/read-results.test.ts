import assert from 'node:assert/strict'
import test from 'node:test'
import type { GoogleSheetsClient } from '@workspace/google-sheets/server'
import { getAnalysisResultBySessionId, listAnalysisResults } from './read-results'

function createFakeSheetsClient(rows: string[][]): GoogleSheetsClient {
  return {
    values: {
      get: async () => ({ values: rows }),
      batchGet: async () => ({ valueRanges: [] }),
      batchUpdate: async () => ({ totalUpdatedRows: 0 }),
      append: async () => ({ updates: { updatedRows: 1 } }),
    },
    spreadsheets: {
      batchUpdate: async () => ({ replies: [] }),
    },
  }
}

function createRows(): string[][] {
  return [
    [
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
    ],
    [
      'session-1',
      '2026-03-10T00:00:00.000Z',
      '4.1',
      '4.1',
      'unknown',
      'null',
      '[{"questionId":"Q1","optionIndex":0}]',
      '{"inferredZishi":"자시","confidence":84,"isCusp":false,"topCandidates":[{"branch":"子","branchKr":"자","score":1.2,"percentage":84}]}',
      '{"top1Prob":0.84,"top2Gap":0.21,"stdSoftmax":0,"stdRawScore":0,"roleInfluence":{},"alerts":{}}',
      '{"rating":5,"accuracy":"accurate"}',
    ],
    [
      'session-2',
      '2026-03-11T00:00:00.000Z',
      '4.1',
      '4.1',
      'approximate',
      '{"start":3,"end":5}',
      '[{"questionId":"Q2","optionIndex":1}]',
      '{"inferredZishi":"축시","confidence":67,"isCusp":true,"topCandidates":[{"branch":"丑","branchKr":"축","score":1.1,"percentage":67}]}',
      '{"top1Prob":0.67,"top2Gap":0.09,"stdSoftmax":0,"stdRawScore":0,"roleInfluence":{},"alerts":{}}',
      '{"rating":4,"accuracy":"possible"}',
    ],
  ]
}

test('listAnalysisResults returns latest rows first and respects limit', async () => {
  const payload = await listAnalysisResults({
    client: createFakeSheetsClient(createRows()),
    spreadsheetId: 'sheet-id',
    range: 'Results!A:J',
    limit: 1,
  })

  assert.equal(payload.items.length, 1)
  assert.equal(payload.limit, 1)
  assert.equal(payload.items[0]?.sessionId, 'session-2')
  assert.equal(payload.items[0]?.feedback?.rating, 4)
})

test('listAnalysisResults filters by exact sessionId', async () => {
  const payload = await listAnalysisResults({
    client: createFakeSheetsClient(createRows()),
    spreadsheetId: 'sheet-id',
    range: 'Results!A:J',
    sessionId: 'session-1',
  })

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.sessionId, 'session-1')
  assert.equal(payload.matchedSessionId, 'session-1')
})

test('getAnalysisResultBySessionId returns a matching row', async () => {
  const result = await getAnalysisResultBySessionId({
    client: createFakeSheetsClient(createRows()),
    spreadsheetId: 'sheet-id',
    range: 'Results!A:J',
    sessionId: 'session-2',
  })

  assert.equal(result?.sessionId, 'session-2')
  assert.equal(result?.birthTimeKnowledge, 'approximate')
  assert.deepEqual(result?.approximateRange, { start: 3, end: 5 })
})
