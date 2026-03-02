# Migration 문서 비교 분석

> **작성 목적**: `docs/migration/` 내 5개 문서의 내용 차이를 분석하고, 구현 시 어느 문서의 어느 부분을 기준으로 삼아야 하는지 판단 근거를 기록한다.
> **분석 기준일**: 2026-03-01

---

## 1. 문서 목록 및 성격

| 파일명                            | 성격                                | 작성 스타일       | 작성 도구/모델                      |
| --------------------------------- | ----------------------------------- | ----------------- | ----------------------------------- |
| `engine-v41-production-design.md` | 확정 스펙 / Source of Truth         | 간결한 계약서     | Oh-My-OpenCode - GPT 5.3 Codex      |
| `engine-migration-plan.md`        | 초기 마이그레이션 개요              | 서술형            | Gemini CLI - Gemini 3.1 Pro Preview |
| `engine-logic-migration-plan.md`  | PR 단위 실행 계획 (Codex)           | 체크리스트형      | Codex CLI - GPT 5.3 Codex           |
| `engine-refactor-plan.md`         | 파일별 코드 diff 계획 (Claude Opus) | diff 코드 포함    | Antigravity - Claude Opus 4.6       |
| `engine-implementation-design.md` | 종합 구현 설계서 (Claude Opus)      | 테이블 + 수도코드 | Claude Code - Claude Opus 4.6       |

---

## 2. 항목별 비교 및 분석 근거

### 2.1 가중치 계산 방식 — 가장 중요한 차이

#### 현황

`engine-migration-plan.md`와 `engine-refactor-plan.md`는 role별 고정 가중치 상수를 제안한다.

```typescript
// engine-refactor-plan.md 제안 (❌ 잘못된 방식)
export const ROLE_WEIGHT_MULTIPLIER: Record<string, number> = {
  noise_reduction: 0.8,
  core: 1.5, // ← 문제
  fine_tune: 1.2,
  closing: 1.0,
};
```

`engine-v41-production-design.md`는 이를 명시적으로 반박한다.

> "engine-data-description.md에는 core=1.5로 설명되어 있으나, 실제 데이터(engine.json)에서 core 문항은 1.5(Q4,Q5)와 1.2(Q6,Q7)가 혼재한다. 따라서 role 기반 고정 가중치가 아니라 문항별 question_weight를 그대로 적용한다."

#### 분석 근거

`engine.json`을 직접 확인하면:

```json
{ "id": "Q4", "structure_role": "core", "question_weight": 1.5 }
{ "id": "Q5", "structure_role": "core", "question_weight": 1.5 }
{ "id": "Q6", "structure_role": "core", "question_weight": 1.2 }  ← core인데 1.5가 아님
{ "id": "Q7", "structure_role": "core", "question_weight": 1.2 }  ← core인데 1.5가 아님
```

`engine-data-description.md`의 "core = 1.5" 설명은 대표값이지, 모든 core 문항에 적용되는 고정값이 아니다. `engine-refactor-plan.md`의 `ROLE_WEIGHT_MULTIPLIER`를 그대로 코드로 옮기면 Q6/Q7의 가중치가 실제보다 25% 크게(1.2 → 1.5) 적용되는 버그가 발생한다.

#### 결론

**`question_weight`는 JSON에서 문항별로 직접 읽어야 한다.** `ROLE_WEIGHT_MULTIPLIER` 상수 방식은 폐기.

---

### 2.2 `SurveyAnswer` 필드명

#### 현황

| 문서                      | 제안                                            |
| ------------------------- | ----------------------------------------------- |
| `engine-refactor-plan.md` | `value: number` (기존 필드명 유지, 타입만 교체) |
| 나머지 4개 문서           | `optionIndex: number` (필드명 변경)             |

#### 분석 근거

두 방식 모두 "선택한 옵션의 인덱스를 저장"한다는 목적은 동일하다. 차이는 명명에 있다.

- `value`를 유지하는 이유(Opus 입장): 기존 `SurveyAnswer` 인터페이스와 호환성을 일부 유지. 리팩토링 범위 축소.
- `optionIndex`를 쓰는 이유(나머지 문서 입장): **의미가 명확하다.** `value: string | number`였던 기존 필드와 동일한 이름을 쓰면, 코드 리뷰 시 "이 value는 인덱스인가, 옵션 텍스트인가"라는 혼란이 생긴다.

`engine-v41-production-design.md`의 인터페이스 정의:

```typescript
interface SurveyAnswer {
  questionId: string;
  optionIndex: number; // 명확한 의도 표현
}
```

4:1로 `optionIndex`가 다수이며, 의미 전달 면에서도 우위다.

#### 결론

**`optionIndex: number`를 사용한다.**

---

### 2.3 모듈 구조 (`lib/engine/` vs `lib/survey/` 내부 파일)

#### 현황

| 문서                              | 구조                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `engine-logic-migration-plan.md`  | `lib/engine/types.ts`, `loader.ts`, `scoring.ts`, `mirroring.ts`              |
| `engine-refactor-plan.md`         | `lib/survey/engine-data.ts` 신규 (lib/engine/ 디렉토리 없음)                  |
| `engine-implementation-design.md` | `lib/engine/types.ts`, `loader.ts`, `scoring.ts` (mirroring은 scoring에 통합) |

#### 분석 근거

**`lib/survey/` 내부 파일로 두는 경우 (Opus 방식)**

- 장점: 기존 `lib/survey/` 구조를 건드리지 않고 파일 추가만으로 해결. 변경 범위가 작다.
- 단점: `engine-data.ts`라는 이름이 설문(survey) 레이어와 혼재한다. 향후 엔진을 독립 패키지로 분리하거나 테스트를 분리할 때 경계가 불명확하다.

**`lib/engine/` 별도 디렉토리 (Codex, Sonnet 방식)**

- 장점: 순수 계산 로직(engine)과 UI 연결 레이어(survey)가 명확히 분리된다. `lib/engine/scoring.ts`는 순수 함수 모음이므로 단독 테스트가 쉽다.
- 단점: 새 디렉토리 생성 필요. 약간의 import 경로 변경.

엔진 로직은 UI에 의존하지 않아야 한다. `lib/engine/`을 독립 레이어로 두면 나중에 `lib/survey/`가 변경되어도 엔진 계산 코드를 건드리지 않아도 된다. 관심사 분리 원칙상 `lib/engine/` 분리가 옳다.

**`mirroring.ts` 별도 분리 여부**

Codex는 `mirroring.ts`를 별도 파일로 제안했다. 현재 미러링 로직은 "core 문항 필터 → 기여도 정렬 → 상위 추출"의 3단계로 단순하다. 별도 파일로 둘 만큼 복잡하지 않으므로 `scoring.ts`에 통합해도 충분하다.

#### 결론

**`lib/engine/types.ts`, `loader.ts`, `scoring.ts` 3파일 구조로 간다.** `mirroring`은 `scoring.ts` 내 함수로 통합.

---

### 2.4 모니터링 `roleInfluence` 추적 범위

#### 현황

| 문서                              | 추적 방식                                                      |
| --------------------------------- | -------------------------------------------------------------- |
| `engine-v41-production-design.md` | `roleInfluence: Record<StructureRole, number>` (4개 역할 전체) |
| `engine-logic-migration-plan.md`  | `role_influence_core` (core만)                                 |
| `engine-implementation-design.md` | `roleInfluenceCore: number` (core만)                           |

#### 분석 근거

`engine-data-description.md`의 가드레일 목적은 "특정 질문군(Core)의 영향력이 전체의 65%를 넘지 않도록" 한다. 경고 임계값도 core에만 정의되어 있다(`alert_if_role_influence_over: 0.65`).

그러나 **4개 역할 전체를 추적하는 것이 더 가치 있다.** 이유:

1. 운영 중 분포를 모니터링할 때, core뿐 아니라 noise_reduction이 과도하게 기여하는 케이스를 발견할 수 있다.
2. 추후 fine_tune 가중치 재조정 판단 시 근거 데이터가 된다.
3. 계산 비용 차이가 없다. 어차피 모든 답변을 순회하는 과정에서 역할별 기여를 집계하는 것은 추가 루프 없이 가능하다.

#### 결론

**`roleInfluence: Record<StructureRole, number>` 방식으로 4개 역할 전체를 추적한다.** 경고 플래그는 core 기준만 발동하되, 전체 데이터는 로그에 남긴다.

---

### 2.5 미러링 신호 구조 (`MirroringEvidence` / `MirroringSignal`)

#### 현황

| 문서                              | 구조                                                                  |
| --------------------------------- | --------------------------------------------------------------------- |
| `engine-v41-production-design.md` | `impactedZishi: Array<{ zishi, weightedDelta }>` — 영향받은 모든 시진 |
| `engine-refactor-plan.md`         | `impactScore: number` — top1 기여 점수 단일 값                        |
| `engine-implementation-design.md` | `impactScore: number, targetZishi` — top1 기여 단일 값                |

#### 분석 근거

`impactScore: number` (단일 값) 방식은 "이 문항이 top1 시진에 얼마나 기여했는가"만 표현한다.

`impactedZishi: Array<{ zishi, weightedDelta }>` 방식은 해당 옵션이 어떤 시진을 올리고 어떤 시진을 낮췄는지 전체 그림을 표현한다. 예시:

```
Q5 "오히려 또렷해지고 살아나요" 선택 시:
  → 자시: +4.5  (1.5 × 3)
  → 해시: +3.0  (1.5 × 2)
  → 오시: -4.5  (1.5 × -3)   ← 단일 값 방식으로는 표현 불가
  → 미시: -4.5  (1.5 × -3)   ← 단일 값 방식으로는 표현 불가
```

AI 미러링 프롬프트에서 "당신이 오전에 힘들다고 느끼는 이유도 자시 기운과 연결된다"는 식의 음수 기여 시진에 대한 설명도 가능하게 하려면 전체 impactedZishi 배열이 필요하다.

다만 MVP 단계에서는 AI 프롬프트 복잡도를 낮추기 위해 단일 값 방식으로 시작하고, 이후 리포트 품질 개선 단계에서 배열 방식으로 전환하는 것이 현실적이다.

#### 결론

**1차 구현은 `impactScore + targetZishi` 단일 값**으로 시작. 구조는 배열 확장이 쉽도록 `impactedZishi: Array<...>` 방식을 염두에 두고 타입을 설계해두되, 실제 AI 프롬프트 주입은 top1 기여만 사용한다.

---

### 2.6 CUSP `std_scope` 실용성 문제

#### 현황

모든 문서가 동일하게 지적하고 있다:

> softmax 확률의 표준편차는 일반적으로 0.05~0.15 수준이므로, `min_score_std = 0.8`은 현실적으로 발동이 불가능에 가깝다.

#### 분석 근거

12시진의 softmax 확률 합은 항상 1이다. 따라서 평균은 항상 `1/12 ≈ 0.083`이다. 표준편차가 0.8이 되려면 특정 시진에 확률이 거의 1로 몰리고 나머지가 0에 수렴해야 하는데, 그 경우 gap도 매우 크기 때문에 조건 A(`gap < 0.05`)를 동시에 만족하는 것이 수학적으로 불가능에 가깝다.

즉, **현재 CUSP 조건은 AND 조건의 두 항목이 서로 상충한다.** 조건 A가 만족될 만큼 확률이 비슷하게 분포되어 있으면, std는 낮다. std가 0.8을 넘을 만큼 확률이 한쪽으로 쏠리면, gap은 크다.

`engine-logic-migration-plan.md`(Codex)는 `std_raw_score`(원시 점수 표준편차)를 병행 기록할 것을 제안했다. 원시 점수의 std는 softmax 변환 전이므로 범위가 더 넓고, 이 값이 실용적인 CUSP 판단 기준이 될 수 있다.

#### 결론

**1차 구현은 스펙 그대로 (`std_softmax > 0.8`) 적용**. 동시에 `std_softmax`와 `std_raw_score`를 모두 모니터링 객체에 기록한다. 실서비스 100건 이상 데이터 수집 후 임계값을 `std_raw_score` 기반으로 재정의한다.

---

### 2.7 각 문서의 고유 기여

각 문서가 다른 문서에 없는 내용을 독자적으로 제공하고 있다. 구현 시 참조해야 할 항목만 정리한다.

#### `engine-v41-production-design.md` 고유 기여

- **Source of Truth 우선순위 규칙**: 문서 간 충돌 시 `engine.json` 수치를 최우선. `engine-data-description.md`는 정책/톤 문서로 보조적 역할.
- **동률 tie-breaker**: "동률 발생 시 `zishi_list` 순서에 따라 deterministic하게 결정"이라는 엣지케이스 처리 규칙. 다른 문서에 없다.
- **빈 `score_map` 처리**: 빈 score_map 옵션 선택 시 해당 문항 기여도는 0. 명시적 처리 필요.
- **문서 수준 완료 기준(DoD)**: 코드가 아닌 문서 자체의 완료 기준 6개 항목.

#### `engine-logic-migration-plan.md` (Codex) 고유 기여

- **approximate range 처리 방안**: 사용자가 "대략적 시간대"를 알 경우, 해당 범위 외 시진에 소프트 패널티를 주거나 사후 정규화하는 prior 방식 제안. 다른 문서에 없다.
- **PR 단위 분리**: PR1(순수 엔진) → PR2(UI) → PR3(결과) → PR4(프롬프트) → PR5(모니터링). 단계별 검증이 가능한 커밋 전략.
- **통합 테스트 3케이스**: unknown/approximate/known 분기 각각에 대한 e2e 시나리오.

#### `engine-refactor-plan.md` (Claude Opus) 고유 기여

- **실제 diff 코드**: 기존 파일에서 어떤 줄을 지우고 어떤 줄을 추가하는지 diff 형식으로 제공. 구현 직전 참고용.
- **Mermaid 데이터 흐름 다이어그램**: 현재 임시 로직과 새 스펙의 파이프라인을 시각적으로 비교.
- **설문 컴포넌트 변경 상세**: `QuestionChoice` props 타입 변경, `QuestionYN`/`QuestionScale` 삭제 가이드.

#### `engine-implementation-design.md` (Claude Sonnet, 이번 세션) 고유 기여

- **`ZISHI_TIME_RANGE`**: 시진별 실제 시간대(23:00~01:00 등) 매핑 테이블. UI 표시용.
- **질문별 선택지 수 + 타겟 시진 요약표**: 20문항 각각의 선택지 수와 주요 시진을 한눈에 파악 가능.
- **검증 체크리스트**: 구현 후 수동으로 확인해야 할 수치 기반 체크리스트 (예: "Q5 '바로 잠들어요' → 자시 raw score -9.0").

---

## 3. 문서 간 충돌 해소 결정표

구현 시 판단 기준이 필요한 항목을 최종 결정한다.

| #   | 충돌 항목               | 선택 기준             | 채택 결정                                         | 근거 요약                                                         |
| --- | ----------------------- | --------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | 가중치 적용 방식        | engine.json 수치 우선 | **문항별 `question_weight` 직접 사용**            | Q6/Q7이 core이지만 weight=1.2. ROLE_WEIGHT_MULTIPLIER는 버그 유발 |
| 2   | SurveyAnswer 필드명     | 다수결 + 명확성       | **`optionIndex: number`**                         | 4:1 다수, `value`보다 의미 명확                                   |
| 3   | 모듈 구조               | 관심사 분리 원칙      | **`lib/engine/` 별도 디렉토리**                   | 순수 계산 코드와 UI 레이어 분리                                   |
| 4   | mirroring 별도 파일     | 복잡도 비례 원칙      | **`scoring.ts`에 통합**                           | 현재 로직이 단순, 별도 파일 불필요                                |
| 5   | roleInfluence 추적 범위 | 데이터 완전성         | **`Record<StructureRole, number>` 4개 전체**      | 비용 동일, 운영 인사이트 확대                                     |
| 6   | 미러링 신호 구조        | MVP 단계적 접근       | **1차: `impactScore` 단일 값**                    | 단계적 확장 전제로 시작                                           |
| 7   | CUSP std 임계값         | 스펙 준수 + 모니터링  | **스펙 그대로 0.8, 단 `std_raw_score` 병행 기록** | 실데이터 수집 후 재보정                                           |
| 8   | confidence 공식         | 직관성                | **`top1_prob × 100`**                             | 모든 문서 동의                                                    |
| 9   | questions.ts 삭제       | 코드 명확성           | **즉시 삭제**                                     | unused 잔존이 더 혼란 초래                                        |
| 10  | approximate range       | 제품 판단 필요        | **MVP에서는 미반영, 저장만**                      | 소프트 prior 방식은 후속 기능으로                                 |

---

## 4. 최종 기준 문서 지위

```
[최우선]  engine-v41-production-design.md
              ↓ 수치/계약 우선
[실행 참고]  engine-logic-migration-plan.md   (PR 순서, 테스트 계획)
              engine-implementation-design.md  (타입 정의, 함수 명세)
              engine-refactor-plan.md          (파일별 diff, 단 ROLE_WEIGHT_MULTIPLIER 제외)
[참고만]    engine-migration-plan.md           (초기 개요, 이미 위 문서들로 대체됨)
```

---

## 5. 남은 오픈 이슈 (코드 구현 전 결정 필요)

아래 두 항목은 제품 판단이 필요하므로 이 문서에서 결정하지 않는다.

| #   | 이슈                        | 선택지                         | 영향                     |
| --- | --------------------------- | ------------------------------ | ------------------------ |
| A   | approximate range 반영 강도 | 미반영(저장만) vs 소프트 prior | 추론 정확도, 구현 복잡도 |
| B   | 질문 수 고정 여부           | 20문항 고정 vs 역할별 샘플링   | UX 길이, 엔진 분산       |

현재 권장: **MVP는 두 항목 모두 단순한 쪽(미반영, 20문항 고정)으로 확정 후 진행.**
