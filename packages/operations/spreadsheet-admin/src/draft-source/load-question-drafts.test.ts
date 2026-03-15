import assert from 'node:assert/strict'
import test from 'node:test'
import { getQuestionDraftDetail, listQuestionDrafts } from './load-question-drafts'

test('listQuestionDrafts groups rows by draftId and returns summaries', async () => {
  const response = await listQuestionDrafts({
    spreadsheetId: 'sheet-id',
    range: 'QuestionDrafts!A:P',
    client: {
      values: {
        get: async () => ({
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
            [
              'draft-1',
              '2026.03.16',
              '2026.03.15',
              'draft',
              'Q1',
              'noise_reduction',
              'habit',
              '1',
              '첫 질문',
              '0',
              '예',
              '{"자시":1}',
              'true',
              'wording update',
              'owner@example.com',
              '2026-03-15T00:00:00.000Z',
            ],
            [
              'draft-1',
              '2026.03.16',
              '2026.03.15',
              'draft',
              'Q2',
              'core',
              'habit',
              '1',
              '둘째 질문',
              '0',
              '예',
              '{"축시":1}',
              'true',
              'wording update',
              'owner@example.com',
              '2026-03-15T00:00:00.000Z',
            ],
            [
              'draft-1',
              '2026.03.16',
              '2026.03.15',
              'draft',
              'Q3',
              'fine_tune',
              'sleep',
              '1',
              '셋째 질문',
              '0',
              '예',
              '{"인시":1}',
              'true',
              'wording update',
              'owner@example.com',
              '2026-03-15T00:00:00.000Z',
            ],
            [
              'draft-1',
              '2026.03.16',
              '2026.03.15',
              'draft',
              'Q4',
              'closing',
              'sleep',
              '1',
              '넷째 질문',
              '0',
              '예',
              '{"묘시":1}',
              'true',
              'wording update',
              'owner@example.com',
              '2026-03-15T00:00:00.000Z',
            ],
          ],
        }),
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async () => ({ totalUpdatedRows: 0 }),
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({
          sheets: [
            {
              properties: {
                title: 'QuestionDrafts',
              },
            },
          ],
        }),
        batchUpdate: async () => ({ replies: [] }),
      },
    },
  })

  assert.equal(response.items.length, 1)
  assert.equal(response.items[0]?.draftId, 'draft-1')
  assert.equal(response.items[0]?.version, '2026.03.16')
  assert.equal(response.items[0]?.questionCount, 4)
  assert.deepEqual(response.items[0]?.missingRoles, [])
})

test('listQuestionDrafts returns empty list when draft sheet does not exist yet', async () => {
  const response = await listQuestionDrafts({
    spreadsheetId: 'sheet-id',
    range: 'QuestionDrafts!A:P',
    client: {
      values: {
        get: async () => ({ values: [] }),
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async () => ({ totalUpdatedRows: 0 }),
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({ sheets: [{ properties: { title: 'Questions' } }] }),
        batchUpdate: async () => ({ replies: [] }),
      },
    },
  })

  assert.deepEqual(response.items, [])
})

test('getQuestionDraftDetail returns editable questions and diff summary', async () => {
  const detail = await getQuestionDraftDetail({
    draftId: 'draft-1',
    spreadsheetId: 'sheet-id',
    range: 'QuestionDrafts!A:P',
    publishedQuestionSet: {
      version: '2026.03.15',
      generatedAt: '2026-03-15T00:00:00.000Z',
      questions: [
        {
          id: 'Q1',
          structure_role: 'noise_reduction',
          category: 'habit',
          question_weight: 1,
          text: '기존 질문',
          options: [{ text: '예', score_map: { 자시: 1 } }],
        },
        {
          id: 'Q2',
          structure_role: 'core',
          category: 'habit',
          question_weight: 1,
          text: 'Q2',
          options: [{ text: '예', score_map: { 축시: 1 } }],
        },
        {
          id: 'Q3',
          structure_role: 'fine_tune',
          category: 'habit',
          question_weight: 1,
          text: 'Q3',
          options: [{ text: '예', score_map: { 인시: 1 } }],
        },
        {
          id: 'Q4',
          structure_role: 'closing',
          category: 'habit',
          question_weight: 1,
          text: 'Q4',
          options: [{ text: '예', score_map: { 묘시: 1 } }],
        },
      ],
    },
    client: {
      values: {
        get: async () => ({
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
            [
              'draft-1',
              '2026.03.16',
              '2026.03.15',
              'draft',
              'Q1',
              'noise_reduction',
              'habit',
              '1',
              '변경된 질문',
              '0',
              '예',
              '{"자시":1}',
              'true',
              'wording update',
              'owner@example.com',
              '2026-03-15T00:00:00.000Z',
            ],
            [
              'draft-1',
              '2026.03.16',
              '2026.03.15',
              'draft',
              'Q2',
              'core',
              'habit',
              '1',
              'Q2',
              '0',
              '예',
              '{"축시":1}',
              'true',
              'wording update',
              'owner@example.com',
              '2026-03-15T00:00:00.000Z',
            ],
            [
              'draft-1',
              '2026.03.16',
              '2026.03.15',
              'draft',
              'Q3',
              'fine_tune',
              'habit',
              '1',
              'Q3',
              '0',
              '예',
              '{"인시":1}',
              'true',
              'wording update',
              'owner@example.com',
              '2026-03-15T00:00:00.000Z',
            ],
            [
              'draft-1',
              '2026.03.16',
              '2026.03.15',
              'draft',
              'Q4',
              'closing',
              'habit',
              '1',
              'Q4',
              '0',
              '예',
              '{"묘시":1}',
              'true',
              'wording update',
              'owner@example.com',
              '2026-03-15T00:00:00.000Z',
            ],
          ],
        }),
        batchGet: async () => ({ valueRanges: [] }),
        batchUpdate: async () => ({ totalUpdatedRows: 0 }),
        append: async () => ({ updates: { updatedRows: 0 } }),
      },
      spreadsheets: {
        get: async () => ({ sheets: [{ properties: { title: 'QuestionDrafts' } }] }),
        batchUpdate: async () => ({ replies: [] }),
      },
    },
  })

  assert.equal(detail?.questions[0]?.id, 'Q1')
  assert.equal(detail?.questions[0]?.options[0]?.rowNumber, 2)
  assert.equal(detail?.diff.totalChangedQuestions, 1)
  assert.deepEqual(detail?.diff.items[0], {
    questionId: 'Q1',
    changeType: 'updated',
    changedFields: ['questionText'],
  })
})
