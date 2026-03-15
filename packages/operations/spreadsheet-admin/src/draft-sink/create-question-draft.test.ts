import assert from 'node:assert/strict'
import test from 'node:test'
import { createQuestionDraftSnapshot } from './create-question-draft'

test('createQuestionDraftSnapshot adds sheet header when draft tab is empty', async () => {
  const calls: string[] = []

  const response = await createQuestionDraftSnapshot({
    spreadsheetId: 'sheet-id',
    range: 'QuestionDrafts!A:P',
    draftId: 'draft-1',
    version: '2026.03.16',
    sourceVersion: '2026.03.15',
    status: 'draft',
    changeSummary: 'initial draft',
    updatedBy: 'owner@example.com',
    updatedAt: '2026-03-15T00:00:00.000Z',
    questionSet: {
      version: '2026.03.15',
      generatedAt: '2026-03-15T00:00:00.000Z',
      questions: [
        {
          id: 'Q1',
          structure_role: 'noise_reduction',
          category: 'habit',
          question_weight: 1,
          text: '첫 질문',
          options: [{ text: '예', score_map: { 자시: 1 } }],
        },
      ],
    },
    client: {
      values: {
        get: async ({ range }) => {
          calls.push(`get:${range}`)
          return { values: [] }
        },
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async ({ data }) => {
          calls.push(`batchUpdate:${data[0]?.range}`)
          return { totalUpdatedRows: 1 }
        },
        append: async ({ values }) => {
          calls.push(`append:${values.length}`)
          return { updates: { updatedRows: values.length } }
        },
      },
      spreadsheets: {
        get: async () => ({ sheets: [] }),
        batchUpdate: async () => {
          calls.push('addSheet')
          return { replies: [] }
        },
      },
    },
  })

  assert.equal(response.appendedRowCount, 1)
  assert.deepEqual(calls, ['addSheet', 'get:QuestionDrafts!A1:P1', 'batchUpdate:QuestionDrafts!A1:P1', 'append:1'])
})
