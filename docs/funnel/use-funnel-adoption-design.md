# use-funnel 도입 설계서

> 범위: pre-analysis 1차 점진 도입
> 대상 앱: `apps/web`

## 1. 목표

`/input -> /branch -> /time -> /survey` 구간의 상태와 전이를 `@use-funnel/next`로 통합한다.
이 단계의 목적은 전체 앱 상태 관리 교체가 아니라, pre-analysis 퍼널의 분기와 뒤로가기 계약을 명시적으로 만드는 것이다.

## 2. 현재 문제

현재 pre-analysis 흐름은 아래 구조에 의존한다.

- 전역 상태: `apps/web/lib/store.tsx`
- 페이지 전이: 각 page 컴포넌트의 `router.push()`
- 분기 처리:
  - `apps/web/app/branch/page.tsx`
  - `apps/web/app/time/page.tsx`
  - `apps/web/app/survey/page.tsx`

이 구조의 문제는 다음과 같다.

- step 전이 규칙이 파일 여러 곳에 흩어진다.
- 페이지 직접 진입 시 어떤 상태가 선행 조건인지 명시성이 약하다.
- pre-analysis 상태와 post-analysis 상태가 한 reducer에 같이 있어 책임이 넓다.
- 전이 이벤트 계측이 페이지 이벤트 핸들러에 분산된다.

## 3. 이번 단계에서의 결정

### 3.1 채택

- `@use-funnel/next`

채택 이유:

- 현재 앱의 핵심 문제는 폼 필드 관리보다 step 전이와 분기다.
- `known | unknown | approximate` 분기를 타입과 history 기준으로 정리할 필요가 있다.
- 전체 상태 머신(XState)로 갈 만큼 비동기 전이가 복잡하지는 않다.

### 3.2 보류

- `react-hook-form`
- `XState`

보류 이유:

- 현재 입력 화면은 검증 규칙이 비교적 단순하다.
- 1차 과제는 폼 추상화보다 funnel 구조 정리다.
- 동시에 여러 추상화를 도입하면 diff와 학습 비용이 커진다.

## 4. 범위

### 4.1 funnel이 소유하는 구간

- `/input`
- `/branch`
- `/time`
- `/survey`

### 4.2 기존 store가 계속 소유하는 구간

- `/analyzing`
- `/result`
- `/feedback`

이유:

- `analyze` 스트림 처리와 결과 표시 로직은 현 상태에서도 응집도가 높다.
- 1차에서는 pre-analysis 상태만 funnel로 이동시키고, 분석 시작 직전에 기존 store로 handoff 하는 편이 안전하다.

## 5. 목표 아키텍처

```text
/input
  -> /branch
    -> /time (known)
      -> handoff
        -> /analyzing
    -> /time?mode=approximate
      -> /survey
        -> handoff
          -> /analyzing
    -> /survey (unknown)
      -> handoff
        -> /analyzing
```

핵심 규칙:

- pre-analysis 상태는 funnel context가 단일 소스다.
- 기존 store는 handoff 시점에만 갱신한다.
- 각 페이지는 가능한 한 "view + funnel action 호출"만 담당한다.

## 6. 상태 모델

```ts
type PreAnalysisContext = {
  birthInfo: {
    name?: string
    year?: number
    month?: number
    day?: number
    isLunar?: boolean
    gender?: 'male' | 'female'
    hour?: number
    minute?: number
  }
  birthTimeKnowledge: 'known' | 'unknown' | 'approximate' | null
  approximateRange: {
    start: number
    end: number
    label: string
  } | null
  surveyAnswers: SurveyAnswer[]
  inferredHour: InferredHourPillar | null
}
```

1차에서는 아래 상태를 funnel로 옮기지 않는다.

- `sajuResult`
- `analysisResult`
- `analysisText`
- `isAnalyzing`

## 7. Step 정의

### 7.1 `input`

책임:

- 이름, 양력/음력, 생년월일, 성별 입력

완료 조건:

- `year`, `month`, `day`, `gender` 유효

### 7.2 `branch`

책임:

- 생시 인지 여부 선택

전이:

- `known` -> `timeExact`
- `unknown` -> `survey`
- `approximate` -> `timeApprox`

### 7.3 `timeExact`

책임:

- 정확한 시/분 입력

전이:

- submit -> `handoff`

### 7.4 `timeApprox`

책임:

- 대략 시간대 선택

전이:

- submit -> `survey`

### 7.5 `survey`

책임:

- 질문 세트 로드
- 사용자 응답 저장
- `inferZishi` 실행
- `inferredHour` 계산

전이:

- complete -> `handoff`

### 7.6 `handoff`

책임:

- funnel context를 기존 `AppProvider` store로 커밋
- `/analyzing`로 이동

화면:

- 별도 UI 없음

## 8. 전이 이벤트 계약

### `input.submit`

- context 갱신: `birthInfo`
- analytics: `submit_birth_info`
- next: `branch`

### `branch.select`

- context 갱신: `birthTimeKnowledge`
- analytics: `select_birth_time_knowledge`
- next:
  - `known` -> `timeExact`
  - `unknown` -> `survey`
  - `approximate` -> `timeApprox`

### `timeExact.submit`

- context 갱신:
  - `birthInfo.hour`
  - `birthInfo.minute`
  - `birthTimeKnowledge = 'known'`
  - `approximateRange = null`
  - `surveyAnswers = []`
  - `inferredHour = null`
- analytics: `submit_known_time`
- next: `handoff`

### `timeApprox.submit`

- context 갱신:
  - `birthTimeKnowledge = 'approximate'`
  - `approximateRange`
- analytics: `submit_approximate_time`
- next: `survey`

### `survey.complete`

- context 갱신:
  - `surveyAnswers`
  - `inferredHour`
- analytics: `complete_survey`
- next: `handoff`

## 9. handoff 설계

`handoff` step에서만 기존 reducer action을 호출한다.

필요 액션:

- `SET_BIRTH_INFO`
- `SET_BIRTH_TIME_KNOWLEDGE`
- `SET_APPROXIMATE_RANGE`
- `SET_SURVEY_ANSWERS`
- `SET_INFERRED_HOUR`

설계 원칙:

- 각 page 파일에서 더 이상 `dispatch + router.push`를 같이 호출하지 않는다.
- store 갱신은 handoff 한 점으로 제한한다.

## 10. 파일 설계

신규 파일:

- `apps/web/lib/funnel/pre-analysis/schema.ts`
- `apps/web/lib/funnel/pre-analysis/bridge.ts`
- `apps/web/components/funnel/pre-analysis-provider.tsx`
- `apps/web/components/funnel/pre-analysis-handoff.tsx`

기존 수정 파일:

- `apps/web/app/layout.tsx`
- `apps/web/app/input/page.tsx`
- `apps/web/app/branch/page.tsx`
- `apps/web/app/time/page.tsx`
- `apps/web/app/survey/page.tsx`
- `apps/web/lib/store.tsx`

## 11. Guard 정책

페이지 직접 진입 시 필요한 조건은 funnel provider에서 해석한다.

- `branch`: `birthInfo.year/month/day/gender`가 없으면 `input`으로 보정
- `timeExact`/`timeApprox`: `birthTimeKnowledge`가 없으면 `branch`로 보정
- `survey`: `birthTimeKnowledge`가 `unknown | approximate`가 아니면 `branch`로 보정

1차에서는 page-level redirect와 funnel guard가 잠시 공존할 수 있지만, 최종적으로는 funnel guard를 우선한다.

## 12. Analytics 정책

1차 목표는 analytics 확장이 아니라 전이 지점 정리다.

원칙:

- step 전이 함수 안에서 이벤트를 보낸다.
- page component의 개별 버튼 핸들러는 가능한 한 analytics 직접 호출을 하지 않는다.
- analytics 예외가 사용자 전이를 막지 않도록 별도 보호가 필요하다.

## 13. 비목표

이번 단계에서 하지 않는 것:

- `/analyzing`, `/result`, `/feedback`까지 funnel에 편입
- `AppProvider` 제거
- `react-hook-form` 도입
- API 계약 변경
- URL 체계 전면 개편

## 14. 완료 기준

- pre-analysis 4개 화면에서 전이 규칙이 funnel 기준으로 동작한다.
- 각 page 파일에서 reducer 직접 갱신 코드가 사라지거나 최소화된다.
- handoff를 통해 `/analyzing` 진입 시 기존 기능 회귀가 없다.
- `pnpm --filter web test`
- `pnpm --filter web typecheck`
- `pnpm --filter web lint`
- `pnpm --filter web build`

