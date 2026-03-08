# use-funnel 구현 순서

> 목적: 1차 점진 도입을 작은 diff 단위로 안전하게 구현한다.

## 1. 선행 작업

먼저 아래 상태를 확인한다.

- 현재 `apps/web` 빌드/테스트가 통과하는지 확인
- 기존 analytics / `server-only` 이슈를 병렬 수정할지 분리할지 결정

권장 검증 명령:

- `pnpm --filter web test`
- `pnpm --filter web typecheck`
- `pnpm --filter web lint`
- `pnpm --filter web build`

## 2. 파일별 구현 순서

### 1) `apps/web/package.json`

작업:

- `@use-funnel/next` 추가

주의:

- 이번 단계에서는 `react-hook-form`을 같이 추가하지 않는다.

### 2) `apps/web/lib/store.tsx`

작업:

- handoff에서 재사용할 dispatch/action 타입을 export 가능하게 정리

목표:

- 신규 bridge 파일이 store 내부 구현 세부사항을 재선언하지 않게 한다.

### 3) `apps/web/lib/funnel/pre-analysis/schema.ts`

작업:

- step 이름 상수/유니온 정의
- `PreAnalysisContext` 정의
- 초기 context 생성 함수 정의

목표:

- 퍼널의 타입 단일 소스를 만든다.

### 4) `apps/web/lib/funnel/pre-analysis/bridge.ts`

작업:

- `commitPreAnalysisToStore(ctx, dispatch)` 구현
- 필요하면 `createInitialPreAnalysisContextFromAppState(state)` 구현

목표:

- handoff의 store 갱신 책임을 별도 파일로 분리한다.

### 5) `apps/web/components/funnel/pre-analysis-provider.tsx`

작업:

- `@use-funnel/next` 초기화
- step별 action 함수 정의
- guard/보정 로직 정의

목표:

- page 컴포넌트가 transition 구현을 몰라도 되게 만든다.

### 6) `apps/web/components/funnel/pre-analysis-handoff.tsx`

작업:

- funnel context -> store commit
- `/analyzing` 이동

목표:

- 기존 reducer와 새 funnel 간 연결 지점을 하나로 고정한다.

### 7) `apps/web/app/layout.tsx`

작업:

- `AppProvider` 내부에 `PreAnalysisFunnelProvider` 추가

목표:

- route group 분리 없이 1차 연동 가능하게 만든다.

### 8) `apps/web/app/input/page.tsx`

작업:

- 초기값 소스를 store 대신 funnel context로 변경
- submit 시 `input -> branch` action 호출
- 직접 `dispatch` 제거

목표:

- 입력 화면을 funnel view로 전환한다.

### 9) `apps/web/app/branch/page.tsx`

작업:

- `dispatch + router.push` 제거
- 분기별 funnel action 호출

목표:

- 분기 규칙을 page 파일에서 제거한다.

### 10) `apps/web/app/time/page.tsx`

작업:

- exact / approximate submit 모두 funnel action으로 전환
- query param 분기는 1차에서는 유지 가능

목표:

- known/approximate 경로의 전이를 funnel이 소유하게 한다.

### 11) `apps/web/app/survey/page.tsx`

작업:

- 설문 완료 시 기존 store dispatch 제거
- `surveyAnswers`, `inferredHour`를 funnel context에 저장
- 완료 후 `handoff` 전이

목표:

- pre-analysis 마지막 단계도 funnel 규칙으로 통일한다.

### 12) `apps/web/app/analyzing/page.tsx`

작업:

- 1차에서는 큰 구조 변경 없이 handoff 결과를 그대로 소비

확인 포인트:

- `/analyzing` 진입 시 필요한 store 상태가 모두 채워지는지 확인

## 3. 테스트 파일 순서

### `apps/web/lib/funnel/pre-analysis/bridge.test.ts`

검증:

- handoff 시 어떤 store action이 어떤 payload로 호출되는지

### `apps/web/lib/funnel/pre-analysis/schema.test.ts`

검증:

- 초기 context 생성
- step guard 보정 규칙

1차에서는 UI 테스트보다 bridge/schema 테스트가 우선이다.

## 4. 권장 커밋 단위

### Commit A: scaffolding

- dependency 추가
- schema / bridge / provider / handoff 생성

### Commit B: page migration

- `input`, `branch`, `time`, `survey` 전이 변경

### Commit C: cleanup + tests

- 불필요한 page-level dispatch 제거
- 문서/테스트/타입 정리

## 5. 검증 순서

1. `pnpm --filter web test`
2. `pnpm --filter web typecheck`
3. `pnpm --filter web lint`
4. `pnpm --filter web build`

수동 시나리오:

1. known 흐름
   - `/input -> /branch -> /time -> /analyzing`
2. unknown 흐름
   - `/input -> /branch -> /survey -> /analyzing`
3. approximate 흐름
   - `/input -> /branch -> /time?mode=approximate -> /survey -> /analyzing`
4. 뒤로가기/직접 진입
   - `/survey` 직접 진입 보정
   - `/time` 직접 진입 보정

## 6. 보류 항목

1차 구현 이후에 판단할 항목:

- `/analyzing`, `/result`, `/feedback` funnel 편입
- `react-hook-form` 부분 도입
- query param 기반 `mode=approximate` 제거
- page별 analytics 호출의 transition 계층 완전 이동

