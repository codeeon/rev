import assert from 'node:assert/strict'
import test from 'node:test'
import type { GoogleSheetsClient } from '@workspace/google-sheets/server'
import { getAnalysisResultBySessionId, listAnalysisResults } from './read-results'

function selectRowsForRange(rows: string[][], range: string): string[][] {
  if (range === 'Results!A:J') {
    return rows
  }

  const match = range.match(/^Results!A(\d+):J(\d+)$/)
  if (match) {
    const startRow = Number(match[1])
    const endRow = Number(match[2])
    return rows.slice(startRow - 1, endRow)
  }

  return []
}

function createFakeSheetsClient(rows: string[][], rowCount = rows.length): GoogleSheetsClient {
  return {
    values: {
      get: async ({ range }) => ({ values: selectRowsForRange(rows, range) }),
      batchGet: async () => ({ valueRanges: [] }),
      batchUpdate: async () => ({ totalUpdatedRows: 0 }),
      append: async () => ({ updates: { updatedRows: 1 } }),
    },
    spreadsheets: {
      get: async () => ({
        sheets: [
          {
            properties: {
              title: 'Results',
              gridProperties: {
                rowCount,
              },
            },
          },
        ],
      }),
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
    client: createFakeSheetsClient(createRows(), 1000),
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
    client: createFakeSheetsClient(createRows(), 1000),
    spreadsheetId: 'sheet-id',
    range: 'Results!A:J',
    sessionId: 'session-1',
  })

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.sessionId, 'session-1')
  assert.equal(payload.matchedSessionId, 'session-1')
})

test('listAnalysisResults filters by questionVersion and birthTimeKnowledge', async () => {
  const rows = createRows()
  rows.push([
    'session-3',
    '2026-03-12T00:00:00.000Z',
    '4.2',
    '4.2',
    'known',
    'null',
    '[{"questionId":"Q3","optionIndex":2}]',
    '{"inferredZishi":"인시","confidence":72,"isCusp":false,"topCandidates":[{"branch":"寅","branchKr":"인","score":1.1,"percentage":72}]}',
    '{"top1Prob":0.72,"top2Gap":0.14,"stdSoftmax":0,"stdRawScore":0,"roleInfluence":{},"alerts":{}}',
    'null',
  ])

  const payload = await listAnalysisResults({
    client: createFakeSheetsClient(rows),
    spreadsheetId: 'sheet-id',
    range: 'Results!A:J',
    questionVersion: '4.2',
    birthTimeKnowledge: 'known',
  })

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.sessionId, 'session-3')
  assert.equal(payload.matchedQuestionVersion, '4.2')
  assert.equal(payload.matchedBirthTimeKnowledge, 'known')
})

test('getAnalysisResultBySessionId returns a matching row', async () => {
  const result = await getAnalysisResultBySessionId({
    client: createFakeSheetsClient(createRows(), 1000),
    spreadsheetId: 'sheet-id',
    range: 'Results!A:J',
    sessionId: 'session-2',
  })

  assert.equal(result?.sessionId, 'session-2')
  assert.equal(result?.birthTimeKnowledge, 'approximate')
  assert.deepEqual(result?.approximateRange, { start: 3, end: 5 })
})
