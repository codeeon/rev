# Docs Plan Index

## 목적

`docs` 내 엔진 관련 계획 문서를 기준으로, 실행 우선순위와 중요도를 한눈에 보기 위한 인덱스다.

평가 기준:

- **우선순위(Priority)**: 지금 당장 실행에 필요한 순서
- **중요도(Importance)**: 잘못 해석되면 제품/운영 리스크가 큰 정도

## 실행 우선순위 요약

1. 기준 설계 확정 (Canonical)
2. 구현 실행 계획
3. 보조 참고 문서로 리스크 점검

## Status Legend

- `Done`: 반영 완료(또는 목적 달성)
- `In Progress`: 일부 반영, 후속 작업 필요
- `Planned`: 아직 구현 전, 계획 단계
- `Reference`: 참고용(보조 문서)

## Plan Table

| Priority | Importance | Status | 문서 | 역할 | 사용 시점 |
| --- | --- | --- | --- | --- | --- |
| P0 | Critical | Done | `docs/migration/engine-v41-production-design.md` | **기준 설계(Canonical)**: 데이터/수식/계약/DoD 기준 | 모든 구현/리뷰 시작 전 |
| P1 | High | In Progress | `docs/implementation-plan.md` | 현재 코드 기준 실행 플랜(Phase 단위) | 실제 작업 착수 시 즉시 |
| P1 | High | In Progress | `docs/migration/engine-implementation-design.md` | 상세 구현 사양(타입, 함수, 검증 체크) | 구현 중 세부 의사결정 시 |
| P3 | Medium | Reference | `docs/migration/engine-logic-migration-plan.md` | PR 단위 전환 계획/테스트 관점 보강 | 병렬 리뷰/리스크 점검 시 |

## 권장 읽기 순서

1. `docs/migration/engine-v41-production-design.md`
2. `docs/implementation-plan.md`
3. `docs/migration/engine-implementation-design.md`
4. `docs/migration/engine-logic-migration-plan.md`

운영/연동 문서(마이그레이션 직접 범위 외):

- `docs/operations/integration/spreadsheet-admin-integration-principles.md`
- `docs/operations/tuning/engine-tuning-next-actions-plan.md`
- `docs/operations/tuning/engine-parameter-tuning-playbook.md`

아카이브 문서(참고 이력):

- `docs/archived/prd/engine-data-description.md`
- `docs/archived/migration/engine-refactor-plan.md`
- `docs/archived/migration/engine-migration-plan.md`
- `docs/archived/migration/document-comparison-analysis.md`
- `docs/archived/migration/engine-docs-comparison-analysis.md`
- `docs/archived/migration/migration-docs-analysis-rationale.md`
- `docs/archived/migration/migration-docs-comparison-analysis.md`

## 운영 메모

- 충돌 시 기준: **항상 `engine-v41-production-design.md` 우선**
- 구현 진행 관리: `implementation-plan.md`의 Phase 단위로 추적
- 운영 전환(시트 연동)과 파라미터 튜닝은 `docs/operations` 기준으로 단계적으로 적용
