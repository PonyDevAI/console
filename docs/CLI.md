# Console CLI (Initial Draft)

This document defines early command behavior for the local Console CLI.

## Command overview

```bash
console init
console start
console status
console doctor
console worker scan
```

## `console init`

Purpose:
- Initialize local Console directories and baseline config under `~/.console/`.

Expected behavior:
- Create missing directories (`state/`, `credentials/`, `logs/`, `artifacts/`, `workspaces/`).
- Create `config.json` with defaults if missing.
- Create baseline state files (`workspaces.json`, `workers.json`) if missing.
- Avoid destructive overwrite by default.

## `console start`

Purpose:
- Start the local Console daemon and API/UI backend services.

Expected behavior:
- Validate local config.
- Start HTTP server endpoints.
- Expose SSE stream endpoints for run output.
- Report bind address and health information.

## `console status`

Purpose:
- Show current daemon status and basic runtime state.

Expected behavior:
- Indicate whether daemon is running.
- Show configured paths and active profile/context.
- Optionally show connected/discovered workers.

## `console doctor`

Purpose:
- Run local environment diagnostics.

Expected behavior:
- Check directory permissions for `~/.console/`.
- Validate config/state file readability.
- Check availability of supported worker CLIs in `PATH`.
- Report actionable warnings and errors.

## `console worker scan`

Purpose:
- Discover available local worker CLIs and refresh worker state.

Expected behavior:
- Probe known executables (Cursor CLI, Claude CLI, Codex CLI).
- Capture version/capability hints where possible.
- Update `state/workers.json`.
- Produce human-readable scan summary.

## CLI design principles

- Local-first and explicit behavior.
- Safe defaults (no destructive writes without confirmation/flags).
- Machine-readable output mode can be added later (for scripting).
- Clear error messaging with direct remediation guidance.
