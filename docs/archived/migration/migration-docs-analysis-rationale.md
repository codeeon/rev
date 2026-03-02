# Migration Docs Comparative Analysis and Rationale

## 1. Purpose

이 문서는 `docs/migration` 내 여러 마이그레이션 문서를 비교한 결과와, 결론을 그렇게 내린 이유(판단 근거)를 명확히 기록하기 위한 분석 보고서다.

대상 문서:

- `docs/migration/engine-implementation-design.md`
- `docs/migration/engine-logic-migration-plan.md`
- `docs/archived/migration/engine-migration-plan.md`
- `docs/archived/migration/engine-refactor-plan.md`
- `docs/migration/engine-v41-production-design.md`

## 2. Analysis Method (Why this method)

문서 간 중복이 많고 표현 방식이 달라, 단순 요약 대신 "결정에 필요한 축"으로 비교했다.

비교 축:

1. Scope alignment: 질문 수/질문 타입/역할 체계
2. Algorithm alignment: `question_weight * score_map`, Softmax(T=1.2), CUSP
3. Contract quality: 타입/응답 저장 방식/결과 객체 구조
4. Integration readiness: 매핑 레이어, store/API/prompt/UI 반영 지시
5. Operability: 모니터링, 테스트, 롤아웃 계획

이 축을 선택한 이유:

- 현재 문제는 "아이디어 부족"이 아니라 "여러 문서 중 무엇을 기준으로 구현할지"의 결정 문제다.
- 따라서 설계 일관성(정합성)과 실행 가능성(구현/검증 가능)을 동시에 본다.

## 3. What is consistent across documents

아래 핵심은 5개 문서가 대체로 합의한다.

- 20문항(Q1~Q20) + choice-only 전환
- 역할 4종(`noise_reduction`, `core`, `fine_tune`, `closing`)
- 계산 파이프라인: 가중치 누적 -> Softmax(T=1.2) -> CUSP
- 미러링 방향: core 문항 기여 상위 2~3개를 리포트 근거로 사용

왜 중요했나:

- 구현 중 재논쟁을 줄이려면, 공통 합의 영역을 먼저 잠그는 게 리스크가 가장 낮다.
- 위 항목은 구현 변경량이 크고(타입/엔진/UI), 팀 내 해석 차이가 생기기 쉬운 부분이기 때문이다.

## 4. Gaps and unresolved points

### 4.1 Weight interpretation ambiguity

- `engine-migration-plan.md` 등 일부 문서는 core를 1.5로 일반화해 설명한다.
- 하지만 실제 `engine.json` 데이터는 Q4/Q5=1.5, Q6/Q7=1.2로 혼재한다.

판단:

- role 고정치보다 문항별 `question_weight`를 그대로 쓰는 것이 데이터 정합성 측면에서 맞다.

### 4.2 CUSP threshold practicality

- 문서들 모두 CUSP 조건을 `gap < 0.05` AND `std(softmax probs) > 0.8`로 둔다.
- 다수 문서가 이 조건이 운영에서 거의 미발동일 가능성을 직접 언급한다.

판단:

- 스펙 우선으로 1차 구현은 유지하되, `std_softmax`와 `std_raw_score`를 함께 관측해야 한다.
- 즉, "즉시 변경"보다 "측정 후 보정"이 안전하다.

### 4.3 Implementation detail coverage differs

- `engine-implementation-design.md`와 `engine-refactor-plan.md`는 구현 상세(함수/테스트/파일별 영향)가 풍부하다.
- `engine-migration-plan.md`는 개요 문서로, 테스트/상세 계약/검증 항목이 상대적으로 약하다.

판단:

- 개요 문서를 기준 문서로 삼으면 실제 구현 단계에서 해석 차이가 생긴다.

### 4.4 Store/API prompt detail variance

- 일부 문서는 `optionIndex` 저장 방식, 결과 객체, 프롬프트 미러링 증거 구조를 명시한다.
- 일부 문서는 동일 방향만 제시하고 계약 수준 정의가 약하다.

판단:

- 실제 마이그레이션 성공 여부는 데이터 계약(입력/출력)이 결정한다.
- 따라서 계약이 명시된 문서를 기준으로 삼아야 한다.

## 5. Recommended baseline and why

권장 기준 문서: `docs/migration/engine-v41-production-design.md`

선정 이유:

1. Source of Truth 우선순위를 명시한다 (`engine.json` 우선).
2. 문항별 가중치 혼재(1.5/1.2)를 명시해 데이터 정합성이 높다.
3. 계약 중심 구조(Data/Result/Monitoring/Edge cases/DoD)가 구현 검증에 바로 연결된다.
4. 추상적 선언보다 운영 전환에 필요한 체크 항목을 갖췄다.

보완 소스(병행 참조):

- 구현 체크리스트/테스트 깊이: `docs/migration/engine-implementation-design.md`
- 파일 단위 변경 경로: `docs/archived/migration/engine-refactor-plan.md`
- PR 단위 진행 플랜: `docs/migration/engine-logic-migration-plan.md`

## 6. Consolidation strategy

중복 문서가 많아 실행 중 기준 흔들림이 생길 수 있으므로, 아래처럼 정리하는 것을 권장한다.

1. Canonical: `engine-v41-production-design.md`
2. Implementation Guide: `engine-implementation-design.md` + `engine-refactor-plan.md` 중복 통합
3. Rollout Guide: `engine-logic-migration-plan.md`의 PR 전략 유지
4. Legacy overview: `engine-migration-plan.md`는 deprecate 또는 요약 링크화

## 7. Decision log (Why these conclusions are credible)

- 근거는 모두 `docs/migration` 내 문서와 `docs/data/engine.json`의 명시 내용에서 추출했다.
- "어느 문서가 더 길다"가 아니라, "데이터 정합성 + 계약 명확성 + 실행 가능성"을 기준으로 평가했다.
- 특히 구현 실패를 가장 많이 만드는 지점(가중치 해석, 응답 저장 방식, 매핑 레이어, CUSP 운영성)을 우선 검토했다.

결론:

- 문서들 사이에 방향 충돌은 크지 않지만, 디테일 수준 차이로 인해 구현 중 해석 분기가 발생할 여지가 있다.
- 따라서 단일 기준 문서를 고정하고, 나머지 문서는 역할 기반(구현/롤아웃/참고)으로 재분류하는 것이 가장 실용적이다.
