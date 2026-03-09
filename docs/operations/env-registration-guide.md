# 환경 변수 등록 가이드

## 목적

이 문서는 저장소의 `.env.example` 값을 실제 개발/배포 환경에 등록할 때 참고하는 기준 문서다.

- 기준 파일
  - `apps/web/.env.example`
  - `packages/operations/google-sheets/.env.example`
- 주요 대상
  - 로컬 개발 환경을 세팅하는 개발자
  - Vercel 배포 환경 변수를 등록하는 운영 담당자

## 먼저 정리할 점

실제 앱 런타임 기준 등록 위치는 `apps/web/.env.local`이다.

- 로컬 개발: `apps/web/.env.local`
- Vercel 배포: Vercel Project Settings > Environment Variables
- `packages/operations/google-sheets/.env.example`는 서비스 계정 관련 변수 참고본이다.

즉, 일반적인 웹 앱 실행(`pnpm dev`, `pnpm --filter web dev`)에는 `apps/web/.env.local`만 맞게 채우면 된다.

## 빠른 시작

```bash
cp apps/web/.env.example apps/web/.env.local
```

그 다음 아래 순서로 값을 채운다.

1. AI 분석용 키 등록
2. GA/Sentry 공개 런타임 값 등록
3. Google Sheets 연동을 쓸 경우 스프레드시트 ID와 서비스 계정 값 등록

## 변수별 등록 기준

### 1. 분석 API

| 변수명 | 필수 여부 | 등록 위치 | 값 설명 |
| --- | --- | --- | --- |
| `AI_GATEWAY_API_KEY` | 필수 | `apps/web/.env.local`, Vercel | 분석 스트리밍 호출에 사용하는 API 키 |
| `VERCEL_OIDC_TOKEN` | 선택 | 보통 수동 등록 불필요 | Vercel 배포 환경에서 자동 주입되는 경우가 많다 |

메모:

- `AI_GATEWAY_API_KEY`가 비어 있으면 `/api/analyze` 경로의 실제 AI 호출이 정상 동작하지 않는다.
- `VERCEL_OIDC_TOKEN`은 `.env.example`에 주석으로만 남아 있는 선택값이다. 로컬 개발에서는 대개 비워 둔다.

### 2. GA / Sentry 공개 런타임 값

| 변수명 | 필수 여부 | 등록 위치 | 권장값 / 준비 방법 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | 선택 | `apps/web/.env.local`, Vercel | GA4 측정 ID (`G-XXXXXXXXXX`) |
| `NEXT_PUBLIC_SENTRY_DSN` | 선택 | `apps/web/.env.local`, Vercel | Sentry 프로젝트 DSN |
| `NEXT_PUBLIC_APP_ENV` | 권장 | `apps/web/.env.local`, Vercel | `development`, `staging`, `production` 중 하나 |
| `NEXT_PUBLIC_APP_RELEASE` | 권장 | `apps/web/.env.local`, Vercel | Git SHA 또는 배포 버전 |
| `SENTRY_TRACES_SAMPLE_RATE` | 선택 | `apps/web/.env.local`, Vercel | 숫자형 비율, 기본 `0.2` |
| `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` | 선택 | `apps/web/.env.local`, Vercel | 숫자형 비율, 기본 `0.01` |
| `SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | 선택 | `apps/web/.env.local`, Vercel | 숫자형 비율, 기본 `1` |

메모:

- `NEXT_PUBLIC_*` 값은 브라우저로 노출되는 공개 런타임 값이다. 비밀키를 넣으면 안 된다.
- GA를 아직 쓰지 않으면 `NEXT_PUBLIC_GA_MEASUREMENT_ID`는 비워 둘 수 있다.
- Sentry를 아직 켜지 않았다면 `NEXT_PUBLIC_SENTRY_DSN`도 비워 둘 수 있다.
- 샘플링 값은 반드시 숫자로 넣는다. 예: `0.2`, `1`, `0.01`

### 3. Google Sheets 연동

| 변수명 | 필수 여부 | 등록 위치 | 값 설명 |
| --- | --- | --- | --- |
| `GOOGLE_SPREADSHEET_ADMIN_ID` | Sheets 사용 시 필수 | `apps/web/.env.local`, Vercel | 질문/결과 시트가 들어 있는 스프레드시트 ID |
| `GOOGLE_SPREADSHEET_QUESTIONS_RANGE` | 선택 | `apps/web/.env.local`, Vercel | 기본 `Questions!A:K` |
| `GOOGLE_SPREADSHEET_RESULTS_RANGE` | 선택 | `apps/web/.env.local`, Vercel | 기본 `Results!A:J` |

`GOOGLE_SPREADSHEET_ADMIN_ID`는 스프레드시트 URL에서 가져온다.

예시:

```text
https://docs.google.com/spreadsheets/d/<이 부분이 스프레드시트 ID>/edit#gid=0
```

메모:

- 질문 동기화와 결과 저장을 둘 다 쓰면 동일한 스프레드시트 ID를 사용한다.
- range를 바꾸지 않는다면 `.env.example` 기본값을 그대로 유지하면 된다.

### 4. Google 서비스 계정 인증

| 변수명 | 필수 여부 | 등록 위치 | 준비 방법 |
| --- | --- | --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Sheets 사용 시 필수 | `apps/web/.env.local`, Vercel | 서비스 계정 JSON의 `client_email` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Sheets 사용 시 필수 | `apps/web/.env.local`, Vercel | 서비스 계정 JSON의 `private_key` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID` | 선택 | `apps/web/.env.local`, Vercel | 서비스 계정 JSON의 `private_key_id` |
| `GOOGLE_SERVICE_ACCOUNT_TOKEN_URI` | 선택 | `apps/web/.env.local`, Vercel | 보통 기본값 `https://oauth2.googleapis.com/token` 유지 |
| `GOOGLE_SERVICE_ACCOUNT_SCOPES` | 선택 | `apps/web/.env.local`, Vercel | 보통 기본값 `https://www.googleapis.com/auth/spreadsheets` 유지 |
| `GOOGLE_SERVICE_ACCOUNT_SUBJECT` | 선택 | `apps/web/.env.local`, Vercel | 도메인 위임이 필요한 경우에만 사용 |

서비스 계정 값은 보통 Google Cloud에서 발급한 JSON 키 파일에서 가져온다.

매핑 기준:

- `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` -> `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `private_key_id` -> `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID`
- `token_uri` -> `GOOGLE_SERVICE_ACCOUNT_TOKEN_URI`

## `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` 입력 규칙

가장 자주 틀리는 항목이다.

멀티라인 키를 `.env` 한 줄 값으로 넣을 때는 실제 줄바꿈 대신 `\n` 이스케이프를 사용한다.

예시:

```env
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nABCDEF...\n-----END PRIVATE KEY-----\n
```

주의:

- 앞뒤에 불필요한 따옴표를 넣지 않는 편이 안전하다.
- 줄바꿈을 실제 엔터로 넣으면 파싱 문제를 만들 수 있다.
- 값이 비어 있거나 형식이 깨지면 스프레드시트 인증이 실패한다.

## 로컬 개발 환경 등록 절차

1. `apps/web/.env.example`를 `apps/web/.env.local`로 복사한다.
2. 최소값으로 `AI_GATEWAY_API_KEY`를 먼저 채운다.
3. GA/Sentry를 쓸 계획이면 해당 공개 런타임 값을 추가한다.
4. Google Sheets 연동이 필요하면 스프레드시트 ID와 서비스 계정 값을 추가한다.
5. 서비스 계정 이메일을 대상 스프레드시트에 공유한다.
6. `pnpm dev`로 앱을 실행한다.

## Vercel 등록 절차

1. Vercel 프로젝트의 `Settings > Environment Variables`로 이동한다.
2. `apps/web/.env.example`의 키를 기준으로 필요한 값만 등록한다.
3. `Development`, `Preview`, `Production` 대상 환경을 구분해서 넣는다.
4. 배포 후 앱 동작과 관측 도구를 확인한다.

권장 등록 예시:

- `NEXT_PUBLIC_APP_ENV`
  - Development: `development`
  - Preview: `staging`
  - Production: `production`
- `NEXT_PUBLIC_APP_RELEASE`
  - 배포 커밋 SHA 또는 릴리즈 버전

메모:

- `VERCEL_OIDC_TOKEN`은 Vercel이 자동 주입하는 경우가 많아서 수동 등록 전에 실제 필요 여부를 먼저 확인한다.
- `NEXT_PUBLIC_*`는 공개 변수이므로 비밀 정보 저장 용도로 쓰지 않는다.

## 언제 `packages/operations/google-sheets/.env.example`를 쓰는가

이 파일은 `@workspace/google-sheets` 패키지가 기대하는 서비스 계정 변수 목록만 따로 보여주는 참고본이다.

일반적인 앱 실행에서는 별도 등록 위치라기보다 아래 의미로 이해하면 된다.

- `apps/web/.env.local`에 같은 값을 등록하면 앱 경유 실행에 충분하다.
- 패키지를 독립적으로 테스트하거나 별도 스크립트에서 직접 읽게 만들 때만 같은 키 세트를 별도로 사용하면 된다.

## 등록 후 확인 포인트

### 분석 API

- `/api/analyze` 호출 시 500이 반복되지 않는지 확인

### GA

- 브라우저 Network에서 `collect` 요청 확인

### Sentry

- 이벤트 유입 여부와 환경값(`NEXT_PUBLIC_APP_ENV`) 확인

### Google Sheets

- `/api/operations/questions`가 `engine-default`만 반환하지 않는지 확인
- `/api/feedback` 결과가 `saved: true` 또는 의도한 fallback 응답으로 내려오는지 확인

## 관련 문서

- `docs/operations/observability/ga.md`
- `docs/operations/observability/sentry.md`
- `docs/operations/observability/sentry-setup-validation.md`
- `docs/operations/integration/google-sheets-usage-guide.md`
- `docs/architecture.md`
