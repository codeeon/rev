# Observability 운영 가이드

이 경로는 `rev-workspace`에서 GA4 + Sentry를 운영하기 위한 문서 묶음이다.

## 문서 구성

- `ga.md`: GA4 설정, 스크립트 삽입, 이벤트 네이밍 규칙
- `sentry.md`: Sentry 환경변수, 초기화 지점, 샘플링 정책
- `sentry-setup-validation.md`: Sentry 설정 및 검증 절차
- `runbook.md`: 장애 대응 절차, 알람 확인, 점검 체크리스트

## 패키지 구조

- `@workspace/ga`: GA 측정 ID 해석, 스크립트/이벤트 helper
- `@workspace/sentry`: 브라우저/서버/엣지용 설정 객체 빌더

## 앱 연동 파일

- `apps/web/components/analytics/ga-script.tsx`
- `apps/web/lib/analytics.ts`
- `apps/web/instrumentation.ts`
- `apps/web/sentry.client.config.ts`
- `apps/web/sentry.server.config.ts`
- `apps/web/sentry.edge.config.ts`

## 빠른 시작

1. `apps/web/.env.local`에 GA/Sentry 환경변수 입력
2. `pnpm -s build --filter=@workspace/ga --filter=@workspace/sentry`
3. `pnpm dev` 실행 후 브라우저 네트워크/콘솔에서 이벤트 전송 확인
4. Sentry SDK를 실제로 활성화할 경우 `sentry.md`의 rollout 절차대로 단계 적용
