# Console Roadmap

This roadmap is phase-based and intended as planning guidance, not a promise of exact delivery dates.

## Phase 0: Foundation and scaffolding

Objective: define shape, contracts, and development workflow.

- Establish repository structure and documentation baseline.
- Define core domain concepts: workspace, repository, worker, session, run, artifact.
- Implement minimal configuration loading from `~/.console/`.
- Set up Go backend skeleton and React frontend skeleton.
- Define initial API boundaries and SSE stream contracts.

## Phase 1: Local control console MVP

Objective: deliver a usable local-first control console.

- Run local daemon to manage control-plane state and routing.
- Implement initial CLI commands (`init`, `start`, `status`, `doctor`, `worker scan`).
- Add worker adapters for Cursor CLI, Claude CLI, and Codex CLI.
- Build first web UI with workspace/repo/worker selection and chat area.
- Stream worker output to UI using SSE.
- Persist state in files under `~/.console/`.

## Phase 2: Reliability and history depth

Objective: improve operational robustness and traceability.

- Extend session/run history retention.
- Add richer artifact tracking and indexing metadata.
- Introduce SQLite for history and query-heavy data paths.
- Improve diagnostics, recovery behavior, and error visibility.
- Add stronger execution controls and better run introspection.

## Phase 3: Orchestration console evolution

Objective: move toward broader AI coding orchestration.

- Expand orchestration model beyond single interactive runs.
- Add board-like views for run states, queues, and approvals.
- Improve policy-aware routing and repository-scoped governance.
- Deepen artifact lineage and run-to-run traceability.
- Maintain separation between control plane and execution adapters while scaling capabilities.
