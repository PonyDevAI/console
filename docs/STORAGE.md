# Storage Model

Console starts with local file-based storage and introduces SQLite only when necessary.

## Current approach: file-based state under `~/.console/`

Reasons:
- Keeps Phase 1 lightweight.
- Avoids premature schema migration burden.
- Makes state readable and editable for local debugging.

Layout:

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

## Directory and file intent

- `config.json`
  - User-level Console configuration.
  - Defaults such as server bind address.

- `state/workspaces.json`
  - Registered workspace records.
  - Each record points to an external repository path.

- `state/workers.json`
  - Latest worker CLI detection snapshot.

- `credentials/`
  - Local credentials/secrets required for worker CLIs.

- `logs/`
  - Run log files (`<run-id>.log`) when logging is enabled.

- `artifacts/`
  - Run outputs/artifacts managed by Console.

- `workspaces/`
  - Console-owned metadata/cache/artifacts scoped to workspaces.
  - Not the canonical location of repository source code.

## Repository source-of-truth policy

Console does not relocate or mirror repositories as authoritative source.
Repository paths remain where users keep them on disk.
Console stores references and metadata only.

## Current JSON shapes

`config.json`:

```json
{
  "version": "phase1",
  "server": { "address": "127.0.0.1:8080" }
}
```

`state/workspaces.json`:

```json
{
  "workspaces": [
    {
      "id": "ws_...",
      "name": "console",
      "repo": { "path": "/path/to/repo" },
      "createdAt": "2026-01-01T00:00:00Z",
      "modifiedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

`state/workers.json`:

```json
{
  "scannedAt": "<rfc3339>",
  "workers": [
    { "name": "cursor", "command": "cursor", "available": false },
    { "name": "claude", "command": "claude", "available": false },
    { "name": "codex", "command": "codex", "available": true, "path": "/usr/local/bin/codex" }
  ]
}
```

## Future storage transition: SQLite

SQLite should be introduced when the product needs:
- Efficient session/run history queries.
- Artifact indexing and relationship queries.
- Multi-dimensional filtering for operational views.
