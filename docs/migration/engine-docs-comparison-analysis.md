# Engine Migration 문서 비교 분석 및 판단 근거

## 1. 목적
`docs/migration/` 하위 문서들의 차이를 비교하고,
- 어떤 문서를 기준으로 삼아야 하는지,
- 왜 그런 결론을 냈는지
를 명확히 기록한다.

대상 문서:
- `engine-migration-plan.md`
- `engine-logic-migration-plan.md`
- `engine-refactor-plan.md`
- `engine-implementation-design.md`
- `engine-v41-production-design.md`

## 2. 비교 방법 (왜 이렇게 분석했는가)
문서별 서술 스타일이 달라 단순 분량 비교는 의미가 없어서, 동일한 평가 축으로 교차 비교했다.

평가 축(고정):
1. **Source of Truth 정합성**
- `engine.json`을 최우선으로 명시하는가
- 설명 문서(`engine-data-description.md`)와 충돌 시 우선순위 규칙이 있는가

2. **알고리즘 정합성**
- `question_weight × option_score` 누적을 정확히 채택하는가
- Softmax(T=1.2) 적용을 명시하는가
- CUSP 조건(gap/std)을 정확히 반영하는가

3. **데이터 계약(Interface Contract) 명확성**
- SurveyAnswer 구조가 구현 가능한 수준으로 정의되어 있는가
- 결과 객체(확률, 후보, confidence, cusp, monitoring)가 구체적인가

4. **실행 가능성(Implementation-readiness)**
- 파일 단위 변경 지시/모듈 경계/순서가 있는가
- 테스트/검증/DoD가 포함되어 있는가
- 운영 이슈(CUSP 임계값 현실성 등)를 다루는가

## 3. 비교 결과 요약

### 3.1 공통적으로 합의된 사항
모든 문서가 아래 큰 방향은 공유한다.
- 임시 12문항 폐기, `engine.json` 20문항 사용
- 점수 계산: `question_weight × score_map` 누적
- Softmax(T=1.2) 도입
- CUSP 로직 도입
- 미러링(core 기여 문항 활용) 반영

### 3.2 주요 차이점 및 충돌 지점

1. **가중치 적용 방식 충돌**
- `engine-v41-production-design.md`, `engine-implementation-design.md`, `engine-logic-migration-plan.md`:
  - 문항별 `question_weight` 직접 사용
- `engine-refactor-plan.md`:
  - `ROLE_WEIGHT_MULTIPLIER` 제안 포함

판단:
- 실제 데이터(`engine.json`)에 이미 문항별 가중치가 있으므로 role multiplier를 별도로 곱하면 중복 스케일링 위험이 생긴다.
- 따라서 문항별 `question_weight` 직접 사용이 정합성이 높다.

2. **confidence 정의 상태 차이**
- `engine-v41-production-design.md`, `engine-implementation-design.md`:
  - `confidence = top1_prob × 100`로 사실상 확정
- `engine-logic-migration-plan.md`:
  - A/B 후보(Top1 확률 vs Top1-Top2 gap)를 열어둠

판단:
- 사용자 노출용으로는 top1 확률이 가장 해석 가능성이 높고 일관성이 좋다.
- gap 기반 값은 보조 모니터링 지표로 남기는 구성이 적절하다.

3. **CUSP std 임계값 현실성 대응 수준 차이**
- `engine-implementation-design.md`, `engine-logic-migration-plan.md`, `engine-v41-production-design.md`:
  - `std > 0.8`이 softmax 분포에서 사실상 드물 수 있음을 명시
  - 운영 모니터링/재보정 필요성 언급
- `engine-migration-plan.md`:
  - 개념 설명 중심으로 현실성 이슈의 운영 대응은 상대적으로 약함

판단:
- 구현/운영 관점에서는 임계값의 실효성까지 다루는 문서가 우선된다.

4. **응답 스키마 표기 방식 차이**
- 다수 문서: `optionIndex` 저장 권장
- 일부 문서(`engine-refactor-plan.md`)는 `SurveyAnswer.value: number`로 표기

판단:
- 둘 다 본질은 같지만 `optionIndex` 명시가 계약 안정성(텍스트 변경 내성) 측면에서 더 명확하다.

## 4. 문서별 성격 평가

1. `engine-v41-production-design.md`
- 강점: Source of Truth 우선순위 규칙이 가장 명확함. 계약/엣지케이스/DoD가 간결하고 기준 문서로 적합.
- 한계: 구현 단계별 코드 지시 수준은 중간.

2. `engine-implementation-design.md`
- 강점: 구현 세부(타입, 모듈, 함수, 체크리스트)가 가장 상세함.
- 한계: 분량이 커서 기준 문서라기보다 실행 설계서 성격.

3. `engine-logic-migration-plan.md`
- 강점: 현재 코드 갭 분석과 PR 순서가 명확함.
- 한계: confidence 등 일부 의사결정이 열려 있어 최종 기준 문서로는 덜 단단함.

4. `engine-refactor-plan.md`
- 강점: 파일별 수정 제안이 구체적임.
- 한계: `ROLE_WEIGHT_MULTIPLIER` 제안이 `engine.json` 문항 가중치 체계와 충돌 가능.

5. `engine-migration-plan.md`
- 강점: 요약 문서로 빠르게 맥락 파악 가능.
- 한계: 구현 디테일/충돌 해결 규칙/테스트 명세가 상대적으로 얕음.

## 5. 최종 판단 (왜 이 결론인가)
기준 문서와 실행 문서를 분리하는 것이 가장 리스크가 낮다.

권장 조합:
1. **정책/기준(Authoritative Spec):** `engine-v41-production-design.md`
- 이유: Source of Truth 우선순위를 가장 명확히 선언하고, 문서 간 충돌 해결 규칙까지 포함함.

2. **구현 실행(Engineering Execution):** `engine-implementation-design.md`
- 이유: 모듈 구조, 타입, 함수 설계, 체크리스트가 상세해 실제 작업 착수가 쉬움.

보조 문서 처리:
- `engine-logic-migration-plan.md`, `engine-refactor-plan.md`, `engine-migration-plan.md`는 참고 문서로 유지하되,
  - `ROLE_WEIGHT_MULTIPLIER` 같은 충돌 항목,
  - confidence 미확정 표기,
  - 응답 스키마 표기 불일치
  를 기준 문서에 맞춰 정합화하는 것이 필요하다.

## 6. 정합화 권고안
1. 가중치 규칙 단일화
- 전 문서에서 “문항별 `question_weight` 직접 적용”으로 통일.

2. confidence 규칙 단일화
- UI: `top1_prob × 100`
- 내부: `top1-top2 gap` 병행 모니터링

3. 응답 스키마 단일화
- `SurveyAnswer = { questionId, optionIndex }`

4. CUSP 운영 메모 공통 반영
- `std > 0.8` 유지(스펙 준수) + 운영 데이터 기반 재보정 계획 명시

5. 문서 역할 분리 명시
- `production-design`은 규범 문서, `implementation-design`은 실행 문서로 라벨링

## 7. 결론
이번 비교는 “어떤 문서가 더 길고 자세한가”가 아니라,
- 실제 데이터(`engine.json`)와의 정합성,
- 구현 시 충돌 가능성,
- 운영 가능한 의사결정 포함 여부
를 기준으로 수행했다.

그 결과,
- 기준은 `engine-v41-production-design.md`,
- 실행은 `engine-implementation-design.md`
조합이 가장 안전하고 일관적이라는 결론에 도달했다.
