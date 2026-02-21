import type { SajuResult, FiveElement } from '../saju/types'
import { ELEMENT_KR } from '../saju/constants'

export function buildAnalysisPrompt(result: SajuResult, surveySummary?: string): string {
  const { fourPillars, fiveElements, dayMaster, dayMasterElement, dayMasterYinYang, inferredHour } = result

  const pillarStr = (label: string, p: typeof fourPillars.year) =>
    `${label}: ${p.stem}${p.branch} (${p.stemKr}${p.branchKr})`

  const pillarsText = [
    pillarStr('년주(年柱)', fourPillars.year),
    pillarStr('월주(月柱)', fourPillars.month),
    pillarStr('일주(日柱)', fourPillars.day),
    pillarStr('시주(時柱)', fourPillars.hour),
  ].join('\n')

  const elementsText = (Object.entries(fiveElements) as [FiveElement, number][])
    .map(([el, pct]) => `${ELEMENT_KR[el]}: ${pct}%`)
    .join(', ')

  const yinYangKr = dayMasterYinYang === 'yang' ? '양(陽)' : '음(陰)'

  let hourNote = ''
  if (inferredHour) {
    const methodKr = inferredHour.method === 'survey' ? '설문 추론' : '대략적 범위 추론'
    hourNote = `\n\n참고: 시주는 ${methodKr} 기반입니다 (신뢰도: ${inferredHour.confidence}%).`
    if (inferredHour.topCandidates.length > 1) {
      const candidates = inferredHour.topCandidates
        .map(c => `${c.branchKr}시(${c.percentage}%)`)
        .join(', ')
      hourNote += ` 상위 후보: ${candidates}`
    }
  }

  return `당신은 30년 경력의 전문 사주 명리학자입니다. 전통적 명리학 이론에 기반하되, 현대인이 이해하기 쉬운 언어로 설명합니다.

## 사주 원국

${pillarsText}

- 일간(日干): ${dayMaster} (${ELEMENT_KR[dayMasterElement]}, ${yinYangKr})
- 오행 분포: ${elementsText}
${hourNote}

${surveySummary ? `## 설문 기반 성향 요약\n${surveySummary}\n` : ''}

## 분석 요청

다음 4개 항목에 대해 각각 200~300자 내외로 분석해주세요.
각 항목은 반드시 ### 으로 시작하는 마크다운 헤딩으로 구분하세요.

### 기본 성격 및 성향
일간(日干)을 중심으로 기본 성격, 강점, 약점을 분석하세요.

### 재물운 및 직업운
재성(財星)과 관성(官星)의 유무와 강약을 중심으로 분석하세요.

### 대인관계 및 연애운
비겁(比劫)과 인성(印星)을 중심으로 대인관계 패턴과 연애 성향을 분석하세요.

### 2026년 운세
2026년(병오년)의 세운과 사주 원국의 관계를 중심으로 분석하세요.

주의사항:
- 반드시 한국어로 답변하세요.
- 명리학 용어는 괄호 안에 쉬운 설명을 추가하세요.
- 긍정적인 톤을 유지하되, 솔직하게 분석하세요.
- 점술적 표현보다 심리학적/실용적 조언에 가깝게 작성하세요.`
}
