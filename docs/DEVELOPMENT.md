# Development Guide

This guide covers the Phase 0 local development loop for Console.

## Prerequisites

- Go 1.22+
- Node.js 18+

## Backend (Go CLI + API)

From repository root:

```bash
go run ./cmd/console init
go run ./cmd/console status
go run ./cmd/console doctor
go run ./cmd/console worker scan
go run ./cmd/console start
```

`console start` serves a minimal API on `127.0.0.1:8080`:
- `GET /api/health`
- `GET /api/status`

## Frontend (Vite + React + TypeScript)

From `web/`:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8080`.

## Current Phase 0 scope

- Local file scaffolding under `~/.console/`
- Minimal CLI command surface
- Minimal API health/status endpoints
- Placeholder UI sections for workspace/repo/worker/chat/output

Real workspace management, run execution, and streaming output behavior are intentionally deferred.
