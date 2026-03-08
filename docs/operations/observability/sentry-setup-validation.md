# Sentry 설정 및 검증 가이드

이 문서는 `apps/web` 기준으로 Sentry를 설정하고, 실제 이벤트 수집을 검증하는 절차를 정리한다.

## 1. 사전 조건

- `apps/web`에 `@sentry/nextjs`가 설치되어 있어야 한다.
- Sentry 프로젝트 DSN을 발급받아야 한다.
- 배포 환경별 값(`development`, `staging`, `production`)을 분리해야 한다.

## 2. 설정 파일 확인

다음 파일이 존재하고 `Sentry.init(...)`를 호출하는지 확인한다.

- `apps/web/sentry.client.config.ts`
- `apps/web/sentry.server.config.ts`
- `apps/web/sentry.edge.config.ts`

공통 설정은 `@workspace/sentry`에서 생성한다.

- `packages/operations/sentry/src/types.ts`

## 3. 환경 변수 설정

`apps/web/.env.local` 또는 배포 환경 변수에 아래 값을 설정한다.

```bash
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_APP_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=0.2
SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.01
SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1
```

권장값:

- `development`: traces `1.0`
- `staging`: traces `1.0`
- `production`: traces `0.1 ~ 0.2`

## 4. 로컬 검증

1. 타입/린트 확인

```bash
pnpm --filter web typecheck
pnpm --filter web lint
```

2. 앱 실행

```bash
pnpm dev
```

3. 클라이언트 에러 테스트 (브라우저 콘솔)

```js
throw new Error('sentry-client-test')
```

4. 서버 에러 테스트 (임시 API/코드 경로에서 예외 발생)

- `/api/*` 라우트에 임시로 `throw new Error('sentry-server-test')` 추가 후 호출
- 검증 후 반드시 제거

5. Sentry 이슈 유입 확인

- 이벤트가 올바른 프로젝트로 들어오는지
- `environment`, `release` 태그가 기대값인지

## 5. 스테이징 검증 체크리스트

- 실제 스테이징 도메인에서 클라이언트 에러 1건 유입 확인
- API 경로 서버 에러 1건 유입 확인
- 샘플링 값이 의도와 일치하는지 확인
- 소스맵 업로드/스택트레이스 가독성 확인

## 6. 운영 배포 전 점검

- DSN이 staging/prod 간 혼선 없는지
- `NEXT_PUBLIC_APP_RELEASE`가 배포 버전(SHA)과 일치하는지
- 알림 규칙(alert rule), 담당자(ownership) 설정 완료 여부

## 7. 트러블슈팅

- 이벤트가 0건일 때:
  - DSN 누락 여부
  - ad blocker/네트워크 정책 차단 여부
  - 샘플링 값이 0으로 설정됐는지
- peer warning 발생 시:
  - `next`와 `@sentry/nextjs` 버전 조합 재확인
  - `pnpm --filter web build` 통과 여부로 실제 배포 가능성 검증

## 8. 관련 문서

- `docs/operations/observability/sentry.md`
- `docs/operations/observability/runbook.md`
