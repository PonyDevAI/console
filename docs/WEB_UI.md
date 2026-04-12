# Web UI

The Web UI is CloudCode's primary management interface, designed as an admin panel for AI CLI tools.

## Stack

- Vite + React + TypeScript + Tailwind CSS

## Pages

### Dashboard
- Overview of all managed CLI tools with version status.
- Quick actions: scan for updates, sync all configs.
- System health indicator (backend connectivity).

### Agent Management (设置菜单)
- List of local CLI Agent Sources with: name, installed status, version, path, current model.
- Actions: scan, install, upgrade, uninstall.
- Model configuration support per tool.
- Status badges: installed, not installed, update available, unhealthy.

### AI Employee Management (设置菜单)
- List of employees (local and remote) with: name, type, role, bound source, model.
- Create/edit/delete employees.
- Local employees support persona files (SOUL.md, SKILLS.md, RULES.md).
- Remote employees support remote agent name binding.
- Model override per employee.
- Dispatch history and success rate display.

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

### Terminal
- Default mode: persistent terminal sessions connecting to the host where CloudCode is running.
- Preferred backend: local `tmux` session on the CloudCode host.
- SSH terminal support is a later backend expansion, not a separate UI model.
- Features:
  - Multiple persistent terminal sessions
  - Session list, create, reopen, and explicit terminate
  - Real-time terminal input/output via WebSocket attachment
  - Detach/reattach semantics across refresh and reconnect
  - Project-bound terminal sessions, with future employee-bound views
  - Shell selection: uses `$SHELL` env var, falls back to `/bin/zsh` → `/bin/bash` → `/bin/sh`
  - Working directory defaults to the selected project or host default
  - Terminal resize support
  - Connection status indicator (connecting/connected/error/disconnected)
  - Explicit session lifecycle separate from browser lifecycle

## Backend connectivity

The Web UI communicates with the Rust backend via REST API:

### Agent Sources
- `GET /api/agent-sources` — list all agent sources (local CLI tools)
- `POST /api/agent-sources/scan` — scan all sources
- `POST /api/agent-sources/check-updates` — check for updates
- `GET /api/agent-sources/:id` — get single source details
- `POST /api/agent-sources/:id/scan` — scan single source
- `POST /api/agent-sources/:id/install` — install source
- `POST /api/agent-sources/:id/upgrade` — upgrade source
- `POST /api/agent-sources/:id/uninstall` — uninstall source
- `POST /api/agent-sources/:id/check-update` — check single source update
- `POST /api/agent-sources/:id/test` — test source health
- `GET /api/agent-sources/:id/models` — get source model info
- `PUT /api/agent-sources/:id/default-model` — set default model

### Employees
- `GET /api/employees` — list all employees
- `POST /api/employees` — create employee
- `GET /api/employees/:id` — get employee details
- `PUT /api/employees/:id` — update employee
- `DELETE /api/employees/:id` — delete employee
- `GET /api/employees/:id/soul-files` — get soul files (deprecated, use persona-files)
- `PUT /api/employees/:id/soul-files` — update soul files
- `POST /api/employees/:id/dispatch` — dispatch task to employee
- `GET /api/employees/:id/history` — get dispatch history

### Legacy CLI Tools (deprecated)
- `GET /api/cli-tools` — list CLI tools and versions
- `POST /api/cli-tools/:name/install` — install a CLI tool
- `POST /api/cli-tools/:name/upgrade` — upgrade a CLI tool

### Providers
- `GET /api/providers` — list providers
- `POST /api/providers` — create provider
- `PUT /api/providers/:id` — update provider
- `DELETE /api/providers/:id` — delete provider
- `POST /api/providers/:id/activate` — switch active provider
- `POST /api/providers/:id/speedtest` — test API latency

### MCP Servers
- `GET /api/mcp-servers` — list MCP servers
- `POST /api/mcp-servers` — create MCP server
- `POST /api/mcp-servers/sync` — sync to CLI configs

### Skills
- `GET /api/skills` — list skills
- `POST /api/skills/install` — install a skill
- `POST /api/skills/sync` — sync to CLI directories

### Config
- `POST /api/config/backup` — create config backup
- `POST /api/config/sync-all` — sync all configs to all CLIs

### Terminal
- `GET /api/terminal/sessions` — list terminal sessions
- `POST /api/terminal/sessions` — create terminal session
- `GET /api/terminal/sessions/:id` — get terminal session metadata
- `GET /api/terminal/sessions/:id/ws` — WebSocket endpoint for terminal I/O
- `POST /api/terminal/sessions/:id/input` — write input into terminal session
- `POST /api/terminal/sessions/:id/resize` — resize terminal session
- `POST /api/terminal/sessions/:id/terminate` — terminate terminal session

**Terminal Session Types:**

Local persistent session (default):
```json
{ "target": "local_host", "backend": "tmux", "cols": 80, "rows": 24, "cwd": "/path", "shell": "/bin/zsh" }
```

Remote persistent session (later phase):
```json
{ "target": "ssh_host", "target_id": "host-prod-01", "backend": "tmux", "cols": 80, "rows": 24, "cwd": "/srv/app" }
```

During local development, Vite proxies `/api/*` calls to `http://127.0.0.1:8080`.
