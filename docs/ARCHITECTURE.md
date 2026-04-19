# CloudCode Architecture

CloudCode is designed around a management plane / execution plane separation, with a config sync engine as the core integration layer.

## Current transition note

The repository has started extracting shared API contracts into `crates/cloudcode-contracts/` as the first step toward a split between:

- a dedicated server application
- a dedicated desktop application
- shared Rust core crates

At this stage, the server still runs from the root package, but route-layer DTOs should begin moving into the contracts crate instead of being defined inline in API files.
The repo also includes a transitional `apps/server/` crate that reuses the current root library while deeper crate extraction is still in progress.
The desktop shell lives in `apps/desktop/` and is intentionally UI-independent from the web dashboard.
Desktop and server are separate Rust application shells. They may share lower crates, but the desktop shell should not embed the server application's route layer as its primary integration path.
Reserved mobile application paths now live under `apps/mobile/android/` and `apps/mobile/ios/` so future mobile work follows the same shell separation model.

## 1) Management plane (primary focus)

The management plane is the CloudCode daemon and backend API.

Responsibilities:
- Load and persist local config/state under `~/.cloudcode/`.
- Manage CLI tool version lifecycle (detect, install, upgrade, uninstall).
- Manage provider/model configurations and active provider switching.
- Manage MCP server configurations with per-app enable/disable.
- Manage skills with SSOT repository and cross-app sync.
- Manage system prompt presets.
- Expose REST APIs consumed by the Web UI.
- Drive the config sync engine to write unified config to each CLI's native format.

## 2) Config sync engine (core differentiator)

Each CLI tool has different config file formats and paths:
- Claude: `~/.claude/settings.json`, `~/.claude.json`
- Codex: `~/.codex/config.toml`
- Gemini: `~/.gemini/settings.json`
- Cursor: `~/.cursor/` (various config files)

The sync engine:
- Reads CloudCode's unified configuration.
- Transforms it into each CLI's native format via the adapter layer.
- Writes to the correct filesystem paths.
- Supports reverse import (read existing CLI configs into CloudCode).
- Detects conflicts when CLI configs are modified externally.

## 3) Execution plane (deferred priority)

The execution plane is a set of worker adapters for running prompts against local CLIs.

Responsibilities:
- Translate normalized run requests into CLI-specific invocations.
- Execute local worker processes.
- Normalize stdout/stderr/events for the management plane.
- Stream output via SSE.

This plane is architecturally preserved but implementation is deferred to Phase 3.

## 4) CLI adapter layer

Each supported CLI has an adapter implementing a shared trait:

```rust
trait CliAdapter {
    fn name(&self) -> &str;
    fn detect_installation(&self) -> Result<Option<InstalledInfo>>;
    fn check_remote_version(&self) -> Result<Option<String>>;
    fn install(&self) -> Result<()>;
    fn upgrade(&self) -> Result<()>;
    fn uninstall(&self) -> Result<()>;
    fn config_paths(&self) -> ConfigPaths;
    fn read_provider_config(&self) -> Result<ProviderConfig>;
    fn write_provider_config(&self, config: &ProviderConfig) -> Result<()>;
    fn read_mcp_config(&self) -> Result<McpConfig>;
    fn write_mcp_config(&self, config: &McpConfig) -> Result<()>;
    fn read_skills(&self) -> Result<Vec<Skill>>;
    fn sync_skills(&self, skills: &[Skill]) -> Result<()>;
}
```

Initial adapters: Claude, Codex, Gemini, Cursor.
New CLIs can be added by implementing this trait.

## 5) Storage model

Local file-based storage under `~/.cloudcode/`:

```text
~/.cloudcode/
  config.json              # CloudCode self-config
  state/
    cli_tools.json         # Detected CLI tools and versions
    providers.json         # Provider configurations
    mcp_servers.json       # MCP server configurations
    prompts.json           # Prompt presets
    workspaces.json        # Workspaces (preserved)
  credentials/             # API keys
  skills/                  # SSOT skill repository
  logs/                    # Logs
  backups/                 # Config backups
  cache/                   # Version check cache
```

Execution-plane runtime metadata may also persist under `~/.cloudcode/`, including terminal session metadata and future runtime/session state, while keeping repositories as external source-of-truth workspaces.

Server target management and local authentication object management are defined separately in:

- [Server And Credential Architecture](SERVER_AND_CREDENTIAL_ARCHITECTURE.md)
- [Server And Credential Implementation Plan](SERVER_AND_CREDENTIAL_IMPLEMENTATION_PLAN.md)

Terminal runtime and local/remote terminal target policy are defined in:

- [Terminal Runtime](TERMINAL_RUNTIME.md)

## Architecture decision records

- [ADR 0001: Local file-based state](decisions/0001-local-file-state.md)
- [ADR 0002: SSE streaming transport](decisions/0002-sse-streaming-transport.md)
- [ADR 0003: Worker adapter boundary](decisions/0003-worker-adapter-boundary.md)
- [ADR 0004: Persistent terminal sessions](decisions/0004-persistent-terminal-sessions.md)
