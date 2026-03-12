# Auth.js 기반 Admin UI 도입 설계

## 1) 목적

운영자가 브라우저에서 Google Sheets 기반 운영 데이터를 조회할 수 있는 최소 admin UI를 추가한다.

범위:

- Auth.js 기반 Google 로그인
- JWT session 기반 관리자 권한 확인
- 결과/질문 조회용 admin API
- `/admin` 화면

비범위:

- 브라우저에서 Google Sheets API 직접 호출
- 서비스 계정 키를 클라이언트에 노출하는 구조
- 질문 수정 UI
- 고급 분석용 검색/집계 대시보드

## 2) 설계 결론

이 저장소에서는 아래 구조를 기준으로 한다.

```text
브라우저
└─ /admin UI
   ├─ Auth.js (Google 로그인)
   └─ Next API (/api/admin/*)
      └─ @workspace/spreadsheet-admin/server
         └─ @workspace/google-sheets
            └─ Google Sheets API
```

핵심은 `인증은 apps/web 안의 Auth.js`, `운영 데이터 접근은 기존 spreadsheet-admin 패키지`로 분리하는 것이다.

## 3) 왜 Firebase가 아니라 Auth.js인가

현재 조건:

- Next.js 웹 앱 1개
- 내부 관리자 화면
- Google 로그인만 필요
- 별도 사용자 DB 없음

이 조건에서는 Firebase보다 Auth.js가 더 단순하다.

이유:

- Next App Router와 세션 모델이 바로 붙는다.
- `ID token -> 별도 session cookie` 브리지를 직접 설계하지 않아도 된다.
- 관리자 수가 적은 내부 툴에서는 이메일 allowlist로 충분하다.
- Google Sheets 접근은 이미 서버 서비스 계정으로 해결되어 있다.

## 4) 패키지/앱 경계

### 4.1 앱 레이어

`apps/web`

책임:

- Auth.js 설정
- `/admin/login`
- `/admin`
- `/admin/results`
- `/admin/questions`
- `/api/auth/*`
- `/api/admin/results`
- `/api/admin/questions`

중요한 예외:

- 인증 프레임워크는 외부 서비스 SDK이지만, Auth.js는 Next 라우팅/세션/프록시와 강하게 결합된다.
- 따라서 이번 경우에는 `packages/operations/*`로 빼지 않고 `apps/web` 안에 둔다.

### 4.2 기존 패키지

`@workspace/spreadsheet-admin`

유지 책임:

- Questions 시트 조회
- Results 시트 조회/저장
- 질문 정규화/동기화

변경 방향:

- 현재 `save` 중심 API에 더해 `listResults`, `getResultBySessionId`, `listQuestions` 같은 조회 API를 admin 소비용으로 확장

## 5) 인증 모델

### 5.1 로그인 흐름

1. `/admin/login`에서 Google 로그인 버튼 클릭
2. Auth.js가 Google OAuth를 처리
3. 로그인 성공 후 JWT session 생성
4. 서버는 allowlist를 기준으로 관리자만 통과시킨다
5. `/admin` 및 `/api/admin/*`는 `auth()`로 세션을 검증한다

### 5.2 권한 모델

1차는 이메일 allowlist가 가장 단순하다.

예:

- `ADMIN_ALLOWED_EMAILS=owner@example.com,ops@example.com`

권한 판단 원칙:

- 클라이언트에서 보이는 이메일로 판단하지 않는다
- 서버의 Auth.js callback 또는 공통 helper에서 판단한다

### 5.3 세션 정책

- 세션 전략은 `jwt`
- 관리자 페이지는 서버에서 `auth()`로 검증 후 렌더
- `/admin`과 `/api/admin/*`는 비로그인 또는 비관리자면 차단
- 로그아웃은 Auth.js `signOut()` 또는 `/api/auth/signout`을 사용

Firebase 안에서 흔한 `클라이언트 로그인 상태`와 `서버 쿠키 상태` 불일치 문제를 여기서는 만들지 않는다.

## 6) Admin UI 정보 구조

### 6.1 화면

- `/admin/login`
  - Google 로그인 버튼
  - 비허용 계정 안내 메시지

- `/admin`
  - Admin 진입 화면
  - 질문 버전/질문 수 요약
  - 최근 결과 수 요약
  - Results / Questions 링크

- `/admin/results`
  - 최근 결과 테이블
  - `sessionId` exact search
  - `questionVersion`, `birthTimeKnowledge` 필터
  - JSON 상세 보기

- `/admin/questions`
  - 현재 Questions 시트 목록 조회
  - `version`, `questionId`, `questionWeight`, option 수 확인

### 6.2 1차 기능 범위

1차 조회 범위:

- 최근 결과 목록
- 특정 `sessionId` 검색
- 현재 질문 버전과 질문 수 확인

1차 제외:

- 질문 수정
- 시트 refresh 버튼
- 운영 상태 카드(`질문 sync 상태`, `결과 저장 상태`)
- 임의 날짜 범위 전수 검색
- 인라인 셀 편집

## 7) 데이터 접근 설계

중요 원칙:

- 브라우저는 Google Sheets API를 직접 호출하지 않는다
- 모든 데이터 접근은 `/api/admin/*`를 통해 서버에서 수행한다
- 서버는 기존 `@workspace/spreadsheet-admin/server`를 계속 사용한다

### 7.1 Results 조회 제한

현재 `Results` 시트는 append-only 로그이며, 일부 상세는 JSON 컬럼으로 저장된다.

따라서 1차는 아래 제약을 둔다.

- 기본 조회는 `최근 N건`만 지원
- `sessionId` 검색은 exact match만 지원
- 필터는 `questionVersion`, `birthTimeKnowledge`만 지원
- 범위 없는 전체 스캔 API는 만들지 않는다

권장 기본값:

- 기본 limit: `100`
- 최대 limit: `200`

### 7.2 Questions 조회

- 현재 Questions 시트의 최신 목록을 서버에서 읽어 반환한다
- 1차에서는 별도 refresh endpoint를 두지 않는다
- `GET /api/admin/questions` 자체가 최신 조회 역할을 한다

## 8) 서버 API 설계

### 8.1 인증 API

Auth.js 기본 라우트를 사용한다.

- `GET/POST /api/auth/*`

별도 `session/login`, `session/logout`, `session/me` API는 1차에서 만들지 않는다.

### 8.2 데이터 API

- `GET /api/admin/results`
  - 최근 결과 목록
  - 쿼리: `limit`, `sessionId`, `questionVersion`, `birthTimeKnowledge`

- `GET /api/admin/results/[sessionId]`
  - 단건 상세

- `GET /api/admin/questions`
  - 현재 시트 질문 목록

## 9) 환경 변수

### 9.1 새 env

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `ADMIN_ALLOWED_EMAILS`

선택:

- `AUTH_TRUST_HOST`
- `AUTH_URL`

### 9.2 기존 env 유지

- `GOOGLE_SPREADSHEET_ADMIN_ID`
- `GOOGLE_SERVICE_ACCOUNT_*`
- `GOOGLE_SPREADSHEET_QUESTIONS_RANGE`
- `GOOGLE_SPREADSHEET_RESULTS_RANGE`

## 10) 보안 원칙

- 관리자 권한은 서버에서 검증한다
- `/admin`과 `/api/admin/*`는 전부 세션 검증을 통과해야 한다
- `ADMIN_ALLOWED_EMAILS` 비교는 서버에서만 수행한다
- 서비스 계정 키는 절대 클라이언트 번들에 포함하지 않는다
- 세션에는 최소한의 사용자 정보만 저장한다

## 11) 1차 구현 대상 파일

앱:

- `apps/web/package.json`
- `apps/web/auth.config.ts`
- `apps/web/auth.ts`
- `apps/web/proxy.ts`
- `apps/web/app/api/auth/[...nextauth]/route.ts`
- `apps/web/lib/admin-access.ts`
- `apps/web/app/admin/login/page.tsx`
- `apps/web/app/admin/layout.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/results/page.tsx`
- `apps/web/app/admin/questions/page.tsx`
- `apps/web/app/api/admin/results/route.ts`
- `apps/web/app/api/admin/results/[sessionId]/route.ts`
- `apps/web/app/api/admin/questions/route.ts`

패키지:

- `packages/operations/spreadsheet-admin/src/result-sink/*`
- `packages/operations/spreadsheet-admin/src/question-source/*`
- `packages/operations/spreadsheet-admin/src/server.ts`

## 12) 도입 순서

1. `apps/web`에 Auth.js 설정 추가
2. `/admin/login`과 `/admin` 보호 레이아웃 추가
3. `spreadsheet-admin`에 조회 API 추가
4. `/api/admin/results`, `/api/admin/questions` 추가
5. `/admin/results`, `/admin/questions` 화면 추가

## 13) 왜 이 구조가 맞는가

- 현재 프로젝트의 인증 요구사항에는 Firebase보다 단순하다
- 별도 인증 패키지를 만들지 않아도 Next 앱 안에서 경계가 명확하다
- 기존 Sheets 연동 구조를 그대로 재사용한다
- DB 없이도 `내부 조회용 admin` 범위는 충분히 커버할 수 있다
