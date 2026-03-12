# Web UI (Phase 0 Placeholder)

The current web UI is intentionally minimal and honest about scope.

## Stack

- Vite
- React
- TypeScript

## Current screen sections

The single page includes:
- Workspace list (loaded from backend API)
- Worker list (loaded from backend API)
- Repo selection placeholder
- Chat input placeholder
- Output panel placeholder

## Backend connectivity

On load, the page calls:
- `GET /api/health` to show backend status (`loading`, `online`, `offline`)
- `GET /api/workspaces` to render workspace rows or an empty-state message
- `GET /api/workers` to render worker rows or an empty-state message

During local development, Vite proxies `/api/*` calls to `http://127.0.0.1:8080`.

## Not implemented yet

- Workspace creation/editing from the web UI
- Chat run submission
- Streaming output rendering
- Session history and run lifecycle UX
