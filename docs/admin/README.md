# Admin 문서 인덱스

`docs/admin`은 Auth.js 기반 admin UI의 1차 도입과 2차 확장 계획 문서를 모아둔 경로다.

대상:

- 관리자용 인증/권한 구조를 설계하는 사람
- `apps/web`에 `/admin` 화면을 붙일 사람
- Google Sheets 기반 운영 데이터를 조회할 내부 admin 기능을 구현할 사람

## 구성

- `authjs-admin-ui-adoption-design.md`
- `authjs-admin-access-control-plan.md`
- `authjs-admin-ui-authoring-guide.md`
- `authjs-admin-ui-implementation-order.md`
- `authjs-admin-ui-phase-1-checklist.md`
- `authjs-admin-ui-phase-2-expansion-plan.md`

## 핵심 원칙

- Auth.js는 `apps/web` 안에서만 설정한다.
- Google Sheets 접근은 브라우저가 아니라 서버가 계속 맡는다.
- 운영 데이터 접근은 `@workspace/spreadsheet-admin/server`를 통해서만 수행한다.
- admin 화면과 라우트는 `apps/web`에 둔다.

## 빠른 읽기

1. 구조와 책임 분리가 궁금하면 `authjs-admin-ui-adoption-design.md`
2. 접근 권한 제어만 따로 보면 `authjs-admin-access-control-plan.md`
3. 실제 구현 규칙과 확장 기준은 `authjs-admin-ui-authoring-guide.md`
4. 실제 파일 작업 순서가 필요하면 `authjs-admin-ui-implementation-order.md`
5. PR/작업 체크리스트가 필요하면 `authjs-admin-ui-phase-1-checklist.md`
6. 다중 관리자/통계/질문 수정 확장 계획은 `authjs-admin-ui-phase-2-expansion-plan.md`
