# GA4 설정 가이드

## 목적

- 핵심 퍼널(`/input -> /branch -> /time|survey -> /analyzing -> /result -> /feedback`) 관측
- 기능 릴리즈 영향 측정

## 환경변수

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (필수)
- `NEXT_PUBLIC_APP_ENV` (권장: `development | staging | production`)
- `NEXT_PUBLIC_APP_RELEASE` (권장: 배포 SHA/버전)

## 코드 지점

- 스크립트 로더: `apps/web/components/analytics/ga-script.tsx`
- 루트 연결: `apps/web/app/layout.tsx`
- helper: `packages/operations/ga/src/index.ts`
- 앱 이벤트 래퍼: `apps/web/lib/analytics.ts`

## 현재 연결된 퍼널 이벤트

- `start_analysis`
- `submit_birth_info`
- `select_birth_time_knowledge`
- `submit_known_time`
- `submit_approximate_time`
- `complete_survey`
- `analysis_success`
- `analysis_failure`
- `view_result`
- `submit_feedback`

## 공통 파라미터 표준

`trackFunnelEvent`는 아래 파라미터를 자동 주입한다.

- `session_id`
- `app_env`
- `app_release`
- `page_path`

## 이벤트 네이밍 규칙

- action: `snake_case` (`start_analysis`, `submit_feedback`)
- category: `funnel | inference | feedback | error`
- label: 선택적 세부 컨텍스트

예시 payload:

```ts
trackEvent({
  action: 'submit_feedback',
  category: 'feedback',
  label: 'inferred_hour',
  value: 5,
})
```

## 검증 방법

1. 브라우저 개발자도구 Network에서 `collect` 요청 확인
2. GA DebugView에서 이벤트 수신 확인
3. 스테이징/프로덕션 속성 분리가 되었는지 재확인
