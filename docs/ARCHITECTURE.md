# Console Architecture

Console is designed around explicit plane separation so the system can remain simple early and scale in capability later.

## 1) Control plane (initial core)

The control plane is the Console daemon and backend API.

Responsibilities:
- Load and persist local config/state.
- Manage workspace and repository registrations.
- Manage worker definitions, capabilities, and routing decisions.
- Create and track sessions/runs.
- Expose APIs used by the web UI.
- Stream run output via SSE.

Non-goals (early):
- Heavy distributed scheduling.
- Multi-node execution management.

## 2) Execution plane (adapter-driven)

The execution plane is a set of worker adapters around local CLIs.

Responsibilities:
- Translate normalized Console run requests into worker-specific CLI invocations.
- Execute local worker processes.
- Normalize stdout/stderr/events for the control plane.
- Return status, artifacts, and errors in a consistent shape.

Initial workers:
- Cursor CLI adapter.
- Claude CLI adapter.
- Codex CLI adapter.

Key principle:
- Execution is pluggable. The control plane should not depend on one worker implementation.

## 3) Future orchestration plane (long-term)

A future orchestration plane can emerge once run volume and workflow complexity increase.

Potential responsibilities:
- Queueing and prioritization.
- Approval gates and policy checks.
- Run board views and lifecycle operations at scale.
- Higher-level coordination across sessions and repositories.

This layer should be additive and must not break local-first operation.

## Transition path

1. Start with a single local daemon that covers control-plane concerns.
2. Keep worker logic behind adapter interfaces from day one.
3. Maintain durable state in files until query demands warrant SQLite.
4. Add orchestration features incrementally, preserving clear boundaries:
   - Control plane = state, routing, APIs.
   - Execution plane = worker process interaction.
   - Orchestration plane = higher-order scheduling/governance.

## Repository and workspace model

- Repositories remain in their original filesystem locations and are treated as source-of-truth working copies.
- `~/.console/workspaces/` stores Console-owned metadata/cache/artifacts only.
- Console tracks repo references, not repo ownership.

## Architecture decision records

- [ADR 0001: Local file-based state](decisions/0001-local-file-state.md)
- [ADR 0002: SSE streaming transport](decisions/0002-sse-streaming-transport.md)
- [ADR 0003: Worker adapter boundary](decisions/0003-worker-adapter-boundary.md)
- [Implementation assumptions and ambiguities](IMPLEMENTATION_ASSUMPTIONS.md)
