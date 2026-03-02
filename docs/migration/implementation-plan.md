# 엔진 v4.1 구현 플랜

> **기준 스펙**: `docs/data/engine.json` (v4.1)
> **비교 분석**: `docs/migration/document-comparison-analysis.md`
> **작성일**: 2026-03-02

---

## 개요

현재 임시 구현(12문항, 단순 합산)을 실제 스펙(20문항, Softmax + CUSP + 미러링)으로 전환한다.
4개 Phase로 나누며, 각 Phase는 독립적으로 검증 가능하다.

```
Phase 1: 엔진 코어 (순수 함수, UI 변경 없음)
Phase 2: 설문 UI 교체 (20문항, choice-only)
Phase 3: 결과 페이지 CUSP UX
Phase 4: AI 프롬프트 업그레이드
```

---

## 변경 파일 전체 목록

| 파일 | 작업 | Phase |
|------|------|-------|
| `lib/engine/types.ts` | **신규 생성** | 1 |
| `lib/engine/loader.ts` | **신규 생성** | 1 |
| `lib/engine/scoring.ts` | **신규 생성** | 1 |
| `lib/survey/zishi-mapping.ts` | **신규 생성** | 1 |
| `lib/survey/types.ts` | **전면 교체** | 1 |
| `lib/survey/weight-engine.ts` | **전면 교체** | 2 |
| `lib/store.tsx` | 부분 수정 | 2 |
| `components/survey/question-choice.tsx` | props 타입 변경 | 2 |
| `app/survey/page.tsx` | **전면 교체** | 2 |
| `lib/survey/questions.ts` | **삭제** | 2 |
| `lib/saju/types.ts` | 부분 수정 | 3 |
| `app/result/page.tsx` | CUSP UI 추가 | 3 |
| `lib/ai/prompts.ts` | **전면 교체** | 4 |
| `app/api/analyze/route.ts` | 부분 수정 | 4 |

---

## Phase 1: 엔진 코어

**목표**: UI를 건드리지 않고 순수 계산 엔진을 완성한다. 이 Phase가 끝나면 콘솔에서 엔진을 독립적으로 테스트할 수 있다.

### 주요 결정사항 (구현 전 반드시 확인)

- `question_weight`는 **JSON에서 문항별로 직접 읽는다.** role별 고정 상수(`ROLE_WEIGHT_MULTIPLIER`) 사용 금지.
  - 근거: Q6/Q7은 `core` role이지만 weight=1.2 (1.5가 아님)
- `SurveyAnswer`의 응답 저장 필드명은 `optionIndex: number` (기존 `value` 아님)
- 모니터링은 `roleInfluence: Record<StructureRole, number>` — 4개 역할 전체 추적

---

### 1-1. `lib/engine/types.ts` — 신규 생성

```typescript
import type { ZishiName, StructureRole } from '../survey/types'

export interface EngineSettings {
  version: string
  default_temperature: number
  cusp_logic: {
    gap_threshold: number
    min_score_std: number
    std_scope: string
  }
  score_monitoring: {
    compute_theoretical_bounds: boolean
    alert_if_zishi_max_diff_over: number
    alert_if_role_influence_over: number
  }
  distribution_monitoring: {
    track_top1_mean: boolean
    track_top2_gap_mean: boolean
    target_top1_band: [number, number]
  }
  zishi_list: ZishiName[]
}

export interface EngineOption {
  text: string
  score_map: Partial<Record<ZishiName, number>>
}

export interface EngineQuestion {
  id: string
  structure_role: StructureRole
  category: string
  question_weight: number
  text: string
  options: EngineOption[]
}
```

---

### 1-2. `lib/survey/types.ts` — 전면 교체

기존 `QuestionType`, `WeightMap`, `QuestionOption`, `SurveyQuestion` 전부 제거.

```typescript
import type { EarthlyBranch } from '../saju/types'

// 시진 (한글) — engine.json score_map 키와 동일
export type ZishiName =
  | '자시' | '축시' | '인시' | '묘시' | '진시' | '사시'
  | '오시' | '미시' | '신시' | '유시' | '술시' | '해시'

// 질문의 구조적 역할
export type StructureRole = 'noise_reduction' | 'core' | 'fine_tune' | 'closing'

// 사용자 응답 — optionIndex 기반 (옵션 텍스트 변경에 안전)
export interface SurveyAnswer {
  questionId: string   // "Q1" ~ "Q20"
  optionIndex: number  // 0-based
}

// CUSP 판정 결과
export interface CuspResult {
  isCusp: boolean
  gap: number      // top1_prob - top2_prob
  stdDev: number   // std(12 softmax probs)
}

// 시진 후보 (정렬된 결과)
export interface ZishiCandidate {
  zishi: ZishiName
  branch: EarthlyBranch
  branchKr: string
  rawScore: number
  probability: number   // 0~1
  percentage: number    // Math.round(probability * 100)
}

// 미러링 신호 — core 문항 중 top1 기여 상위 2~3개
export interface MirroringSignal {
  questionId: string
  questionText: string
  selectedOptionText: string
  impactScore: number    // question_weight × score_map[top1] (부호 포함)
  targetZishi: ZishiName
}

// 모니터링 지표
export interface MonitoringResult {
  zishiMaxDiff: number
  roleInfluence: Record<StructureRole, number>  // 4개 역할 전체
  top1Prob: number
  top2Gap: number
  stdSoftmax: number
  stdRawScore: number
  alerts: {
    zishiMaxDiffOver: boolean   // > 8
    roleInfluenceOver: boolean  // core > 0.65
    top1OutOfBand: boolean      // top1 < 0.5 또는 > 0.65
  }
}

// 최종 설문 결과
export interface SurveyResult {
  inferredZishi: ZishiName
  confidence: number                         // top1_prob × 100 (반올림)
  probabilities: Record<ZishiName, number>
  topCandidates: ZishiCandidate[]            // 상위 3개
  cusp: CuspResult
  mirroringSignals: MirroringSignal[]
  monitoring: MonitoringResult
}
```

---

### 1-3. `lib/survey/zishi-mapping.ts` — 신규 생성

```typescript
import type { EarthlyBranch } from '../saju/types'
import type { ZishiName } from './types'

export const ZISHI_TO_BRANCH: Record<ZishiName, EarthlyBranch> = {
  자시: '子', 축시: '丑', 인시: '寅', 묘시: '卯',
  진시: '辰', 사시: '巳', 오시: '午', 미시: '未',
  신시: '申', 유시: '酉', 술시: '戌', 해시: '亥',
}

export const BRANCH_TO_ZISHI: Record<EarthlyBranch, ZishiName> = {
  子: '자시', 丑: '축시', 寅: '인시', 卯: '묘시',
  辰: '진시', 巳: '사시', 午: '오시', 未: '미시',
  申: '신시', 酉: '유시', 戌: '술시', 亥: '해시',
}
```

---

### 1-4. `lib/engine/loader.ts` — 신규 생성

```typescript
import engineJson from '@/docs/data/engine.json'
import type { EngineQuestion, EngineSettings } from './types'
import type { ZishiName } from '../survey/types'

export const ENGINE_SETTINGS = engineJson.engine_settings as unknown as EngineSettings
export const ZISHI_LIST = engineJson.engine_settings.zishi_list as ZishiName[]
export const ENGINE_QUESTIONS = engineJson.questions as unknown as EngineQuestion[]

// O(1) 조회용 Map
export const QUESTION_MAP = new Map(ENGINE_QUESTIONS.map(q => [q.id, q]))

// role별 필터 (미러링 추출에 사용)
export const CORE_QUESTIONS = ENGINE_QUESTIONS.filter(q => q.structure_role === 'core')
```

---

### 1-5. `lib/engine/scoring.ts` — 신규 생성

가장 핵심 파일. 순수 함수로만 구성한다.

```typescript
import { ENGINE_SETTINGS, ZISHI_LIST, QUESTION_MAP, CORE_QUESTIONS } from './loader'
import { ZISHI_TO_BRANCH } from '../survey/zishi-mapping'
import { BRANCH_KR } from '../saju/constants'
import type { SurveyAnswer, ZishiName, StructureRole, CuspResult, ZishiCandidate, MirroringSignal, MonitoringResult, SurveyResult } from '../survey/types'

function initZeroScores(): Record<ZishiName, number> {
  const scores = {} as Record<ZishiName, number>
  for (const z of ZISHI_LIST) scores[z] = 0
  return scores
}

// Step 1: 원시 점수 누적
export function calculateRawScores(answers: SurveyAnswer[]): Record<ZishiName, number> {
  const scores = initZeroScores()

  for (const answer of answers) {
    const question = QUESTION_MAP.get(answer.questionId)
    if (!question) continue

    const option = question.options[answer.optionIndex]
    if (!option) continue

    // question_weight는 문항별로 직접 읽음 (role 기반 고정 상수 사용 금지)
    for (const [zishi, score] of Object.entries(option.score_map) as [ZishiName, number][]) {
      scores[zishi] += question.question_weight * score
    }
  }

  return scores
}

// Step 2: Softmax 변환 (수치 안정성을 위해 max 빼기 적용)
export function softmax(
  scores: Record<ZishiName, number>,
  temperature: number = ENGINE_SETTINGS.default_temperature
): Record<ZishiName, number> {
  const vals = ZISHI_LIST.map(z => scores[z])
  const maxVal = Math.max(...vals)

  const exps = {} as Record<ZishiName, number>
  let sumExp = 0
  for (const z of ZISHI_LIST) {
    exps[z] = Math.exp((scores[z] - maxVal) / temperature)
    sumExp += exps[z]
  }

  const probs = {} as Record<ZishiName, number>
  for (const z of ZISHI_LIST) {
    probs[z] = exps[z] / sumExp
  }

  return probs
}

// Step 3: CUSP 판정
export function evaluateCusp(probs: Record<ZishiName, number>): CuspResult {
  const sorted = ZISHI_LIST.map(z => probs[z]).sort((a, b) => b - a)
  const gap = sorted[0] - sorted[1]

  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / sorted.length
  const stdDev = Math.sqrt(variance)

  const { gap_threshold, min_score_std } = ENGINE_SETTINGS.cusp_logic

  return {
    isCusp: gap < gap_threshold && stdDev > min_score_std,
    gap,
    stdDev,
  }
}

// 상위 N개 후보 추출
export function getTopCandidates(
  probs: Record<ZishiName, number>,
  rawScores: Record<ZishiName, number>,
  n = 3
): ZishiCandidate[] {
  return ZISHI_LIST
    .map(z => ({
      zishi: z,
      branch: ZISHI_TO_BRANCH[z],
      branchKr: BRANCH_KR[ZISHI_TO_BRANCH[z]],
      rawScore: rawScores[z],
      probability: probs[z],
      percentage: Math.round(probs[z] * 100),
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n)
}

// 모니터링 지표 계산
export function calculateMonitoring(
  rawScores: Record<ZishiName, number>,
  probs: Record<ZishiName, number>,
  answers: SurveyAnswer[]
): MonitoringResult {
  const rawVals = ZISHI_LIST.map(z => rawScores[z])
  const zishiMaxDiff = Math.max(...rawVals) - Math.min(...rawVals)

  // role별 절대 기여합
  const roleAbsSum: Record<StructureRole, number> = {
    noise_reduction: 0, core: 0, fine_tune: 0, closing: 0,
  }
  let totalAbsSum = 0

  for (const answer of answers) {
    const question = QUESTION_MAP.get(answer.questionId)
    if (!question) continue
    const option = question.options[answer.optionIndex]
    if (!option) continue

    const absContrib = Object.values(option.score_map).reduce(
      (s, v) => s + Math.abs(question.question_weight * (v ?? 0)), 0
    )
    roleAbsSum[question.structure_role] += absContrib
    totalAbsSum += absContrib
  }

  const roleInfluence = {
    noise_reduction: totalAbsSum > 0 ? roleAbsSum.noise_reduction / totalAbsSum : 0,
    core: totalAbsSum > 0 ? roleAbsSum.core / totalAbsSum : 0,
    fine_tune: totalAbsSum > 0 ? roleAbsSum.fine_tune / totalAbsSum : 0,
    closing: totalAbsSum > 0 ? roleAbsSum.closing / totalAbsSum : 0,
  }

  const sortedProbs = ZISHI_LIST.map(z => probs[z]).sort((a, b) => b - a)
  const top1Prob = sortedProbs[0]
  const top2Gap = sortedProbs[0] - sortedProbs[1]

  const probMean = 1 / ZISHI_LIST.length
  const stdSoftmax = Math.sqrt(
    ZISHI_LIST.map(z => probs[z]).reduce((s, v) => s + (v - probMean) ** 2, 0) / ZISHI_LIST.length
  )

  const rawMean = rawVals.reduce((s, v) => s + v, 0) / rawVals.length
  const stdRawScore = Math.sqrt(
    rawVals.reduce((s, v) => s + (v - rawMean) ** 2, 0) / rawVals.length
  )

  const { alert_if_zishi_max_diff_over, alert_if_role_influence_over } = ENGINE_SETTINGS.score_monitoring
  const [bandLow, bandHigh] = ENGINE_SETTINGS.distribution_monitoring.target_top1_band

  return {
    zishiMaxDiff,
    roleInfluence,
    top1Prob,
    top2Gap,
    stdSoftmax,
    stdRawScore,
    alerts: {
      zishiMaxDiffOver: zishiMaxDiff > alert_if_zishi_max_diff_over,
      roleInfluenceOver: roleInfluence.core > alert_if_role_influence_over,
      top1OutOfBand: top1Prob < bandLow || top1Prob > bandHigh,
    },
  }
}

// 미러링 신호 추출 — core 문항(Q4~Q7) 중 top1 기여 상위 2~3개
export function extractMirroringSignals(
  answers: SurveyAnswer[],
  top1Zishi: ZishiName,
  maxCount = 3
): MirroringSignal[] {
  const coreIds = new Set(CORE_QUESTIONS.map(q => q.id))

  return answers
    .filter(a => coreIds.has(a.questionId))
    .map(answer => {
      const question = QUESTION_MAP.get(answer.questionId)!
      const option = question.options[answer.optionIndex]
      const rawScore = option.score_map[top1Zishi] ?? 0
      const impactScore = question.question_weight * rawScore

      return {
        questionId: answer.questionId,
        questionText: question.text,
        selectedOptionText: option.text,
        impactScore,
        targetZishi: top1Zishi,
      }
    })
    .filter(s => s.impactScore !== 0)
    .sort((a, b) => Math.abs(b.impactScore) - Math.abs(a.impactScore))
    .slice(0, maxCount)
}

// 전체 파이프라인 — 외부 진입점
export function inferZishi(answers: SurveyAnswer[]): SurveyResult {
  const rawScores = calculateRawScores(answers)
  const probs = softmax(rawScores)
  const cusp = evaluateCusp(probs)
  const topCandidates = getTopCandidates(probs, rawScores)
  const top1 = topCandidates[0]
  const mirroringSignals = extractMirroringSignals(answers, top1.zishi)
  const monitoring = calculateMonitoring(rawScores, probs, answers)

  // 모니터링 알림 로그
  if (Object.values(monitoring.alerts).some(Boolean)) {
    console.warn('[Engine Monitor]', JSON.stringify(monitoring, null, 2))
  }

  return {
    inferredZishi: top1.zishi,
    confidence: Math.round(top1.probability * 100),
    probabilities: probs,
    topCandidates,
    cusp,
    mirroringSignals,
    monitoring,
  }
}
```

### Phase 1 검증

콘솔 또는 임시 테스트 파일에서 다음을 확인:

```typescript
import { inferZishi } from '@/lib/engine/scoring'

// 케이스 1: Q5 "바로 잠들어요" (자시 -9점 소거 확인)
const result = inferZishi([
  { questionId: 'Q5', optionIndex: 1 },  // "눈꺼풀이 무거워 바로 잠들어요"
])
// 기대: 자시 rawScore = -9.0 (1.5 × -6)
// 기대: 자시 probability가 매우 낮음

// 케이스 2: 확률 합 검증
const total = Object.values(result.probabilities).reduce((s, v) => s + v, 0)
// 기대: total ≈ 1.0 (오차 1e-10 이내)

// 케이스 3: 빈 답변 (균등 분포)
const empty = inferZishi([])
// 기대: 각 시진 probability ≈ 0.0833
```

---

## Phase 2: 설문 UI 교체

**목표**: 12문항 임시 UI를 20문항 choice-only UI로 교체. Phase 1 완료 후 진행.

### 2-1. `lib/survey/weight-engine.ts` — 전면 교체

Phase 1 엔진의 얇은 래퍼로 대체한다.

```typescript
import { inferZishi } from '../engine/scoring'
import { ZISHI_TO_BRANCH } from './zishi-mapping'
import { BRANCH_KR } from '../saju/constants'
import type { SurveyAnswer, SurveyResult } from './types'
import type { InferredHourPillar } from '../saju/types'

export { inferZishi }

// SurveyResult → InferredHourPillar 변환 (store/saju 레이어 연결용)
export function toInferredHourPillar(result: SurveyResult): InferredHourPillar {
  const branch = ZISHI_TO_BRANCH[result.inferredZishi]
  return {
    branch,
    branchKr: BRANCH_KR[branch],
    confidence: result.confidence,
    topCandidates: result.topCandidates.map(c => ({
      branch: c.branch,
      branchKr: c.branchKr,
      score: c.rawScore,
      percentage: c.percentage,
    })),
    method: 'survey',
    isCusp: result.cusp.isCusp,
    cuspCandidates: result.cusp.isCusp
      ? [result.topCandidates[0].branch, result.topCandidates[1].branch]
      : undefined,
    mirroringData: result.mirroringSignals.map(s => ({
      questionText: s.questionText,
      selectedOptionText: s.selectedOptionText,
    })),
  }
}
```

### 2-2. `lib/saju/types.ts` — `InferredHourPillar` 수정

기존 인터페이스에 필드 추가:

```typescript
export interface InferredHourPillar {
  branch: EarthlyBranch
  branchKr: string
  confidence: number
  topCandidates: Array<{
    branch: EarthlyBranch
    branchKr: string
    score: number
    percentage: number
  }>
  method: 'known' | 'survey' | 'approximate'
  // 신규 추가
  isCusp?: boolean
  cuspCandidates?: [EarthlyBranch, EarthlyBranch]
  mirroringData?: Array<{
    questionText: string
    selectedOptionText: string
  }>
}
```

### 2-3. `lib/store.tsx` — `SurveyAnswer` 타입 변경

`SurveyAnswer` import 타입이 바뀌므로 자동 적용됨. Action 타입 `SET_SURVEY_ANSWERS` payload 타입도 자동 변경됨.

확인 필요 사항: `state.surveyAnswers`를 사용하는 곳에서 `value` 대신 `optionIndex`를 참조하는 곳이 없는지 검색.

```bash
# 확인 명령
grep -r "\.value" lib/store.tsx app/api/analyze/route.ts
```

### 2-4. `components/survey/question-choice.tsx` — 전면 교체

```typescript
'use client'

import type { EngineOption } from '@/lib/engine/types'

interface QuestionChoiceProps {
  options: EngineOption[]
  onAnswer: (optionIndex: number) => void
}

export function QuestionChoice({ options, onAnswer }: QuestionChoiceProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt, index) => (
        <button
          key={index}
          onClick={() => onAnswer(index)}
          className="flex min-h-[52px] items-center justify-center rounded-2xl bg-card px-5 py-3.5 text-[15px] font-medium text-foreground shadow-sm transition-all duration-200 hover:bg-secondary active:scale-[0.98]"
        >
          {opt.text}
        </button>
      ))}
    </div>
  )
}
```

### 2-5. `app/survey/page.tsx` — 전면 교체

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/lib/store'
import { QuestionChoice } from '@/components/survey/question-choice'
import { ENGINE_QUESTIONS } from '@/lib/engine/loader'
import { inferZishi, toInferredHourPillar } from '@/lib/survey/weight-engine'
import type { SurveyAnswer } from '@/lib/survey/types'

export default function SurveyPage() {
  const router = useRouter()
  const { dispatch } = useAppState()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<SurveyAnswer[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'in' | 'out'>('in')

  const totalQuestions = ENGINE_QUESTIONS.length  // 20
  const question = ENGINE_QUESTIONS[currentIndex]

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      if (isAnimating) return

      const newAnswer: SurveyAnswer = {
        questionId: question.id,
        optionIndex,
      }
      const updatedAnswers = [...answers, newAnswer]
      setAnswers(updatedAnswers)

      if (currentIndex < totalQuestions - 1) {
        setIsAnimating(true)
        setSlideDirection('out')
        setTimeout(() => {
          setCurrentIndex(prev => prev + 1)
          setSlideDirection('in')
          setTimeout(() => setIsAnimating(false), 300)
        }, 200)
      } else {
        // 설문 완료 — 엔진 실행
        const surveyResult = inferZishi(updatedAnswers)
        const inferredHour = toInferredHourPillar(surveyResult)

        dispatch({ type: 'SET_SURVEY_ANSWERS', payload: updatedAnswers })
        dispatch({ type: 'SET_INFERRED_HOUR', payload: inferredHour })

        router.push('/analyzing')
      }
    },
    [currentIndex, answers, dispatch, isAnimating, question, router, totalQuestions]
  )

  function handleBack() {
    if (currentIndex > 0) {
      setIsAnimating(true)
      setSlideDirection('out')
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1)
        setAnswers(prev => prev.slice(0, -1))
        setSlideDirection('in')
        setTimeout(() => setIsAnimating(false), 300)
      }, 200)
    } else {
      router.back()
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-3 bg-background px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary"
            aria-label="뒤로 가기"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {currentIndex + 1}/{totalQuestions}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-5 pt-4">
        <div
          className={`transition-all duration-300 ${
            slideDirection === 'in' ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
          }`}
        >
          <p className="mb-2 text-[13px] font-semibold text-primary">
            Q{currentIndex + 1}
          </p>
          <h2 className="mb-8 whitespace-pre-line text-[22px] font-bold leading-tight text-foreground">
            {question.text}
          </h2>

          <QuestionChoice
            options={question.options}
            onAnswer={handleAnswer}
          />
        </div>
      </div>
    </div>
  )
}
```

### 2-6. `lib/survey/questions.ts` — 삭제

```bash
rm lib/survey/questions.ts
```

삭제 전 이 파일을 import하는 곳이 없는지 확인:

```bash
grep -r "survey/questions" app/ lib/ components/
# 결과: app/survey/page.tsx 1건 → Phase 2-5에서 이미 제거됨
```

### Phase 2 검증

브라우저에서 직접 확인:

1. `/survey` 진입 시 프로그레스바 `1/20` 표시 확인
2. 20번째 질문 응답 후 `/analyzing` 이동 확인
3. 콘솔에서 모니터링 경고 JSON 출력 확인 (alerts 발동 시)
4. `/result`에서 `inferredHour.confidence`, `inferredHour.isCusp` 값 확인

---

## Phase 3: 결과 페이지 CUSP UX

**목표**: 두 시진이 경합할 때 사용자에게 "하이브리드" 안내를 보여준다.

### 3-1. `app/result/page.tsx` — CUSP 섹션 추가

기존 "시주 추론 정보" 섹션에 CUSP 표시 추가.

변경 위치: `inferredHour.isCusp` 분기 추가

```typescript
{/* 기존 시주 추론 정보 섹션 안에 추가 */}
{isInferred && inferredHour?.isCusp && (
  <div className="mt-3 rounded-xl bg-primary/5 px-4 py-3">
    <p className="text-[13px] font-semibold text-primary">
      두 시진이 경합 중이에요
    </p>
    <p className="mt-1 text-[12px] text-muted-foreground">
      두 시진의 기운이 거의 동등하게 나타났습니다.
      아래 두 시진 모두 당신의 기운을 담고 있을 수 있어요.
    </p>
  </div>
)}
```

### Phase 3 검증

CUSP 발동은 현재 `std > 0.8` 조건으로 사실상 미발동. 테스트용 임시 확인 방법:

```typescript
// engine/scoring.ts evaluateCusp에서 임시로 조건 완화 후 테스트
// isCusp: gap < 0.5 && stdDev > 0.01  ← 테스트 후 원복 필수
```

---

## Phase 4: AI 프롬프트 업그레이드

**목표**: Therapeutic Saju 톤과 미러링 근거를 AI에게 전달한다.

### 4-1. `lib/ai/prompts.ts` — 전면 교체

```typescript
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
```

### 4-2. `app/api/analyze/route.ts` — 수정

```typescript
import { streamText } from 'ai'
import { buildAnalysisPrompt } from '@/lib/ai/prompts'
import { analyzeSaju } from '@/lib/saju/calculator'
import type { BirthInfo, InferredHourPillar } from '@/lib/saju/types'

export async function POST(req: Request) {
  const body = await req.json()
  const { birthInfo, inferredHour } = body as {
    birthInfo: BirthInfo
    inferredHour?: InferredHourPillar
  }

  const sajuResult = analyzeSaju(birthInfo, inferredHour)
  const prompt = buildAnalysisPrompt({ sajuResult, inferredHour })

  const result = streamText({
    model: 'google/gemini-2.0-flash',
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.7,
  })

  return result.toTextStreamResponse()
}
```

> `surveyAnswers`를 별도로 받을 필요가 없어짐. `inferredHour.mirroringData`에 이미 필요한 정보가 포함되어 있기 때문.

### Phase 4 검증

- AI 리포트에 "~할 가능성이 높습니다" 표현이 사용되는지 확인
- 미러링 문구("당신이 ~하게 행동하는 이유는...") 포함 여부 확인
- 기존 "당신은 ~입니다" 단정형이 사라졌는지 확인

---

## 전체 구현 순서 (의존성 기준)

```
① lib/survey/types.ts         전면 교체
② lib/survey/zishi-mapping.ts 신규
③ lib/engine/types.ts         신규
④ lib/engine/loader.ts        신규
⑤ lib/engine/scoring.ts       신규          ← Phase 1 완료, 여기서 콘솔 테스트

⑥ lib/saju/types.ts           InferredHourPillar 필드 추가
⑦ lib/survey/weight-engine.ts 전면 교체 (⑤ 래퍼)
⑧ lib/store.tsx               타입 자동 변경 확인
⑨ components/survey/question-choice.tsx  props 교체
⑩ app/survey/page.tsx         전면 교체      ← Phase 2 완료, 브라우저 테스트

⑪ app/result/page.tsx         CUSP 섹션 추가 ← Phase 3 완료

⑫ lib/ai/prompts.ts           전면 교체
⑬ app/api/analyze/route.ts    수정           ← Phase 4 완료
⑭ lib/survey/questions.ts     삭제
```

---

## 최종 완료 기준 (Definition of Done)

### 기능 검증

- [ ] `/survey` 진입 시 프로그레스바 `1/20` 표시
- [ ] 20문항 순서대로 렌더링 (Q1 ~ Q20)
- [ ] 모든 질문이 choice 타입 (YN/Scale 컴포넌트 없음)
- [ ] 설문 완료 후 `/analyzing` → `/result` 정상 이동
- [ ] 결과 페이지 `confidence` 값이 0~100% 범위로 표시
- [ ] AI 리포트에 단정형 표현 없음

### 코드 검증

- [ ] `lib/survey/questions.ts` 파일 삭제됨
- [ ] 코드 어디에도 `ROLE_WEIGHT_MULTIPLIER` 상수 없음
- [ ] `SurveyAnswer.value` 필드 참조 없음 (`optionIndex` 사용)
- [ ] Softmax 출력 12시진 합 = 1.0 (오차 1e-10 이내)
- [ ] Q5 "바로 잠들어요" → 자시 rawScore = -9.0 (1.5 × -6)
- [ ] TypeScript 에러 0건 (`pnpm build` 통과)

### 미결 이슈 (MVP 이후)

- [ ] CUSP `std_softmax > 0.8` 임계값 → 운영 데이터 수집 후 `std_raw_score` 기반으로 재보정
- [ ] approximate 범위 소프트 prior 반영 — 제품 판단 후 별도 구현
