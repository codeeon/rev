# use-funnel 1차 구현 체크리스트

## A. 범위 확인

- [ ] 1차 범위가 pre-analysis 구간에 한정됨을 확인했다.
- [ ] `/analyzing`, `/result`, `/feedback`는 기존 구조를 유지한다.
- [ ] `react-hook-form`과 `XState`는 이번 작업 범위에서 제외한다.

## B. 의존성 / 스캐폴딩

- [ ] `apps/web/package.json`에 `@use-funnel/next`를 추가했다.
- [ ] `apps/web/lib/funnel/pre-analysis/schema.ts`를 만들었다.
- [ ] `apps/web/lib/funnel/pre-analysis/bridge.ts`를 만들었다.
- [ ] `apps/web/components/funnel/pre-analysis-provider.tsx`를 만들었다.
- [ ] `apps/web/components/funnel/pre-analysis-handoff.tsx`를 만들었다.

## C. store 연동

- [ ] handoff에 필요한 store action/type export를 정리했다.
- [ ] pre-analysis 상태를 funnel context로 표현했다.
- [ ] 기존 store 갱신은 handoff 한 지점으로 제한했다.

## D. page 마이그레이션

- [ ] `apps/web/app/input/page.tsx`가 funnel context를 사용한다.
- [ ] `apps/web/app/branch/page.tsx`에서 직접 `dispatch + router.push`를 제거했다.
- [ ] `apps/web/app/time/page.tsx`가 funnel action으로 전이한다.
- [ ] `apps/web/app/survey/page.tsx`가 결과를 funnel context에 저장한다.
- [ ] `apps/web/app/layout.tsx`에 provider를 연결했다.

## E. guard / 전이 계약

- [ ] `branch` 직접 진입 시 선행 birth info가 없으면 보정된다.
- [ ] `time` 직접 진입 시 `birthTimeKnowledge`가 없으면 보정된다.
- [ ] `survey` 직접 진입 시 허용된 분기 상태가 아니면 보정된다.
- [ ] known 흐름에서 `surveyAnswers`와 `inferredHour`가 초기화된다.
- [ ] approximate 흐름에서 `approximateRange`가 저장된다.

## F. analytics / 안정성

- [ ] step 전이 함수 안에서 analytics를 호출하도록 구조를 정리했다.
- [ ] analytics 예외가 사용자 전이를 막지 않도록 보호했다.
- [ ] handoff 이후 `/analyzing`에서 기존 분석 플로우가 깨지지 않는다.

## G. 테스트

- [ ] `bridge.test.ts`를 추가했다.
- [ ] 필요 시 `schema.test.ts`를 추가했다.
- [ ] `pnpm --filter web test` 통과
- [ ] `pnpm --filter web typecheck` 통과
- [ ] `pnpm --filter web lint` 통과
- [ ] `pnpm --filter web build` 통과

## H. 수동 검증

- [ ] known 경로 수동 확인
- [ ] unknown 경로 수동 확인
- [ ] approximate 경로 수동 확인
- [ ] back navigation 수동 확인
- [ ] 직접 URL 진입 보정 수동 확인

## I. 리뷰 포인트

- [ ] page 파일이 view 역할만 하도록 충분히 단순화됐는가
- [ ] handoff 이전에 기존 store를 직접 수정하는 코드가 남아 있지 않은가
- [ ] funnel context와 store state 간 중복 필드가 불필요하게 늘어나지 않았는가
- [ ] 1차 비목표가 scope creep 없이 유지됐는가

