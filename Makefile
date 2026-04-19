.PHONY: init run dev server web desk android ios build check test verify-local clean doctor scan install uninstall help

# ── Default ──────────────────────────────────────────────

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# ── Init ─────────────────────────────────────────────────

init: ## Install deps, build backend, init ~/.cloudcode/
	@echo "==> Checking prerequisites..."
	@command -v cargo >/dev/null 2>&1 || { echo "Error: cargo not found. Install Rust: https://rustup.rs"; exit 1; }
	@command -v node  >/dev/null 2>&1 || { echo "Error: node not found. Install Node.js 18+"; exit 1; }
	@command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm not found. Install pnpm first."; exit 1; }
	@echo "==> Installing cargo-watch (hot-reload)..."
	@cargo install cargo-watch --quiet 2>/dev/null || true
	@echo "==> Installing frontend dependencies..."
	@cd apps/web && pnpm install --silent
	@echo "==> Installing desktop dependencies..."
	@cd apps/desktop && pnpm install --silent
	@echo "==> Building backend..."
	@cargo build
	@echo "==> Initializing ~/.cloudcode/..."
	@cargo run --quiet -- init
	@echo "==> Done."

# ── Run (separate or together) ───────────────────────────

server: ## Start backend dev server with hot-reload
	@command -v cargo-watch >/dev/null 2>&1 || { echo "cargo-watch not found. Run 'cargo install cargo-watch' first."; exit 1; }
	@cargo watch -w src -x 'run -- start'

web: ## Start web dev server
	@cd apps/web && pnpm dev

desk: ## Start desktop dev shell
	@cd apps/desktop && pnpm tauri:dev

android: ## Start Android dev target
	@echo "Android shell placeholder ready at apps/mobile/android"
	@echo "Next step: scaffold the actual Android runtime in apps/mobile/android"

ios: ## Start iOS dev target
	@echo "iOS shell placeholder ready at apps/mobile/ios"
	@echo "Next step: scaffold the actual iOS runtime in apps/mobile/ios"

dev: ## Start backend hot-reload + web dev server
	@command -v cargo-watch >/dev/null 2>&1 || { echo "cargo-watch not found. Run 'cargo install cargo-watch' first."; exit 1; }
	@trap 'kill 0' INT TERM; \
	cargo watch -w src -x 'run -- start' & \
	cd apps/web && pnpm dev & \
	wait

run: ## Start backend + frontend together
	@trap 'kill 0' INT TERM; \
	cargo run -- start & \
	cd apps/web && pnpm dev & \
	wait

# ── Build ────────────────────────────────────────────────

build: ## Build production release
	@echo "==> Building backend (release)..."
	@cargo build --release
	@echo "==> Building frontend..."
	@cd apps/web && pnpm build
	@echo "==> Build complete."

install: build ## Install to ~/.cloudcode/bin/
	@mkdir -p ~/.cloudcode/bin ~/.cloudcode/web
	@cp target/release/cloudcode ~/.cloudcode/bin/cloudcode
	@cp -r apps/web/dist/ ~/.cloudcode/web/
	@echo "Installed to ~/.cloudcode/bin/cloudcode"
	@echo "Add to PATH: export PATH=\"\$$HOME/.cloudcode/bin:\$$PATH\""

uninstall: ## Remove ~/.cloudcode/bin/ and ~/.cloudcode/web/
	@rm -rf ~/.cloudcode/bin ~/.cloudcode/web
	@echo "Uninstalled. Config preserved at ~/.cloudcode/"

# ── Check ────────────────────────────────────────────────

check: ## Type-check backend + frontend
	@echo "==> cargo check..."
	@cargo check
	@echo "==> tsc --noEmit..."
	@cd apps/web && pnpm exec tsc --noEmit
	@echo "==> All checks passed."

test: ## Run Rust unit and narrow integration tests
	@echo "==> cargo test..."
	@cargo test
	@echo "==> Tests passed."

verify-local: ## Run the default local validation command set
	@echo "==> Local validation: make check"
	@$(MAKE) check
	@echo "==> Local validation: make test"
	@$(MAKE) test
	@echo "==> Local validation complete."

# ── Clean ────────────────────────────────────────────────

clean: ## Remove build artifacts
	@cargo clean
	@rm -rf apps/web/dist apps/web/node_modules/.vite
	@echo "Cleaned."

# ── Utilities ────────────────────────────────────────────

doctor: ## Run diagnostic checks
	@cargo run --quiet -- doctor

scan: ## Scan for installed CLI tools
	@cargo run --quiet -- scan
