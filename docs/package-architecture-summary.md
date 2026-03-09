# 패키지 구조 요약

이 문서는 `rev-workspace`의 현재 package 구조를 빠르게 파악하기 위한 요약본이다.
상세 런타임 흐름은 `docs/architecture.md`, Google Sheets 연동은 `docs/operations/integration/google-sheets-package-architecture.md`를 본다.

## 한눈에 보기

```text
apps/web
├─ consumes: @workspace/base-ui
├─ consumes: @workspace/saju-core
├─ consumes: @workspace/time-inference
├─ consumes: @workspace/spreadsheet-admin/server
├─ consumes: @workspace/ga
└─ consumes: @workspace/sentry

packages/design-systems
└─ base-ui

packages/domain
├─ engine-data
├─ saju-core
└─ time-inference

packages/operations
├─ google-sheets
├─ spreadsheet-admin
├─ ga
└─ sentry
```

## 레이어 규칙

- `apps/web`은 workspace 패키지를 소비하지만, 패키지 내부 구현 경로를 직접 import하지 않는다.
- domain 패키지는 operations 패키지를 의존하지 않는다.
- operations 패키지는 domain 패키지를 의존할 수 있다.
- 저수준 인프라는 transport/auth에 머물고, 앱용 유스케이스는 facade 패키지로 올린다.

## 패키지별 책임

| 패키지 | 책임 | 비고 |
| --- | --- | --- |
| `@workspace/base-ui` | 공유 UI 컴포넌트 | 디자인 시스템 레이어 |
| `@workspace/engine-data` | 엔진 JSON SoT 패키징 | checksum 검증 포함 |
| `@workspace/saju-core` | 사주 계산/검증 | authoritative 계산 소스 |
| `@workspace/time-inference` | 설문 기반 생시 추론 | `engine-data`, `saju-core` 사용 |
| `@workspace/google-sheets` | Google Sheets transport/auth | 저수준 API 클라이언트 |
| `@workspace/spreadsheet-admin` | 질문 동기화/결과 저장 facade | 앱은 이 패키지를 통해 Sheets 기능 사용 |
| `@workspace/ga` | GA runtime env 해석, 이벤트 helper | 별도 core 패키지 없음 |
| `@workspace/sentry` | Sentry config builder | browser/server/edge 지원 |

## 의존성 요약

```text
@workspace/engine-data ───▶ @workspace/time-inference ───┐
                                                          │
@workspace/saju-core ─────────────────────────────────────┼──▶ apps/web
                                                          │
@workspace/base-ui ───────────────────────────────────────┤
                                                          │
@workspace/google-sheets ─▶ @workspace/spreadsheet-admin ─┤
                                                          │
@workspace/ga ────────────────────────────────────────────┤
@workspace/sentry ────────────────────────────────────────┘
```

## 최근 구조 정리 결과

- `packages/server-only` 제거
- `@workspace/observability-core` 제거
- `@workspace/ga`, `@workspace/sentry`가 각자 runtime env helper를 내부 보유
- `apps/web`은 `@workspace/google-sheets`를 직접 몰라도 되게 정리
- workspace 검증 경로를 `web` 중심이 아니라 Turbo 전체 scope 기준으로 전환

## 어디를 수정해야 하는가

- UI/화면 변경: `apps/web`, 필요시 `@workspace/base-ui`
- 사주 계산 규칙 변경: `@workspace/saju-core`
- 추론 엔진/질문 데이터 변경: `@workspace/time-inference`, `@workspace/engine-data`
- Google Sheets 연동 변경: `@workspace/spreadsheet-admin`, 필요시 `@workspace/google-sheets`
- GA/Sentry 부트스트랩 변경: `@workspace/ga`, `@workspace/sentry`, `apps/web`

## 검증 명령

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm ci:monorepo`
