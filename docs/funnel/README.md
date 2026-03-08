# 퍼널 구현 문서 인덱스

`docs/funnel`은 `apps/web`의 pre-analysis 사용자 흐름을 `@use-funnel/next` 기반으로 정리하기 위한 설계/실행 문서를 모아둔 경로다.

대상 범위:

- `/input`
- `/branch`
- `/time`
- `/survey`

1차 범위에서 유지하는 기존 화면:

- `/analyzing`
- `/result`
- `/feedback`

## 왜 별도 문서가 필요한가

현재 퍼널은 `apps/web/lib/store.tsx` 전역 상태와 각 페이지의 `router.push()` 호출에 분산되어 있다.
이 구조는 작은 기능 추가에는 빠르지만, 아래 문제가 커질수록 유지보수 비용이 증가한다.

- 분기(`known | unknown | approximate`)가 UI 파일 여러 곳에 흩어져 있음
- 뒤로가기/직접 진입 시 필요한 선행 상태 검사가 페이지별로 분산됨
- pre-analysis 상태와 post-analysis 상태가 한 reducer에 섞여 있음
- 단계 전이 이벤트와 화면 렌더링 책임이 한 파일에 같이 있음

## 이번 문서 묶음의 결정

- 1차 도입은 `@use-funnel/next`만 사용한다.
- `react-hook-form`은 도입하지 않는다.
- `AppProvider`는 즉시 제거하지 않는다.
- funnel은 pre-analysis 구간만 소유하고, `/analyzing` 진입 직전에 기존 store로 handoff 한다.

## 문서 구성

- `use-funnel-adoption-design.md`
  - 1차 도입 목표, 상태 모델, step 정의, 전이 규칙, handoff 설계
- `use-funnel-implementation-order.md`
  - 파일별 구현 순서, 책임, 예상 diff 범위, 검증 명령
- `use-funnel-phase-1-checklist.md`
  - 실제 구현/리뷰/검증 체크리스트

## 권장 읽기 순서

1. `use-funnel-adoption-design.md`
2. `use-funnel-implementation-order.md`
3. `use-funnel-phase-1-checklist.md`

## 선행 주의 사항

퍼널 리팩터링과 별개로, 현재 리뷰에서 확인된 아래 이슈는 별도 수정이 필요하다.

- analytics가 사용자 흐름을 막지 않도록 예외 안전성 확보
- `server-only` 경계 회귀 복구
- 초기 GA 이벤트 유실 정책 정리

