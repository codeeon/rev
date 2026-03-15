import assert from 'node:assert/strict'
import test from 'node:test'
import type { GoogleSheetsClient } from '@workspace/google-sheets/server'
import { InMemoryLastKnownGoodStore } from '../sync/last-known-good'
import {
  getAdminResultBySessionIdFromSpreadsheet,
  listAdminResultsFromSpreadsheet,
  saveAnalysisResultToSpreadsheet,
  syncQuestionsFromSpreadsheet,
} from './service'

const TEST_ENV = {
  GOOGLE_SPREADSHEET_ADMIN_ID: 'sheet-id',
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.iam.gserviceaccount.com',
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nLINE\\n-----END PRIVATE KEY-----\\n',
}

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

function createFakeSheetsClient(): GoogleSheetsClient {
  return {
    values: {
      get: async () => ({
        values: [
          [
            'version',
            'questionId',
            'structureRole',
            'category',
            'questionWeight',
            'questionText',
            'optionIndex',
            'optionText',
            'scoreMapJson',
            'isActive',
            'updatedAt',
          ],
          ['2026.03.10', 'Q1', 'noise_reduction', 'Warm-up', '1', '첫 질문', '0', '예', '{"자시":1}', 'true', '2026-03-10T00:00:00.000Z'],
          ['2026.03.10', 'Q2', 'core', 'Core', '1', '둘째 질문', '0', '예', '{"축시":1}', 'true', '2026-03-10T00:00:00.000Z'],
          ['2026.03.10', 'Q3', 'fine_tune', 'Tune', '1', '셋째 질문', '0', '예', '{"인시":1}', 'true', '2026-03-10T00:00:00.000Z'],
          ['2026.03.10', 'Q4', 'closing', 'Close', '1', '넷째 질문', '0', '예', '{"묘시":1}', 'true', '2026-03-10T00:00:00.000Z'],
        ],
      }),
      batchGet: async () => ({ valueRanges: [] }),
      batchUpdate: async () => ({ totalUpdatedRows: 0 }),
      append: async () => ({ updates: { updatedRows: 1 } }),
    },
    spreadsheets: {
      get: async () => ({ sheets: [] }),
      batchUpdate: async () => ({ replies: [] }),
    },
  }
}

function createFakeSheetsClientForResults(): GoogleSheetsClient {
  const rows = [
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
  ]

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
                rowCount: 1000,
              },
            },
          },
        ],
      }),
      batchUpdate: async () => ({ replies: [] }),
    },
  }
}

function createValidRecord() {
  return {
    sessionId: 'session-1',
    timestamp: '2026-03-10T00:00:00.000Z',
    engineVersion: '4.1',
    questionVersion: '2026.03.10',
    birthTimeKnowledge: 'unknown' as const,
    surveyAnswers: [{ questionId: 'Q1', optionIndex: 0 }],
    inferenceResult: {
      inferredZishi: '자시',
      confidence: 84,
      isCusp: false,
      topCandidates: [{ branch: '子', branchKr: '자', score: 1.2, percentage: 84 }],
    },
    monitoring: {
      top1Prob: 0.84,
      top2Gap: 0.21,
      stdSoftmax: 0,
      stdRawScore: 0,
      roleInfluence: {},
      alerts: {},
    },
  }
}

test('syncQuestionsFromSpreadsheet throws when env is not configured', async () => {
  await assert.rejects(() => syncQuestionsFromSpreadsheet({}), /spreadsheet-sync-not-configured/)
})

test('syncQuestionsFromSpreadsheet resolves spreadsheet payload through injected client', async () => {
  const payload = await syncQuestionsFromSpreadsheet(TEST_ENV, {
    createClient: () => createFakeSheetsClient(),
    store: new InMemoryLastKnownGoodStore(),
  })

  assert.equal(payload.source, 'spreadsheet-latest')
  assert.equal(payload.questionVersion, '2026.03.10')
  assert.equal(payload.questions.length, 4)
})

test('saveAnalysisResultToSpreadsheet uses injected client when configured', async () => {
  const result = await saveAnalysisResultToSpreadsheet(createValidRecord(), TEST_ENV, {
    createClient: () => createFakeSheetsClient(),
  })

  assert.deepEqual(result, { saved: true })
})

test('listAdminResultsFromSpreadsheet returns recent records through injected client', async () => {
  const payload = await listAdminResultsFromSpreadsheet({ limit: 10 }, {
    ...TEST_ENV,
    GOOGLE_SPREADSHEET_RESULTS_RANGE: 'Results!A:J',
  }, {
    createClient: () => createFakeSheetsClientForResults(),
  })

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.sessionId, 'session-1')
})

test('getAdminResultBySessionIdFromSpreadsheet resolves a single matching record', async () => {
  const result = await getAdminResultBySessionIdFromSpreadsheet('session-1', {
    ...TEST_ENV,
    GOOGLE_SPREADSHEET_RESULTS_RANGE: 'Results!A:J',
  }, {
    createClient: () => createFakeSheetsClientForResults(),
  })

  assert.equal(result?.sessionId, 'session-1')
  assert.equal(result?.feedback?.rating, 5)
})
