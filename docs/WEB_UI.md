# Web UI (Local Execution Loop)

The web UI now includes a minimal but real local execution loop.

## Stack

- Vite
- React
- TypeScript

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
