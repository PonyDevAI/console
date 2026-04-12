# CloudCode Goals

This document captures product and engineering goals by horizon.

## Near-term goals (Phase 0 to Phase 1)

- Establish CloudCode as a reliable **local AI CLI management platform**.
- Build a web UI management panel with:
  - Dashboard showing CLI tool status and version info.
  - Version management: detect installed CLIs, check for updates, install/upgrade/uninstall.
  - Provider management: multi-provider CRUD, one-click switching, cross-app sync.
- Implement a local daemon (management plane) in Rust.
- Define CLI adapters for Claude CLI, Codex CLI, Gemini CLI, and Cursor CLI.
- Implement a config sync engine that translates unified config to each CLI's native format.
- Store configuration and state under `~/.console/` using files.
- Keep startup and runtime lightweight for daily local usage.

## Mid-term goals (Phase 2)

- MCP server unified management (CRUD, per-app enable/disable, sync to native configs).
- Skills management (SSOT repository, install/uninstall, cross-app sync).
- Config sync engine hardening (conflict detection, import from existing CLI configs).
- Config backup and restore.
- Upgrade notification system (startup check, Web UI banner).

## Long-term goals (Phase 3 and beyond)

- System prompt management (presets, cross-app format adaptation).
- Restore and enhance run execution capabilities (workspace selection, worker routing, SSE streaming).
- Run history, retry, and approval workflows.
- Evolve toward a broader orchestration model if justified.
- Preserve local-first ergonomics while allowing future expansion (Tauri desktop GUI).
