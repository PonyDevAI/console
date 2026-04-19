# Development Guide

## Prerequisites

- Rust 1.75+ (with cargo)
- Node.js 18+

## Quick start

```bash
make init   # install deps, build backend, init ~/.cloudcode/
make dev    # start with hot-reload
```

Open `http://127.0.0.1:5173` to access the management panel.

## Validation rule

This document explains development workflow and command usage.
Canonical testing rules live in `docs/testing/`.

## Workspace transition

The repo has started a staged Cargo workspace migration.

- The current app still builds from the root `console` package.
- A transitional `apps/server/` crate now exists as the dedicated server shell.
- Shared API DTO extraction has started in `crates/cloudcode-contracts/`.
- A separate desktop shell scaffold now exists in `apps/desktop/` and `apps/desktop/src-tauri/`.
- The desktop Tauri crate is wired into the Cargo workspace so `make desk` can boot through the repo root.
- Reserved mobile shell paths now exist in `apps/mobile/android/` and `apps/mobile/ios/`.
- The root package now also exposes a reusable library surface so future app shells can share Rust modules during migration.
- The desktop UI is independent from `apps/web/`; do not treat `apps/desktop/` as a visual clone or a shared-component target.

## Make commands

| Command      | Description                                      |
|-------------|--------------------------------------------------|
| `make init`  | Install deps, build backend, init `~/.cloudcode/`  |
| `make server` | Start backend dev server with hot-reload       |
| `make web` | Start web dev server                              |
| `make desk` | Start desktop dev shell                          |
| `make android` | Reserved Android dev target                   |
| `make ios` | Reserved iOS dev target                           |
| `make dev`   | Start backend hot-reload + web dev server       |
| `make run`   | Start backend + frontend (no hot-reload)          |
| `make build` | Build production release                          |
| `make check` | Type-check backend (cargo) + frontend (tsc)       |
| `make test`  | Run Rust unit and narrow integration tests        |
| `make verify-local` | Run the default local validation command set |
| `make clean` | Remove build artifacts                            |
| `make doctor`| Run diagnostic checks                             |
| `make scan`  | Scan for installed CLI tools                      |
| `make help`  | Show all available commands                       |

Command semantics:

- `make check` is static validation only.
- `make test` is test execution only.
- `make verify-local` is a convenience entrypoint for the local validation layer.
- `make doctor` and `make scan` are helpers; they do not prove end-to-end correctness.
- For claims about validation scope, follow `docs/testing/`.

Desktop command semantics:

- `make server` is the canonical backend dev entrypoint and uses hot-reload.
- `make web` is the canonical web dev entrypoint.
- `make desk` is the canonical desktop dev entrypoint and starts the Tauri shell.
- `make android` and `make ios` are the canonical mobile placeholder entrypoints and currently confirm the reserved app paths.
- These commands are development helpers, not validation proof.

## Hot-reload in dev mode

`make dev` starts two processes in parallel:

- **Rust backend**: `cargo-watch` monitors `src/` for changes, auto-recompiles and restarts the API server on `:8080`.
- **React frontend**: Vite dev server on `:5173` with HMR (Hot Module Replacement). Proxies `/api/*` to the backend.

Press `Ctrl+C` to stop both processes.

## Manual commands

If you prefer running things separately:

```bash
# Terminal 1 — backend with hot-reload
make server

# Terminal 2 — frontend with HMR
make web
```

Or without hot-reload:

```bash
# Terminal 1 — backend
cargo run -- start

# Terminal 2 — frontend
make web
```

Desktop shell:

```bash
make desk
```

Mobile placeholders:

```bash
make android
make ios
```

## Project structure

```
console/
  Cargo.toml               # Rust project manifest
  Makefile                  # Dev commands
  src/
    main.rs                 # Entry point
    lib.rs                  # Reusable transitional library surface
    cli/                    # CLI commands (init, start, doctor)
    api/                    # HTTP API routes (axum)
    services/               # Business logic (version, provider, mcp, skill, prompt)
    adapters/               # CLI adapter implementations
    sync/                   # Config sync engine
    storage/                # Local file read/write
    models/                 # Data structures
  apps/
    server/                # Transitional dedicated server shell
    web/                   # Web app (Vite + React + Tailwind)
    desktop/               # Independent desktop app + Tauri shell
    mobile/
      android/             # Reserved Android app surface
      ios/                 # Reserved iOS app surface
  crates/
    cloudcode-contracts/   # Shared request/response and protocol DTOs
  docs/                     # Documentation
```

## Adding a new CLI adapter

1. Create `src/adapters/<name>.rs` implementing the `CliAdapter` trait.
2. Register the adapter in `src/adapters/mod.rs`.
3. Add config path mappings and format handlers.
4. Add or update relevant tests and validation docs under `docs/testing/`.
5. Use `docs/testing/adapter-validation-spec.md` to verify detection and native config assumptions.
