# CLI Commands

Console provides a CLI for initialization and daemon management.

## Commands

### `console init`

Initialize the `~/.console/` directory structure.

Creates:
- `config.json` with default settings
- `state/` directory with empty state files
- `credentials/` directory
- `skills/` directory
- `logs/` directory
- `backups/` directory
- `cache/` directory

### `console start`

Start the Console daemon (HTTP API server).

Options:
- `--port <port>` — override default port (default: 8080)
- `--host <host>` — override default host (default: 127.0.0.1)

### `console status`

Show daemon status and basic system info.

### `console doctor`

Run diagnostic checks:
- Verify `~/.console/` directory structure.
- Detect installed CLI tools and their versions.
- Check for version updates.
- Validate config file integrity.
- Report any issues with suggested fixes.

### `console scan`

Scan for installed CLI tools and update `state/cli_tools.json`.

### `console sync (planned)`

> Not yet implemented.

Sync Console configuration to all managed CLI tools:
- Write provider configs to each CLI's native format.
- Write MCP server configs to each CLI's native format.
- Sync enabled skills to each CLI's skill directory.

### `console backup (planned)`

> Not yet implemented.

Create a backup of current configuration under `~/.console/backups/`.

Options:
- `--name <name>` — custom backup name (default: timestamp-based)
