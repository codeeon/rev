# Auth.js Admin UI 2차 확장 계획

기준 시점: `2026-03-15`

## 1) 목적

1차 admin UI 위에 아래 확장 요구를 안전하게 얹기 위한 후속 계획을 정리한다.

대상 요구:

- Google OAuth 기반 다중 관리자 운영
- 결과 통계 시각화
- 질문 수정 기능
- 질문 version 업데이트 / publish 흐름
- 운영 감사와 변경 이력 추적

이 문서는 `왜 이 구조가 필요한가`보다 `무엇을 어떤 순서로 만들 것인가`에 집중한다.

## 2) 현재 상태 요약

이미 구현된 범위:

- Auth.js + Google provider + JWT session
- `ADMIN_ALLOWED_EMAILS` 기반 1차 admin 인가
- `/admin/results`, `/admin/questions`
- `sessionId`, `questionVersion`, `birthTimeKnowledge` exact filter
- 최근 window 기반 bounded recent-scan 조회
- 범위 없는 전체 Results 스캔 제거

아직 없는 범위:

- 역할 분리(`viewer`, `editor`, `owner`)
- 결과 통계 대시보드
- 질문 수정 UI
- draft/review/publish version workflow
- audit log와 변경 승인 흐름

## 3) 설계 전제

### 3.1 인증은 계속 Google OAuth

이 단계에서는 인증 방식을 Credentials로 바꾸지 않는다.

이유:

- 관리자 2명 이상이 각자 자신의 계정으로 로그인해야 한다.
- 질문 수정/배포 이력을 사용자 이메일 기준으로 남길 수 있어야 한다.
- 이후 권한 분리 시 `누가 어떤 역할인지`를 계정 단위로 연결하기 쉽다.

### 3.2 인가는 2단계로 나눈다

초기 확장:

- Google OAuth 로그인
- allowlist 통과 계정만 admin 진입
- role은 별도 정책 저장소에서 관리

권장 진화 순서:

1. phase 2 초반: allowlist + role map
2. phase 2 후반 또는 phase 3: 별도 admin 설정 저장소 또는 DB

### 3.3 Sheets는 운영 데이터 source이지만 권한 source는 아니다

질문/결과 데이터는 계속 Google Sheets에 둘 수 있다.

하지만 아래 정보는 장기적으로 Sheets보다 별도 저장소가 더 적합하다.

- 관리자 role
- 배포 승인 상태
- audit log
- draft와 published version 간 관계

초기에는 문서화와 최소 구현으로 시작하되, 권한과 감사는 eventually DB 또는 별도 settings data source로 갈 수 있도록 경계를 열어 둔다.

## 4) 목표 정보 구조

### 4.1 역할 모델

초기 role 제안:

- `viewer`
  - 결과 목록/상세 조회
  - 통계 대시보드 조회
  - 질문 목록 조회

- `editor`
  - `viewer` 권한 포함
  - draft 질문 편집
  - version 초안 생성

- `owner`
  - `editor` 권한 포함
  - publish / rollback
  - 관리자 role 관리

### 4.2 주요 화면

- `/admin`
  - 운영 개요
  - 최근 결과 수
  - 최신 질문 version
  - 통계 진입 링크
  - 질문 편집 진입 링크

- `/admin/results`
  - 기존 결과 목록
  - 필터 유지
  - 통계 drill-down 링크

- `/admin/analytics`
  - 결과 통계 KPI
  - version별 분포
  - birthTimeKnowledge 분포
  - feedback / confidence 분포

- `/admin/questions`
  - published version 목록
  - draft 목록
  - 편집 진입 링크

- `/admin/questions/[version]`
  - 질문 세트 상세
  - role/category/questionWeight/option 구조 확인

- `/admin/questions/[version]/edit`
  - draft 편집 화면
  - validation 결과
  - 변경 요약

- `/admin/questions/publish`
  - publish 대상 확인
  - 변경 diff
  - 승인/배포 액션

## 5) 작업 스트림

## 5.1 권한/역할 스트림

### 목표

- 다중 관리자 운영을 지원한다.
- 조회/수정/배포 권한을 분리한다.

### 태스크

- [ ] `viewer` / `editor` / `owner` 역할 정의
- [ ] role 별 페이지/API 접근 매트릭스 작성
- [ ] `session.user.role` 또는 equivalent helper 설계
- [ ] phase 2 초기 role 저장 방식 결정
  - 후보 A: env 기반 role map
  - 후보 B: admin settings sheet
  - 후보 C: Notion/DB 등 별도 저장소
- [ ] `ADMIN_ALLOWED_EMAILS`와 role source의 책임 분리
- [ ] route guard와 page guard를 role 기반으로 확장
- [ ] role 없는 allowlist 사용자 처리 정책 정의

### 산출물

- role matrix 표
- access control helper 초안
- route/page guard 규칙 문서

## 5.2 결과 통계 시각화 스트림

### 목표

- 운영자가 결과 품질과 사용 분포를 빠르게 확인할 수 있어야 한다.

### 우선 KPI 제안

- 최근 7일 / 30일 결과 수
- `questionVersion`별 결과 수
- `birthTimeKnowledge` 분포
- confidence 분포
- feedback 존재율
- rating / accuracy 분포
- `questionVersion` 전환 전후 비교

### 태스크

- [ ] KPI 정의와 우선순위 합의
- [ ] read model이 필요한 집계 항목 구분
- [ ] chart/table 데이터 계약 초안 작성
- [ ] `/api/admin/analytics/*` route 범위 정의
- [ ] 차트 라이브러리 사용 기준 정리
- [ ] 큰 범위 집계를 위한 캐시 또는 pre-aggregation 필요성 평가
- [ ] phase 2에서 허용할 시간 범위(`7d`, `30d`, `90d`) 결정

### 산출물

- analytics IA
- KPI 정의 문서
- 집계 API 계약

## 5.3 질문 수정 / version 관리 스트림

### 목표

- 질문 세트를 draft로 수정하고, 검증 후 publish할 수 있어야 한다.

### version 모델 제안

- `draft`
- `review-ready`
- `published`
- `archived`

### 필요한 메타데이터

- `version`
- `status`
- `updatedBy`
- `updatedAt`
- `publishedBy`
- `publishedAt`
- `changeSummary`
- `sourceVersion`

### 태스크

- [ ] 질문 편집 단위 정의
  - question text
  - option text
  - `questionWeight`
  - role/category
  - `scoreMap`
  - active flag
- [ ] draft 저장 방식 결정
- [ ] published version immutable 원칙 정의
- [ ] diff 표현 방식 정의
- [ ] validation 규칙 문서화
  - 필수 role 누락
  - option index 중복
  - score map 형식 오류
  - version 충돌
- [ ] publish 전 check list 정의
- [ ] rollback / 재배포 정책 정의

### 산출물

- version state machine
- validation 목록
- publish/rollback runbook 초안

## 5.4 운영 감사 / 변경 추적 스트림

### 목표

- 누가 무엇을 바꿨는지 남겨야 한다.
- 조회와 수정, 배포를 구분해서 추적해야 한다.

### audit 대상

- 로그인 / 로그아웃
- admin page/API 접근
- 질문 draft 수정
- version publish
- rollback
- role 변경

### 태스크

- [ ] audit event taxonomy 정의
- [ ] 최소 event payload 정의
- [ ] access log와 mutation log 분리
- [ ] log retention / export 정책 정의
- [ ] 운영 장애 시 조사에 필요한 키(`email`, `role`, `version`, `actionId`) 정의

### 산출물

- audit event spec
- 운영 로그 요구사항 표

## 6) 저장소/아키텍처 의사결정 포인트

### 6.1 role 저장 위치

옵션:

- env
  - 장점: 빠름
  - 단점: role 변경이 배포 작업이 됨

- admin settings sheet
  - 장점: 기존 운영 방식과 가까움
  - 단점: 권한 source까지 Sheets에 두는 것은 관리가 거칠다

- 별도 DB / data source
  - 장점: role, audit, draft 관리에 가장 적합
  - 단점: 초기 구현 비용이 높다

권장:

- role은 phase 2 중반부터 별도 저장소로 분리하는 방향을 기본안으로 둔다.

### 6.2 질문 draft 저장 위치

옵션:

- 같은 Questions 스프레드시트 내 별도 탭
- 별도 draft 스프레드시트
- 별도 DB/data source

권장:

- published source는 지금 구조를 유지하되, draft는 published와 분리된 저장 단위를 갖는다.

### 6.3 집계 데이터 저장

옵션:

- 요청 시 실시간 계산
- 메모리 캐시
- pre-aggregated sheet
- DB/materialized view

권장:

- phase 2 초기에는 제한된 최근 범위만 실시간 집계
- 장기 범위/비교 집계가 필요해지면 pre-aggregation 도입

## 7) 권장 구현 순서

1. role 모델 문서화
2. analytics KPI와 집계 API 계약 문서화
3. 질문 version workflow 문서화
4. audit event spec 문서화
5. role helper와 guard 구조 확장
6. read-only analytics 화면 추가
7. draft 질문 조회 구조 추가
8. 질문 편집 UI 추가
9. publish/rollback 액션 추가
10. audit log 저장과 운영 runbook 마무리

## 8) 완료 기준

아래가 되면 phase 2의 핵심이 성립한 것으로 본다.

- 관리자 2명 이상이 개인 Google 계정으로 로그인한다.
- role에 따라 조회/편집/배포 권한이 구분된다.
- 결과 통계 화면에서 핵심 KPI를 본다.
- draft 질문 세트를 수정하고 validation을 통과시킬 수 있다.
- owner만 publish/rollback 할 수 있다.
- 질문 수정과 배포 이력이 사용자 단위로 남는다.

## 9) 관련 문서

- `docs/admin/authjs-admin-ui-phase-1-checklist.md`
- `docs/admin/authjs-admin-ui-adoption-design.md`
- `docs/admin/authjs-admin-access-control-plan.md`
- `docs/admin/authjs-admin-ui-authoring-guide.md`
- `docs/operations/env-registration-guide.md`
