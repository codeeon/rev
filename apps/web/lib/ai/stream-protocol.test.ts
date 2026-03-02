import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeSaju, type BirthInfo } from '@workspace/saju-core'
import { encodeAnalyzeMetaLine, parseAnalyzeMetaLine, resolveAnalyzeStreamBuffer } from './stream-protocol'

const BIRTH_INFO: BirthInfo = {
  year: 1995,
  month: 8,
  day: 13,
  isLunar: false,
  gender: 'male',
}

test('stream protocol encodes and parses metadata line', () => {
  const sajuResult = analyzeSaju(BIRTH_INFO)
  const metaLine = encodeAnalyzeMetaLine({ sajuResult })
  const parsed = parseAnalyzeMetaLine(metaLine)

  assert.ok(parsed)
  assert.equal(parsed.sajuResult.dayMaster, sajuResult.dayMaster)
})

test('stream protocol waits for complete metadata line until newline arrives', () => {
  const sajuResult = analyzeSaju(BIRTH_INFO)
  const metaLine = encodeAnalyzeMetaLine({ sajuResult })
  const partialLine = metaLine.slice(0, Math.floor(metaLine.length / 2))

  assert.equal(resolveAnalyzeStreamBuffer(partialLine), null)

  const resolved = resolveAnalyzeStreamBuffer(`${metaLine}분석 본문`)
  assert.ok(resolved)
  assert.ok(resolved.meta)
  assert.equal(resolved.text, '분석 본문')
})

test('stream protocol flush mode falls back to plain text when no metadata exists', () => {
  const resolved = resolveAnalyzeStreamBuffer('일반 텍스트 응답', true)

  assert.ok(resolved)
  assert.equal(resolved.meta, null)
  assert.equal(resolved.text, '일반 텍스트 응답')
})

test('stream protocol rejects malformed metadata payload shape', () => {
  const malformedLine = '__SAJU_META__{"sajuResult":{"dayMaster":"갑"}}\n'
  const parsed = parseAnalyzeMetaLine(malformedLine)

  assert.equal(parsed, null)
})

test('stream protocol does not resolve empty buffer', () => {
  assert.equal(resolveAnalyzeStreamBuffer(''), null)
})
