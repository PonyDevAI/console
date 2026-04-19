# AGENTS.md — Canonical Engineering Guide

This file is the single source of truth for project engineering rules in **CloudCode**.
If any tool-specific rule file conflicts with this file, follow `AGENTS.md`.

## Project identity

- Project name: **CloudCode**.
- CloudCode is a **local AI CLI unified management platform**.
- CloudCode provides a Web UI and local daemon for managing AI coding CLI tools — including version lifecycle, provider/model configuration, MCP servers, skills, and system prompts.
- Prefer local-first behavior and straightforward implementation choices.

## Product scope

Current focus:
- CLI tool version management (install / upgrade / uninstall / version detection).
- Provider / model management (multi-endpoint switching, API key management, cross-app sync).
- MCP server unified management (CRUD, per-app enable/disable, config sync).
- Skills management (SSOT repository, install/uninstall, cross-app sync).
- Web UI as the primary management interface.

Supported CLI tools (extensible via adapter interface):
- Claude CLI
- Codex CLI
- Gemini CLI
- Cursor CLI

Deferred to later phases:
- Run execution and streaming output (architecture preserved, priority lowered).
- Distributed orchestration.
- Queue-heavy or multi-node scheduling infrastructure.

## Architecture principles

- Maintain strict separation between:
  - **Management plane**: config/state, version management, provider/MCP/skill management, API, sync engine.
  - **Execution plane**: worker adapters that invoke local CLIs for run execution.
- A **config sync engine** is the core differentiator — it translates CloudCode's unified config into each CLI's native format and writes to the correct paths.
- Keep modules small and composable.
- Favor clarity over abstraction-heavy frameworks.
- Use explicit CLI adapters; do not hard-code one CLI implementation into core logic.
- Introduce new architectural layers only when justified by concrete use-cases.
- Document architecture decisions when they are introduced.

## Storage principles

- Start with local file-based state/config under `~/.console/`.
- Defer SQLite until history/indexing/query needs are clearly justified.
- Treat repository paths as external source-of-truth filesystem locations.
- Treat `~/.console/` as CloudCode-owned metadata/cache/artifact space only.

## CLI adapter model

- Use explicit adapters for each supported CLI tool.
- Each adapter knows:
  - How to detect installation and version.
  - Where the CLI's config files live and their format.
  - How to read/write provider, MCP, skill, and prompt configs in native format.
- Adapter behavior must be isolated behind a shared trait/interface.
- Core logic should depend on adapter interfaces, not CLI-specific details.

## UI model

- Web UI is the primary management interface (similar to an admin panel).
- Desktop is a separate application surface and must keep an independent UI from the web dashboard during the current migration phase.
- Key pages: Dashboard, Version Management, Provider Management, MCP Management, Skills Management, Prompt Management.
- Run execution UI is preserved but deprioritized.
- Default streaming transport is **SSE** unless a strong reason requires another transport.

## Multi-surface migration rules

- `apps/server` and `apps/desktop/src-tauri` are separate Rust application shells.
- `apps/mobile/android` and `apps/mobile/ios` are separate future mobile shells and should not be treated as UI variants of the web app.
- They may share lower crates and contracts, but should not be coupled through the server route layer.
- Prefer sharing contracts, adapters, storage, sync, and runtime building blocks before sharing UI.
- Do not introduce a shared UI library until both web and desktop surfaces have stabilized enough to reveal true overlap.

## Default implementation stack

- Backend: **Rust** (axum), chosen for future Tauri desktop GUI compatibility.
- Frontend: **Vite + React + TypeScript + Tailwind CSS**.

## Coding guidelines

- Prefer simple, explicit code paths.
- Keep files and modules focused on one responsibility.
- Avoid introducing heavy infrastructure patterns prematurely.
- Keep boundaries between management-plane and execution-plane code obvious.

## Documentation expectations

- When behavior or architecture changes, update relevant docs under `docs/` in the same change.
- Ensure docs describe user-visible behavior and architectural intent.
- Record meaningful architectural decisions as they are made.

## Agent Delivery Contract

Every meaningful change is a multi-part delivery:

1. code
2. config/schema changes if needed
3. canonical doc updates if needed
4. validation evidence

A task is not complete when only code changes.

## Testing And Validation Rules

- `docs/testing/` is the canonical testing surface for this repo.
- `docs/DEVELOPMENT.md` explains how to work in the repo; it does not define testing truth.
- `Makefile`, CLI commands, CI jobs, and helper scripts are execution surfaces only.
- `make check` proves static validation only.
- `make test` proves unit or narrow integration execution only.
- `make doctor` proves diagnostics only.
- `make scan` proves discovery only.
- Claims about adapter correctness, native config paths, or config sync require evidence that matches the relevant testing spec.
- If behavior, validation flow, or config sync semantics change, update the matching docs in the same change.

## Canonical Doc Update Rules

- If current behavior changes, update the relevant canonical docs under `docs/`.
- If testing or validation flow changes, update `docs/testing/*.md`.
- If command semantics change, update `docs/DEVELOPMENT.md` and `docs/CLI.md` as needed.
- If architecture boundaries change, update `docs/ARCHITECTURE.md` and any affected domain docs.

## Reporting Rules

When reporting validation, distinguish explicitly between:

- `implemented`
- `validated_static`
- `validated_local`
- `validated_host_cli`

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
