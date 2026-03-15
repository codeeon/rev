# Auth.js 기반 Admin UI 1차 체크리스트

기준 시점: `2026-03-15`

체크 기준:

- `[x]` 구현 또는 로컬 검증까지 끝난 항목
- `[ ]` 아직 수동 확인, 운영 설정, 후속 개선이 남은 항목

## 작업 범위

- [x] `apps/web`에 Auth.js 설정 추가
- [x] Google provider 설정 추가
- [x] `ADMIN_ALLOWED_EMAILS` allowlist 추가
- [x] `/api/auth/*` route 추가
- [x] `/api/admin/results` 추가
- [x] `/api/admin/results/[sessionId]` 추가
- [x] `/api/admin/questions` 추가
- [x] `/admin/login` 페이지 추가
- [x] `/admin` 보호 레이아웃 추가
- [x] `/admin/results` 페이지 추가
- [x] `/admin/questions` 페이지 추가

## 경계 확인

- [x] Auth.js는 `apps/web` 안에서만 직접 설정한다
- [x] 브라우저는 Google Sheets API를 직접 호출하지 않는다
- [x] admin 데이터는 `@workspace/spreadsheet-admin/server`를 통해서만 읽는다
- [x] 인증 프레임워크와 운영 데이터 접근 경계가 분리되어 있다

## 보안 확인

- [x] 관리자 권한은 서버에서 검증한다
- [x] `ADMIN_ALLOWED_EMAILS` 비교는 서버에서 수행한다
- [x] `/admin`과 `/api/admin/*` 전체가 세션 검증을 통과해야 한다
- [x] 서비스 계정 키는 클라이언트에 노출되지 않는다

## UX 확인

- [x] 비로그인 상태에서 `/admin` 접근 시 `/admin/login`으로 이동한다
- [x] 비관리자 로그인 시 접근이 차단된다
- [x] 로그인 성공 시 `/admin`으로 이동한다
- [x] 로그아웃 후 admin 화면 재진입이 차단된다
- [x] 결과 목록이 비어 있을 때 빈 상태 UI가 있다
- [x] 질문 목록에서 현재 version과 question 수가 보인다

## 조회 정책 확인

- [x] 기본 Results 조회는 최근 N건만 읽는다
- [x] `sessionId` 검색은 exact match다
- [x] `questionVersion`, `birthTimeKnowledge` 필터만 1차 지원한다
- [x] 범위 없는 전체 스캔 API를 만들지 않는다
- [x] `questions/refresh` endpoint는 만들지 않는다

## 운영 확인

- [x] Auth.js env가 `.env.example`와 운영 환경에 정리되어 있다
- [ ] `ADMIN_ALLOWED_EMAILS` 값이 설정되어 있다
- [x] Google Sheets service account는 기존대로 유지된다
- [ ] admin 접근 로그와 Sheets 조회 로그가 구분되어 보인다

## 테스트 확인

- [x] Auth.js allowlist/세션 테스트 추가
- [x] admin results/questions route 테스트 추가
- [x] spreadsheet-admin 조회 helper 테스트 추가
- [x] `pnpm test` 통과
- [x] `pnpm build` 통과
- [x] `pnpm ci:monorepo` 통과

## 현재 남은 태스크

- [ ] 실제 Google OAuth env를 넣고 `/admin/login`부터 로그인 플로우 수동 확인
- [ ] `ADMIN_ALLOWED_EMAILS` 운영값 등록

## 2차 확장 태스크 플랜

상세 설계 문서: `authjs-admin-ui-phase-2-expansion-plan.md`

### 권한/역할 모델

- [ ] Google OAuth 기반 다중 관리자 운영을 전제로 `viewer` / `editor` / `owner` 역할 모델 문서화
- [ ] 역할별 접근 범위 매트릭스 정의
- [ ] 조회 화면, 질문 수정 화면, 버전 배포 액션에 필요한 권한 경계 정리
- [ ] 초기에는 allowlist 기반으로 role을 둘지, 별도 admin 설정 저장소로 옮길지 결정

### 결과 통계 시각화

- [ ] `/admin` 또는 별도 통계 화면에서 보여줄 핵심 KPI 정의
- [ ] `questionVersion`, `birthTimeKnowledge`, `feedback`, `confidence` 기준 집계 항목 문서화
- [ ] 시트 원본 조회와 별도 read model/집계 캐시 중 어떤 구조로 갈지 결정
- [ ] 차트/테이블용 admin API 계약 초안 작성

### 질문 수정 / 버전 관리

- [ ] Questions 편집 화면의 정보 구조와 편집 단위 정의
- [ ] draft -> review -> publish 버전 워크플로 문서화
- [ ] version bump 규칙, publishedAt, updatedBy, 변경 사유 필드 정의
- [ ] 질문 수정 시 validation 규칙과 실패 처리 정책 정리
- [ ] rollback 또는 이전 version 재배포 정책 결정

### 운영 / 감사

- [ ] 누가 질문을 수정하고 배포했는지 남기는 audit log 항목 정의
- [ ] admin 접근 로그와 Sheets read/write 로그를 구분해서 남기는 방식 정리
- [ ] 다중 관리자 동시 수정 충돌 방지 정책 정의
- [ ] 운영 변경 전 확인 절차와 배포 체크리스트 초안 작성
