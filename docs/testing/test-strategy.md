# Test Strategy

## Goal

Define how CloudCode validates changes in an agent-first workflow.

## Core Principle

Only the validation layer that matches the changed surface can justify the conclusion.

Examples:

- Static checks can justify `build/typecheck clean`.
- Local validation can justify `local behavior verified`.
- Real host CLI validation is required for claims about adapter detection, config path correctness, or native config sync.

## Validation Layers

### 1. Static Validation

Purpose:

- catch regressions quickly
- keep review cost low

Includes:

- `cargo check`
- `cargo clippy -- -D warnings`
- web app `pnpm exec tsc --noEmit`
- web app `pnpm build` when frontend packaging matters

Static validation is useful, but it does **not** prove runtime behavior or host CLI integration.

### 2. Unit / Narrow Integration Tests

Purpose:

- validate stable logic in isolation
- protect parser and mapping behavior
- keep adapter and sync changes reviewable

Examples:

- Rust unit tests
- service-level tests
- adapter parser tests
- sync mapping tests

These tests are useful, but they do **not** prove native config files or real CLI behavior.

### 3. Local Validation

Purpose:

- validate deterministic local code paths
- validate API to service to storage wiring
- validate non-mock web and backend paths in a local environment

Use:

- `docs/testing/local-validation-spec.md`

### 4. Real Host CLI Validation

Purpose:

- validate real CLI detection
- validate real config path assumptions
- validate read/write behavior against native CLI configs
- validate install/upgrade/scan/test behavior that depends on the host toolchain

Use:

- `docs/testing/adapter-validation-spec.md`
- `docs/testing/config-sync-validation-spec.md`

## Hard Rules

1. Commands are helpers, not testing truth.
2. CI passing does not automatically prove real host integration.
3. Mock UI or fixture data does not prove end-to-end behavior.
4. Claims about adapter correctness must be backed by real host evidence when possible.
5. If the change alters validation semantics, `docs/testing/*.md` must be updated in the same change.
6. Reports must distinguish:
   - `implemented`
   - `validated_static`
   - `validated_local`
   - `validated_host_cli`
