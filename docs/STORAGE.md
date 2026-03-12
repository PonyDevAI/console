# Storage Model

Console starts with local file-based storage and introduces SQLite only when necessary.

## Current approach: file-based state under `~/.console/`

Reasons:
- Keeps Phase 0/1 lightweight.
- Avoids premature schema migration burden.
- Makes state readable and editable for local debugging.

Initial layout:

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
  - Defaults, ports, and feature toggles (as introduced).

- `state/workspaces.json`
  - Registered workspace records and metadata references.

- `state/workers.json`
  - Worker adapter definitions and discovered capabilities.

- `credentials/`
  - Local credentials/secrets required for worker CLIs.
  - Stored separately from general config.

- `logs/`
  - Daemon and run logs.

- `artifacts/`
  - Run outputs/artifacts managed by Console.

- `workspaces/`
  - Console-owned metadata/cache/artifacts scoped to workspaces.
  - Not the canonical location of repository source code.

## Repository source-of-truth policy

Console does not relocate or mirror repositories as authoritative source.
Repository paths remain where users keep them on disk.
Console stores references and metadata only.


### Current JSON shapes

`config.json`:

```json
{
  "version": "phase0",
  "server": { "address": "127.0.0.1:8080" }
}
```

`state/workspaces.json`:

```json
{
  "workspaces": []
}
```

Each workspace record stores `id`, `name`, `repoPath`, `createdAt`, and `modifiedAt`.

`state/workers.json`:

```json
{
  "scannedAt": "<rfc3339>",
  "workers": []
}
```

## Future storage transition: SQLite

SQLite should be introduced when the product needs:
- Efficient session/run history queries.
- Artifact indexing and relationship queries.
- Multi-dimensional filtering for operational views.

Likely transition model:
- Keep static config files where practical.
- Move query-heavy state (sessions/runs/artifact metadata) to SQLite.
- Maintain migration tooling from file-only state into DB-backed structures.
