# Auth.js Admin 기능 작성 가이드

## 목적

이 문서는 현재 구현된 Auth.js 기반 admin UI 위에 새 기능을 추가할 때 따라야 하는 기준을 정리한다.

대상:

- `/admin` 화면을 확장하는 개발자
- `/api/admin/*` route를 추가하는 개발자
- Google Sheets 기반 운영 조회 기능을 추가하는 개발자

이 문서는 `설계안`보다 `구현 규칙`에 가깝다.

문서 역할:

- 현재 구현/확장 규칙: 이 문서
- phase 1 완료 상태: `authjs-admin-ui-phase-1-checklist.md`
- phase 2 확장 태스크: `authjs-admin-ui-phase-2-expansion-plan.md`

## 현재 기준 구조

```text
apps/web
├─ auth.config.ts
├─ auth.ts
├─ lib/admin-access.ts
├─ app/admin/(auth)/login/page.tsx
├─ app/admin/(protected)/*
└─ app/api/admin/*

packages/operations/spreadsheet-admin
└─ src/*
```

역할 분리:

- Auth.js 설정과 admin 화면/route는 `apps/web`
- Google Sheets 읽기/쓰기와 시트 row 해석은 `@workspace/spreadsheet-admin`

## 핵심 원칙

1. 인증은 `apps/web` 안에서만 처리한다.
2. admin 데이터 조회는 `@workspace/spreadsheet-admin/server`를 통해서만 수행한다.
3. 브라우저에서 Google Sheets API를 직접 호출하지 않는다.
4. `/admin` 페이지 보호와 `/api/admin/*` API 보호를 분리해서 둘 다 구현한다.
5. Results 조회는 항상 제한된 범위만 읽는다.

## 1. 파일 배치 규칙

### 1.1 로그인/비보호 화면

비보호 admin 화면은 아래에 둔다.

- `apps/web/app/admin/(auth)/*`

현재 기준:

- `apps/web/app/admin/(auth)/login/page.tsx`

### 1.2 보호된 admin 화면

로그인 후에만 보여야 하는 화면은 아래에 둔다.

- `apps/web/app/admin/(protected)/*`

현재 기준:

- `apps/web/app/admin/(protected)/layout.tsx`
- `apps/web/app/admin/(protected)/results/page.tsx`
- `apps/web/app/admin/(protected)/questions/page.tsx`

새 admin 화면을 추가할 때는 먼저 `(protected)` 아래에 넣는지부터 판단한다.

### 1.3 admin API

admin 전용 서버 route는 아래에 둔다.

- `apps/web/app/api/admin/*`

예:

- `apps/web/app/api/admin/results/route.ts`
- `apps/web/app/api/admin/results/[sessionId]/route.ts`
- `apps/web/app/api/admin/questions/route.ts`

### 1.4 시트 조회/파싱 로직

Google Sheets range, row parsing, read-model은 `packages/operations/spreadsheet-admin`에 둔다.

예:

- `packages/operations/spreadsheet-admin/src/result-source/read-results.ts`
- `packages/operations/spreadsheet-admin/src/runtime/service.ts`

앱 레이어에서 row 구조를 직접 파싱하지 않는다.

## 2. 인증/인가 규칙

### 2.1 Auth.js 설정

인증 진입점:

- `apps/web/auth.config.ts`
- `apps/web/auth.ts`

공통 권한 유틸:

- `apps/web/lib/admin-access.ts`

관리자 여부는 항상 아래 helper를 기준으로 판단한다.

- `getAllowedAdminEmails`
- `isAllowedAdminEmail`
- `getAdminSessionStatus`
- `hasAdminSessionAccess`

### 2.2 페이지 보호

admin 페이지는 `auth()` 호출 후 상태를 확인한다.

권장 규칙:

```ts
const session = await auth()
const sessionStatus = getAdminSessionStatus(session)

if (sessionStatus === 'unauthorized') {
  redirect('/admin/login')
}

if (sessionStatus === 'forbidden') {
  redirect('/admin/login?error=AccessDenied')
}
```

페이지 보호는 `apps/web/app/admin/(protected)/layout.tsx`에서 공통으로 처리한다.

### 2.3 API 보호

admin API는 route 시작에서 세션을 검사한다.

권장 규칙:

```ts
const session = await deps.auth()
const sessionStatus = getAdminSessionStatus(session)

if (sessionStatus === 'unauthorized') {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

if (sessionStatus === 'forbidden') {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}
```

원칙:

- 세션 없음 -> `401`
- 로그인은 되었지만 비관리자 -> `403`

## 3. admin API 작성 규칙

### 3.1 deps 레이어를 먼저 둔다

admin API는 직접 import를 흩뿌리지 말고 `route-deps.ts`를 통해 주입 가능하게 둔다.

현재 기준:

- `apps/web/app/api/admin/route-deps.ts`

이유:

- 테스트에서 `auth()`와 시트 조회 함수를 쉽게 대체할 수 있다.
- route 파일이 인증/응답 계약에만 집중할 수 있다.

### 3.2 응답 계약은 짧고 명확하게 유지한다

권장 에러 형태:

```json
{ "error": "unauthorized" }
```

```json
{ "error": "forbidden" }
```

```json
{
  "error": "results-load-failed",
  "message": "..."
}
```

원칙:

- 인증 실패와 데이터 로드 실패를 섞지 않는다.
- `message`는 운영 확인에 필요한 경우만 추가한다.

### 3.3 조회 범위를 제한한다

Results 조회 API는 무제한 전체 목록 계약으로 만들지 않는다.

현재 기준:

- 기본 최근 `100`건
- 기본 목록 조회는 최근 window만 뒤에서부터 제한적으로 읽는다
- `sessionId`, `questionVersion`, `birthTimeKnowledge` exact match만 지원
- 상세 `sessionId` 조회도 같은 bounded recent-scan 범위 안에서만 찾는다

새 필터를 추가할 때는 먼저 이 질문을 본다.

1. 이 필터가 Sheets 전체 스캔 비용을 크게 늘리나?
2. 이 필터가 정말 1차 운영에 필요한가?
3. 목록 컬럼만으로 처리 가능한가?

답이 불명확하면 추가하지 않는 편이 낫다.

## 4. `spreadsheet-admin` 확장 규칙

### 4.1 앱은 유스케이스만 알고 있어야 한다

`apps/web`는 아래 수준만 알아야 한다.

- `listAdminResultsFromSpreadsheet`
- `getAdminResultBySessionIdFromSpreadsheet`
- `syncQuestionsFromSpreadsheet`

앱에서 range 문자열이나 row column index를 직접 다루지 않는다.

### 4.2 read-model은 별도 모듈로 분리한다

append용 schema와 조회용 parser는 목적이 다르므로 분리한다.

현재 기준:

- 저장 schema: `src/result-sink/result-schema.ts`
- 조회 parser: `src/result-source/read-results.ts`

새 시트 조회가 필요하면 `result-source`, `question-source`처럼 읽기 목적 폴더를 분리한다.

### 4.3 파싱 실패는 조용히 삼키지 않는다

admin 조회는 운영 확인 도구이므로, row/header가 깨졌다면 즉시 에러를 내는 쪽이 맞다.

예:

- header mismatch
- JSON parse failure
- 필수 컬럼 누락

이런 오류는 `Error`로 올리고 route에서 `503`으로 감싼다.

## 5. UI 작성 규칙

### 5.1 admin 전용 컴포넌트는 `components/admin`에 둔다

현재 기준:

- `apps/web/components/admin/admin-shell.tsx`
- `apps/web/components/admin/results-table.tsx`
- `apps/web/components/admin/questions-table.tsx`

공용 product UI 컴포넌트와 섞지 않는다.

### 5.2 1차 UI는 운영 확인 우선이다

admin UI는 브랜드 랜딩 페이지처럼 만들 필요가 없다.

우선순위:

1. 데이터가 잘 보이는가
2. 오류 원인이 드러나는가
3. 조회가 빠른가

그래서 다음을 우선한다.

- 표 형식
- raw JSON 상세
- 명확한 empty/error state

질문 수정, 통계 시각화, publish workflow처럼 조회를 넘어서는 기능은 1차 규칙만으로 확장하지 말고 아래 문서를 먼저 확인한다.

- `authjs-admin-ui-phase-2-expansion-plan.md`
- `authjs-admin-ui-phase-2-api-contracts.md`
- `question-approval-thread-runbook.md`
- `question-publish-rollback-runbook.md`

현재 publish workflow는 단순 `review-ready -> publish`가 아니라 `ApprovalRequests` 기반 `request -> approve/reject -> publish` gating을 전제로 한다.

### 5.3 검색은 exact match부터 시작한다

`sessionId` 같은 운영 키는 fuzzy search보다 exact match가 낫다.

이유:

- 구현이 단순하다
- 결과가 예측 가능하다
- 시트 기반 조회 비용을 통제하기 쉽다

## 6. 테스트 규칙

### 6.1 앱 테스트

새 admin API를 추가하면 route test를 같이 추가한다.

예:

- `apps/web/app/api/admin/results/route.test.ts`
- `apps/web/app/api/admin/results/[sessionId]/route.test.ts`
- `apps/web/app/api/admin/questions/route.test.ts`

최소 확인 항목:

- `401`
- `403`
- 성공 응답
- backend error -> `503`

### 6.2 권한 유틸 테스트

allowlist나 세션 상태 helper를 바꾸면 `apps/web/lib/admin-access.test.ts`를 같이 수정한다.

### 6.3 패키지 테스트

시트 row parser나 read-model을 바꾸면 `packages/operations/spreadsheet-admin/src/**/*.test.ts`를 같이 수정한다.

현재 기준:

- `src/result-source/read-results.test.ts`
- `src/runtime/service.test.ts`

## 7. env / 문서 갱신 규칙

Auth.js 관련 env를 추가/변경하면 아래를 같이 갱신한다.

- `apps/web/.env.example`
- `docs/operations/env-registration-guide.md`

admin 구조나 작업 원칙이 바뀌면 아래도 같이 본다.

- `docs/admin/README.md`
- `docs/admin/authjs-admin-ui-adoption-design.md`
- `docs/admin/authjs-admin-access-control-plan.md`
- `docs/admin/authjs-admin-ui-phase-2-api-contracts.md`
- `docs/admin/question-approval-thread-runbook.md`
- `docs/admin/question-publish-rollback-runbook.md`

## 8. 새 admin 기능 추가 체크리스트

예를 들어 `/admin/metrics`를 추가한다고 가정하면 순서는 이렇다.

1. `spreadsheet-admin`에 필요한 조회 helper 추가
2. helper 테스트 추가
3. `apps/web/app/api/admin/metrics/route.ts` 추가
4. route test 추가
5. `apps/web/app/admin/(protected)/metrics/page.tsx` 추가
6. `components/admin/*` 필요 컴포넌트 추가
7. nav 링크 추가
8. env/doc 변경 여부 확인
9. `pnpm --filter @workspace/spreadsheet-admin test`
10. `pnpm --filter web test`
11. `pnpm --filter web build`

## 9. 하지 말아야 할 것

- 브라우저에서 Google Sheets API 직접 호출
- 서비스 계정 키를 클라이언트로 전달
- admin page만 막고 `/api/admin/*`는 열어두기
- 앱 레이어에서 시트 row를 직접 파싱
- 무제한 Results 전체 조회 계약 추가
- allowlist 파싱을 여러 파일에 중복 구현

## 10. 현재 소스 오브 트루스

구현 기준으로 가장 먼저 볼 파일:

- `apps/web/auth.config.ts`
- `apps/web/lib/admin-access.ts`
- `apps/web/app/admin/(protected)/layout.tsx`
- `apps/web/app/api/admin/route-deps.ts`
- `packages/operations/spreadsheet-admin/src/runtime/service.ts`
- `packages/operations/spreadsheet-admin/src/result-source/read-results.ts`

새 기능 설계가 이 파일들의 책임을 깨기 시작하면, 먼저 구조를 다시 나누는 게 맞다.
