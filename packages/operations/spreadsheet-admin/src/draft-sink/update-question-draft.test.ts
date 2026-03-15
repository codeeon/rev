import assert from 'node:assert/strict'
import test from 'node:test'
import { updateQuestionDraftQuestion } from './update-question-draft'

test('updateQuestionDraftQuestion rewrites all rows of a question', async () => {
  const batchUpdates: Array<{ range: string; row: (string | number | boolean | null)[] | undefined }> = []

  const response = await updateQuestionDraftQuestion({
    spreadsheetId: 'sheet-id',
    draftRange: 'QuestionDrafts!A:P',
    questionsRange: 'Questions!A:K',
    input: {
      draftId: 'draft-1',
      questionId: 'Q1',
      version: '2026.03.16',
      sourceVersion: '2026.03.15',
      structureRole: 'core',
      category: 'updated-category',
      questionWeight: 2,
      questionText: '변경된 질문',
      isActive: true,
      changeSummary: 'manual edit',
      updatedBy: 'owner@example.com',
      updatedAt: '2026-03-15T00:00:00.000Z',
      options: [
        {
          optionIndex: 0,
          optionText: '새 옵션',
          scoreMap: { 자시: 2 },
        },
      ],
    },
    client: {
      values: {
        get: async ({ range }) => {
          if (range === 'Questions!A:K') {
            return {
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
                ['2026.03.15', 'Q1', 'noise_reduction', 'habit', '1', '기존 질문', '0', '예', '{"자시":1}', 'true', '2026-03-15T00:00:00.000Z'],
                ['2026.03.15', 'Q2', 'core', 'habit', '1', 'Q2', '0', '예', '{"축시":1}', 'true', '2026-03-15T00:00:00.000Z'],
                ['2026.03.15', 'Q3', 'fine_tune', 'habit', '1', 'Q3', '0', '예', '{"인시":1}', 'true', '2026-03-15T00:00:00.000Z'],
                ['2026.03.15', 'Q4', 'closing', 'habit', '1', 'Q4', '0', '예', '{"묘시":1}', 'true', '2026-03-15T00:00:00.000Z'],
              ],
            }
          }

          return {
            values: [
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
              ['draft-1', '2026.03.16', '2026.03.15', 'draft', 'Q1', 'noise_reduction', 'habit', '1', '기존 질문', '0', '예', '{"자시":1}', 'true', 'copy', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'draft', 'Q2', 'core', 'habit', '1', 'Q2', '0', '예', '{"축시":1}', 'true', 'copy', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'draft', 'Q3', 'fine_tune', 'habit', '1', 'Q3', '0', '예', '{"인시":1}', 'true', 'copy', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'draft', 'Q4', 'closing', 'habit', '1', 'Q4', '0', '예', '{"묘시":1}', 'true', 'copy', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
            ],
          }
        },
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async ({ data }) => {
          data.forEach(item => {
            batchUpdates.push({
              range: item.range,
              row: item.values[0],
            })
          })
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

  assert.equal(response.updatedRowCount, 1)
  assert.deepEqual(batchUpdates, [
    {
      range: 'QuestionDrafts!A2:P2',
      row: [
        'draft-1',
        '2026.03.16',
        '2026.03.15',
        'draft',
        'Q1',
        'core',
        'updated-category',
        '2',
        '변경된 질문',
        '0',
        '새 옵션',
        '{"자시":2}',
        'true',
        'manual edit',
        'owner@example.com',
        '2026-03-15T00:00:00.000Z',
      ],
    },
  ])
})
