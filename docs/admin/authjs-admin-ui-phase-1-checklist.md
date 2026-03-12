# Auth.js 기반 Admin UI 1차 체크리스트

## 작업 범위

- [ ] `apps/web`에 Auth.js 설정 추가
- [ ] Google provider 설정 추가
- [ ] `ADMIN_ALLOWED_EMAILS` allowlist 추가
- [ ] `/api/auth/*` route 추가
- [ ] `/api/admin/results` 추가
- [ ] `/api/admin/results/[sessionId]` 추가
- [ ] `/api/admin/questions` 추가
- [ ] `/admin/login` 페이지 추가
- [ ] `/admin` 보호 레이아웃 추가
- [ ] `/admin/results` 페이지 추가
- [ ] `/admin/questions` 페이지 추가

## 경계 확인

- [ ] Auth.js는 `apps/web` 안에서만 직접 설정한다
- [ ] 브라우저는 Google Sheets API를 직접 호출하지 않는다
- [ ] admin 데이터는 `@workspace/spreadsheet-admin/server`를 통해서만 읽는다
- [ ] 인증 프레임워크와 운영 데이터 접근 경계가 분리되어 있다

## 보안 확인

- [ ] 관리자 권한은 서버에서 검증한다
- [ ] `ADMIN_ALLOWED_EMAILS` 비교는 서버에서 수행한다
- [ ] `/admin`과 `/api/admin/*` 전체가 세션 검증을 통과해야 한다
- [ ] 서비스 계정 키는 클라이언트에 노출되지 않는다

## UX 확인

- [ ] 비로그인 상태에서 `/admin` 접근 시 `/admin/login`으로 이동한다
- [ ] 비관리자 로그인 시 접근이 차단된다
- [ ] 로그인 성공 시 `/admin`으로 이동한다
- [ ] 로그아웃 후 admin 화면 재진입이 차단된다
- [ ] 결과 목록이 비어 있을 때 빈 상태 UI가 있다
- [ ] 질문 목록에서 현재 version과 question 수가 보인다

## 조회 정책 확인

- [ ] 기본 Results 조회는 최근 N건만 읽는다
- [ ] `sessionId` 검색은 exact match다
- [ ] `questionVersion`, `birthTimeKnowledge` 필터만 1차 지원한다
- [ ] 범위 없는 전체 스캔 API를 만들지 않는다
- [ ] `questions/refresh` endpoint는 만들지 않는다

## 운영 확인

- [ ] Auth.js env가 `.env.example`와 운영 환경에 정리되어 있다
- [ ] `ADMIN_ALLOWED_EMAILS` 값이 설정되어 있다
- [ ] Google Sheets service account는 기존대로 유지된다
- [ ] admin 접근 로그와 Sheets 조회 로그가 구분되어 보인다

## 테스트 확인

- [ ] Auth.js allowlist/세션 테스트 추가
- [ ] admin results/questions route 테스트 추가
- [ ] spreadsheet-admin 조회 helper 테스트 추가
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm ci:monorepo` 통과
