# ADR 0004: Model terminal sessions as persistent execution resources

## Status
Accepted

## Context
CloudCode needs terminal sessions that survive browser refresh, reconnects, and later AI-driven task execution. The current transient PTY model is not sufficient for project-scoped, employee-scoped, and remotely hosted long-running work.

## Decision
Model terminal sessions as persistent execution resources whose lifecycle is independent from a browser connection. Treat WebSocket connections as attach/detach channels only, and use backend adapters to support local-host and remote-host terminal targets. Prefer `tmux` as the persistent backend when available.

## Consequences
- Enables project-bound and employee-bound terminal sessions that can be reopened later.
- Creates a clean path for AI workers to operate against stable terminal session ids instead of transient browser state.
- Requires terminal metadata persistence under `~/.cloudcode/` and explicit terminate semantics separate from disconnect semantics.
