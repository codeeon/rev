# Auth.js Admin 접근 제어 계획

## 1) 목적

`/admin`과 `/api/admin/*`를 관리자만 사용할 수 있게 보호한다.

1차 목표:

- Google 로그인 사용
- 서버 세션 기준 관리자 판별
- 이메일 allowlist 기반 권한 제어
- 페이지와 API를 같은 규칙으로 차단

비목표:

- 세분화된 역할 체계(`viewer`, `editor`, `owner`)
- 조직/팀 동기화
- 사용자 관리 UI

위 비목표는 phase 1 기준이다. phase 2 role 기반 확장은 `authjs-admin-ui-phase-2-expansion-plan.md`에서 다룬다.

## 2) 권한 모델

1차 권한 모델은 단순하다.

- 인증: Auth.js + Google Provider
- 인가: `ADMIN_ALLOWED_EMAILS`
- 세션 전략: `jwt`

관리자 판별 규칙:

1. 로그인 성공 후 서버가 사용자 이메일을 확인한다.
2. 이메일을 `trim().toLowerCase()`로 정규화한다.
3. 정규화한 이메일이 `ADMIN_ALLOWED_EMAILS`에 있으면 관리자다.
4. 아니면 비관리자로 취급한다.

## 3) 환경 변수

필수:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `ADMIN_ALLOWED_EMAILS`

예:

```env
ADMIN_ALLOWED_EMAILS=owner@example.com,ops@example.com
```

파싱 규칙:

- 쉼표 구분
- 공백 제거
- 소문자 정규화
- 빈 값 제거

## 4) 세션 설계

세션에는 최소 정보만 둔다.

권장 세션 필드:

```ts
type AdminSessionUser = {
  name?: string | null
  email?: string | null
  image?: string | null
  isAdmin: boolean
}
```

JWT에는 최소한 아래가 들어간다.

- `email`
- `isAdmin`

원칙:

- 권한 판단은 로그인 시점에 1회만 하지 않는다.
- 필요 시 `jwt` callback에서도 `isAdmin`을 다시 계산할 수 있게 한다.
- 클라이언트가 `isAdmin`을 바꾸는 구조를 만들지 않는다.

## 5) Auth.js 설정 포인트

권장 파일:

- `apps/web/auth.config.ts`
- `apps/web/auth.ts`
- `apps/web/lib/admin-access.ts`

`auth.config.ts` 책임:

- Google Provider 설정
- `signIn` callback에서 기본 이메일 유효성 검사
- `jwt` callback에서 `isAdmin` 주입
- `session` callback에서 `session.user.isAdmin` 주입

`admin-access.ts` 책임:

- `parseAdminAllowedEmails(env)`
- `normalizeEmail(email)`
- `isAllowedAdminEmail(email, env)`
- `assertAdminSession(session)`

핵심 원칙:

- allowlist 파싱 로직은 한 곳에 둔다.
- 페이지/route/middleware에서 중복 파싱하지 않는다.

## 6) 페이지 보호

보호 대상:

- `/admin`
- `/admin/results`
- `/admin/questions`

권장 1차 방식:

- `apps/web/app/admin/layout.tsx`에서 `auth()` 호출
- 세션 없음 -> `/admin/login`
- `session.user.isAdmin !== true` -> `/admin/login?error=AccessDenied`

이유:

- 서버 컴포넌트에서 바로 차단할 수 있다.
- admin 하위 페이지가 같은 규칙을 공유한다.

선택적으로:

- `apps/web/proxy.ts`에서 `/admin` prefix 차단 가능

다만 1차에서는 `layout.tsx` 서버 가드만으로도 충분하다.

## 7) API 보호

보호 대상:

- `/api/admin/results`
- `/api/admin/results/[sessionId]`
- `/api/admin/questions`

권장 공통 규칙:

1. route 시작에서 `auth()` 호출
2. 세션 없음 -> `401`
3. `session.user.isAdmin !== true` -> `403`
4. 통과 시에만 `@workspace/spreadsheet-admin/server` 호출

권장 응답 형태:

```json
{ "error": "unauthorized" }
```

```json
{ "error": "forbidden" }
```

중요:

- UI에서 숨겨도 API가 열려 있으면 안 된다.
- 페이지 보호와 API 보호를 분리해서 둘 다 구현한다.

## 8) 로그인/로그아웃 흐름

### 로그인

1. 사용자가 `/admin/login` 방문
2. Google 로그인 버튼 클릭
3. Auth.js `signIn('google')`
4. 로그인 성공
5. 서버가 allowlist 확인
6. 관리자면 `/admin` 이동
7. 비관리자면 로그인은 되더라도 admin 접근은 차단

권장 UX:

- `/admin/login?error=AccessDenied`
- 화면에 "허용된 관리자 계정이 아닙니다" 메시지 표시

### 로그아웃

1. admin 화면에서 로그아웃 클릭
2. `signOut({ callbackUrl: '/admin/login' })`
3. 세션 제거
4. `/admin` 재진입 차단

## 9) 실패 시나리오

### 9.1 이메일 없음

- Google provider 응답에 이메일이 없으면 로그인 차단

### 9.2 allowlist 불일치

- 세션은 있더라도 admin은 아님
- `/admin` 페이지는 접근 차단
- `/api/admin/*`는 `403`

### 9.3 allowlist 설정 누락

- 안전 기본값은 "아무도 관리자 아님"이다
- `ADMIN_ALLOWED_EMAILS`가 비어 있으면 admin 접근 전면 차단

### 9.4 세션 만료

- `/admin`은 `/admin/login`으로 이동
- `/api/admin/*`는 `401`

## 10) 구현 순서

1. `apps/web/package.json`에 Auth.js 추가
2. `apps/web/lib/admin-access.ts` 생성
3. `apps/web/auth.config.ts`에 allowlist/callback 정의
4. `apps/web/auth.ts` 생성
5. `apps/web/app/api/auth/[...nextauth]/route.ts` 연결
6. `apps/web/app/admin/layout.tsx` 보호 가드 추가
7. `/api/admin/*` route에 `auth()` 기반 검증 추가
8. `/admin/login` 오류 메시지 처리 추가
9. `.env.example`와 운영 문서 갱신

## 11) 테스트 계획

단위 테스트:

- `normalizeEmail`
- `parseAdminAllowedEmails`
- `isAllowedAdminEmail`

인증 테스트:

- allowlist 포함 이메일은 `isAdmin: true`
- allowlist 미포함 이메일은 `isAdmin: false`
- 이메일 없음은 차단

페이지/API 테스트:

- 비로그인 사용자의 `/admin` 접근 차단
- 비관리자 세션의 `/admin` 접근 차단
- 비로그인 사용자의 `/api/admin/*`는 `401`
- 비관리자 세션의 `/api/admin/*`는 `403`
- 관리자 세션만 정상 응답

## 12) 완료 기준

- 관리자 이메일만 `/admin` 진입 가능
- 관리자 이메일만 `/api/admin/*` 호출 가능
- 권한 판별 로직이 한 곳에 모여 있다
- allowlist 변경 시 코드 수정 없이 env만으로 반영 가능

## 13) phase 2 접근 제어 메모

다중 관리자 운영과 질문 수정/배포 기능이 들어가면 phase 1 allowlist만으로는 부족하다.

다음 단계에서 필요한 것:

- 역할 모델(`viewer`, `editor`, `owner`)
- 역할별 page/API 권한 매트릭스
- publish/rollback 같은 mutation 액션의 추가 보호
- audit log에 사용자 이메일과 역할 기록

세부 태스크는 `authjs-admin-ui-phase-2-expansion-plan.md`를 본다.
