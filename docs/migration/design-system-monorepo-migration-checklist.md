# Design System Monorepo Migration Checklist

This checklist is for extracting `components/ui` into a workspace package with the least breakage.

## Goal

- Move shared UI primitives to `packages/design-systems/base-ui`.
- Keep app-specific logic in `apps/web`.
- Preserve current behavior while making future UI reuse possible.

## Target Workspace Layout (Locked)

```text
apps/
  web/
packages/
  design-systems/
    base-ui/
```

- Canonical UI package path: `packages/design-systems/base-ui`
- Canonical package name: `@workspace/base-ui`
- If you want a flatter tree later, `packages/base-ui` is an allowed simplification, but this checklist assumes the canonical path above.

## Migration Strategy (Recommended)

Use a 2-step rollout:

1. Decouple UI from app-local aliases and duplicate hooks in the current repo.
2. Create workspace structure and move UI into a package.

This avoids a high-risk "big bang" move.

## Phase 1 - Decouple in Current Repo (No workspace yet)

### 1) Remove duplicated hooks and define ownership

- [ ] Keep one source of truth for mobile hook:
  - Choose one: `components/ui/use-mobile.tsx` or `hooks/use-mobile.ts`
  - Remove the duplicate file
- [ ] Keep one source of truth for toast hook:
  - Choose one: `components/ui/use-toast.ts` or `hooks/use-toast.ts`
  - Remove the duplicate file
- [ ] Update imports in `components/ui/sidebar.tsx` and `components/ui/toaster.tsx` to use the chosen source

### 2) Isolate utilities that UI package will own

- [ ] Introduce UI-local utility path for `cn` (currently imported from `@/lib/utils` in many UI files)
- [ ] Replace all `@/lib/utils` imports under `components/ui/*` with the new UI-local utility import

### 3) Reduce intra-folder coupling hotspots

- [ ] Review and keep only necessary UI-to-UI imports in these files:
  - `components/ui/sidebar.tsx`
  - `components/ui/input-group.tsx`
  - `components/ui/field.tsx`
  - `components/ui/command.tsx`
  - `components/ui/calendar.tsx`
  - `components/ui/pagination.tsx`
  - `components/ui/button-group.tsx`

### 4) Verify before workspace split

- [ ] `pnpm lint`
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm build`

## Phase 2 - Create Workspace Skeleton

### 1) Add monorepo root config

- [ ] Create `pnpm-workspace.yaml`
- [ ] Create `turbo.json` (or keep pnpm-only if Turbo is intentionally not used)

### 2) Create app/package layout

- [ ] Move app to `apps/web`
- [ ] Create `packages/design-systems/base-ui`

### 3) Create package manifests and TS configs

- [ ] Add `apps/web/package.json`
- [ ] Add `packages/design-systems/base-ui/package.json`
- [ ] Add `packages/design-systems/base-ui/tsconfig.json`
- [ ] Add root `tsconfig.base.json` (shared path/compiler defaults)
- [ ] Update `apps/web/tsconfig.json` to extend base config

## Phase 3 - Move UI Source to `packages/design-systems/base-ui`

### 1) Move files

- [ ] Move all files from `components/ui/*` to `packages/design-systems/base-ui/src/components/*`
- [ ] Move chosen shared hooks to `packages/design-systems/base-ui/src/hooks/*` if they are UI package concerns
- [ ] Move/duplicate minimal UI utils to `packages/design-systems/base-ui/src/lib/utils.ts`

### 2) Update import contracts

- [ ] Replace app imports from `@/components/ui/*` to `@workspace/base-ui/components/*`
- [ ] Replace UI internal imports to package-local aliases

### 3) Update shadcn config

- [ ] Update root or app `components.json` aliases:
- `ui` -> `@workspace/base-ui/components`
- `utils` -> `@workspace/base-ui/lib/utils`
- `hooks` -> `@workspace/base-ui/hooks`

## Phase 4 - Build Integration (Next.js + package consumption)

- [ ] Update `apps/web/next.config.mjs` with `transpilePackages: ['@workspace/base-ui']`
- [ ] Ensure CSS tokens/global UI styles are loaded from the package (or shared style entry)
- [ ] Keep React and Radix as compatible versions across app and package
- [ ] Configure package peer dependencies to avoid duplicate React instances

## Phase 5 - Verification Gate

- [ ] `pnpm install`
- [ ] `pnpm --filter web lint`
- [ ] `pnpm --filter web exec tsc --noEmit`
- [ ] `pnpm --filter web build`
- [ ] Smoke test pages that use major UI primitives (dialog, dropdown, form, toast, sidebar)

## Rollback Plan

- [ ] Keep migration in small commits per phase
- [ ] Tag Phase 1 completion before moving files
- [ ] If package consumption fails, revert only the current phase commit set

## Definition of Done

- [ ] No `@/components/ui/*` imports remain in app code
- [ ] UI package builds independently
- [ ] Web app builds using `@workspace/base-ui`
- [ ] No duplicate React instance issues
- [ ] CI commands pass for lint, typecheck, and build
