# AGENTS.md — Canonical Engineering Guide

This file is the single source of truth for project engineering rules in **Console**.
If any tool-specific rule file conflicts with this file, follow `AGENTS.md`.

## Project identity

- Project name: **Console**.
- Console is a **local AI coding control plane**.
- Console coordinates local coding runs across supported worker CLIs.
- Prefer local-first behavior and straightforward implementation choices.

## Product scope

Current focus:
- Workspace / repository / worker selection.
- Chat-triggered worker runs.
- Streaming run output in the UI.

Out of scope for early phases:
- Distributed orchestration.
- Queue-heavy or multi-node scheduling infrastructure.
- Cloud-first operational complexity.

## Architecture principles

- Maintain strict separation between:
  - **Control plane**: config/state, routing, API, session/run tracking.
  - **Execution plane**: worker adapters that invoke local CLIs.
- Keep modules small and composable.
- Favor clarity over abstraction-heavy frameworks.
- Do not hard-code one worker implementation into core business logic.
- Introduce new architectural layers only when justified by concrete use-cases.
- Document architecture decisions when they are introduced.

## Storage principles

- Start with local file-based state/config under `~/.console/`.
- Defer SQLite until history/indexing/query needs are clearly justified.
- Treat repository paths as external source-of-truth filesystem locations.
- Treat `~/.console/workspaces/` as Console-owned metadata/cache/artifact space only.

## Worker model

- Use explicit worker adapters for:
  - Cursor CLI
  - Claude CLI
  - Codex CLI
- Adapter behavior must be isolated behind a shared contract.
- Core logic should depend on adapter interfaces, not worker-specific details.

## UI model

- Keep the UX centered on:
  - selecting workspace/repository/worker,
  - triggering runs from chat-like interactions,
  - viewing streaming output.
- Default streaming transport is **SSE** unless a strong, demonstrated reason requires another transport.

## Default implementation stack

- Backend default language: **Go**.
- Frontend default stack: **Vite + React + Tailwind**.

## Coding guidelines

- Prefer simple, explicit code paths.
- Keep files and modules focused on one responsibility.
- Avoid introducing heavy infrastructure patterns prematurely.
- Keep boundaries between control-plane and execution-plane code obvious.

## Documentation expectations

- When behavior or architecture changes, update relevant docs under `docs/` in the same change.
- Ensure docs describe user-visible behavior and architectural intent.
- Record meaningful architectural decisions as they are made.

## What not to build yet

Do **not** introduce the following without clear, documented justification:
- Distributed orchestration systems.
- Queue-first execution engines.
- Multi-node schedulers.
- Database-first persistence when file-based storage is still sufficient.
- Framework-heavy abstractions that reduce code clarity.

## Tool wrapper policy

The following files must stay aligned with this canonical guide:
- `CLAUDE.md`
- `CODEX.md`
- `CURSOR_RULES.md`
- `.cursor/rules/project.mdc`

Keep wrappers short and avoid duplicating policy text that can drift.
