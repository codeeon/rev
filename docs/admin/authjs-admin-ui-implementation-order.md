# Auth.js 기반 Admin UI 구현 순서

이 문서는 `1차 admin UI`를 가장 낮은 리스크로 구현하기 위한 파일별 순서를 정리한다.

## 1) 앱 인증 추가

### 1.1 `apps/web/package.json`

- `next-auth` 의존성 추가

### 1.2 `apps/web/auth.config.ts`

- Google provider 설정
- `ADMIN_ALLOWED_EMAILS` allowlist 검사
- 로그인 성공/실패 정책 정의

### 1.3 `apps/web/auth.ts`

- `NextAuth(...)` 초기화
- `auth`, `signIn`, `signOut`, `handlers` export

### 1.4 `apps/web/app/api/auth/[...nextauth]/route.ts`

- Auth.js route handler 연결

### 1.5 `apps/web/proxy.ts`

- `/admin` 및 필요 경로 보호
- 비로그인/비관리자 접근 차단

### 1.6 `apps/web/lib/admin-access.ts`

- allowlist 파싱
- 세션 user에서 admin 여부 판정
- 공통 에러/redirect helper

## 2) spreadsheet-admin 확장

### 2.1 `packages/operations/spreadsheet-admin/src/result-sink/*`

- append 전용 API 외에 결과 row 조회 API 추가
- `최근 N건` 조회 정책 정의
- `sessionId` exact match 조회 helper 추가

### 2.2 `packages/operations/spreadsheet-admin/src/question-source/*`

- admin 조회용 질문 목록 반환 helper 추가

### 2.3 `packages/operations/spreadsheet-admin/src/server.ts`

- 결과 조회/질문 조회 export 추가

## 3) app API 추가

### 3.1 `apps/web/app/api/admin/results/route.ts`

- `auth()` 세션 검증
- `limit`, `sessionId`, `questionVersion`, `birthTimeKnowledge` 파싱
- `@workspace/spreadsheet-admin/server` 결과 조회 호출

### 3.2 `apps/web/app/api/admin/results/[sessionId]/route.ts`

- `auth()` 세션 검증
- 단건 상세 반환

### 3.3 `apps/web/app/api/admin/questions/route.ts`

- `auth()` 세션 검증
- 현재 질문 목록 조회

1차에서는 별도 `/api/admin/session/*`과 `/api/admin/questions/refresh`를 만들지 않는다.

## 4) admin 화면 추가

### 4.1 `apps/web/app/admin/login/page.tsx`

- Google 로그인 버튼
- 비허용 계정 오류 안내
- 로그인 성공 시 `/admin` 이동

### 4.2 `apps/web/app/admin/layout.tsx`

- 세션 없는 경우 `/admin/login` 리다이렉트
- 공통 nav 제공

### 4.3 `apps/web/app/admin/page.tsx`

- Admin 진입 화면
- 질문 버전/질문 수 요약
- 최근 결과 수 요약

### 4.4 `apps/web/app/admin/results/page.tsx`

- 최근 결과 테이블
- `sessionId` exact search
- 제한된 필터 UI

### 4.5 `apps/web/app/admin/questions/page.tsx`

- 질문 버전/목록 표시

## 5) 공통 컴포넌트

필요 시:

- `apps/web/components/admin/admin-shell.tsx`
- `apps/web/components/admin/results-table.tsx`
- `apps/web/components/admin/questions-table.tsx`
- `apps/web/components/admin/google-login-button.tsx`

admin 전용 컴포넌트는 앱 안에 둔다.

## 6) 테스트 추가

### 앱 테스트

- `apps/web/auth*.test.ts`
- allowlist와 세션 callback 검증
- `apps/web/app/api/admin/results/route.test.ts`
- `apps/web/app/api/admin/results/[sessionId]/route.test.ts`
- `apps/web/app/api/admin/questions/route.test.ts`

### 패키지 테스트

- `packages/operations/spreadsheet-admin/src/*/*.test.ts`
- 결과 조회 helper와 질문 조회 helper 검증

## 7) 문서/환경 정리

- `apps/web/.env.example`에 Auth.js env 추가
- `docs/operations/env-registration-guide.md`에 admin auth env 섹션 추가
- `docs/architecture.md`에 admin 흐름 링크 갱신

## 8) 1차 완료 기준

- Google 로그인 성공
- 관리자만 `/admin` 접근 가능
- Questions 목록 조회 가능
- Results 목록 조회 가능
- 전체 스캔 없는 제한된 조회 정책이 문서와 구현에 반영됨
