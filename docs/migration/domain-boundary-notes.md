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

- 변경 커밋 시, 이번 문서와 `apps/web/types/lunar-javascript.d.ts` 삭제를 함께 기록한다.
- 필요 시 `packages/domain/engine-data/src/index.ts`의 미사용 export 정리를 별도 커밋으로 분리한다.
