# CloudCode

CloudCode is a **local AI CLI unified management platform**. It provides a web UI and local daemon for managing the full lifecycle of AI coding CLI tools — version management, provider/model switching, MCP server configuration, skills management, and system prompts.

## What CloudCode does

- **Version management**: detect, install, upgrade, and uninstall AI CLI tools (Claude CLI, Codex CLI, Gemini CLI, Cursor CLI, and more via adapters).
- **Provider / model management**: configure multiple API endpoints and keys, switch active providers, sync across all managed CLIs.
- **MCP server management**: unified CRUD for MCP servers, per-app enable/disable, auto-sync to each CLI's native config.
- **Skills management**: single source of truth skill repository, install/uninstall/enable/disable, sync to CLI skill directories.
- **System prompt management**: manage prompt presets, cross-app format adaptation (CLAUDE.md, AGENTS.md, GEMINI.md).
- **Run execution** (deferred priority): route prompts to local CLI workers and stream output via SSE.

## What CloudCode is not (yet)

- A cloud-hosted orchestration platform.
- A replacement for git hosting or CI systems.
- A full distributed job scheduler.

## Core differentiator

Unlike CLI-only tools, CloudCode provides a **Web UI management panel** as the primary interface. Unlike desktop-only tools, CloudCode runs as a lightweight local daemon accessible from any browser. The **config sync engine** translates CloudCode's unified configuration into each CLI's native format automatically.

## Supported CLI tools

| CLI | Status |
|-----|--------|
| Claude CLI | Supported |
| Codex CLI | Supported |
| Gemini CLI | Supported |
| Cursor CLI | Supported |
| Custom | Extensible via adapter interface |

## Tech stack

- Backend: Rust (axum)
- Frontend: Vite + React + TypeScript + Tailwind CSS
- Storage: local files under `~/.console/`, SQLite when justified
- Streaming: SSE

## Local file layout

```text
~/.console/
  config.json              # CloudCode config (port, theme, etc.)
  state/
    cli_tools.json         # Detected CLI tools and versions
    providers.json         # Provider configurations
    mcp_servers.json       # MCP server configurations
    prompts.json           # Prompt presets
    workspaces.json        # Workspaces (preserved)
  credentials/             # API keys and secrets
  skills/                  # SSOT skill repository
  logs/                    # Run logs
  backups/                 # Config backups
  cache/                   # Version check cache, etc.
```

## Quickstart

Backend:

```bash
cargo run -- init
cargo run -- start
```

Frontend:

```bash
cd dashboard
npm install
npm run dev
```

Open the Vite URL (default `http://127.0.0.1:5173`) to access the CloudCode management panel.

## Documentation

- [Goals](docs/GOALS.md)
- [Roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Tech Stack](docs/TECH_STACK.md)
- [Storage Model](docs/STORAGE.md)
- [CLI Commands](docs/CLI.md)
- [CLI Adapter Model](docs/ADAPTER_MODEL.md)
- [Web UI](docs/WEB_UI.md)
- [Development Guide](docs/DEVELOPMENT.md)

## Current phase

CloudCode is in Phase 0 (foundation and scaffolding). See [Roadmap](docs/ROADMAP.md) for details.
