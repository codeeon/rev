import { BRANCH_KR } from './constants'
import { isValidBirthInfo, isValidInferredHour, parseAnalyzeInput } from './validation'

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

const validBirthInfo = {
  year: 1990,
  month: 2,
  day: 28,
  isLunar: false,
  gender: 'male' as const,
}

expect(isValidBirthInfo(validBirthInfo), 'valid solar date should pass')

const invalidLeapBirthInfo = {
  year: 2023,
  month: 2,
  day: 29,
  isLunar: false,
  gender: 'female' as const,
}

expect(!isValidBirthInfo(invalidLeapBirthInfo), 'invalid leap day should fail')

const lunarBirthInfo = {
  year: 2023,
  month: 2,
  day: 30,
  isLunar: true,
  gender: 'female' as const,
}

expect(isValidBirthInfo(lunarBirthInfo), 'lunar day 30 should pass')

const invalidLunarBirthInfo = {
  year: 2024,
  month: 1,
  day: 30,
  isLunar: true,
  gender: 'male' as const,
}

expect(!isValidBirthInfo(invalidLunarBirthInfo), 'invalid lunar date should fail')

const validInferredHour = {
  branch: '子',
  branchKr: BRANCH_KR['子'],
  confidence: 77,
  topCandidates: [
    { branch: '子', branchKr: BRANCH_KR['子'], score: 1.2, percentage: 52 },
    { branch: '丑', branchKr: BRANCH_KR['丑'], score: 0.8, percentage: 48 },
  ],
  method: 'survey' as const,
  isCusp: true,
  cuspCandidates: ['子', '丑'] as const,
  mirroringData: [{ questionText: 'Q1', selectedOptionText: 'A' }],
}

expect(isValidInferredHour(validInferredHour), 'fully structured inferred hour should pass')

const invalidInferredHour = {
  branch: '子',
  branchKr: '오',
  confidence: 55,
  topCandidates: [{ branch: '子', branchKr: BRANCH_KR['子'], score: 1, percentage: 100 }],
  method: 'known' as const,
}

expect(!isValidInferredHour(invalidInferredHour), 'mismatched branchKr should fail')

const parsed = parseAnalyzeInput({
  birthInfo: {
    year: 1995,
    month: 5,
    day: 21,
    isLunar: false,
    gender: 'male',
  },
  inferredHour: {
    branch: '寅',
    branchKr: BRANCH_KR['寅'],
    confidence: 63,
    topCandidates: [{ branch: '寅', branchKr: BRANCH_KR['寅'], score: 0.9, percentage: 63 }],
    method: 'approximate',
  },
})

expect(parsed !== null, 'valid payload should parse')
expect(parsed?.birthInfo.year === 1995, 'parsed birth year should match input')
expect(parsed?.inferredHour?.branch === '寅', 'parsed inferred hour branch should match input')

const parsedInvalid = parseAnalyzeInput({
  birthInfo: {
    year: 1995,
    month: 2,
    day: 31,
    isLunar: false,
    gender: 'male',
  },
})

expect(parsedInvalid === null, 'invalid payload should be rejected')
