# 역추론 엔진 구현 설계서 (v4.1 기준)

> **입력 소스**: `docs/data/engine.json` (v4.1) + `docs/engine-data-description.md`
> **목적**: 임시 12문항 코드를 폐기하고 engine.json 기반의 실제 엔진으로 전환하기 위한 구현 설계

---

## 1. 엔진 개요

### 핵심 파이프라인

```
사용자 응답(20문항)
  → ① 가중치 누적 (Raw Score)
  → ② Softmax 변환 (T = 1.2)
  → ③ CUSP 판정 (하이브리드 여부)
  → 결과: 추론 시진 + 신뢰도 + 미러링 신호
```

### 설계 철학 (MOI 원칙)

| 원칙 | 내용 |
|------|------|
| Therapeutic Saju | 결과 통보가 아닌 미러링. "당신이 ~하게 행동한 이유는 당신 사주의 강점입니다" |
| 확률 기반 | 신뢰도를 항상 %로 투명하게 노출. 점술이 아닌 추론 서비스 |
| 단정형 금지 | "당신은 ~입니다" (X) → "~할 가능성이 높습니다 / ~하는 경향이 있습니다" (O) |
| 장기 리듬 유도 | 설문 마이크로카피는 예외 상황이 아닌 장기적 패턴 선택을 유도 |

---

## 2. 전체 질문 목록 (20문항)

### 2.1 역할별 분류 및 가중치

| role | question_weight 의미 | 설계 목적 |
|------|---------------------|-----------|
| `noise_reduction` | 0.8 | 초기 이탈 방지, 기본 성향 파악 |
| `core` | 1.5 (또는 1.2) | 강한 긍정(+4) / 음수(-6)로 시진 확실 판별 |
| `fine_tune` | 1.0~1.2 | 1·2위 경합 시진 간 미세 격차 벌리기 |
| `closing` | 1.0 | 응답 마무리, 전반적 성향 보완 |

### 2.2 문항별 상세

#### 🌿 NOISE_REDUCTION (Q1~Q3) — weight: 0.8

| ID | 질문 | 선택지 수 | 핵심 타겟 시진 |
|----|------|-----------|--------------|
| Q1 | 아침에 눈을 떴을 때, 나의 모습은? | 3 | 바로 활동→인묘진, 멍함→해축, 예열→미오 |
| Q2 | 커피(카페인)가 가장 간절할 때는? | 4 | 오전→인묘진, 오후→미신, 해질녘→유술, 밤→해자 |
| Q3 | 밥 먹고 졸음이 쏟아지는 때는? | 4 | 점심후→미오진, 저녁후→술유, 야식후→축자해, 없음→진사신 |

#### 🔥 CORE (Q4~Q7) — weight: 1.5 / 1.2

| ID | weight | 질문 | 최고점 | 최저점 |
|----|--------|------|--------|--------|
| Q4 | 1.5 | 머리가 가장 또렷해지고 '나답다'고 느껴지는 시간은? | +4 | — |
| Q5 | 1.5 | 밤 11시 이후, 나의 에너지는? | +3 | **-6** (자시) |
| Q6 | 1.2 | 유독 기운이 안 붙고 몸이 무겁게 느껴지는 때는? | — | -3 |
| Q7 | 1.2 | 몸이 '잠깐 멈춰, 쉬어야 해'라고 신호를 보내는 시간은? | — | -3 |

> **핵심**: Q5는 "바로 잠들어요" 선택 시 자시에 -6 × 1.5 = **-9점** 부과. 가장 강력한 소거 장치.

#### 🔧 FINE_TUNE (Q8~Q17) — weight: 1.0~1.2

| ID | weight | 질문 | 카테고리 |
|----|--------|------|---------|
| Q8  | 1.0 | 마음이 '뾰족'해지거나 예민해지는 시간은? | Life-Rhythm |
| Q9  | 1.2 | 계절의 변화를 어디서 가장 먼저 느끼나요? | Life-Rhythm |
| Q10 | 1.0 | 큰 프로젝트를 끝냈을 때, 나는 보통? | Behavior |
| Q11 | 1.0 | 실패를 겪었을 때 다시 일어서는 속도는? | Behavior |
| Q12 | 1.2 | 돌발 상황이 생기면 나의 첫 번째 반응은? | Behavior |
| Q13 | 1.0 | 갈등이 생기면, 나를 지키기 위해 선택하는 방식은? | Behavior |
| Q14 | 1.0 | 나보다 어린 사람을 대할 때 나는? | Behavior |
| Q15 | 1.2 | 혼자 가만히 있을 때, 생각은 어디로 흘러가나요? | Deep-Inner |
| Q16 | 1.2 | 남들은 모르지만, 내 안의 단단한 힘은? | Deep-Inner |
| Q17 | 1.2 | 지금까지 살아오면서 반복된 특징은? | Deep-Inner |

#### 🌙 CLOSING (Q18~Q20) — weight: 1.0

| ID | 질문 | 핵심 타겟 |
|----|------|-----------|
| Q18 | 내가 꿈꾸는 삶의 방향은? | 전문성→유축해, 영향력→인사오, 안정→미술진 |
| Q19 | 나의 '인생 전성기'는 언제일 것 같나요? | 초반→인묘진, 중반→사오미, 후반→신유해축술 |
| Q20 | 나를 가장 잘 설명하는 문장은? | 현실꿈→진술미축, 데이터→유신사, 중간→없음 |

---

## 3. 계산 파이프라인 상세

### Step 1: 원시 점수 누적 (Raw Score Accumulation)

```
score[시진] = Σ( question_weight_i × option_score_map_i[시진] )
```

- 각 응답에 대해 해당 질문의 `question_weight`와 선택한 옵션의 `score_map`을 곱하여 12시진 배열에 누적
- `score_map`에 없는 시진은 해당 답변에서 0 기여 (초기화 값 0 유지)
- **음수 점수 정상 처리 필수**: -6, -3, -2 값이 Softmax 입력으로 그대로 전달됨

**구현 수도코드:**
```typescript
const rawScores: Record<ZishiName, number> = initZero()

for (const answer of answers) {
  const question = findQuestion(answer.questionId)       // engine.json 기반
  const option = question.options[answer.optionIndex]   // 인덱스 기반 조회

  for (const [zishi, score] of entries(option.score_map)) {
    rawScores[zishi] += question.question_weight * score
  }
}
```

### Step 2: Softmax 변환 (T = 1.2)

```
x_i     = (score_i - max(scores)) / T     ← 수치 안정성을 위한 max 빼기
exp_i   = exp(x_i)
prob_i  = exp_i / Σ(exp_j)
```

- **T = 1.2**: engine.json `default_temperature` 값. 상수로 관리, 추후 환경변수화 권장
- **수치 안정성**: max를 빼지 않으면 큰 음수값에서 exp가 0에 수렴해 정밀도 손실 발생
- 결과: 12시진의 확률합 = 1.0 (100%)

**구현 수도코드:**
```typescript
function softmax(scores: Record<ZishiName, number>, T: number): Record<ZishiName, number> {
  const vals = Object.values(scores)
  const maxVal = Math.max(...vals)
  const exps = mapValues(scores, s => Math.exp((s - maxVal) / T))
  const sumExp = sum(Object.values(exps))
  return mapValues(exps, e => e / sumExp)
}
```

### Step 3: CUSP 판정 (하이브리드 여부)

**발동 조건** (AND 조건):
```
조건 A: (Top1_prob - Top2_prob) < gap_threshold (= 0.05)
조건 B: stdDev(12시진 softmax 확률) > min_score_std (= 0.8)
```

| 조건 | 의미 |
|------|------|
| 조건 A | 1위와 2위가 매우 근접 (5% 미만 차이) |
| 조건 B | 분포가 특정 시진에 집중 (평탄한 분포 제외) |

> ⚠️ **주의**: softmax 확률의 std는 보통 0.05~0.15 수준. `min_score_std = 0.8`은 사실상 미발동에 가까움.
> 운영 데이터 수집 후 `std_raw_score`(원시 점수 std) 기준으로 재보정 필요.
> 1차 구현은 스펙 그대로 적용하되, `std_softmax`와 `std_raw_score` 모두 모니터링 값으로 기록.

**구현 수도코드:**
```typescript
function evaluateCusp(probs: Record<ZishiName, number>, settings: CuspSettings): CuspResult {
  const sorted = Object.values(probs).sort((a, b) => b - a)
  const gap = sorted[0] - sorted[1]
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / sorted.length
  const stdDev = Math.sqrt(variance)

  return {
    isCusp: gap < settings.gap_threshold && stdDev > settings.min_score_std,
    gap,
    stdDev,
  }
}
```

---

## 4. Confidence (신뢰도) 정의

**채택안: `confidence = Top1_prob × 100`**

| 후보안 | 공식 | 특징 |
|--------|------|------|
| A (채택) | `top1_prob × 100` | 직관적. "이 시진일 확률 XX%" |
| B (모니터링) | `(top1 - top2) × 100` | 격차 기반. 내부 지표로 병행 추적 |

- UI 노출: A안 (`top1_prob × 100`)
- 내부 로그: B안도 함께 기록

---

## 5. 모니터링 Guardrails

매 요청마다 계산 후 콘솔/로그에 JSON으로 기록. 경고는 소프트 알림 (하드 차단 아님).

```typescript
interface MonitoringResult {
  zishiMaxDiff: number          // max(raw) - min(raw)
  roleInfluenceCore: number     // core 절대기여합 / 전체 절대기여합
  top1Prob: number
  top2Gap: number               // top1 - top2 확률 차이
  stdSoftmax: number            // 12시진 softmax 확률의 표준편차
  stdRawScore: number           // 12시진 원시 점수의 표준편차
  alerts: {
    zishiMaxDiffOver: boolean   // > 8
    roleInfluenceOver: boolean  // > 0.65
    top1OutOfBand: boolean      // top1_prob < 0.5 또는 > 0.65
  }
}
```

| 지표 | 경고 임계값 | 의미 |
|------|------------|------|
| `zishiMaxDiff` | > 8 | 특정 시진에 점수가 극단적으로 집중 |
| `roleInfluenceCore` | > 0.65 | core 문항이 결과를 지나치게 지배 |
| `top1Prob` | [0.5, 0.65] 밴드 이탈 | 너무 확실하거나 너무 불확실한 결과 |

---

## 6. 미러링 신호 추출 (Mirroring Signals)

AI 리포트에서 "당신이 ~하게 행동한 이유"를 설명하기 위한 근거 문항 추출.

### 추출 기준

1. `structure_role === 'core'`인 문항만 대상 (Q4, Q5, Q6, Q7)
2. 해당 답변이 Top1 시진에 기여한 점수의 절대값 계산: `|question_weight × score_map[top1_zishi]|`
3. 절대값 내림차순으로 **상위 2~3개** 추출
4. 기여 점수가 0인 경우 제외 (해당 시진에 score_map이 없는 옵션 선택)

### 출력 구조

```typescript
interface MirroringSignal {
  questionId: string          // "Q4"
  questionText: string        // "머리가 가장 또렷해지고..."
  selectedOptionText: string  // "오전 시간"
  impactScore: number         // question_weight × |score_map[top1]|  (부호 포함)
  targetZishi: ZishiName      // top1 시진
}
```

### AI 프롬프트 사용 예

```
[미러링 근거]
Q4: "머리가 가장 또렷해지고 나답다고 느껴지는 시간"에서 "오전 시간"을 선택 (진시·사시 +6점 기여)
Q5: "밤 11시 이후 에너지"에서 "눈꺼풀이 무거워 바로 잠들어요"를 선택 (자시 -9점 소거)
→ "당신이 오전에 유독 맑고 집중이 잘 된다고 느끼는 이유는, 당신이 타고난 사시(巳時)의 기운과 맞닿아 있을 가능성이 높습니다."
```

---

## 7. TypeScript 타입 정의 (전체)

### 7.1 기본 타입 (`lib/survey/types.ts` 전면 교체)

```typescript
// 시진 이름 (한글) — engine.json의 score_map 키와 동일
export type ZishiName =
  | '자시' | '축시' | '인시' | '묘시' | '진시' | '사시'
  | '오시' | '미시' | '신시' | '유시' | '술시' | '해시'

// 질문의 구조적 역할
export type StructureRole = 'noise_reduction' | 'core' | 'fine_tune' | 'closing'

// engine.json 스키마 타입
export interface EngineOption {
  text: string
  score_map: Partial<Record<ZishiName, number>>
}

export interface EngineQuestion {
  id: string                    // "Q1" ~ "Q20"
  structure_role: StructureRole
  category: string
  question_weight: number       // 0.8 | 1.0 | 1.2 | 1.5
  text: string
  options: EngineOption[]
}

// 사용자 응답 — optionIndex 기반 (텍스트 변경에 안전)
export interface SurveyAnswer {
  questionId: string            // "Q1" ~ "Q20"
  optionIndex: number           // 0-based
}

// CUSP 판정 결과
export interface CuspResult {
  isCusp: boolean
  gap: number                   // top1_prob - top2_prob
  stdDev: number                // std(12 softmax probs)
}

// 시진 후보
export interface ZishiCandidate {
  zishi: ZishiName
  branch: EarthlyBranch         // 한자 지지 (사주 계산용)
  branchKr: string              // 한글 (표시용)
  rawScore: number
  probability: number           // softmax 확률 (0~1)
  percentage: number            // probability × 100 (반올림)
}

// 미러링 신호
export interface MirroringSignal {
  questionId: string
  questionText: string
  selectedOptionText: string
  impactScore: number           // question_weight × score_map[top1] (부호 포함)
  targetZishi: ZishiName
}

// 모니터링 결과
export interface MonitoringResult {
  zishiMaxDiff: number
  roleInfluenceCore: number
  top1Prob: number
  top2Gap: number
  stdSoftmax: number
  stdRawScore: number
  alerts: {
    zishiMaxDiffOver: boolean
    roleInfluenceOver: boolean
    top1OutOfBand: boolean
  }
}

// 최종 설문 결과
export interface SurveyResult {
  inferredZishi: ZishiName
  confidence: number            // top1_prob × 100
  probabilities: Record<ZishiName, number>
  topCandidates: ZishiCandidate[]   // 상위 3개
  cusp: CuspResult
  mirroringSignals: MirroringSignal[]
  monitoring: MonitoringResult
}
```

### 7.2 엔진 설정 타입 (`lib/engine/types.ts` 신규)

```typescript
export interface EngineSettings {
  version: string
  default_temperature: number
  cusp_logic: {
    gap_threshold: number       // 0.05
    min_score_std: number       // 0.8
    std_scope: string
  }
  score_monitoring: {
    alert_if_zishi_max_diff_over: number  // 8
    alert_if_role_influence_over: number  // 0.65
  }
  distribution_monitoring: {
    target_top1_band: [number, number]    // [0.5, 0.65]
  }
  zishi_list: ZishiName[]
}
```

---

## 8. 시진 ↔ 지지 매핑 테이블

engine.json은 한글 시진명, 기존 사주 계산 코드는 한자 지지 사용. 변환 레이어 필수.

```typescript
// lib/survey/zishi-mapping.ts

export const ZISHI_TO_BRANCH: Record<ZishiName, EarthlyBranch> = {
  자시: '子',   // 23:00 ~ 01:00
  축시: '丑',   // 01:00 ~ 03:00
  인시: '寅',   // 03:00 ~ 05:00
  묘시: '卯',   // 05:00 ~ 07:00
  진시: '辰',   // 07:00 ~ 09:00
  사시: '巳',   // 09:00 ~ 11:00
  오시: '午',   // 11:00 ~ 13:00
  미시: '未',   // 13:00 ~ 15:00
  신시: '申',   // 15:00 ~ 17:00
  유시: '酉',   // 17:00 ~ 19:00
  술시: '戌',   // 19:00 ~ 21:00
  해시: '亥',   // 21:00 ~ 23:00
}

export const BRANCH_TO_ZISHI: Record<EarthlyBranch, ZishiName> = {
  子: '자시', 丑: '축시', 寅: '인시', 卯: '묘시',
  辰: '진시', 巳: '사시', 午: '오시', 未: '미시',
  申: '신시', 酉: '유시', 戌: '술시', 亥: '해시',
}

// 시진별 실제 시간대 (표시용)
export const ZISHI_TIME_RANGE: Record<ZishiName, string> = {
  자시: '23:00~01:00', 축시: '01:00~03:00', 인시: '03:00~05:00',
  묘시: '05:00~07:00', 진시: '07:00~09:00', 사시: '09:00~11:00',
  오시: '11:00~13:00', 미시: '13:00~15:00', 신시: '15:00~17:00',
  유시: '17:00~19:00', 술시: '19:00~21:00', 해시: '21:00~23:00',
}
```

---

## 9. 모듈 구조 및 파일별 역할

```
lib/
├── engine/                         # 신규 디렉토리
│   ├── types.ts                    # EngineSettings, EngineQuestion 타입
│   ├── loader.ts                   # engine.json 로드 + 정규화
│   └── scoring.ts                  # calculateRawScores, softmax, evaluateCusp, monitoring
│
├── survey/
│   ├── types.ts                    # [전면 교체] ZishiName, SurveyAnswer(optionIndex), SurveyResult
│   ├── zishi-mapping.ts            # [신규] 한글↔한자 변환 테이블
│   ├── weight-engine.ts            # [교체] engine/scoring.ts 래퍼 + 미러링 추출
│   └── questions.ts                # [삭제] 임시 12문항 하드코딩 → loader.ts로 대체
│
├── saju/
│   └── types.ts                    # [수정] InferredHourPillar에 isCusp, mirroringData 추가
│
├── ai/
│   └── prompts.ts                  # [수정] Therapeutic Saju 프롬프트 + 미러링 섹션
│
└── store.tsx                       # [수정] SurveyAnswer 타입 변경, 새 Action 추가
```

### 각 모듈의 역할 및 의존 관계

```
engine/loader.ts
  └─ (imports) docs/data/engine.json

engine/scoring.ts
  └─ (imports) engine/loader.ts, survey/types.ts

survey/weight-engine.ts (래퍼)
  └─ (imports) engine/scoring.ts, survey/zishi-mapping.ts

app/survey/page.tsx
  └─ (imports) engine/loader.ts (질문 목록), survey/weight-engine.ts (추론)

app/api/analyze/route.ts
  └─ (imports) lib/ai/prompts.ts (미러링 포함)
```

---

## 10. loader.ts 구현 명세

```typescript
// lib/engine/loader.ts

import engineJson from '@/docs/data/engine.json'
import type { EngineQuestion, EngineSettings } from './types'
import type { ZishiName } from '../survey/types'

export const ENGINE_SETTINGS = engineJson.engine_settings as EngineSettings

export const ZISHI_LIST: ZishiName[] = engineJson.engine_settings.zishi_list as ZishiName[]

export const ENGINE_QUESTIONS: EngineQuestion[] = engineJson.questions as EngineQuestion[]

// role별 질문 인덱스 (미러링 필터링용)
export const QUESTIONS_BY_ROLE = {
  noise_reduction: ENGINE_QUESTIONS.filter(q => q.structure_role === 'noise_reduction'),
  core:            ENGINE_QUESTIONS.filter(q => q.structure_role === 'core'),
  fine_tune:       ENGINE_QUESTIONS.filter(q => q.structure_role === 'fine_tune'),
  closing:         ENGINE_QUESTIONS.filter(q => q.structure_role === 'closing'),
}

// ID로 빠른 조회 (O(1))
export const QUESTION_MAP = new Map(ENGINE_QUESTIONS.map(q => [q.id, q]))
```

---

## 11. scoring.ts 핵심 함수 명세

```typescript
// lib/engine/scoring.ts

/**
 * Step 1: 원시 점수 누적
 */
export function calculateRawScores(
  answers: SurveyAnswer[]
): Record<ZishiName, number>

/**
 * Step 2: Softmax 변환
 */
export function softmax(
  scores: Record<ZishiName, number>,
  temperature: number = ENGINE_SETTINGS.default_temperature
): Record<ZishiName, number>

/**
 * Step 3: CUSP 판정
 */
export function evaluateCusp(
  probs: Record<ZishiName, number>
): CuspResult

/**
 * 상위 N개 후보 추출 (정렬 + 지지 변환 포함)
 */
export function getTopCandidates(
  probs: Record<ZishiName, number>,
  rawScores: Record<ZishiName, number>,
  n: number = 3
): ZishiCandidate[]

/**
 * 모니터링 지표 계산
 */
export function calculateMonitoring(
  rawScores: Record<ZishiName, number>,
  probs: Record<ZishiName, number>,
  answers: SurveyAnswer[]
): MonitoringResult

/**
 * 미러링 신호 추출 (core 문항 중 top1 기여 상위 2~3개)
 */
export function extractMirroringSignals(
  answers: SurveyAnswer[],
  top1Zishi: ZishiName,
  maxCount: number = 3
): MirroringSignal[]

/**
 * 전체 파이프라인 실행 (외부 진입점)
 */
export function inferZishi(answers: SurveyAnswer[]): SurveyResult
```

---

## 12. AI 프롬프트 설계 (Therapeutic Saju)

### 추가할 섹션

```
## 추론 메타 정보
- 추론 시진: ${top1_zishi} (${timeRange})
- 신뢰도: ${confidence}%
${isCusp ? `- ⚠️ 경합 시진: ${top1_zishi} vs ${top2_zishi} (차이 ${gap*100}% 미만)` : ''}

## 미러링 근거 (설문에서 추출)
${mirroringSignals.map(s =>
  `- "${s.questionText}" → "${s.selectedOptionText}"`
).join('\n')}

## 핵심 작성 지침
1. 위 미러링 근거를 인용하여, 해당 행동 패턴이 ${top1_zishi} 기운에서 비롯된 강점임을 설명할 것.
2. 단정형 절대 금지: "~입니다" (X) → "~할 가능성이 높습니다 / ~하는 경향이 있습니다" (O)
3. 어조: 분석적이되 차갑지 않은 '따뜻한 상담가(Therapist)' 톤
${isCusp ? `4. CUSP 상황: ${top1_zishi}와 ${top2_zishi}의 특성을 융합한 조건부 해석 제공` : ''}
```

---

## 13. InferredHourPillar 타입 수정 (`lib/saju/types.ts`)

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
  cuspCandidates?: [EarthlyBranch, EarthlyBranch]   // CUSP 발동 시 경합 2개
  mirroringData?: Array<{
    questionText: string
    selectedOptionText: string
  }>
}
```

---

## 14. 구현 순서 (의존성 기준)

| 순서 | 파일 | 변경 유형 | 이전 의존 |
|------|------|-----------|-----------|
| ① | `lib/survey/types.ts` | 전면 교체 | — |
| ② | `lib/survey/zishi-mapping.ts` | 신규 | ① |
| ③ | `lib/engine/types.ts` | 신규 | ① |
| ④ | `lib/engine/loader.ts` | 신규 | ③ |
| ⑤ | `lib/engine/scoring.ts` | 신규 | ①②③④ |
| ⑥ | `lib/saju/types.ts` | 부분 수정 | — |
| ⑦ | `lib/survey/weight-engine.ts` | 전면 교체 | ①②④⑤ |
| ⑧ | `lib/store.tsx` | 부분 수정 | ① |
| ⑨ | `components/survey/question-choice.tsx` | props 타입 변경 | ① |
| ⑩ | `app/survey/page.tsx` | 20문항 + choice-only | ④⑦⑨ |
| ⑪ | `lib/ai/prompts.ts` | 미러링 섹션 추가 | ⑥ |
| ⑫ | `app/api/analyze/route.ts` | mirroringData 전달 | ⑪ |

---

## 15. 검증 체크리스트

### 단위 검증

- [ ] Softmax 출력 합계 = 1.0 (±1e-10 오차 허용)
- [ ] Q5 "바로 잠들어요" 선택 시 자시 raw score -= 9.0 (1.5 × -6)
- [ ] Q6 "오전 시간대" 선택 시 인시 raw score -= 3.6 (1.2 × -3)
- [ ] 모든 점수가 0인 경우 확률 = 1/12 ≈ 0.0833 (균등 분포)
- [ ] CUSP: gap < 0.05 AND std > 0.8 → `isCusp = true`
- [ ] 미러링 신호: core 문항(Q4~Q7)만 추출되는지 확인
- [ ] role influence core: core 기여 / 전체 기여 비율 계산 정확성

### 통합 검증

- [ ] 20문항이 순서대로 렌더링되는지 확인
- [ ] 프로그레스바 1/20 → 20/20 정상 동작
- [ ] `unknown` / `approximate` / `known` 분기별 결과 생성 확인
- [ ] 결과 페이지에서 확률(%) 노출 확인
- [ ] AI 리포트 톤앤매너: 단정형 없는지 확인

---

## 16. 오픈 이슈 (결정 필요)

| # | 이슈 | 옵션 | 권장 |
|---|------|------|------|
| 1 | CUSP std 임계값 | 0.8 (스펙) vs 재보정 | 1차는 스펙 그대로, 운영 후 재보정 |
| 2 | confidence 공식 | top1_prob vs (top1-top2) | **top1_prob** (직관적) |
| 3 | approximate 반영 | 하드 마스킹 vs 소프트 prior | **소프트 prior 권장** (강한 마스킹 제품 판단 필요) |
| 4 | 질문 수 | 20문항 고정 vs 역할별 랜덤 샘플 | **20문항 고정** (MVP) |
| 5 | questions.ts 삭제 | 즉시 삭제 vs unused 유지 | **즉시 삭제** (혼란 방지) |
