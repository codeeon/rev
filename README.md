# rev-workspace

Monorepo for the Reverse Saju web product, domain engine packages, and design system.

## Workspace map

- `apps/web`: Next.js product app
- `packages/domain/saju-core`: Four pillars and element analysis domain logic
- `packages/domain/time-inference`: Survey-based hour inference engine
- `packages/domain/engine-data`: Engine JSON data package
- `packages/design-systems/base-ui`: Shared UI components
- `packages/operations/google-sheets`: Server-only Google Sheets transport/auth adapter
- `packages/operations/spreadsheet-admin`: Spreadsheet schema normalization and sync orchestration
- `docs/`: migration, operations, and archived references

## Dependency rules

- App layer imports workspace packages (`@workspace/*`) only.
- Domain packages can depend on other domain packages when the dependency direction is explicit.
- `@workspace/time-inference` consumes `@workspace/engine-data` and `@workspace/saju-core`.
- `@workspace/base-ui` is the shared UI layer used by the app.
- Operations packages can depend on domain and integration packages, but domain packages must not depend on operations packages.

## Standard commands

- `pnpm dev`: build dependency packages via Turbo, then run `web` dev server
- `pnpm build`: run monorepo build through Turbo (`web...` filter)
- `pnpm lint`: lint `web` via Turbo task pipeline
- `pnpm typecheck`: typecheck `web` with Turbo dependency-aware build
- `pnpm test:engine`: run engine tests through Turbo
- `pnpm ci:monorepo`: unified CI command (lint + typecheck + test + build)

## Documentation entry points

- `docs/architecture.md`: current system architecture (runtime, domain boundaries, build pipeline)
- `docs/migration-plan-index.md`: execution order for migration docs
- `docs/migration/domain-boundary-notes.md`: current domain boundary decisions
- `docs/operations/README.md`: operations and integration guides
