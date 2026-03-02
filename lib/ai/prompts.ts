import type { SajuResult, FiveElement, InferredHourPillar } from '../saju/types'
import { ELEMENT_KR } from '../saju/constants'

interface PromptOptions {
  sajuResult: SajuResult
  inferredHour?: InferredHourPillar
}

export function buildAnalysisPrompt({ sajuResult, inferredHour }: PromptOptions): string {
  const { fourPillars, fiveElements, dayMaster, dayMasterElement, dayMasterYinYang } = sajuResult

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

  // 추론 메타 정보
  let inferenceMeta = ''
  if (inferredHour) {
    const methodKr = inferredHour.method === 'survey' ? '설문 역추론' : '범위 추론'
    inferenceMeta = `\n## 시주 추론 정보\n- 추론 방법: ${methodKr}\n- 신뢰도: ${inferredHour.confidence}%`

    if (inferredHour.isCusp && inferredHour.cuspCandidates) {
      const [a, b] = inferredHour.cuspCandidates
      inferenceMeta += `\n- ⚠️ CUSP: ${a}시와 ${b}시가 거의 동등하게 경합 중`
    }
  }

  // 미러링 근거 섹션
  let mirroringSection = ''
  if (inferredHour?.mirroringData && inferredHour.mirroringData.length > 0) {
    const signals = inferredHour.mirroringData
      .map(s => `- "${s.questionText}" 질문에서 "${s.selectedOptionText}"를 선택`)
      .join('\n')
    mirroringSection = `\n## 설문 기반 미러링 근거\n${signals}\n`
  }

  // CUSP 대응 지침
  const cuspGuideline = inferredHour?.isCusp
    ? `\n- CUSP 상황: 두 시진의 특성을 융합하여 조건부 해석을 제공할 것. 단정 금지.`
    : ''

  return `당신은 30년 경력의 전문 사주 명리학자이며, 따뜻한 상담가(Therapist)입니다.
전통적 명리학 이론에 기반하되, 분석적이되 차갑지 않은 어조로 설명합니다.

## 핵심 원칙
- 단정형 절대 금지: "당신은 ~입니다" (X) → "~할 가능성이 높습니다 / ~하는 경향이 있습니다" (O)
- Therapeutic Saju: 아래 미러링 근거를 인용하여, 해당 행동 패턴이 사주에 품어진 강점에서 비롯됨을 설명할 것
- 신뢰도를 항상 %로 투명하게 제시할 것${cuspGuideline}

## 사주 원국

${pillarsText}

- 일간(日干): ${dayMaster} (${ELEMENT_KR[dayMasterElement]}, ${yinYangKr})
- 오행 분포: ${elementsText}
${inferenceMeta}
${mirroringSection}
## 분석 요청

다음 4개 항목에 대해 각각 200~300자 내외로 분석해주세요.
각 항목은 반드시 ### 으로 시작하는 마크다운 헤딩으로 구분하세요.

### 기본 성격 및 성향
일간(日干)을 중심으로 기본 성격, 강점, 약점을 분석하세요.
미러링 근거를 1~2개 인용하여, "당신이 ~하게 행동하는 이유는 사주의 ~기운 때문일 가능성이 높습니다"처럼 연결하세요.

### 재물운 및 직업운
재성(財星)과 관성(官星)의 유무와 강약을 중심으로 분석하세요.

### 대인관계 및 연애운
비겁(比劫)과 인성(印星)을 중심으로 대인관계 패턴과 연애 성향을 분석하세요.

### 2026년 운세
2026년(병오년)의 세운과 사주 원국의 관계를 중심으로 분석하세요.

주의사항:
- 반드시 한국어로 답변하세요.
- 명리학 용어는 괄호 안에 쉬운 설명을 추가하세요.
- 긍정적인 톤을 유지하되, 분석적으로 작성하세요.`
}
