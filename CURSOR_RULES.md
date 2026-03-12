# Cursor Project Rules (Human-Readable)

`AGENTS.md` is the canonical project engineering guide for Console.
This file is a Cursor-oriented restatement and must stay aligned with `AGENTS.md`.

## Core direction

- Console is a local AI coding control plane.
- Prefer simple, local-first solutions.
- Keep control plane and execution plane separate.
- Favor clarity over heavy abstractions.

## Product focus (now)

- Workspace/repo/worker selection.
- Chat-triggered runs.
- Streaming output UX.

## Architecture guardrails

- Use explicit worker adapters (Cursor CLI / Claude CLI / Codex CLI).
- Do not hard-wire a single worker into core business logic.
- Keep modules small and composable.
- Avoid introducing distributed orchestration, queue-heavy systems, or other heavy infra early.

## Storage and paths

- Use file-based config/state first.
- Defer SQLite until history/indexing/query needs clearly justify it.
- Repositories stay at real external filesystem paths.
- `~/.console/workspaces/` is Console-owned metadata/cache/artifact space.

## Stack defaults

- Backend: Go.
- Frontend: Vite + React + Tailwind.
- Streaming: SSE by default.

## Documentation

- Update `docs/` when behavior or architecture changes.
- Document architectural decisions when introduced.
