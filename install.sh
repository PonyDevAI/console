#!/usr/bin/env bash
set -euo pipefail

REPO="${CONSOLE_GITHUB_REPO:-PonyDevAI/console}"
BIN_NAME="console"
INSTALL_ROOT="${CONSOLE_INSTALL_DIR:-$HOME/.console}"
BIN_DIR="$INSTALL_ROOT/bin"
WEB_DIR="$INSTALL_ROOT/web"
BIN_PATH="$BIN_DIR/$BIN_NAME"

# ── Colors ──────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET="\033[0m"
  C_GREEN="\033[32m"
  C_YELLOW="\033[33m"
  C_RED="\033[31m"
  C_CYAN="\033[36m"
else
  C_RESET="" C_GREEN="" C_YELLOW="" C_RED="" C_CYAN=""
fi

info()  { echo -e "${C_CYAN}[console]${C_RESET} $*"; }
warn()  { echo -e "${C_YELLOW}[console]${C_RESET} $*" >&2; }
error() { echo -e "${C_RED}[console]${C_RESET} $*" >&2; }
ok()    { echo -e "${C_GREEN}[console]${C_RESET} $*"; }

# ── Environment checks ──────────────────────────────────
preflight() {
  # OS check
  local os
  os="$(uname -s)"
  case "$os" in
    Darwin|Linux) ;;
    MINGW*|MSYS*|CYGWIN*)
      error "Windows is not supported. Use WSL2 instead."
      exit 1
      ;;
    *)
      error "Unsupported OS: $os"
      exit 1
      ;;
  esac

  # Architecture check
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64|arm64|aarch64) ;;
    *)
      error "Unsupported architecture: $arch"
      exit 1
      ;;
  esac

  # Required commands
  local missing=()
  for cmd in curl tar; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing required commands: ${missing[*]}"
    error "Please install them and try again."
    exit 1
  fi

  # Disk space check (~100MB minimum)
  local avail_kb
  if avail_kb="$(df -k "$HOME" 2>/dev/null | awk 'NR==2{print $4}')"; then
    if [[ -n "$avail_kb" ]] && [[ "$avail_kb" -lt 102400 ]]; then
      warn "Low disk space: $(( avail_kb / 1024 ))MB available (recommend >= 100MB)"
    fi
  fi

  # Writable home directory
  if [[ ! -w "$HOME" ]]; then
    error "\$HOME ($HOME) is not writable"
    exit 1
  fi

  # Print detected environment
  info "Environment: $os $(uname -m)"
}

usage() {
  cat <<'EOF'
Usage:
  install.sh [install] [--version <tag>] [-y|--yes]
  install.sh upgrade   [--version <tag>] [-y|--yes]
  install.sh uninstall [--purge] [-y|--yes]
  install.sh rollback  [--version <tag>]
  install.sh --help

Options:
  --from-repo  Build from current repo instead of downloading release

Commands:
  install    Install Console to ~/.console/bin/console (default when no command given)
  upgrade    Upgrade existing installation
  uninstall  Remove binary and web assets (keeps ~/.console state by default)
  rollback   Roll back to a previously installed version
EOF
}

subcommand_help() {
  case "${1:-}" in
    install)
      cat <<'EOF'
Usage: install.sh install [--version <tag>]
Install Console from GitHub Releases.
EOF
      ;;
    upgrade)
      cat <<'EOF'
Usage: install.sh upgrade [--version <tag>]
Upgrade existing Console installation.
EOF
      ;;
    uninstall)
      cat <<'EOF'
Usage: install.sh uninstall [--purge]
Uninstall Console. --purge removes ~/.console entirely.
EOF
      ;;
    rollback)
      cat <<'EOF'
Usage: install.sh rollback [--version <tag>]
Roll back to a previously installed version.
EOF
      ;;
    *)
      usage
      ;;
  esac
}

map_os() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    *) error "Unsupported OS: $(uname -s)"; exit 1 ;;
  esac
}

map_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "amd64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) error "Unsupported architecture: $(uname -m)"; exit 1 ;;
  esac
}

latest_tag() {
  local api="https://api.github.com/repos/${REPO}/releases/latest"
  if command -v jq >/dev/null 2>&1; then
    curl -fsSL "$api" | jq -r '.tag_name'
  else
    curl -fsSL "$api" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1
  fi
}

ensure_path() {
  local shell_name
  shell_name="$(basename "${SHELL:-}")"
  local path_line="export PATH=\"${BIN_DIR}:\$PATH\""
  local fish_line="set -gx PATH ${BIN_DIR} \$PATH"

  if echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
    return 0
  fi

  case "$shell_name" in
    zsh)
      local rc="$HOME/.zshrc"
      grep -Fq "$path_line" "$rc" 2>/dev/null || \
        echo "$path_line" >> "$rc"
      ;;
    bash)
      local rc="$HOME/.bashrc"
      grep -Fq "$path_line" "$rc" 2>/dev/null || \
        echo "$path_line" >> "$rc"
      ;;
    fish)
      local rc="$HOME/.config/fish/config.fish"
      mkdir -p "$(dirname "$rc")"
      grep -Fq "$fish_line" "$rc" 2>/dev/null || \
        echo "$fish_line" >> "$rc"
      ;;
    *)
      warn "Unknown shell '$shell_name'. Add this manually:"
      warn "  $path_line"
      ;;
  esac
}

remove_path() {
  local path_line="export PATH=\"${BIN_DIR}:\$PATH\""
  local fish_line="set -gx PATH ${BIN_DIR} \$PATH"

  for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [[ -f "$rc" ]]; then
      # grep -v returns 1 when no lines match (all lines removed); use || true
      grep -vF "$path_line" "$rc" > "${rc}.tmp" || true
      mv "${rc}.tmp" "$rc"
    fi
  done

  local fish_rc="$HOME/.config/fish/config.fish"
  if [[ -f "$fish_rc" ]]; then
    grep -vF "$fish_line" "$fish_rc" > "${fish_rc}.tmp" || true
    mv "${fish_rc}.tmp" "$fish_rc"
  fi
}

download_and_install() {
  local tag="$1"
  if [[ "$tag" != v* ]]; then
    tag="v${tag}"
  fi
  local os arch file url tmp
  os="$(map_os)"
  arch="$(map_arch)"
  file="console-${tag}-${os}-${arch}.tar.gz"
  url="https://github.com/${REPO}/releases/download/${tag}/${file}"
  tmp="$(mktemp -d)"

  info "Downloading ${file}..."
  if ! curl -fL --progress-bar "$url" -o "${tmp}/${file}"; then
    error "Download failed: $url"
    rm -rf "$tmp"
    exit 1
  fi

  local sums_url="https://github.com/${REPO}/releases/download/${tag}/SHA256SUMS"
  if curl -fsSL "$sums_url" -o "${tmp}/SHA256SUMS" 2>/dev/null; then
    info "Verifying checksum..."
    (cd "$tmp" && grep -F "$file" SHA256SUMS | sha256sum -c --quiet 2>/dev/null) || \
    (cd "$tmp" && grep -F "$file" SHA256SUMS | shasum -a 256 -c --quiet 2>/dev/null) || {
      error "SHA256 checksum verification failed!"
      rm -rf "$tmp"
      exit 1
    }
    ok "Checksum verified."
  else
    warn "SHA256SUMS not found, skipping verification."
  fi

  info "Extracting..."
  tar -xzf "${tmp}/${file}" -C "$tmp"

  local extracted_bin
  extracted_bin="$(find "$tmp" -type f -name "$BIN_NAME" | head -n1)"
  if [[ -z "${extracted_bin}" ]]; then
    error "Archive does not contain ${BIN_NAME}"
    rm -rf "$tmp"
    exit 1
  fi

  local extracted_web
  extracted_web="$(find "$tmp" -type d -name web | head -n1 || true)"

  local ver_dir="$INSTALL_ROOT/versions/${tag}"
  mkdir -p "$ver_dir/bin"
  mv "$extracted_bin" "$ver_dir/bin/$BIN_NAME"
  chmod +x "$ver_dir/bin/$BIN_NAME"

  if [[ -n "${extracted_web}" ]]; then
    mv "$extracted_web" "$ver_dir/web"
  fi

  rm -f "$INSTALL_ROOT/current"
  ln -sf "$ver_dir" "$INSTALL_ROOT/current"

  mkdir -p "$BIN_DIR"
  rm -f "$BIN_PATH"
  ln -sf "../current/bin/$BIN_NAME" "$BIN_PATH"

  if [[ -d "$ver_dir/web" ]]; then
    rm -f "$WEB_DIR"
    ln -sf "current/web" "$WEB_DIR"
  fi

  rm -rf "$tmp"
}

do_install() {
  local tag="${1:-}"
  if [[ -z "$tag" ]]; then
    info "Fetching latest version..."
    tag="$(latest_tag)"
  fi
  if [[ -z "$tag" ]]; then
    error "Failed to resolve latest version from GitHub API"
    exit 1
  fi
  download_and_install "$tag"
  ensure_path
  "$BIN_PATH" init
  ok "Installed Console ${tag} to ${BIN_PATH}"
  local shell_name
  shell_name="$(basename "${SHELL:-}")"
  case "$shell_name" in
    zsh)  info "Run 'source ~/.zshrc' or restart terminal to use 'console'." ;;
    bash) info "Run 'source ~/.bashrc' or restart terminal to use 'console'." ;;
    fish) info "Restart terminal or run 'source ~/.config/fish/config.fish' to use 'console'." ;;
    *)    info "Restart terminal to use 'console'." ;;
  esac
}

do_upgrade() {
  local tag="${1:-}"
  if [[ ! -x "$BIN_PATH" ]]; then
    error "Console is not installed at ${BIN_PATH}. Run: install.sh install"
    exit 1
  fi

  local current
  current="$("$BIN_PATH" --version | awk '{print $2}' | sed 's/^v//')"
  if [[ -z "$tag" ]]; then
    info "Checking for updates..."
    tag="$(latest_tag)"
  fi
  local latest
  latest="$(echo "$tag" | sed 's/^v//')"

  if [[ "$current" == "$latest" ]]; then
    ok "Already up to date (${current})"
    exit 0
  fi

  info "Upgrading: ${current} -> ${latest}"
  download_and_install "$tag"
  ok "Upgraded Console: ${current} -> ${latest}"
}

do_uninstall() {
  local purge="${1:-false}"
  local skip_confirm="${2:-false}"

  if [[ "$skip_confirm" != "true" ]]; then
    if [[ "$purge" == "true" ]]; then
      warn "This will remove Console and ALL data at ${INSTALL_ROOT}"
    else
      info "This will remove Console binary and web assets. Config will be preserved."
    fi
    printf "Continue? [y/N]: "
    read -r answer
    case "$answer" in
      y|Y|yes|YES) ;;
      *) info "Cancelled."; exit 0 ;;
    esac
  fi

  rm -f "$BIN_PATH"
  rm -rf "$WEB_DIR"
  rm -f "$INSTALL_ROOT/current"
  rm -rf "$INSTALL_ROOT/versions"
  if [[ -d "$BIN_DIR" ]] && [[ -z "$(ls -A "$BIN_DIR" 2>/dev/null)" ]]; then
    rmdir "$BIN_DIR" || true
  fi

  remove_path

  if [[ "$purge" == "true" ]]; then
    rm -rf "$INSTALL_ROOT"
    ok "Uninstalled Console and purged ${INSTALL_ROOT}"
  else
    ok "Uninstalled Console binary and web assets."
    info "Preserved data at ${INSTALL_ROOT}"
  fi
}

do_rollback() {
  local target_ver="${1:-}"
  local versions_dir="$INSTALL_ROOT/versions"

  if [[ ! -d "$versions_dir" ]]; then
    error "No versions found at $versions_dir"
    exit 1
  fi

  if [[ -z "$target_ver" ]]; then
    info "Available versions:"
    ls -1 "$versions_dir" | sort -V
    printf "Roll back to which version? "
    read -r target_ver
  fi

  if [[ ! -d "$versions_dir/$target_ver" ]]; then
    error "Version $target_ver not found in $versions_dir"
    exit 1
  fi

  rm -f "$INSTALL_ROOT/current"
  ln -sf "$versions_dir/$target_ver" "$INSTALL_ROOT/current"
  ok "Rolled back to $target_ver"
}

do_install_from_repo() {
  if [[ ! -f "Cargo.toml" ]] || ! grep -q 'name = "console"' Cargo.toml 2>/dev/null; then
    error "Not in Console repo root. Run from the project directory."
    exit 1
  fi

  info "Building from source..."
  command -v cargo >/dev/null 2>&1 || { error "cargo not found. Install Rust: https://rustup.rs"; exit 1; }
  cargo build --release

  info "Building web assets..."
  if [[ -d "web" ]]; then
    command -v pnpm >/dev/null 2>&1 || { error "pnpm not found"; exit 1; }
    (cd web && pnpm install && pnpm build)
  fi

  local ver_dir="$INSTALL_ROOT/versions/source"
  local bin_dir="$ver_dir/bin"
  mkdir -p "$bin_dir"

  cp target/release/console "$bin_dir/console"
  chmod +x "$bin_dir/console"

  if [[ -d "web/dist" ]]; then
    mkdir -p "$ver_dir/web"
    cp -r web/dist "$ver_dir/web/dist"
  fi

  rm -f "$INSTALL_ROOT/current"
  ln -sf "$ver_dir" "$INSTALL_ROOT/current"

  mkdir -p "$BIN_DIR"
  rm -f "$BIN_PATH"
  ln -sf "../current/bin/console" "$BIN_PATH"

  if [[ -d "$ver_dir/web" ]]; then
    rm -f "$WEB_DIR"
    ln -sf "current/web" "$WEB_DIR"
  fi

  ensure_path
  "$BIN_PATH" init
  ok "Installed Console from source to ${BIN_PATH}"
  local shell_name
  shell_name="$(basename "${SHELL:-}")"
  case "$shell_name" in
    zsh)  info "Run 'source ~/.zshrc' or restart terminal to use 'console'." ;;
    bash) info "Run 'source ~/.bashrc' or restart terminal to use 'console'." ;;
    fish) info "Restart terminal or run 'source ~/.config/fish/config.fish' to use 'console'." ;;
    *)    info "Restart terminal to use 'console'." ;;
  esac
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    -h|--help|help)
      usage
      exit 0
      ;;
    install|upgrade|uninstall|rollback)
      if [[ "${2:-}" == "--help" || "${2:-}" == "-h" ]]; then
        subcommand_help "$cmd"
        exit 0
      fi
      shift
      ;;
    "")
      # Default: install (for curl | bash usage)
      cmd="install"
      ;;
    *)
      error "Unknown command: $cmd"
      usage
      exit 1
      ;;
  esac

  # Parse common + subcommand-specific flags
  local version="" purge="false" yes="false" from_repo="false"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --version)
        version="${2:-}"
        shift 2
        ;;
      --purge)
        purge="true"
        shift
        ;;
      -y|--yes)
        yes="true"
        shift
        ;;
      --from-repo)
        from_repo="true"
        shift
        ;;
      *)
        error "Unknown option for ${cmd}: $1"
        exit 1
        ;;
    esac
  done

  case "$cmd" in
    install)
      preflight
      if [[ "$from_repo" == "true" ]]; then
        do_install_from_repo
      else
        do_install "$version"
      fi
      ;;
    upgrade)
      preflight
      do_upgrade "$version"
      ;;
    uninstall)
      do_uninstall "$purge" "$yes"
      ;;
    rollback)
      do_rollback "$version"
      ;;
  esac
}

main "$@"
