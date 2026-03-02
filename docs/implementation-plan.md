# 구현 실행 플랜 (현재 모노레포 기준)

> 갱신일: 2026-03-02
> 워크스페이스: `apps/web` + `packages/domain/*` + `packages/design-systems/*`

## 목표

분석(analyze) 플로우를 안정적으로 유지하기 위해 입력 계약을 도메인 단일 소스로 관리하고, 앱 레이어는 HTTP/AI 오케스트레이션 책임만 담당하도록 경계를 명확히 유지한다.

## 현재까지 반영 완료

- 모노레포 빌드/검증 계약을 Turbo 단일 진입점(`pnpm run ci:monorepo`)으로 정리했다.
- 분석 API 라우트는 어댑터 책임(요청 파싱/응답 매핑/오케스트레이션) 중심으로 경량화했다.
- 분석 입력 런타임 검증을 도메인 패키지로 이관했다.
  - `packages/domain/saju-core/src/validation.ts`
  - `packages/domain/saju-core/src/index.ts` export 연결
- 클라이언트 분석 페이지도 동일 validator를 재사용하도록 정리했다.
  - `apps/web/app/analyzing/page.tsx`
- typecheck 안정화 가드를 적용했다.
  - `apps/web/package.json`: `next typegen && tsc --noEmit`
  - `turbo.json`: `typecheck`가 `build` 선행 의존
- validator 회귀 테스트를 추가했다.
  - `packages/domain/saju-core/src/validation.spec.ts`
  - `packages/domain/saju-core/package.json` `test` 스크립트

## 현재 책임 분리

### 도메인 (`@workspace/saju-core`)

- 도메인 모델/계산 로직 소유 (`BirthInfo`, `InferredHourPillar`, `analyzeSaju`)
- 분석 입력 런타임 검증/파싱 소유
  - `isValidBirthInfo`
  - `isValidInferredHour`
  - `parseAnalyzeInput`

### 앱 (`apps/web`)

- 전송/어댑터 책임 소유
  - `req.json()` 실패 -> 400 매핑
  - payload 검증 실패 -> 400 매핑
  - 내부 처리 실패 -> 500 매핑
- AI 프롬프트/스트리밍 통합 소유
  - `apps/web/lib/ai/prompts.ts`
  - `apps/web/app/api/analyze/route.ts`

## 주요 파일 맵 (기준 경로)

- API 라우트: `apps/web/app/api/analyze/route.ts`
- 분석 페이지(클라이언트): `apps/web/app/analyzing/page.tsx`
- 앱 상태 스토어: `apps/web/lib/store.tsx`
- 입력 페이지 검증 UX: `apps/web/app/input/page.tsx`
- 프롬프트 빌더: `apps/web/lib/ai/prompts.ts`
- 도메인 타입: `packages/domain/saju-core/src/types.ts`
- 도메인 계산: `packages/domain/saju-core/src/calculator.ts`
- 도메인 검증: `packages/domain/saju-core/src/validation.ts`
- 도메인 export 배럴: `packages/domain/saju-core/src/index.ts`
- 도메인 검증 테스트: `packages/domain/saju-core/src/validation.spec.ts`

## 검증 명령

- 도메인 validator 테스트
  - `pnpm --filter @workspace/saju-core test`
- 모노레포 통합 검증 계약
  - `pnpm run ci:monorepo`

## 완료 기준 (Definition of Done)

- `pnpm --filter @workspace/saju-core test` 통과
- `pnpm run ci:monorepo` 통과 (lint/typecheck/test:engine/build)
- 변경된 TS 파일 LSP diagnostics 에러 0
- 분석 입력 검증 로직이 도메인 패키지 단일 소스로만 존재

## 다음 권장 작업

1. E2E 회귀 테스트 추가: 첫 분석 성공 -> 두 번째 분석 실패 시 stale 결과 미노출 보장
2. API 라우트 테스트 추가: malformed JSON / invalid payload 응답 케이스 고정
3. `engine.json` 중복 위치에 대한 checksum 가드/SoT 정책 추가
