# Web UI (Local Execution Loop)

The web UI includes a minimal but real local execution loop.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS

## Frontend structure

The app is split by feature instead of keeping all UI/state in one file:

- `web/src/app/` — page-level composition and state wiring
- `web/src/features/workspaces/` — workspace list UI
- `web/src/features/workers/` — worker list UI
- `web/src/features/runs/` — run form and streaming output panel
- `web/src/components/` — shared presentational blocks
- `web/src/lib/api/` — API client helpers
- `web/src/lib/types/` — shared frontend types

## Current screen sections

The single page includes:
- Workspace list (loaded from backend API)
- Worker list (loaded from backend API)
- Run form:
  - workspace repo quick-select,
  - manual repo path input,
  - worker selector,
  - prompt input,
  - run submit button
- Output panel:
  - current run id/status/error/exit code,
  - streamed output lines from SSE,
  - state transition lines from SSE events

## Backend connectivity

On load, the page calls:
- `GET /api/health` to show backend status (`loading`, `online`, `offline`)
- `GET /api/workspaces` to render workspace rows or an empty-state message
- `GET /api/workers` to render worker rows or an empty-state message

For run execution, the page calls:
- `POST /api/runs` to create and start a run
- `GET /api/runs/:id/stream` using `EventSource` (SSE) to receive output and state events

During local development, Vite proxies `/api/*` calls to `http://127.0.0.1:8080`.

## Scope intentionally deferred

Still not implemented:
- Session/history browsing
- Run replay/resume
- Database-backed persistence
- Multi-run dashboard and controls
