# Domain Boundary Notes (2026-03-02)

도메인 경계 정리 과정에서 합의된 최신 결정을 기록한다.

## 1) `lunar-javascript` 타입 선언 단일화

- 결정: `apps/web/types/lunar-javascript.d.ts`를 제거하고, `packages/domain/saju-core/src/lunar-javascript.d.ts`를 단일 소스로 사용한다.
- 배경: `apps/web`에서 `lunar-javascript`를 직접 import하지 않으며, `@workspace/saju-core`의 빌드 산출 타입으로 웹 타입체크가 충족된다.

검증:

- `pnpm --filter @workspace/saju-core build` 통과
- `pnpm --filter web typecheck` 통과
- `pnpm --filter web build` 통과

## 2) `engine-data` 패키지 경계

- 결정: 현시점에서는 `packages/domain/engine-data`를 독립 패키지로 유지한다.
- 배경:
  - `time-inference`가 `@workspace/engine-data/data/engine.json` 서브패스 import를 직접 사용한다.
  - 루트 빌드/배포 구성(`package.json`, `apps/web/vercel.json`)이 현재 분리 단위를 전제로 한다.
  - `engine-data`는 데이터(JSON) 책임이 명확하고, 추론 로직(`time-inference`)과 분리하는 편이 변경 영향도 관리에 유리하다.

## 3) 후속 정리 후보

- 필요 시 `packages/domain/engine-data/src/index.ts`의 미사용 export 정리를 별도 커밋으로 분리한다.

## 4) 분석 입력 검증(Analyze Input) 경계 정리

- 결정: `BirthInfo`/`InferredHourPillar` 런타임 검증은 `@workspace/saju-core`가 소유한다.
- 반영:
  - `packages/domain/saju-core/src/validation.ts` 신설
  - `packages/domain/saju-core/src/index.ts`에서 validator export
  - `apps/web/app/api/analyze/route.ts`는 `parseAnalyzeInput` 호출 + HTTP status 매핑만 담당
  - `apps/web/app/analyzing/page.tsx`도 동일 validator 재사용
- 배경:
  - 동일 입력 계약을 API/클라이언트가 중복 구현하면 drift 위험이 커진다.
  - 도메인 함수(`analyzeSaju`) 소비 경로가 여러 곳이므로, 검증 규칙도 도메인 단일 소스로 유지하는 편이 안전하다.

검증:

- `pnpm --filter @workspace/saju-core test` 통과 (`src/validation.spec.ts`)
- `pnpm run ci:monorepo` 통과

## 5) typecheck 실행 안정성 메모

- 결정: `web:typecheck`는 `next typegen`을 선행하고, Turbo에서 `typecheck`가 `build`를 선행하도록 유지한다.
- 배경: `.next/types` 생성 타이밍 레이스로 인한 간헐 실패를 제거하기 위함.

검증:

- `pnpm run ci:monorepo` 반복 실행 시 lint/typecheck/test:engine/build 통과
