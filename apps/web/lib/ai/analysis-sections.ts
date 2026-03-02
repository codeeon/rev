import type { AnalysisSection } from '@workspace/saju-core'

interface ParsedAnalysisSections {
  sections: AnalysisSection[]
  usedFallback: boolean
}

const HEADING_REGEX = /^\s*#{2,4}\s*(?:\d+[.)]\s*)?(.+?)\s*$/

function normalizeTitle(rawTitle: string): string {
  return rawTitle
    .replace(/^[\s*_`~]+|[\s*_`~]+$/g, '')
    .replace(/\s*#+\s*$/g, '')
    .trim()
}

export function parseAnalysisSections(text: string): ParsedAnalysisSections {
  const sections: AnalysisSection[] = []
  const lines = text.split(/\r?\n/)
  let currentTitle: string | null = null
  let contentBuffer: string[] = []
  const preHeadingBuffer: string[] = []

  const flushSection = () => {
    if (!currentTitle) {
      contentBuffer = []
      return
    }

    const content = contentBuffer.join('\n').trim()
    if (content) {
      sections.push({
        title: currentTitle,
        content,
      })
    }

    contentBuffer = []
  }

  for (const line of lines) {
    const headingMatch = line.match(HEADING_REGEX)
    if (headingMatch) {
      flushSection()
      const normalizedTitle = normalizeTitle(headingMatch[1])
      currentTitle = normalizedTitle || null
      continue
    }

    if (currentTitle) {
      contentBuffer.push(line)
    } else {
      preHeadingBuffer.push(line)
    }
  }

  flushSection()

  const preHeadingText = preHeadingBuffer.join('\n').trim()

  if (sections.length > 0 && preHeadingText) {
    const firstSection = sections[0]
    firstSection.content = `${preHeadingText}\n\n${firstSection.content}`
  }

  if (sections.length === 0 && text.trim()) {
    return {
      sections: [{ title: '사주 분석', content: text.trim() }],
      usedFallback: true,
    }
  }

  return {
    sections,
    usedFallback: false,
  }
}
