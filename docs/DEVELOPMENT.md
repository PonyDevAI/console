# Development Guide

## Prerequisites

- Rust 1.75+ (with cargo)
- Node.js 18+

## Quick start

```bash
make init   # install deps, build backend, init ~/.console/
make dev    # start with hot-reload
```

Open `http://127.0.0.1:5173` to access the management panel.

## Make commands

| Command      | Description                                      |
|-------------|--------------------------------------------------|
| `make init`  | Install deps, build backend, init `~/.console/`  |
| `make dev`   | Start with hot-reload (cargo-watch + Vite HMR)   |
| `make run`   | Start backend + frontend (no hot-reload)          |
| `make build` | Build production release                          |
| `make check` | Type-check backend (cargo) + frontend (tsc)       |
| `make clean` | Remove build artifacts                            |
| `make doctor`| Run diagnostic checks                             |
| `make scan`  | Scan for installed CLI tools                      |
| `make help`  | Show all available commands                       |

## Hot-reload in dev mode

`make dev` starts two processes in parallel:

- **Rust backend**: `cargo-watch` monitors `src/` for changes, auto-recompiles and restarts the API server on `:8080`.
- **React frontend**: Vite dev server on `:5173` with HMR (Hot Module Replacement). Proxies `/api/*` to the backend.

Press `Ctrl+C` to stop both processes.

## Manual commands

If you prefer running things separately:

```bash
# Terminal 1 — backend with hot-reload
cargo watch -w src -x 'run -- start'

# Terminal 2 — frontend with HMR
cd web && npm run dev
```

Or without hot-reload:

```bash
# Terminal 1 — backend
cargo run -- start

# Terminal 2 — frontend
cd web && npm run dev
```

## Project structure

```
console/
  Cargo.toml               # Rust project manifest
  Makefile                  # Dev commands
  src/
    main.rs                 # Entry point
    cli/                    # CLI commands (init, start, doctor)
    api/                    # HTTP API routes (axum)
    services/               # Business logic (version, provider, mcp, skill, prompt)
    adapters/               # CLI adapter implementations
    sync/                   # Config sync engine
    storage/                # Local file read/write
    models/                 # Data structures
  web/                      # Frontend (Vite + React + Tailwind)
  docs/                     # Documentation
```

## Adding a new CLI adapter

1. Create `src/adapters/<name>.rs` implementing the `CliAdapter` trait.
2. Register the adapter in `src/adapters/mod.rs`.
3. Add config path mappings and format handlers.
4. Test with `make doctor` to verify detection.
