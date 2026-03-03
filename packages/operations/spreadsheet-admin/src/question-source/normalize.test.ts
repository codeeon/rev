import assert from 'node:assert/strict'
import test from 'node:test'
import type { AdminSheetRow } from './admin-sheet-schema'
import { normalizeAdminSheetRows } from './normalize'

function createRow(input: Partial<AdminSheetRow>): AdminSheetRow {
  return {
    version: '2026.03.03',
    questionId: 'Q1',
    structureRole: 'noise_reduction',
    category: 'Warm-up',
    questionWeight: 1,
    questionText: '기본 질문',
    optionIndex: 0,
    optionText: '기본 선택지',
    scoreMap: { 자시: 1 },
    isActive: true,
    updatedAt: '2026-03-03T00:00:00.000Z',
    ...input,
  }
}

test('normalize admin rows groups options into questions', () => {
  const rows: AdminSheetRow[] = [
    createRow({ questionId: 'Q2', structureRole: 'core', questionText: '코어 질문', optionText: 'A' }),
    createRow({ questionId: 'Q1', structureRole: 'noise_reduction', questionText: '잡음 제거', optionText: 'A' }),
    createRow({ questionId: 'Q1', structureRole: 'noise_reduction', questionText: '잡음 제거', optionIndex: 1, optionText: 'B' }),
    createRow({ questionId: 'Q3', structureRole: 'fine_tune', questionText: '미세조정 질문', optionText: 'A' }),
    createRow({ questionId: 'Q4', structureRole: 'closing', questionText: '종결 질문', optionText: 'A' }),
  ]

  const normalized = normalizeAdminSheetRows(rows)
  assert.equal(normalized.version, '2026.03.03')
  assert.equal(normalized.questions.length, 4)
  assert.equal(normalized.questions[0].id, 'Q1')
  assert.equal(normalized.questions[0].options.length, 2)
  assert.equal(normalized.questions[0].options[1].text, 'B')
})

test('normalize admin rows rejects duplicate option index per question', () => {
  const duplicateRows: AdminSheetRow[] = [
    createRow({ questionId: 'Q1', structureRole: 'noise_reduction' }),
    createRow({ questionId: 'Q1', structureRole: 'noise_reduction' }),
    createRow({ questionId: 'Q2', structureRole: 'core' }),
    createRow({ questionId: 'Q3', structureRole: 'fine_tune' }),
    createRow({ questionId: 'Q4', structureRole: 'closing' }),
  ]

  assert.throws(() => normalizeAdminSheetRows(duplicateRows), /Duplicate optionIndex/)
})

test('normalize admin rows rejects missing required role', () => {
  const missingRoleRows: AdminSheetRow[] = [
    createRow({ questionId: 'Q1', structureRole: 'noise_reduction' }),
    createRow({ questionId: 'Q2', structureRole: 'core' }),
    createRow({ questionId: 'Q3', structureRole: 'fine_tune' }),
  ]

  assert.throws(() => normalizeAdminSheetRows(missingRoleRows), /Missing required structure roles/)
})
