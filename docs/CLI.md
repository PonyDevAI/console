# Console CLI (Phase 0)

Console currently provides a lightweight local CLI with five commands:

```bash
console init
console start
console status
console doctor
console worker scan
```

## `console init`

Initializes local state under `~/.console/` if it does not already exist.

Created layout:

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

## `console start`

Ensures local state exists (runs the same setup as `init`) and starts a small HTTP server.

The bind address is read from `~/.console/config.json` at `server.address` (default `127.0.0.1:8080`).

Endpoints:
- `GET /api/health` → `{ "ok": true }`
- `GET /api/status` → basic runtime status JSON
- `GET /api/workspaces` → workspace list from `~/.console/state/workspaces.json`
- `POST /api/workspaces` → add workspace with `{ "name": "...", "repoPath": "/abs/path" }`
- `GET /api/workers` → worker snapshot from `~/.console/state/workers.json`
- `POST /api/workers/scan` → scan known worker CLIs and persist snapshot

## `console status`

Prints a basic local status summary:
- Whether `~/.console/` is initialized
- Console home path
- Exposed API endpoints

## `console doctor`

Runs lightweight environment checks:
- `~/.console/` existence
- `config.json` readability
- worker CLI availability in `PATH` (`cursor`, `claude`, `codex`)

## `console worker scan`

Scans `PATH` for supported worker CLIs and writes the current snapshot to:

```text
~/.console/state/workers.json
```

The command prints a concise summary of found/missing workers.
