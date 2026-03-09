# Google Sheets 연동 사용 가이드

## 1) 목적

이 문서는 운영 스프레드시트 연동을 실제로 켜고 검증할 때 필요한 절차를 정리한다.

- 대상: `apps/web` 운영 담당자, 백엔드/인프라 담당자
- 범위: 환경 변수, Google Cloud 설정, 시트 템플릿, 동작 확인, 장애 대응

아키텍처/경계 원칙은 아래 문서를 기준으로 한다.

- `docs/operations/integration/google-sheets-package-architecture.md`
- `docs/operations/integration/spreadsheet-admin-integration-principles.md`
- `docs/operations/integration/google-sheets-sheet-bootstrap.md`

## 2) 패키지/앱 책임 요약

- `@workspace/google-sheets`: Google Sheets API 인증/호출 인프라
- `@workspace/spreadsheet-admin`: 질문 시트 검증/정규화, fallback, 결과 저장 유스케이스
- `apps/web`: API 라우트(`/api/operations/questions`, `/api/feedback`)에서 서버 전용으로 연동 실행

## 3) 환경 변수 파일 위치

현재 저장소 기준 `.env.example` 위치:

- 앱 레이어: `apps/web/.env.example`
- 패키지 레이어: `packages/operations/google-sheets/.env.example`

민감한 실제 환경 파일은 Git에 올라가면 안 된다.

- 허용: `**/.env.example`
- 금지(자동 ignore): `.env`, `.env.*`, `**/.env`, `**/.env.*`, `.envrc`, `**/.envrc`

## 4) 필수/선택 환경 변수

`apps/web/.env.local`에 아래 값을 설정한다.

### 4.1 분석 API 기본값

- `AI_GATEWAY_API_KEY` (필수)
- `VERCEL_OIDC_TOKEN` (선택, 배포 환경 자동 주입 가능)

### 4.2 스프레드시트 연동값

- `GOOGLE_SPREADSHEET_ADMIN_ID` (질문/결과 시트가 있는 스프레드시트 ID)
- `GOOGLE_SPREADSHEET_QUESTIONS_RANGE` (선택, 기본 `Questions!A:K`)
- `GOOGLE_SPREADSHEET_RESULTS_RANGE` (선택, 기본 `Results!A:J`)

### 4.3 서비스 계정 인증값

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` (필수)
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (필수)
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID` (선택)
- `GOOGLE_SERVICE_ACCOUNT_TOKEN_URI` (선택, 기본 `https://oauth2.googleapis.com/token`)
- `GOOGLE_SERVICE_ACCOUNT_SCOPES` (선택, 기본 `https://www.googleapis.com/auth/spreadsheets`)
- `GOOGLE_SERVICE_ACCOUNT_SUBJECT` (선택)

`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` 입력 규칙:

- 멀티라인 키를 한 줄 env로 넣을 때는 줄바꿈을 `\n`로 이스케이프
- 예시: `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`

## 5) Google Cloud 준비 절차

1. Google Cloud 프로젝트에서 **Google Sheets API** 활성화
2. 서비스 계정 생성
3. 서비스 계정 키(JSON) 발급
4. 운영 스프레드시트를 서비스 계정 이메일에 공유
   - 질문 로드만 필요하면 Viewer 이상
   - 결과 저장까지 쓰면 Editor 권한 필요

## 6) 스프레드시트 시트 구성

### 6.1 Questions 시트

기본 range: `Questions!A:K`

필수 헤더:

- `version`
- `questionId`
- `structureRole`
- `category`
- `questionWeight`
- `questionText`
- `optionIndex`
- `optionText`
- `scoreMapJson`
- `isActive`
- `updatedAt`

검증 실패 사례:

- `questionId + optionIndex` 중복
- `scoreMapJson`의 허용되지 않은 시진 키
- role 누락(`noise_reduction|core|fine_tune|closing`)

현재 엔진 질문 원본을 시트 포맷으로 바로 내보내려면 아래 명령을 사용한다.

```bash
pnpm run export:questions-sheet --output /tmp/rev-questions.tsv
```

- 생성된 TSV 파일을 열어 전체 복사 후 `Questions` 시트 A1에 붙여 넣는다.
- 첫 줄 헤더(`version`부터 `updatedAt`까지)도 함께 포함된다.
- `updatedAt`을 고정하려면 `--updated-at 2026-03-10T00:00:00.000Z`처럼 명시한다.

### 6.2 Results 시트

기본 range: `Results!A:J`

저장되는 기본 컬럼:

- `sessionId`
- `timestamp`
- `engineVersion`
- `questionVersion`
- `birthTimeKnowledge`
- `approximateRangeJson`
- `surveyAnswersJson`
- `inferenceResultJson`
- `monitoringJson`
- `feedbackJson`

초기 헤더만 빠르게 만들려면 아래 명령을 사용한다.

```bash
pnpm run export:results-sheet --output /tmp/rev-results.tsv
```

- 생성된 TSV 파일을 열어 전체 복사 후 `Results` 시트 A1에 붙여 넣는다.
- 현재 출력은 헤더 한 줄만 포함한다.

## 7) 런타임 동작 요약

### 7.1 질문 동기화 (`GET /api/operations/questions`)

- 정상 최신 로드: `source = spreadsheet-latest`
- 최신 실패 + fallback 존재: `source = spreadsheet-fallback`
- 설정 미비/실패: `source = engine-default`

앱(`app/survey/page.tsx`)은 버전이 현재 엔진과 맞을 때만 동기화 질문을 사용한다.

### 7.2 피드백 저장 (`POST /api/feedback`)

- 저장 성공: `200 { saved: true }`
- 저장 스킵/실패: `202 { saved: false, reason }`

`/feedback` 화면은 best-effort 정책으로 저장 실패 시에도 사용자 완료 플로우를 유지한다.

## 8) 로컬 검증 체크리스트

1. `apps/web/.env.local` 작성
2. `pnpm --filter web test`
3. `pnpm run ci:monorepo`
4. 브라우저에서 `/survey` 진입 후 질문 로드 확인
5. `/feedback` 제출 후 API 응답(200 또는 202) 확인

## 9) 트러블슈팅

### 9.1 항상 `engine-default`가 나오는 경우

- `GOOGLE_SPREADSHEET_ADMIN_ID` 누락 여부
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` 누락 여부
- 서비스 계정이 스프레드시트에 공유되었는지 확인

### 9.2 `save-failed`가 반복되는 경우

- Results range가 실제 시트와 일치하는지 확인
- 서비스 계정 권한(Editor) 확인
- 네트워크/429/5xx가 반복되면 재시도/큐 설계 추가 검토

### 9.3 `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` 파싱 오류

- 줄바꿈 이스케이프(`\n`) 확인
- 키 앞뒤 공백/따옴표 처리 확인
