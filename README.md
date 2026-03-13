# Console

Console is a **local AI coding control console**. It provides a web UI and local daemon for managing workspaces, repositories, and local CLI-based AI workers.

The initial focus is practical and local-first:
- Run on your machine.
- Work with repos at their real filesystem paths.
- Route requests to local worker CLIs (for example Cursor CLI, Claude CLI, and Codex CLI).
- Stream execution output in the UI.

## What Console is

Console is a control surface for AI-assisted coding workflows:
- A local control plane for configuration, routing, session state, and run tracking.
- A worker adapter layer around local CLI tools.
- A web UI for selecting workspace/repo/worker and viewing streaming run output.

## What Console is not (yet)

Console is not currently intended to be:
- A cloud-hosted orchestration platform.
- A replacement for git hosting or CI systems.
- A full distributed job scheduler in early phases.

SQLite-backed querying, deep run history analytics, and richer orchestration capabilities are intentionally deferred.

## Current phase

Console is in an early design and implementation stage:
- Backend target stack: Go.
- Frontend target stack: Vite + React + Tailwind.
- Initial run streaming transport: SSE.
- Initial state/config storage: file-based under `~/.console/`.

## Long-term direction

Over time, Console is expected to evolve toward a broader orchestration model:
- Multiple worker types and capabilities.
- Better run lifecycle visibility and approvals.
- Artifact management and indexing.
- A job-board style operational view (in spirit similar to a future bull-board-like model), specialized for AI worker execution across repositories.

## Local-first philosophy

Console starts local-first by design:
- Repositories remain where they already live on disk.
- Console-owned state is stored separately under `~/.console/`.
- Credentials are managed locally under `~/.console/credentials/`.
- Lightweight file-based state comes first; SQLite is introduced only when richer query requirements justify it.

## Initial local file layout

```text
~/.console/
  config.json
  state/
    workspaces.json
    workers.json
  credentials/
  logs/
  artifacts/
  workspaces/
```

`~/.console/workspaces/` is for Console metadata/cache/artifacts and does **not** replace repository source locations.

## Documentation map

- [Goals](docs/GOALS.md)
- [Roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Tech Stack](docs/TECH_STACK.md)
- [Storage Model](docs/STORAGE.md)
- [CLI Commands](docs/CLI.md)
- [Worker Model](docs/WORKER_MODEL.md)
- [Web UI](docs/WEB_UI.md)
- [Development Guide](docs/DEVELOPMENT.md)

## Phase 1 quickstart

Backend:

```bash
go run ./cmd/console init
go run ./cmd/console start
```

Frontend:

```bash
cd web
npm install
npm run dev
```

Open the Vite URL (default `http://127.0.0.1:5173`) to use the local run loop UI (workspaces, workers, run form, SSE output).

