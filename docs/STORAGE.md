# Storage Model

CloudCode uses local file-based storage under `~/.cloudcode/`. SQLite is deferred until query needs justify it.

## Directory layout

```text
~/.cloudcode/
  config.json              # CloudCode self-config (port, theme, etc.)
  state/
    cli_tools.json         # Detected CLI tools and version info
    providers.json         # Provider/model configurations
    mcp_servers.json       # MCP server configurations
    prompts.json           # System prompt presets
    workspaces.json        # Workspace registrations (preserved)
    terminal_sessions.json # Terminal session metadata
    execution_targets.json # Local/remote terminal target metadata
  credentials/             # Managed secrets and auth credentials (separate from general config)
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

Credentials are stored under `credentials/` and referenced by pointer from higher-level configs. This includes API keys today and should also be the storage boundary for future server password and private-key credentials. General state files should store references only, not secret plaintext.

For server/private-key planning, see:

- [Server And Credential Architecture](SERVER_AND_CREDENTIAL_ARCHITECTURE.md)
- [Server And Credential Implementation Plan](SERVER_AND_CREDENTIAL_IMPLEMENTATION_PLAN.md)
- [Terminal Runtime](TERMINAL_RUNTIME.md)

## Backup model

Config backups are stored under `backups/` with timestamps. Auto-rotation keeps the 10 most recent backups. Backups can be created manually or triggered before sync operations.

## Repository source-of-truth policy

CloudCode does not relocate or mirror repositories. Repository paths remain where users keep them on disk. CloudCode stores references and metadata only.

## Terminal runtime persistence

Persistent terminal sessions are stored as CloudCode-owned metadata under `~/.cloudcode/`. Terminal metadata belongs to the execution plane and must not be written into project repositories.

Suggested layout:

```text
~/.cloudcode/
  state/
    terminal_sessions.json
    execution_targets.json
  terminals/
    <session_id>/
      meta.json
      events.log
```

The actual terminal backend may run via `tmux`, `screen`, or `pty` on the CloudCode host or on a remote SSH host later, but CloudCode remains responsible only for metadata, target bindings, and audit information. Only `tmux`/`screen` sessions should be restored across app restart; `pty` remains ephemeral.

## Future: SQLite

SQLite should be introduced when the product needs:
- Efficient run history queries.
- Skill/MCP metadata indexing.
- Multi-dimensional filtering for operational views.
