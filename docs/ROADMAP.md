# Console Roadmap

This roadmap is phase-based and intended as planning guidance, not a promise of exact delivery dates.

## Phase 0: Foundation and scaffolding

Objective: establish Rust project skeleton, core abstractions, and development workflow.

- Set up Rust project with axum, clap, serde, tokio.
- Define CLI adapter trait (version detection, config paths, config read/write).
- Implement initial adapters for Claude CLI, Codex CLI, Gemini CLI, Cursor CLI.
- Implement local file storage layer under `~/.console/`.
- Set up basic API framework (health, status endpoints).
- Set up React + Tailwind frontend skeleton.
- Update documentation to reflect new direction.

## Phase 1: Core management MVP

Objective: deliver version management and provider management with a usable Web UI.

- Version management service: local version detection, remote version query, install/upgrade/uninstall.
- Provider management service: CRUD, active provider switching, cross-app config sync.
- Config sync engine: translate unified config to each CLI's native format and write to correct paths.
- Web UI management panel: dashboard, version page, provider page.
- CLI commands: `init`, `start`, `status`, `doctor`.
- Upgrade notification (startup check, Web UI banner).

## Phase 2: Extended management

Objective: add MCP and skills management capabilities.

- MCP server management: CRUD, per-app enable/disable, sync to native config files.
- Skills management: SSOT repository, install/uninstall/enable/disable, cross-app sync.
- Import from existing CLI configs (reverse sync).
- Config backup and restore.
- Web UI pages for MCP and skills management.

## Phase 3: Completion and execution

Objective: round out management features and restore run execution.

- System prompt management (presets, cross-app format adaptation).
- Run execution restoration (workspace/worker selection, prompt routing, SSE streaming).
- Run history and lifecycle controls.
- Conflict detection for external config changes.
- Foundation for future Tauri desktop GUI.
