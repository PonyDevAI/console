# Local Validation Spec

## Goal

Validate deterministic local code paths without overstating what local-only checks can prove.

## Canonical Entry Points

Use canonical commands where possible:

- `make check`
- `make test`
- `make verify-local`
- project-specific manual checks when the spec requires them

## Required Local Checks

Choose the relevant subset for the changed surface:

### Backend / Rust

- `cargo check`
- `cargo test`
- `cargo clippy -- -D warnings` when code quality or lint-sensitive paths changed

### Frontend / Web

- `cd apps/web && pnpm exec tsc --noEmit`
- `cd apps/web && pnpm build` when routing, bundling, or build output changed

### Local API / UI Behavior

- start the backend and web app locally when API or UI behavior changed
- verify the changed flow through the actual local UI or actual API route
- confirm storage side effects under `~/.cloudcode/` or the relevant local state path when needed

## What Local Validation Can Prove

- code compiles and typechecks
- local API and UI wiring works
- local state and file writes behave as expected
- obvious regressions are absent in a deterministic environment

## What Local Validation Cannot Prove

- real host CLI install/detect/version behavior
- correctness of native config paths on a different host setup
- external tool compatibility beyond the local environment
- cross-tool sync correctness without reading real native configs

## Reporting Rule

If only local checks were run, the report must not claim host CLI validation.
