# CLI Commands

CloudCode provides a CLI for initialization and daemon management.

## Validation note

These commands are operational entrypoints.
Their existence does not define testing truth; use `docs/testing/` for validation requirements.

## Commands

### `cloudcode init`

Initialize the `~/.cloudcode/` directory structure.

Creates:
- `config.json` with default settings
- `state/` directory with empty state files
- `credentials/` directory
- `skills/` directory
- `logs/` directory
- `backups/` directory
- `cache/` directory

### `cloudcode start`

Start the CloudCode daemon (HTTP API server).

Options:
- `--port <port>` — override default port (default: 8080)
- `--host <host>` — override default host (default: 127.0.0.1)

### `console status`

Show daemon status and basic system info.

### `console doctor`

Run diagnostic checks:
- Verify `~/.cloudcode/` directory structure.
- Detect installed CLI tools and their versions.
- Check for version updates.
- Validate config file integrity.
- Report any issues with suggested fixes.

This command is a diagnostic helper. It does not prove adapter correctness or host CLI compatibility by itself.

### `console scan`

Scan for installed CLI tools and update `state/cli_tools.json`.

This command proves discovery only. It does not prove install, upgrade, or native config correctness by itself.

### `console sync (planned)`

> Not yet implemented.

Sync CloudCode configuration to all managed CLI tools:
- Write provider configs to each CLI's native format.
- Write MCP server configs to each CLI's native format.
- Sync enabled skills to each CLI's skill directory.

### `console backup (planned)`

> Not yet implemented.

Create a backup of current configuration under `~/.cloudcode/backups/`.

Options:
- `--name <name>` — custom backup name (default: timestamp-based)
