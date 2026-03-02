# Reverse Saju Engine v4.1 Production Design

## 1) Goal

현재 코드의 임시 질문/계산 로직을 폐기하고, `docs/data/engine.json` + `docs/archived/prd/engine-data-description.md`를 단일 기준(Source of Truth)으로 사용하는 실서비스용 추론 설계를 확정한다.

- 기준 데이터: `docs/data/engine.json` (v4.1)
- 기준 철학: 가중치 누적 -> Softmax(T=1.2) -> CUSP 판정
- 서비스 목적: 점술 단정이 아닌 확률 기반 + Therapeutic Mirroring

## 2) Source of Truth and Priority Rules

1. 질문/옵션/점수/역할/가중치의 최종 기준은 `engine.json`이다.
2. 문서 간 문구가 다를 때는 `engine.json` 수치를 우선한다.
3. `engine-data-description.md`는 톤/운영 원칙(미러링, 표현 가이드, UX 원칙)을 보강하는 정책 문서로 사용한다.

Notes:

- `engine-data-description.md`에는 `core=1.5`로 설명되어 있으나, 실제 데이터(`engine.json`)에서 core 문항은 `1.5`(Q4,Q5)와 `1.2`(Q6,Q7)가 혼재한다.
- 따라서 role 기반 고정 가중치가 아니라 문항별 `question_weight`를 그대로 적용한다.

## 3) Production Question Set (20)

실사용 질문은 아래 20개를 그대로 사용한다.

### 3.1 noise_reduction (3)

- Q1 (0.8): 아침에 눈을 떴을 때, 나의 모습은?
- Q2 (0.8): 커피(카페인)가 가장 간절하게 당기는 순간은?
- Q3 (0.8): 밥 먹고 나서 특히 졸음이 쏟아지는 때가 있다면?

### 3.2 core (4)

- Q4 (1.5): 머리가 가장 또렷해지고 '나답다'고 느껴지는 시간은?
- Q5 (1.5): 밤 11시 이후, 나의 에너지는 보통 어떤가요?
- Q6 (1.2): 유독 기운이 안 붙고 몸이 무겁게 느껴지는 때는?
- Q7 (1.2): 몸이 먼저 '잠깐 멈춰, 쉬어야 해'라고 신호를 보내는 시간은?

### 3.3 fine_tune (10)

- Q8 (1.0): 나도 모르게 마음이 조금 '뾰족'해지거나 예민해지는 시간은?
- Q9 (1.2): 나는 계절의 변화를 어디서 가장 먼저 느끼나요?
- Q10 (1.0): 큰 프로젝트나 일을 끝냈을 때, 나는 보통...
- Q11 (1.0): 실패를 겪었을 때, 다시 일어서는 나의 속도는?
- Q12 (1.2): 예상치 못한 돌발 상황이 생기면, 나의 첫 번째 반응은?
- Q13 (1.0): 갈등이 생기면, 나를 지키기 위해 선택하는 방식은?
- Q14 (1.0): 나보다 어린 사람이나 후배를 대할 때 나는?
- Q15 (1.2): 혼자 가만히 있을 때, 생각은 주로 어디로 흘러가나요?
- Q16 (1.2): 남들은 잘 모르지만, 내 안에 자리 잡은 단단한 힘은?
- Q17 (1.2): 지금까지 살아오면서 반복된 특징이 있다면?

### 3.4 closing (3)

- Q18 (1.0): 내가 꿈꾸는 삶의 방향은 어떤 모습인가요?
- Q19 (1.0): 나의 '인생 전성기'는 언제일 것 같나요?
- Q20 (1.0): 나를 가장 잘 설명하는 문장은?

## 4) Data Contract

질문 데이터는 `engine.json.questions[]`를 런타임 로드해 사용한다.

```ts
type ZishiKr =
  | '자시' | '축시' | '인시' | '묘시' | '진시' | '사시'
  | '오시' | '미시' | '신시' | '유시' | '술시' | '해시'

type StructureRole = 'noise_reduction' | 'core' | 'fine_tune' | 'closing'

interface EngineOption {
  text: string
  score_map: Partial<Record<ZishiKr, number>>
}

interface EngineQuestion {
  id: string
  structure_role: StructureRole
  category: string
  question_weight: number
  text: string
  options: EngineOption[]
}

interface SurveyAnswer {
  questionId: string
  optionIndex: number
}
```

핵심 변경점:

- 기존 `value: string | number` 응답 저장 대신 `optionIndex` 기반 저장 권장
- 사본 하드코딩(`lib/survey/questions.ts`) 제거, JSON 단일 소스 사용

## 5) Scoring Algorithm

## 5.1 Stage 1: Weighted Accumulation

12시진 각각에 대해 누적 점수를 계산한다.

`score[z] += question_weight * option.score_map[z]`

- 점수가 없는 시진 키는 0으로 처리
- 음수 점수(Soft-Elimination) 허용

## 5.2 Stage 2: Softmax Probability

`P(z) = exp(score[z] / T) / sum(exp(score[k] / T))`, `T = 1.2`

안정성 구현 규칙:

- numerical stability를 위해 `shift = max(score/T)`를 빼고 `exp((score/T)-shift)` 사용
- 모든 확률 합은 부동소수 오차 범위 내에서 1.0이어야 함

## 5.3 Stage 3: CUSP Logic

`engine.json` 기준 조건:

- `gap = top1Prob - top2Prob < 0.05`
- `std(12 softmax probs) > 0.8`

운영 메모:

- softmax 확률의 표준편차가 일반적으로 낮기 때문에(`0.8`은 매우 큰 문턱), CUSP가 거의 발동되지 않을 수 있다.
- 본 값은 임의 변경하지 않고 우선 모니터링 대상으로 유지한다.

## 6) Mapping Layer (KR Zishi -> Branch)

엔진 점수 키(한글 시진)와 사주 계산 키(한자 지지)를 명시적으로 변환한다.

| Zishi KR | Earthly Branch |
| --- | --- |
| 자시 | 子 |
| 축시 | 丑 |
| 인시 | 寅 |
| 묘시 | 卯 |
| 진시 | 辰 |
| 사시 | 巳 |
| 오시 | 午 |
| 미시 | 未 |
| 신시 | 申 |
| 유시 | 酉 |
| 술시 | 戌 |
| 해시 | 亥 |

이 변환 레이어 없이 엔진 결과를 `analyzeSaju`에 연결하면 시주 추론 연계가 깨진다.

## 7) Result Contract

```ts
interface InferenceResult {
  rawScores: Record<ZishiKr, number>
  probabilities: Record<ZishiKr, number>
  topCandidates: Array<{ zishi: ZishiKr; probability: number; score: number }>
  inferredZishi: ZishiKr
  confidence: number // top1 probability * 100 (rounded)
  gapTop1Top2: number
  cusp: {
    isCusp: boolean
    gap: number
    stdSoftmax: number
    candidateA: ZishiKr
    candidateB: ZishiKr
  }
  monitoring: {
    roleInfluence: Record<StructureRole, number>
    zishiMaxDiff: number
    alerts: string[]
  }
}
```

## 8) Monitoring and Guardrails

`engine_settings`를 그대로 반영한다.

- `alert_if_zishi_max_diff_over = 8`
- `alert_if_role_influence_over = 0.65`
- `target_top1_band = [0.5, 0.65]`

권장 로그 항목:

- `top1_prob`, `top2_prob`, `gap`, `std_softmax`
- `role_influence_core`, `role_influence_noise_reduction`, `role_influence_fine_tune`, `role_influence_closing`
- `cusp_is_triggered`, `alerts[]`

## 9) Therapeutic Mirroring Design (Report Input)

AI 리포트에는 전체 설문 원문을 덤프하지 말고, 아래 증거만 전달한다.

1. core 문항(Q4~Q7) 중 점수 변동 기여도가 큰 2~3개 선택
2. 각 문항에서 사용자 선택 옵션 텍스트와 영향 시진(score delta) 함께 전달
3. 표현 원칙:
   - 금지: "당신은 ~입니다"
   - 사용: "~할 확률이 높습니다", "~하는 경향을 보입니다"

예시 전달 구조:

```ts
interface MirroringEvidence {
  questionId: string
  questionText: string
  selectedOptionText: string
  impactedZishi: Array<{ zishi: ZishiKr; weightedDelta: number }>
}
```

## 10) Edge Cases

- 빈 `score_map` 옵션 선택 시 해당 문항 기여도는 0
- 음수 누적이 커도 softmax는 정상 동작해야 함
- 동률 발생 시 deterministic tie-breaker 필요 (zishi_list 순서)
- 질문 개수/ID/옵션 인덱스 검증 실패 시 즉시 에러 처리

## 11) Definition of Done (Doc-Level)

- 질문 세트가 정확히 20개(Q1~Q20)로 명시됨
- 수식이 `question_weight x option_score -> softmax(T=1.2)`로 확정됨
- CUSP 조건이 데이터 기준으로 명시됨
- KR/Hanja 매핑 레이어가 명시됨
- 미러링 근거 추출 규칙(core 2~3개)이 명시됨
- 모니터링 지표와 guardrail 임계치가 명시됨
