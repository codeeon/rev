import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAnalysisSections } from './analysis-sections'

test('parseAnalysisSections parses markdown heading levels 2-4', () => {
  const input = [
    '## 기본 성격 및 성향',
    '첫 번째 문단',
    '#### 재물운 및 직업운',
    '두 번째 문단',
  ].join('\n')

  const parsed = parseAnalysisSections(input)

  assert.equal(parsed.usedFallback, false)
  assert.equal(parsed.sections.length, 2)
  assert.equal(parsed.sections[0]?.title, '기본 성격 및 성향')
  assert.equal(parsed.sections[1]?.title, '재물운 및 직업운')
})

test('parseAnalysisSections supports numbered headings', () => {
  const input = [
    '### 1. 기본 성격 및 성향',
    '첫 번째 분석',
    '### 2) 대인관계 및 연애운',
    '두 번째 분석',
  ].join('\n')

  const parsed = parseAnalysisSections(input)

  assert.equal(parsed.usedFallback, false)
  assert.equal(parsed.sections.length, 2)
  assert.equal(parsed.sections[0]?.title, '기본 성격 및 성향')
  assert.equal(parsed.sections[1]?.title, '대인관계 및 연애운')
})

test('parseAnalysisSections falls back when no headings exist', () => {
  const input = '헤딩 없이 본문만 있는 분석 결과입니다.'
  const parsed = parseAnalysisSections(input)

  assert.equal(parsed.usedFallback, true)
  assert.equal(parsed.sections.length, 1)
  assert.equal(parsed.sections[0]?.title, '사주 분석')
  assert.equal(parsed.sections[0]?.content, input)
})

test('parseAnalysisSections preserves pre-heading text in first section', () => {
  const input = [
    '머리말 문장입니다.',
    '',
    '### 기본 성격 및 성향',
    '본문입니다.',
  ].join('\n')

  const parsed = parseAnalysisSections(input)

  assert.equal(parsed.usedFallback, false)
  assert.equal(parsed.sections.length, 1)
  assert.match(parsed.sections[0]?.content ?? '', /머리말 문장입니다\./)
  assert.match(parsed.sections[0]?.content ?? '', /본문입니다\./)
})

test('parseAnalysisSections trims trailing markdown hash markers from headings', () => {
  const input = [
    '### 기본 성격 및 성향 ###',
    '본문입니다.',
  ].join('\n')

  const parsed = parseAnalysisSections(input)

  assert.equal(parsed.sections.length, 1)
  assert.equal(parsed.sections[0]?.title, '기본 성격 및 성향')
})
