# Design System Style Layering Guide

이 문서는 `@workspace/base-ui`의 기본 스타일을 앱에서 공통으로 가져오고,
앱별 튜닝을 최소 오버라이드로 유지하는 기준을 정의한다.

## Goal

- 공통 토큰/베이스 스타일은 `base-ui`에서 단일 관리
- 앱은 필요한 토큰만 `:root`에서 오버라이드
- 새 앱 추가 시 동일한 import 패턴으로 빠르게 온보딩

## Base Import Rule

모든 앱의 글로벌 CSS 첫 줄은 아래를 사용한다.

```css
@import '@workspace/base-ui/styles/globals.css';
```

## App Tuning Rule

앱 레벨에서는 아래 범위만 오버라이드한다.

- 브랜드 토큰: `--primary`, `--ring`, 필요 시 `--accent`
- 라운드 토큰: `--radius`
- 도메인 토큰: 예) `--water` 같은 앱 고유 의미 토큰

아래 토큰은 기본적으로 `base-ui`에서만 관리한다.

- 베이스 배경/텍스트 토큰 전체
- 컴포넌트 공통 상태 토큰
- 타이포그래피 기본 매핑(`@theme`)
- 공통 `@layer base` 스타일

## apps/web Current Pattern

`apps/web/app/globals.css`는 base import 후 최소 토큰만 오버라이드한다.

```css
@import '@workspace/base-ui/styles/globals.css';

:root {
  --radius: 0.75rem;
  --primary: oklch(0.45 0.25 265);
  --ring: oklch(0.45 0.25 265);
  --water: oklch(0.45 0.25 265);
}
```

## New App Onboarding Checklist

1. `apps/<new-app>/app/globals.css` 생성
2. 첫 줄에 `@import '@workspace/base-ui/styles/globals.css';` 추가
3. 앱 브랜딩에 필요한 최소 토큰만 `:root`에서 오버라이드
4. `pnpm --filter <new-app> lint`
5. `pnpm --filter <new-app> exec tsc --noEmit`
6. `pnpm --filter <new-app> build`

## Guardrails

- 앱 CSS에서 `@import 'tailwindcss'`, `@import 'tw-animate-css'`를 다시 선언하지 않는다.
- 동일 토큰을 여러 앱에서 중복 오버라이드할 경우 `base-ui`로 승격 검토한다.
- 컴포넌트 공통 스타일 변경은 앱 CSS가 아니라 `base-ui`에서 처리한다.
