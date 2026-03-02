# Design System Governance ADR

## Status

Accepted

## Context

`apps/web` and `@workspace/base-ui` were still sharing responsibilities in a way that made boundaries fragile:

- app code could rely on deep package paths
- package internals could change and break consumers
- new component placement rules were implicit rather than explicit

To scale across additional apps, we need a stable contract and lightweight operational rules.

## Decision

### 1) New component placement rule

- Add to `@workspace/base-ui` when the component is domain-agnostic and reusable across apps.
- Keep in `apps/web` when it includes survey, saju, routing, or other app-specific business semantics.

### 2) App override token scope

Apps may override only:

- `--primary`, `--ring`, optional `--accent`
- `--radius`
- app domain tokens (for example `--water`)

Apps must not override base semantic token layers globally.

### 3) base-ui promotion criteria

Promote app component code to `@workspace/base-ui` only if all conditions are true:

1. Used or planned in at least two apps.
2. No app-specific state/store/routing assumptions.
3. Styling can be expressed with existing design tokens.
4. Public props can be documented without domain terms.

### 4) Public API policy

`@workspace/base-ui` root export (`@workspace/base-ui`) is the official API surface.

- Supported: imports from package root.
- Transitional support: deep paths (`@workspace/base-ui/components/*`) remain for backward compatibility.
- Breaking changes to root exports require migration note and update plan.

## Consequences

- Consumer apps become resilient to base-ui internal file moves.
- Reuse decisions become cheaper and more consistent during team growth.
- Migration from app-local UI to shared primitives can be incremental without contract drift.
