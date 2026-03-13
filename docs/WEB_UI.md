# Web UI

The Web UI is Console's primary management interface, designed as an admin panel for AI CLI tools.

## Stack

- Vite + React + TypeScript + Tailwind CSS

## Pages

### Dashboard
- Overview of all managed CLI tools with version status.
- Quick actions: scan for updates, sync all configs.
- System health indicator (backend connectivity).

### Version Management
- List of supported CLI tools with: name, installed version, latest version, status badge.
- Actions per tool: install, upgrade, uninstall.
- Upgrade notification banner when updates are available.

### Provider Management
- List of configured providers with: name, API endpoint, associated apps, active status.
- Add / edit / delete providers.
- One-click switch active provider.
- API latency test (speedtest).
- Provider templates (OpenRouter, PackyAPI, etc.).
- Sync button to push config to all managed CLIs.

### MCP Server Management
- List of MCP servers with: name, transport type, enabled apps.
- Add / edit / delete MCP servers.
- Per-app enable/disable toggles.
- Sync to native CLI config files.
- Import from existing CLI configs.
- Command validation (check if MCP server command is in PATH).

### Skills Management
- List of installed skills with: name, description, enabled apps.
- Install / uninstall skills.
- Per-app enable/disable.
- Search community skill repositories.
- Scan for unmanaged skills and import.
- Sync method selection (symlink / copy).

### Prompt Management (Phase 3)
- List of prompt presets.
- Create / edit / delete presets.
- Activate / deactivate per app.
- Preview with format adaptation (CLAUDE.md / AGENTS.md / GEMINI.md).

### Run Execution (Phase 3, deferred)
- Workspace and worker selection.
- Prompt input and run submission.
- SSE streaming output panel.

## Backend connectivity

The Web UI communicates with the Rust backend via REST API:

- `GET /api/health` — backend status
- `GET /api/cli-tools` — list CLI tools and versions
- `POST /api/cli-tools/:name/install` — install a CLI tool (planned)
- `POST /api/cli-tools/:name/upgrade` — upgrade a CLI tool (planned)
- `GET /api/providers` — list providers
- `POST /api/providers` — create provider
- `PUT /api/providers/:id` — update provider (planned)
- `DELETE /api/providers/:id` — delete provider (planned)
- `POST /api/providers/:id/activate` — switch active provider (planned)
- `POST /api/providers/:id/speedtest` — test API latency (planned)
- `GET /api/mcp-servers` — list MCP servers
- `POST /api/mcp-servers` — create MCP server
- `POST /api/mcp-servers/sync` — sync to CLI configs (planned)
- `GET /api/skills` — list skills
- `POST /api/skills/install` — install a skill (planned)
- `POST /api/skills/sync` — sync to CLI directories (planned)
- `POST /api/config/backup` — create config backup (planned)
- `POST /api/config/sync-all` — sync all configs to all CLIs (planned)

During local development, Vite proxies `/api/*` calls to `http://127.0.0.1:8080`.
