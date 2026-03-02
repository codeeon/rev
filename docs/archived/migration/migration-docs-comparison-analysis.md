# docs/migration 문서 비교 분석 및 판단 근거

작성일: 2026-02-28  
대상 문서:
- `engine-migration-plan.md`
- `engine-logic-migration-plan.md`
- `engine-refactor-plan.md`
- `engine-implementation-design.md`
- `engine-v41-production-design.md`

## 1. 비교 분석 요약

### 1.1 문서별 성격

1. `engine-migration-plan.md`
- 가장 짧은 상위 계획 문서.
- 방향성과 단계 순서 중심.
- 구현 계약/예외/테스트 상세는 적음.

2. `engine-logic-migration-plan.md`
- 전환 범위, 아키텍처, PR 단위 구현 순서, 테스트, 오픈 이슈까지 포함한 실무 계획서.
- 설계 의도와 현재 코드 갭을 설명하는 문서.

3. `engine-refactor-plan.md`
- 파일 단위 수정 지시가 강한 리팩터링 실행 문서.
- 실제 변경 파일과 diff 성격 제안이 많음.

4. `engine-implementation-design.md`
- 가장 상세한 구현 설계서.
- 타입, 모듈 구조, 수도코드, 체크리스트, 오픈 이슈까지 포괄.

5. `engine-v41-production-design.md`
- 운영 기준(Production 기준)을 간결하게 고정한 기준 문서.
- Source of Truth 우선순위와 수치/계약을 명확히 선언.

### 1.2 공통 합의(대체로 일치)

- 임시 12문항 로직 폐기, `engine.json` 기반 20문항 전환.
- 계산식: `question_weight × option.score_map` 누적 후 Softmax(`T=1.2`).
- CUSP 조건: `gap < 0.05` and `std(softmax) > 0.8`.
- 미러링 근거: core 문항(Q4~Q7) 중심 2~3개 추출.
- 한글 시진명과 한자 지지 간 매핑 레이어 필요.

### 1.3 차이/충돌 포인트

1. confidence 정의 상태 불일치
- `engine-v41-production-design.md`, `engine-implementation-design.md`: `top1_prob * 100` 채택 방향이 명확.
- `engine-logic-migration-plan.md`: A/B 후보(Top1 확률 vs Top1-Top2 gap)로 열어둠.

2. 응답 필드 명칭 불일치
- 일부 문서는 `optionIndex`.
- 일부 문서는 `value: number`(의미는 option index).
- 의미는 같지만 타입 계약 이름이 달라 구현 혼선 가능.

3. 가중치 해석 방식 표현 차이
- 다수 문서는 문항별 `question_weight` 직접 적용을 강조.
- `engine-refactor-plan.md`에는 role multiplier 표현이 포함되어 해석 혼선 가능.

4. 문서 레벨 차이
- `engine-migration-plan.md`는 요약 계획서라 계약/예외/검증 상세가 적음.
- 세부 구현 기준으로 단독 사용 시 누락 가능성이 있음.

### 1.4 실무 기준 권장

- 정책/운영 기준 문서: `engine-v41-production-design.md`
- 구현 상세 기준 문서: `engine-implementation-design.md`
- 나머지 문서는 보조 계획/이력 문서로 참조.
- 후속 정리 권장:
1. confidence 공식 단일화
2. `optionIndex`로 응답 필드명 통일
3. role multiplier vs question_weight 해석 문구 정리

## 2. 왜 이렇게 분석했는가 (판단 방법)

아래 순서로 검증했다.

1. 구조 비교(문서 역할 분류)
- 각 파일의 길이(line 수)와 헤더 구조(`#`, `##`, `###`)를 먼저 확인.
- 목적 문서(Production 기준/Implementation 설계/Migration 계획/Refactor 실행)를 분리해 역할을 판단.

2. 핵심 키워드 교차 검색(합의/불일치 탐지)
- `softmax`, `T=1.2`, `cusp`, `confidence`, `question_weight`, `mirroring`, `mapping` 등을 전 문서에서 검색.
- 동일 수식/조건 반복 여부로 공통 합의를 확인.
- 같은 항목이 다른 표현으로 등장하는 지점을 후보 충돌로 추출.

3. 원문 정독으로 충돌 확정
- 키워드만으로 판단하지 않고 해당 문맥 단락을 직접 읽어 의미 차이를 확인.
- 예: confidence는 어떤 문서는 “채택”, 어떤 문서는 “후보안”으로 기술되어 상태가 다름.

4. 기준 문서 우선순위 반영
- `engine-v41-production-design.md`의 Source of Truth/priority 규칙을 기준으로, 운영 기준 문서와 구현 문서를 분리해 추천.

## 3. 결론

현재 `docs/migration/` 문서군은 큰 방향과 수식은 거의 정렬되어 있다.  
다만 confidence 공식, 응답 필드 명칭, 가중치 표현 방식에서 문서 간 상태가 완전히 합쳐지지 않았다.  
운영 기준은 `engine-v41-production-design.md`, 구현 기준은 `engine-implementation-design.md`로 삼고, 나머지는 보조 문서로 관리하는 구성이 가장 안전하다.
