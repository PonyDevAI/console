# Technical Stack Rationale

## Backend: Go

Why Go for the Console daemon/control plane:
- Good fit for long-running local services.
- Strong standard library for HTTP, process execution, filesystem operations, and concurrency.
- Predictable deployment story (single binary workflows).
- Practical ergonomics for streaming and adapter orchestration.

## Frontend: Vite + React + Tailwind

Why this frontend stack:
- Vite provides fast local iteration and simple build tooling.
- React supports component-based UI for chat, selectors, and run details.
- Tailwind enables fast, consistent UI styling for operational panels.

This combination supports quick iteration in early phases without excessive framework overhead.

## Streaming transport: SSE (initial)

Why SSE first:
- Simple server-to-client streaming model for incremental run output.
- Easy to implement and debug for local-first scenarios.
- Good match for unidirectional stream needs in initial chat/run output UX.

WebSockets can be revisited later if bidirectional real-time control needs significantly expand.

## Storage: files first, SQLite later

Why start with file-based state:
- Minimal operational complexity.
- Easy local inspection and backup.
- Sufficient for early configuration and small-scale state.

Why add SQLite later:
- Session/run history will eventually need indexed queries.
- Artifact metadata lookup becomes harder with only flat files.
- Operational dashboards and richer filtering require structured query support.

Trigger for SQLite adoption should be demonstrated query/use-case pressure, not preference alone.
