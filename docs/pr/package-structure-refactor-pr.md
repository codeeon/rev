# PR 설명문

## 배경

이번 변경은 monorepo package 경계를 실제 사용 방식에 맞게 정리하고, `web` 중심으로 느슨하게 검증되던 구조를 workspace 기준으로 다시 묶는 작업이다.

문제는 세 가지였다.

- package 테스트와 타입체크가 기본 CI에서 충분히 강제되지 않았다.
- `apps/web`이 일부 workspace 패키지를 source path alias로 직접 소비해 package boundary가 일관되지 않았다.
- Google Sheets, observability 관련 package가 실제 책임보다 더 느슨하거나 잘게 나뉘어 있었다.

## 주요 변경

### 1. workspace 기준 검증 경로 정리

- 루트 `build`, `lint`, `typecheck`, `test`, `ci:monorepo`를 Turbo 전체 scope 기준으로 정리했다.
- package 공통 TypeScript 설정을 루트 base config로 모았다.
- `apps/web`의 source path alias를 제거하고 workspace package `exports` 기준 소비로 통일했다.

### 2. spreadsheet facade 정리

- `@workspace/spreadsheet-admin`가 질문 동기화와 결과 저장을 담당하는 실제 facade가 되도록 책임을 올렸다.
- `apps/web`에서 `@workspace/google-sheets`를 직접 아는 경로를 제거했다.
- package 내부 server runtime guard 이름을 `assert-server-runtime`으로 명확히 정리했다.
- 사용 가치가 없던 `packages/server-only` shim package를 제거했다.

### 3. observability package 단순화

- `@workspace/observability-core`를 제거했다.
- 공통 runtime env helper는 `@workspace/ga`, `@workspace/sentry` 내부로 흡수했다.
- observability package 구조를 실제 public API 기준으로 단순화했다.

### 4. 문서 정리

- 현재 package 구조를 빠르게 파악할 수 있도록 `docs/package-architecture-summary.md`를 추가했다.
- `docs/architecture.md`에 빠른 읽기 섹션과 현재 package 경계 규칙을 반영했다.
- 운영 연동 문서와 환경 변수 등록 가이드를 현재 구조 기준으로 갱신했다.

## 기대 효과

- package 경계가 import 경로와 CI에서 동시에 강제된다.
- `apps/web`은 고수준 facade만 알면 되고, 저수준 infra 세부사항은 operations package 내부로 숨겨진다.
- observability package 수와 의존성이 줄어들어 유지보수 비용이 낮아진다.

## 검증

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm ci:monorepo`

## 확인 포인트

- `apps/web`이 더 이상 `@workspace/google-sheets`를 직접 import하지 않는지
- workspace CI scope에 모든 package가 포함되는지
- `@workspace/ga`, `@workspace/sentry`가 독립적으로 build/typecheck 되는지
- Google Sheets 질문 동기화와 피드백 저장 API가 기존 계약을 유지하는지
