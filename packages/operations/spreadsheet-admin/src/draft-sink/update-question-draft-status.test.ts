import assert from 'node:assert/strict'
import test from 'node:test'
import { updateQuestionDraftStatus } from './update-question-draft-status'

test('updateQuestionDraftStatus rewrites all draft rows with next status', async () => {
  const batchUpdates: Array<{ range: string; row: (string | number | boolean | null)[] | undefined }> = []

  const response = await updateQuestionDraftStatus({
    spreadsheetId: 'sheet-id',
    draftRange: 'QuestionDrafts!A:P',
    questionsRange: 'Questions!A:K',
    input: {
      draftId: 'draft-1',
      nextStatus: 'review-ready',
      updatedBy: 'owner@example.com',
      updatedAt: '2026-03-15T00:00:00.000Z',
      changeSummary: 'ready for review',
    },
    client: {
      values: {
        get: async ({ range }) => {
          if (range === 'Questions!A:K') {
            return {
              values: [
                ['version', 'questionId', 'structureRole', 'category', 'questionWeight', 'questionText', 'optionIndex', 'optionText', 'scoreMapJson', 'isActive', 'updatedAt'],
                ['2026.03.15', 'Q1', 'noise_reduction', 'habit', '1', 'Q1', '0', '예', '{"자시":1}', 'true', '2026-03-15T00:00:00.000Z'],
                ['2026.03.15', 'Q2', 'core', 'habit', '1', 'Q2', '0', '예', '{"축시":1}', 'true', '2026-03-15T00:00:00.000Z'],
                ['2026.03.15', 'Q3', 'fine_tune', 'habit', '1', 'Q3', '0', '예', '{"인시":1}', 'true', '2026-03-15T00:00:00.000Z'],
                ['2026.03.15', 'Q4', 'closing', 'habit', '1', 'Q4', '0', '예', '{"묘시":1}', 'true', '2026-03-15T00:00:00.000Z'],
              ],
            }
          }

          return {
            values: [
              ['draftId', 'version', 'sourceVersion', 'status', 'questionId', 'structureRole', 'category', 'questionWeight', 'questionText', 'optionIndex', 'optionText', 'scoreMapJson', 'isActive', 'changeSummary', 'updatedBy', 'updatedAt'],
              ['draft-1', '2026.03.16', '2026.03.15', 'draft', 'Q1', 'noise_reduction', 'habit', '1', 'Q1', '0', '예', '{"자시":1}', 'true', 'copy', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'draft', 'Q2', 'core', 'habit', '1', 'Q2', '0', '예', '{"축시":1}', 'true', 'copy', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'draft', 'Q3', 'fine_tune', 'habit', '1', 'Q3', '0', '예', '{"인시":1}', 'true', 'copy', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'draft', 'Q4', 'closing', 'habit', '1', 'Q4', '0', '예', '{"묘시":1}', 'true', 'copy', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
            ],
          }
        },
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async ({ data }) => {
          data.forEach(item => batchUpdates.push({ range: item.range, row: item.values[0] }))
          return { totalUpdatedRows: data.length }
        },
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({ sheets: [{ properties: { title: 'QuestionDrafts' } }] }),
        batchUpdate: async () => ({ replies: [] }),
      },
    },
  })

  assert.equal(response.updatedRowCount, 4)
  assert.equal(batchUpdates.length, 4)
  assert.equal(batchUpdates[0]?.row?.[3], 'review-ready')
  assert.equal(batchUpdates[0]?.row?.[13], 'ready for review')
})
