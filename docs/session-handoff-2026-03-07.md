# Session Handoff - 2026-03-07

## 1) 이번 세션에서 실제 완료한 작업

### A. 아키텍처/프로젝트 분석 및 문서화

- 전체 모노레포 구조, 계층 경계, 런타임 플로우, API 계약 분석 완료
- 아키텍처 문서 작성/보강
  - `docs/architecture.md`
- 루트 문서 엔트리 연결
  - `README.md`에 architecture 링크 추가

### B. Observability 패키지/앱 연동 스캐폴딩

신규 패키지 추가:

- `packages/operations/observability-core`
- `packages/operations/ga`
- `packages/operations/sentry`

웹 앱 연동 파일 추가:

- `apps/web/components/analytics/ga-script.tsx`
- `apps/web/lib/analytics.ts`
- `apps/web/instrumentation.ts`
- `apps/web/sentry.client.config.ts`
- `apps/web/sentry.server.config.ts`
- `apps/web/sentry.edge.config.ts`

앱 연결 변경:

- `apps/web/app/layout.tsx`에서 GA script 연결
- `apps/web/package.json`에 `@workspace/ga`, `@workspace/sentry`, `@sentry/nextjs` 반영
- `apps/web/.env.example`에 GA/Sentry 환경변수 예시 추가

### C. 퍼널 이벤트 계측 연결

아래 퍼널 이벤트를 실제 페이지 액션에 연결:

- `start_analysis`
- `submit_birth_info`
- `select_birth_time_knowledge`
- `submit_known_time`
- `submit_approximate_time`
- `complete_survey`
- `analysis_success`
- `analysis_failure`
- `view_result`
- `submit_feedback`

공통 파라미터 표준화(`apps/web/lib/analytics.ts`):

- `session_id`
- `app_env`
- `app_release`
- `page_path`

### D. 운영 문서 작성

신규/업데이트 문서:

- `docs/operations/observability/README.md`
- `docs/operations/observability/ga.md`
- `docs/operations/observability/sentry.md`
- `docs/operations/observability/runbook.md`
- `docs/operations/observability/sentry-setup-validation.md` (신규)
- `docs/operations/README.md` 인덱스 반영
- `README.md` entrypoint 반영

## 2) 검증 상태 (실행 결과)

성공:

- `pnpm install` (권한 상승 실행 포함) 완료
- `pnpm --filter web lint` 통과
- `pnpm --filter web typecheck` 통과
- `pnpm --filter web build` 통과 (권한 상승 실행)

참고:

- `@sentry/nextjs` 설치 시 peer warning 존재
  - `@sentry/nextjs 8.55.0` vs `next 16.1.6`
  - 현재 로컬 빌드는 통과했으므로, staging에서 실제 이벤트 유입/에러 수집 검증이 다음 우선 작업

## 3) 현재 워킹 트리 상태

- 다수 파일이 수정/추가된 상태이며 **커밋은 아직 없음**
- 변경 축은 크게 4개:
  1. observability 패키지 추가
  2. web 계측/초기화 연동
  3. 퍼널 이벤트 계측
  4. 운영 문서 추가/정리

## 4) 다음 세션에서 바로 할 작업 (우선순위)

### P0. Staging Sentry 실수집 검증

- DSN/ENV/RELEASE 설정 후 의도적 클라이언트/서버 에러 1건씩 발생
- Sentry에서 `environment`, `release`, stacktrace 정상 여부 확인
- 결과를 `docs/operations/observability/sentry-setup-validation.md` 체크리스트에 반영

완료 기준:

- browser/server 이벤트 각각 1건 이상 유입 확인
- 태그/샘플링 값이 설정 의도와 일치

### P1. GA 이벤트 품질 점검

- DebugView에서 퍼널 이벤트 10종 수집 확인
- 공통 파라미터(`session_id`, `app_env`, `app_release`, `page_path`) 누락 여부 점검
- 이벤트 이름/속성 대시보드 스키마 고정

완료 기준:

- 핵심 퍼널 대시보드에서 end-to-end 경로 확인 가능

### P1. CI에 observability 변경 영향 반영 점검

- 루트 `ci:monorepo`에서 새 패키지 영향이 예상대로 동작하는지 확인
- 필요 시 `turbo` 필터/파이프라인 보정

완료 기준:

- CI에서 lint/typecheck/build가 새 패키지 추가 이후 안정 동작

### P2. 문서 정리

- 중복/역참조 정리 (observability 문서 간 링크 통일)
- 운영팀 온보딩용 1페이지 quickstart 추가 여부 결정

## 5) 위험/주의 사항

- Next 16 + Sentry SDK 버전 조합은 향후 호환성 리스크 가능
- Sentry DSN 누락 시 초기화는 되지만 실수집은 발생하지 않음
- 계측 이벤트는 현재 클라이언트 액션 중심이며, 서버 측 비즈니스 이벤트까지는 아직 확장 전

## 6) 다음 세션 시작 명령 제안

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web build
pnpm dev
```

그 다음 `docs/operations/observability/sentry-setup-validation.md` 순서대로 staging 검증 진행.
