# Sentry 설정 가이드

## 목적

- 클라이언트/서버 예외를 공통 릴리즈/환경 축으로 수집
- 장애 triage 시간을 단축

## 현재 상태

현재 레포는 `@workspace/sentry` 설정 빌더 + 앱 초기화 파일까지 연결된 상태다.

- 공통 설정 빌더: `packages/operations/sentry/src/*`
- 앱 초기화 파일: `apps/web/sentry.client.config.ts`, `apps/web/sentry.server.config.ts`, `apps/web/sentry.edge.config.ts`
- instrumentation preload: `apps/web/instrumentation.ts`
- client replay integration: `apps/web/sentry.client.config.ts`

## 환경변수

- `NEXT_PUBLIC_SENTRY_DSN` (필수)
- `NEXT_PUBLIC_APP_ENV` (권장)
- `NEXT_PUBLIC_APP_RELEASE` (권장)
- `SENTRY_TRACES_SAMPLE_RATE` (기본 0.2)
- `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` (기본 0.01)
- `SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` (기본 1)

## SDK 활성화 단계

1. `apps/web`에 `@sentry/nextjs` 설치
2. client init에서 replay integration이 포함되는지 확인
3. staging에서 의도적 예외를 발생시켜 이벤트 유입 검증
4. alert rule, ownership rule 설정

## 버전 호환성 메모

현재 `Next.js 16` 환경에서 `@sentry/nextjs` peer 경고가 발생할 수 있다.
설치 후 CI/프로덕션 빌드가 정상 통과하는지 반드시 확인하고, 필요하면 Sentry SDK 버전을 상향 추적한다.

## 운영 권장값

- production traces: `0.1 ~ 0.2`
- staging traces: `1.0`
- replay는 비용 영향이 커서 production은 낮게 시작
- sourcemap 업로드는 기본 활성 상태를 유지하고, staging에서 stacktrace 가독성을 반드시 확인

상세 설정/검증 절차는 `sentry-setup-validation.md`를 따른다.
