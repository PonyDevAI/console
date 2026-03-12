# Console Goals

This document captures product and engineering goals by horizon. It intentionally avoids implying that all capabilities already exist.

## Near-term goals (now to Phase 1)

- Establish Console as a reliable **local control console** for AI coding workflows.
- Build a minimal but useful web UI for:
  - Workspace and repository selection.
  - Worker selection.
  - Chat-style request input.
  - Streaming execution output.
- Implement a local daemon (control plane) in Go.
- Define worker adapters for local CLIs (Cursor CLI, Claude CLI, Codex CLI).
- Store configuration and state under `~/.console/` using files.
- Keep startup and runtime lightweight for daily local usage.

## Mid-term goals (Phase 2)

- Improve run/session durability and observability.
- Add stronger lifecycle controls (pause/cancel/retry semantics where feasible).
- Expand artifact handling (structured storage + lookup metadata).
- Introduce SQLite when history/query complexity justifies it.
- Harden worker capability detection and compatibility diagnostics.
- Improve UX for approvals, logs, and execution context.

## Long-term goals (Phase 3 and beyond)

- Evolve from local control console toward a richer orchestration model.
- Support higher-volume and multi-run operational workflows.
- Provide job-board style visibility tailored to AI workers, runs, artifacts, and approvals.
- Enable repository-scoped execution governance with clear control-plane boundaries.
- Preserve local-first ergonomics while allowing future optional expansion paths.
