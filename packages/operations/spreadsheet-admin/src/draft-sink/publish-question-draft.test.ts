import assert from 'node:assert/strict'
import test from 'node:test'
import { publishQuestionDraft } from './publish-question-draft'

test('publishQuestionDraft overwrites Questions sheet from a review-ready draft', async () => {
  const updates: Array<{ range: string; rows: (string | number | boolean | null)[][] }> = []

  const result = await publishQuestionDraft({
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
              ['draft-1', '2026.03.16', '2026.03.15', 'review-ready', 'Q1', 'noise_reduction', 'habit', '1', 'Q1 changed', '0', '예', '{"자시":1}', 'true', 'ready', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'review-ready', 'Q2', 'core', 'habit', '1', 'Q2', '0', '예', '{"축시":1}', 'true', 'ready', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'review-ready', 'Q3', 'fine_tune', 'habit', '1', 'Q3', '0', '예', '{"인시":1}', 'true', 'ready', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
              ['draft-1', '2026.03.16', '2026.03.15', 'review-ready', 'Q4', 'closing', 'habit', '1', 'Q4', '0', '예', '{"묘시":1}', 'true', 'ready', 'owner@example.com', '2026-03-15T00:00:00.000Z'],
            ],
          }
        },
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async ({ data }) => {
          data.forEach(item => updates.push({ range: item.range, rows: item.values }))
          return { totalUpdatedRows: data.length }
        },
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({
          sheets: [
            {
              properties: {
                title: 'QuestionDrafts',
                gridProperties: { rowCount: 1000 },
              },
            },
            {
              properties: {
                title: 'Questions',
                gridProperties: { rowCount: 8 },
              },
            },
          ],
        }),
        batchUpdate: async () => ({ replies: [] }),
      },
    },
    spreadsheetId: 'sheet-id',
    questionsRange: 'Questions!A:K',
    draftRange: 'QuestionDrafts!A:P',
    draftId: 'draft-1',
    publishedBy: 'owner@example.com',
    publishedAt: '2026-03-15T01:00:00.000Z',
  })

  assert.equal(result.publishedVersion, '2026.03.16')
  assert.equal(result.updatedRowCount, 4)
  assert.equal(updates[0]?.range, 'Questions!A1:K5')
  assert.equal(updates[0]?.rows[1]?.[0], '2026.03.16')
  assert.equal(updates[1]?.range, 'Questions!A6:K8')
})
