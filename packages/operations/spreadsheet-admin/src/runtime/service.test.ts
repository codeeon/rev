import assert from 'node:assert/strict'
import test from 'node:test'
import type { GoogleSheetsClient } from '@workspace/google-sheets/server'
import { InMemoryLastKnownGoodStore } from '../sync/last-known-good'
import {
  createApprovalRequestFromSpreadsheet,
  createQuestionDraftFromSpreadsheet,
  getAdminResultBySessionIdFromSpreadsheet,
  getQuestionDraftDetailFromSpreadsheet,
  listApprovalLogEntriesFromSpreadsheet,
  listAdminAuditEventsFromSpreadsheet,
  listAdminResultsFromSpreadsheet,
  listApprovalRequestsFromSpreadsheet,
  listQuestionDraftsFromSpreadsheet,
  publishQuestionDraftFromSpreadsheet,
  rollbackApprovalFromSpreadsheet,
  saveAdminAuditEventToSpreadsheet,
  saveAnalysisResultToSpreadsheet,
  syncQuestionsFromSpreadsheet,
  updateApprovalRequestStatusFromSpreadsheet,
  updateQuestionDraftFromSpreadsheet,
  updateQuestionDraftStatusFromSpreadsheet,
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

function selectRowsForAuditRange(rows: string[][], range: string): string[][] {
  if (range.endsWith('!A1:H1')) {
    return [rows[0]!]
  }

  const match = range.match(/^[^!]+!A(\d+):H(\d+)$/)
  if (match) {
    const startRow = Number(match[1])
    const endRow = Number(match[2])
    return rows.slice(startRow - 1, endRow)
  }

  return []
}

function selectRowsForApprovalRange(rows: string[][], range: string): string[][] {
  if (range === 'ApprovalLog!A1:J1') {
    return [rows[0]!]
  }

  const match = range.match(/^ApprovalLog!A(\d+):J(\d+)$/)
  if (match) {
    const startRow = Number(match[1])
    const endRow = Number(match[2])
    return rows.slice(startRow - 1, endRow)
  }

  return []
}

function selectRowsForApprovalRequestRange(rows: string[][], range: string): string[][] {
  if (range === 'ApprovalRequests!A1:L1') {
    return [rows[0]!]
  }

  const match = range.match(/^ApprovalRequests!A(\d+):L(\d+)$/)
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

function createFakeSheetsClientForDrafts(
  status: 'draft' | 'review-ready' | 'published' | 'archived' = 'draft',
  approvalRequestStatus: 'requested' | 'approved' | 'rejected' = 'approved',
): GoogleSheetsClient {
  const questionRows = [
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
  ]

  const draftRows = [
    [
      'draftId',
      'version',
      'sourceVersion',
      'status',
      'questionId',
      'structureRole',
      'category',
      'questionWeight',
      'questionText',
      'optionIndex',
      'optionText',
      'scoreMapJson',
      'isActive',
      'changeSummary',
      'updatedBy',
      'updatedAt',
    ],
    ['draft-1', '2026.03.11', '2026.03.10', status, 'Q1', 'noise_reduction', 'Warm-up', '1', '첫 질문', '0', '예', '{"자시":1}', 'true', 'copy', 'owner@example.com', '2026-03-11T00:00:00.000Z'],
    ['draft-1', '2026.03.11', '2026.03.10', status, 'Q2', 'core', 'Core', '1', '둘째 질문', '0', '예', '{"축시":1}', 'true', 'copy', 'owner@example.com', '2026-03-11T00:00:00.000Z'],
    ['draft-1', '2026.03.11', '2026.03.10', status, 'Q3', 'fine_tune', 'Tune', '1', '셋째 질문', '0', '예', '{"인시":1}', 'true', 'copy', 'owner@example.com', '2026-03-11T00:00:00.000Z'],
    ['draft-1', '2026.03.11', '2026.03.10', status, 'Q4', 'closing', 'Close', '1', '넷째 질문', '0', '예', '{"묘시":1}', 'true', 'copy', 'owner@example.com', '2026-03-11T00:00:00.000Z'],
  ]
  const approvalRequestRows = [
    ['requestId', 'draftId', 'version', 'sourceVersion', 'draftUpdatedAt', 'status', 'requestedBy', 'requestedAt', 'requestComment', 'reviewedBy', 'reviewedAt', 'reviewComment'],
    ['request-1', 'draft-1', '2026.03.11', '2026.03.10', '2026-03-11T00:00:00.000Z', approvalRequestStatus, 'editor@example.com', '2026-03-11T00:10:00.000Z', 'review', approvalRequestStatus === 'requested' ? '' : 'owner@example.com', approvalRequestStatus === 'requested' ? '' : '2026-03-11T00:20:00.000Z', approvalRequestStatus === 'requested' ? '' : 'ok'],
  ]

  return {
    values: {
      get: async ({ range }) => {
        if (range.startsWith('QuestionDrafts!')) {
          return { values: range.includes('A1:P1') ? [] : draftRows }
        }
        if (range.startsWith('ApprovalRequests!')) {
          return { values: selectRowsForApprovalRequestRange(approvalRequestRows, range) }
        }

        return { values: questionRows }
      },
      batchGet: async () => ({ valueRanges: [] }),
      batchUpdate: async () => ({ totalUpdatedRows: 1 }),
      append: async ({ values }) => ({ updates: { updatedRows: values.length } }),
    },
    spreadsheets: {
      get: async () => ({
        sheets: [
          {
            properties: {
              title: 'QuestionDrafts',
              gridProperties: {
                rowCount: 1000,
              },
            },
          },
          {
            properties: {
              title: 'Questions',
              gridProperties: {
                rowCount: 1000,
              },
            },
          },
          {
            properties: {
              title: 'ApprovalRequests',
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

test('saveAdminAuditEventToSpreadsheet uses injected client when configured', async () => {
  const rows = [
    ['eventId', 'at', 'action', 'actorEmail', 'actorRole', 'subjectType', 'subjectId', 'metadataJson'],
  ]

  const result = await saveAdminAuditEventToSpreadsheet(
    {
      eventId: 'audit-1',
      at: '2026-03-15T00:00:00.000Z',
      action: 'draft.publish',
      actorEmail: 'owner@example.com',
      actorRole: 'owner',
      subjectType: 'draft',
      subjectId: 'draft-1',
      metadata: {
        approvalComment: 'looks good',
      },
    },
    TEST_ENV,
    {
      createClient: () => ({
        values: {
          get: async ({ range }) => ({ values: selectRowsForAuditRange(rows, range) }),
          batchGet: async () => ({ valueRanges: [] }),
          batchUpdate: async () => ({ totalUpdatedRows: 1 }),
          append: async () => ({ updates: { updatedRows: 1 } }),
        },
        spreadsheets: {
          get: async () => ({
            sheets: [
              { properties: { title: 'AdminMutationLog' } },
              { properties: { title: 'AdminAuditLog' } },
            ],
          }),
          batchUpdate: async () => ({ replies: [] }),
        },
      }),
    },
  )

  assert.deepEqual(result, { saved: true })
})

test('listAdminAuditEventsFromSpreadsheet reads audit rows through injected client', async () => {
  const rows = [
    ['eventId', 'at', 'action', 'actorEmail', 'actorRole', 'subjectType', 'subjectId', 'metadataJson'],
    ['audit-1', '2026-03-15T00:00:00.000Z', 'draft.publish', 'owner@example.com', 'owner', 'draft', 'draft-1', '{"approvalComment":"ok"}'],
  ]

  const payload = await listAdminAuditEventsFromSpreadsheet(
    { actionFamily: 'mutation', limit: 10 },
    TEST_ENV,
    {
      createClient: () => ({
        values: {
          get: async ({ range }) => {
            return {
              values: selectRowsForAuditRange(rows, range),
            }
          },
          batchGet: async () => ({ valueRanges: [] }),
          batchUpdate: async () => ({ totalUpdatedRows: 0 }),
          append: async () => ({ updates: { updatedRows: 0 } }),
        },
        spreadsheets: {
          get: async () => ({
            sheets: [
              {
                properties: {
                  title: 'AdminMutationLog',
                  gridProperties: {
                    rowCount: 1000,
                  },
                },
              },
            ],
          }),
          batchUpdate: async () => ({ replies: [] }),
        },
      }),
    },
  )

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.action, 'draft.publish')
})

test('listApprovalLogEntriesFromSpreadsheet reads approval rows through injected client', async () => {
  const rows = [
    ['approvalId', 'approvedAt', 'draftId', 'draftVersion', 'sourceVersion', 'publishedVersion', 'actorEmail', 'actorRole', 'changeSummary', 'approvalComment'],
    ['approval-1', '2026-03-15T00:00:00.000Z', 'draft-1', '2026.03.16', '2026.03.15', '2026.03.16', 'owner@example.com', 'owner', 'publish', 'LGTM'],
  ]

  const payload = await listApprovalLogEntriesFromSpreadsheet(
    { limit: 10 },
    TEST_ENV,
    {
      createClient: () => ({
        values: {
          get: async ({ range }) => ({ values: selectRowsForApprovalRange(rows, range) }),
          batchGet: async () => ({ valueRanges: [] }),
          batchUpdate: async () => ({ totalUpdatedRows: 0 }),
          append: async () => ({ updates: { updatedRows: 0 } }),
        },
        spreadsheets: {
          get: async () => ({
            sheets: [
              {
                properties: {
                  title: 'ApprovalLog',
                  gridProperties: {
                    rowCount: 1000,
                  },
                },
              },
            ],
          }),
          batchUpdate: async () => ({ replies: [] }),
        },
      }),
    },
  )

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.approvalId, 'approval-1')
})

test('listApprovalRequestsFromSpreadsheet reads request rows through injected client', async () => {
  const rows = [
    ['requestId', 'draftId', 'version', 'sourceVersion', 'draftUpdatedAt', 'status', 'requestedBy', 'requestedAt', 'requestComment', 'reviewedBy', 'reviewedAt', 'reviewComment'],
    ['request-1', 'draft-1', '2026.03.16', '2026.03.15', '2026-03-15T00:00:00.000Z', 'requested', 'editor@example.com', '2026-03-15T00:10:00.000Z', 'please review', '', '', ''],
  ]

  const payload = await listApprovalRequestsFromSpreadsheet(
    { draftId: 'draft-1', limit: 10 },
    TEST_ENV,
    {
      createClient: () => ({
        values: {
          get: async ({ range }) => ({ values: selectRowsForApprovalRequestRange(rows, range) }),
          batchGet: async () => ({ valueRanges: [] }),
          batchUpdate: async () => ({ totalUpdatedRows: 0 }),
          append: async () => ({ updates: { updatedRows: 0 } }),
        },
        spreadsheets: {
          get: async () => ({
            sheets: [
              {
                properties: {
                  title: 'ApprovalRequests',
                  gridProperties: {
                    rowCount: 1000,
                  },
                },
              },
            ],
          }),
          batchUpdate: async () => ({ replies: [] }),
        },
      }),
    },
  )

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.requestId, 'request-1')
})

test('createApprovalRequestFromSpreadsheet creates a requested approval entry', async () => {
  const result = await createApprovalRequestFromSpreadsheet(
    {
      draftId: 'draft-1',
      requestedBy: 'editor@example.com',
      requestComment: 'please review',
    },
    TEST_ENV,
    {
      createClient: () => createFakeSheetsClientForDrafts('review-ready'),
    },
  )

  assert.equal(result.draftId, 'draft-1')
  assert.equal(result.status, 'requested')
  assert.equal(result.requestedBy, 'editor@example.com')
})

test('updateApprovalRequestStatusFromSpreadsheet approves a requested approval entry', async () => {
  const result = await updateApprovalRequestStatusFromSpreadsheet(
    {
      requestId: 'request-1',
      nextStatus: 'approved',
      reviewedBy: 'owner@example.com',
      reviewComment: 'approved',
    },
    TEST_ENV,
    {
      createClient: () => createFakeSheetsClientForDrafts('review-ready', 'requested'),
    },
  )

  assert.equal(result.requestId, 'request-1')
  assert.equal(result.status, 'approved')
  assert.equal(result.reviewedBy, 'owner@example.com')
})

test('rollbackApprovalFromSpreadsheet republishes a previously approved draft through injected client', async () => {
  const questionRows = [
    ['version', 'questionId', 'structureRole', 'category', 'questionWeight', 'questionText', 'optionIndex', 'optionText', 'scoreMapJson', 'isActive', 'updatedAt'],
    ['2026.03.16', 'Q1', 'noise_reduction', 'Warm-up', '1', '현재 질문', '0', '예', '{"자시":1}', 'true', '2026-03-16T00:00:00.000Z'],
    ['2026.03.16', 'Q2', 'core', 'Core', '1', '현재 질문 2', '0', '예', '{"축시":1}', 'true', '2026-03-16T00:00:00.000Z'],
    ['2026.03.16', 'Q3', 'fine_tune', 'Tune', '1', '현재 질문 3', '0', '예', '{"인시":1}', 'true', '2026-03-16T00:00:00.000Z'],
    ['2026.03.16', 'Q4', 'closing', 'Close', '1', '현재 질문 4', '0', '예', '{"묘시":1}', 'true', '2026-03-16T00:00:00.000Z'],
  ]
  const draftRows = [
    [
      'draftId',
      'version',
      'sourceVersion',
      'status',
      'questionId',
      'structureRole',
      'category',
      'questionWeight',
      'questionText',
      'optionIndex',
      'optionText',
      'scoreMapJson',
      'isActive',
      'changeSummary',
      'updatedBy',
      'updatedAt',
    ],
    ['draft-1', '2026.03.15', '2026.03.14', 'published', 'Q1', 'noise_reduction', 'Warm-up', '1', '롤백 질문', '0', '예', '{"자시":1}', 'true', 'publish', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
    ['draft-1', '2026.03.15', '2026.03.14', 'published', 'Q2', 'core', 'Core', '1', '롤백 질문 2', '0', '예', '{"축시":1}', 'true', 'publish', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
    ['draft-1', '2026.03.15', '2026.03.14', 'published', 'Q3', 'fine_tune', 'Tune', '1', '롤백 질문 3', '0', '예', '{"인시":1}', 'true', 'publish', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
    ['draft-1', '2026.03.15', '2026.03.14', 'published', 'Q4', 'closing', 'Close', '1', '롤백 질문 4', '0', '예', '{"묘시":1}', 'true', 'publish', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
  ]
  const approvalRows = [
    ['approvalId', 'approvedAt', 'draftId', 'draftVersion', 'sourceVersion', 'publishedVersion', 'actorEmail', 'actorRole', 'changeSummary', 'approvalComment'],
    ['approval-1', '2026-03-15T00:00:00.000Z', 'draft-1', '2026.03.15', '2026.03.14', '2026.03.15', 'owner@example.com', 'owner', 'publish', 'LGTM'],
  ]

  const result = await rollbackApprovalFromSpreadsheet(
    {
      approvalId: 'approval-1',
      rolledBackBy: 'owner@example.com',
      rolledBackByRole: 'owner',
      changeSummary: 'rollback to 2026.03.15',
      approvalComment: 'restore stable version',
    },
    TEST_ENV,
    {
      createClient: () => ({
        values: {
          get: async ({ range }) => {
            if (range.startsWith('ApprovalLog!')) {
              return { values: selectRowsForApprovalRange(approvalRows, range) }
            }
            if (range.startsWith('QuestionDrafts!')) {
              return { values: draftRows }
            }
            return { values: questionRows }
          },
          batchGet: async () => ({ valueRanges: [] }),
          batchUpdate: async () => ({ totalUpdatedRows: 1 }),
          append: async () => ({ updates: { updatedRows: 1 } }),
        },
        spreadsheets: {
          get: async () => ({
            sheets: [
              { properties: { title: 'ApprovalLog', gridProperties: { rowCount: 1000 } } },
              { properties: { title: 'QuestionDrafts', gridProperties: { rowCount: 1000 } } },
              { properties: { title: 'Questions', gridProperties: { rowCount: 1000 } } },
            ],
          }),
          batchUpdate: async () => ({ replies: [] }),
        },
      }),
    },
  )

  assert.equal(result.sourceApprovalId, 'approval-1')
  assert.equal(result.sourceDraftId, 'draft-1')
  assert.equal(result.sourcePublishedVersion, '2026.03.15')
  assert.equal(result.publishedVersion, '2026.03.15')
  assert.equal(result.publishedBy, 'owner@example.com')
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

test('listQuestionDraftsFromSpreadsheet returns draft summaries through injected client', async () => {
  const payload = await listQuestionDraftsFromSpreadsheet({ version: '2026.03.11' }, TEST_ENV, {
    createClient: () => createFakeSheetsClientForDrafts(),
  })

  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0]?.draftId, 'draft-1')
  assert.equal(payload.items[0]?.questionCount, 4)
})

test('createQuestionDraftFromSpreadsheet appends snapshot rows through injected client', async () => {
  const result = await createQuestionDraftFromSpreadsheet(
    {
      version: '2026.03.11',
      changeSummary: 'copy current published set',
      updatedBy: 'owner@example.com',
    },
    TEST_ENV,
    {
      createClient: () => createFakeSheetsClientForDrafts(),
    },
  )

  assert.equal(result.version, '2026.03.11')
  assert.equal(result.sourceVersion, '2026.03.10')
  assert.equal(result.status, 'draft')
  assert.equal(result.questionCount, 4)
  assert.equal(result.appendedRowCount, 4)
})

test('getQuestionDraftDetailFromSpreadsheet resolves draft detail through injected client', async () => {
  const detail = await getQuestionDraftDetailFromSpreadsheet('draft-1', TEST_ENV, {
    createClient: () => createFakeSheetsClientForDrafts(),
  })

  assert.equal(detail?.draftId, 'draft-1')
  assert.equal(detail?.questions.length, 4)
  assert.equal(detail?.diff.totalChangedQuestions, 0)
})

test('updateQuestionDraftFromSpreadsheet updates a draft question through injected client', async () => {
  const result = await updateQuestionDraftFromSpreadsheet(
    {
      draftId: 'draft-1',
      questionId: 'Q1',
      version: '2026.03.11',
      sourceVersion: '2026.03.10',
      structureRole: 'core',
      category: 'Updated',
      questionWeight: 2,
      questionText: '변경된 질문',
      isActive: true,
      changeSummary: 'manual update',
      updatedBy: 'owner@example.com',
      options: [
        {
          optionIndex: 0,
          optionText: '새 옵션',
          scoreMap: { 자시: 2 },
        },
      ],
    },
    TEST_ENV,
    {
      createClient: () => createFakeSheetsClientForDrafts(),
    },
  )

  assert.equal(result.draftId, 'draft-1')
  assert.equal(result.questionId, 'Q1')
  assert.equal(result.updatedRowCount, 1)
})

test('updateQuestionDraftStatusFromSpreadsheet transitions a draft status through injected client', async () => {
  const result = await updateQuestionDraftStatusFromSpreadsheet(
    {
      draftId: 'draft-1',
      nextStatus: 'review-ready',
      updatedBy: 'owner@example.com',
      changeSummary: 'ready for review',
    },
    TEST_ENV,
    {
      createClient: () => createFakeSheetsClientForDrafts(),
    },
  )

  assert.equal(result.draftId, 'draft-1')
  assert.equal(result.status, 'review-ready')
  assert.equal(result.updatedRowCount, 4)
})

test('publishQuestionDraftFromSpreadsheet publishes a review-ready draft through injected client', async () => {
  const result = await publishQuestionDraftFromSpreadsheet(
    {
      draftId: 'draft-1',
      approvalRequestId: 'request-1',
      publishedBy: 'owner@example.com',
      changeSummary: 'published',
    },
    TEST_ENV,
    {
      createClient: () => createFakeSheetsClientForDrafts('review-ready'),
    },
  )

  assert.equal(result.draftId, 'draft-1')
  assert.equal(result.publishedVersion, '2026.03.11')
  assert.equal(result.sourceVersion, '2026.03.10')
  assert.equal(result.questionCount, 4)
})
