# Web UI (Phase 0 Placeholder)

The current web UI is intentionally minimal and honest about scope.

## Stack

- Vite
- React
- TypeScript

## Current screen sections

The single page includes clear placeholders for:
- Workspace area
- Repo selection area
- Worker selection area
- Chat input area
- Output panel area

## Backend connectivity

On load, the page calls `GET /api/health` and displays backend status (`loading`, `online`, `offline`).

During local development, Vite proxies `/api/*` calls to `http://127.0.0.1:8080`.

## Not implemented yet

- Workspace/repo/worker state management
- Chat run submission
- Streaming output rendering
- Session history and run lifecycle UX
