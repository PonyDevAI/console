# Development Guide (Initial)

This guide describes a practical local development loop for Console.
It is written for an early-stage implementation where conventions may still evolve.

## Prerequisites

- Go toolchain (for backend daemon/control plane).
- Node.js + npm/pnpm (for frontend).
- Local worker CLIs to test adapter behavior (Cursor CLI, Claude CLI, Codex CLI as available).

## Suggested repository structure (conceptual)

A likely initial shape:

```text
/backend   # Go daemon, APIs, worker adapters
/frontend  # Vite + React + Tailwind UI
/docs      # project docs
```

Exact paths can evolve as implementation lands.

## Local development loop

1. Initialize local Console state:
   - `console init`

2. Run backend in dev mode:
   - Start daemon/API server with verbose logging.

3. Run frontend dev server:
   - Start Vite dev server and point it at local backend.

4. Verify end-to-end flow:
   - Select workspace/repo/worker.
   - Submit a prompt.
   - Confirm SSE output streaming and terminal run status.

5. Run diagnostics as needed:
   - `console doctor`
   - `console worker scan`

## Backend development focus

- Keep control-plane and adapter boundaries explicit.
- Build worker adapters behind interfaces for testability.
- Prefer structured logs and consistent error categories.
- Ensure safe handling of credentials and command traces.

## Frontend development focus

- Keep layout and interaction straightforward.
- Render streaming output incrementally and robustly.
- Surface worker/run context clearly to avoid operator confusion.
- Start simple; introduce complexity only when justified by real workflows.

## Testing guidance (early stage)

- Unit test worker adapter command construction and parsing.
- Add integration tests for run lifecycle APIs where practical.
- Validate SSE event order and reconnect behavior.
- Manually test with at least one real local worker CLI.

## Documentation and iteration

- Keep docs aligned with actual implementation status.
- Avoid documenting speculative features as complete.
- Update architecture/roadmap docs when phase assumptions change.
