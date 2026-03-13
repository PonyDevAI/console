# Technical Stack Rationale

## Backend: Rust (axum)

Why Rust for the Console daemon:
- Excellent fit for long-running local services with low resource usage.
- Strong type system catches config sync bugs at compile time.
- Single binary deployment, no runtime dependencies.
- Future compatibility with Tauri for desktop GUI.
- axum provides ergonomic async HTTP with tower middleware ecosystem.

## Frontend: Vite + React + TypeScript + Tailwind CSS

Why this frontend stack:
- Vite provides fast local iteration and simple build tooling.
- React supports component-based UI for management panels and dashboards.
- TypeScript ensures type safety across API boundaries.
- Tailwind enables fast, consistent UI styling for admin-panel-style interfaces.

## Streaming transport: SSE (initial)

Why SSE first:
- Simple server-to-client streaming model for run output (when execution is restored).
- Easy to implement and debug for local-first scenarios.
- Good match for unidirectional stream needs.

WebSockets can be revisited if bidirectional real-time control needs expand.

## Storage: files first, SQLite later

Why start with file-based state:
- Minimal operational complexity.
- Easy local inspection and backup.
- Sufficient for configuration management and small-scale state.

Why add SQLite later:
- Run history will eventually need indexed queries.
- Skill/MCP metadata lookup may benefit from structured queries.
- Operational dashboards and richer filtering require query support.

Trigger for SQLite adoption should be demonstrated query/use-case pressure, not preference alone.
