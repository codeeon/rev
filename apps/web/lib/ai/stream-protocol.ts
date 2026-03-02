import type { SajuResult } from '@workspace/saju-core'

const ANALYZE_META_PREFIX = '__SAJU_META__'

interface AnalyzeStreamMeta {
  sajuResult: SajuResult
}

interface AnalyzeStreamResolution {
  meta: AnalyzeStreamMeta | null
  text: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasStringKey(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'string' && record[key].length > 0
}

function hasNumberKey(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'number' && Number.isFinite(record[key])
}

function isValidPillarShape(value: unknown): boolean {
  if (!isRecord(value)) return false

  return (
    hasStringKey(value, 'stem') &&
    hasStringKey(value, 'branch') &&
    hasStringKey(value, 'stemKr') &&
    hasStringKey(value, 'branchKr')
  )
}

function isValidFourPillarsShape(value: unknown): boolean {
  if (!isRecord(value)) return false

  return (
    isValidPillarShape(value.year) &&
    isValidPillarShape(value.month) &&
    isValidPillarShape(value.day) &&
    isValidPillarShape(value.hour)
  )
}

function isValidFiveElementsShape(value: unknown): boolean {
  if (!isRecord(value)) return false

  return (
    hasNumberKey(value, 'wood') &&
    hasNumberKey(value, 'fire') &&
    hasNumberKey(value, 'earth') &&
    hasNumberKey(value, 'metal') &&
    hasNumberKey(value, 'water')
  )
}

function isValidSajuResultShape(value: unknown): boolean {
  if (!isRecord(value)) return false

  return (
    isValidFourPillarsShape(value.fourPillars) &&
    isValidFiveElementsShape(value.fiveElements) &&
    hasStringKey(value, 'dayMaster') &&
    hasStringKey(value, 'dayMasterElement') &&
    hasStringKey(value, 'dayMasterYinYang')
  )
}

function isAnalyzeStreamMeta(value: unknown): value is AnalyzeStreamMeta {
  if (!isRecord(value)) return false
  return isValidSajuResultShape(value.sajuResult)
}

export function encodeAnalyzeMetaLine(meta: AnalyzeStreamMeta): string {
  return `${ANALYZE_META_PREFIX}${JSON.stringify(meta)}\n`
}

export function parseAnalyzeMetaLine(line: string): AnalyzeStreamMeta | null {
  if (!line.startsWith(ANALYZE_META_PREFIX)) {
    return null
  }

  const json = line.slice(ANALYZE_META_PREFIX.length).trimEnd()
  if (!json) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(json)
    return isAnalyzeStreamMeta(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function resolveAnalyzeStreamBuffer(buffer: string, flush = false): AnalyzeStreamResolution | null {
  if (!buffer) {
    return null
  }

  const newlineIndex = buffer.indexOf('\n')

  if (newlineIndex === -1) {
    if (!flush) {
      return null
    }

    return { meta: null, text: buffer }
  }

  const firstLine = buffer.slice(0, newlineIndex + 1)
  const meta = parseAnalyzeMetaLine(firstLine)
  if (!meta) {
    return { meta: null, text: buffer }
  }

  return {
    meta,
    text: buffer.slice(newlineIndex + 1),
  }
}
