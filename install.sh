#!/usr/bin/env bash
set -euo pipefail

REPO="${CONSOLE_GITHUB_REPO:-OWNER/console}"
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

usage() {
  cat <<'EOF'
Usage:
  install.sh [install] [--version <tag>] [-y|--yes]
  install.sh upgrade   [--version <tag>] [-y|--yes]
  install.sh uninstall [--purge] [-y|--yes]
  install.sh --help

Commands:
  install    Install Console to ~/.console/bin/console (default when no command given)
  upgrade    Upgrade existing installation
  uninstall  Remove binary and web assets (keeps ~/.console state by default)
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
  # Normalize: ensure tag starts with 'v'
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

  info "Extracting..."
  tar -xzf "${tmp}/${file}" -C "$tmp"
  mkdir -p "$BIN_DIR"

  local extracted_bin
  extracted_bin="$(find "$tmp" -type f -name "$BIN_NAME" | head -n1)"
  if [[ -z "${extracted_bin}" ]]; then
    error "Archive does not contain ${BIN_NAME}"
    rm -rf "$tmp"
    exit 1
  fi

  mv "$extracted_bin" "$BIN_PATH"
  chmod +x "$BIN_PATH"

  local extracted_web
  extracted_web="$(find "$tmp" -type d -name web | head -n1 || true)"
  if [[ -n "${extracted_web}" ]]; then
    rm -rf "$WEB_DIR"
    mkdir -p "$INSTALL_ROOT"
    mv "$extracted_web" "$WEB_DIR"
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
  info "Run 'source' on your shell rc file or restart terminal to use 'console'."
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

main() {
  local cmd="${1:-}"
  case "$cmd" in
    -h|--help|help)
      usage
      exit 0
      ;;
    install|upgrade|uninstall)
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
  local version="" purge="false" yes="false"
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
      *)
        error "Unknown option for ${cmd}: $1"
        exit 1
        ;;
    esac
  done

  case "$cmd" in
    install)
      do_install "$version"
      ;;
    upgrade)
      do_upgrade "$version"
      ;;
    uninstall)
      do_uninstall "$purge" "$yes"
      ;;
  esac
}

main "$@"
