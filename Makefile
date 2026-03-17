.PHONY: init run dev server dashboard build check clean doctor scan install uninstall help

# ── Default ──────────────────────────────────────────────

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# ── Init ─────────────────────────────────────────────────

init: ## Install deps, build backend, init ~/.console/
	@echo "==> Checking prerequisites..."
	@command -v cargo >/dev/null 2>&1 || { echo "Error: cargo not found. Install Rust: https://rustup.rs"; exit 1; }
	@command -v node  >/dev/null 2>&1 || { echo "Error: node not found. Install Node.js 18+"; exit 1; }
	@command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm not found. Install pnpm first."; exit 1; }
	@echo "==> Installing cargo-watch (hot-reload)..."
	@cargo install cargo-watch --quiet 2>/dev/null || true
	@echo "==> Installing frontend dependencies..."
	@cd dashboard && pnpm install --silent
	@echo "==> Building backend..."
	@cargo build
	@echo "==> Initializing ~/.console/..."
	@cargo run --quiet -- init
	@echo "==> Done."

# ── Run (separate or together) ───────────────────────────

server: ## Start backend only
	@cargo run -- start

dev: ## Start backend with hot-reload (auto recompile on file change)
	@cargo watch -x 'run -- start'

dashboard: ## Start frontend dev server only
	@cd dashboard && pnpm dev

run: ## Start backend + frontend together
	@trap 'kill 0' INT TERM; \
	cargo run -- start & \
	cd dashboard && pnpm dev & \
	wait

# ── Dev (hot-reload) ─────────────────────────────────────

dev: ## Start with hot-reload (cargo-watch + vite HMR)
	@command -v cargo-watch >/dev/null 2>&1 || { echo "cargo-watch not found. Run 'make init' first."; exit 1; }
	@trap 'kill 0' INT TERM; \
	cargo watch -w src -x 'run -- start' & \
	cd dashboard && pnpm dev & \
	wait

# ── Build ────────────────────────────────────────────────

build: ## Build production release
	@echo "==> Building backend (release)..."
	@cargo build --release
	@echo "==> Building frontend..."
	@cd dashboard && pnpm build
	@echo "==> Build complete."

install: build ## Install to ~/.console/bin/
	@mkdir -p ~/.console/bin ~/.console/dashboard
	@cp target/release/console ~/.console/bin/console
	@cp -r dashboard/dist/ ~/.console/dashboard/
	@echo "Installed to ~/.console/bin/console"
	@echo "Add to PATH: export PATH=\"\$$HOME/.console/bin:\$$PATH\""

uninstall: ## Remove ~/.console/bin/ and ~/.console/dashboard/
	@rm -rf ~/.console/bin ~/.console/dashboard
	@echo "Uninstalled. Config preserved at ~/.console/"

# ── Check ────────────────────────────────────────────────

check: ## Type-check backend + frontend
	@echo "==> cargo check..."
	@cargo check
	@echo "==> tsc --noEmit..."
	@cd dashboard && pnpm exec tsc --noEmit
	@echo "==> All checks passed."

# ── Clean ────────────────────────────────────────────────

clean: ## Remove build artifacts
	@cargo clean
	@rm -rf dashboard/dist dashboard/node_modules/.vite
	@echo "Cleaned."

# ── Utilities ────────────────────────────────────────────

doctor: ## Run diagnostic checks
	@cargo run --quiet -- doctor

scan: ## Scan for installed CLI tools
	@cargo run --quiet -- scan
