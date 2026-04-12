# Storage Model

Console uses local file-based storage under `~/.console/`. SQLite is deferred until query needs justify it.

## Directory layout

```text
~/.console/
  config.json              # Console self-config (port, theme, etc.)
  state/
    cli_tools.json         # Detected CLI tools and version info
    providers.json         # Provider/model configurations
    mcp_servers.json       # MCP server configurations
    prompts.json           # System prompt presets
    workspaces.json        # Workspace registrations (preserved)
    terminal_sessions.json # Terminal session metadata
    execution_targets.json # Local/remote terminal target metadata
  credentials/             # API keys and secrets (separate from general config)
  skills/                  # SSOT skill repository
  logs/                    # Daemon and run logs
  backups/                 # Config backups (auto-rotate, keep 10)
  cache/                   # Version check cache, remote metadata cache
  terminals/               # Terminal runtime metadata and per-session logs
```

## File schemas

`config.json`:

```json
{
  "version": "0.1.0",
  "server": { "address": "127.0.0.1:8080" }
}
```

`state/cli_tools.json`:

```json
{
  "tools": [
    {
      "name": "claude",
      "installed": true,
      "localVersion": "1.0.16",
      "remoteVersion": "1.0.18",
      "path": "/usr/local/bin/claude",
      "lastChecked": "2026-03-13T10:00:00Z"
    }
  ]
}
```

`state/providers.json`:

```json
{
  "providers": [
    {
      "id": "provider-1",
      "name": "OpenRouter",
      "apiEndpoint": "https://openrouter.ai/api/v1",
      "apiKey": "ref:credentials/openrouter.key",
      "active": true,
      "apps": ["claude", "codex", "gemini"]
    }
  ]
}
```

`state/mcp_servers.json`:

```json
{
  "servers": [
    {
      "id": "mcp-1",
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {},
      "enabledApps": ["claude", "codex"]
    }
  ]
}
```

## Credential storage

API keys are stored as separate files under `credentials/`, referenced by pointer from provider configs. This keeps secrets out of general state files.

## Backup model

Config backups are stored under `backups/` with timestamps. Auto-rotation keeps the 10 most recent backups. Backups can be created manually or triggered before sync operations.

## Repository source-of-truth policy

Console does not relocate or mirror repositories. Repository paths remain where users keep them on disk. Console stores references and metadata only.

## Terminal runtime persistence

Persistent terminal sessions are stored as Console-owned metadata under `~/.console/`. Terminal metadata belongs to the execution plane and must not be written into project repositories.

Suggested layout:

```text
~/.console/
  state/
    terminal_sessions.json
    execution_targets.json
  terminals/
    <session_id>/
      meta.json
      events.log
```

The actual terminal backend may run via `tmux` on the Console host or on a remote SSH host later, but Console remains responsible only for metadata, control bindings, and audit information.

## Future: SQLite

SQLite should be introduced when the product needs:
- Efficient run history queries.
- Skill/MCP metadata indexing.
- Multi-dimensional filtering for operational views.
