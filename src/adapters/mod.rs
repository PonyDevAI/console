pub mod claude;
pub mod codex;
pub mod cursor;
pub mod gemini;
pub mod openclaw;
pub mod opencode;

use anyhow::Result;
use std::path::PathBuf;

use crate::models::InstalledInfo;

/// Shared trait for all CLI adapters.
pub trait CliAdapter: Send + Sync {
    /// Internal name (e.g. "claude", "codex").
    fn name(&self) -> &str;
    /// Human-readable name (e.g. "Claude CLI").
    fn display_name(&self) -> &str;

    // ── Version management ──

    /// Detect if the CLI is installed locally. Returns version + path.
    fn detect_installation(&self) -> Result<Option<InstalledInfo>>;
    /// Query the latest remote version (GitHub/npm).
    fn check_remote_version(&self) -> Result<Option<String>>;
    /// Install the CLI tool.
    fn install(&self) -> Result<()>;
    /// Upgrade the CLI tool.
    fn upgrade(&self) -> Result<()>;
    /// Uninstall the CLI tool.
    fn uninstall(&self) -> Result<()>;
    /// Whether this tool supports automatic install/upgrade/uninstall.
    /// Tools like Cursor that require manual installation return false.
    fn supports_auto_install(&self) -> bool {
        true
    }
    /// URL to visit for manual installation (when supports_auto_install is false).
    fn install_url(&self) -> Option<&str> {
        None
    }

    // ── Config paths ──

    /// Root config directory for this CLI (e.g. ~/.claude).
    fn config_dir(&self) -> Result<PathBuf>;
    /// Primary config file path.
    #[allow(dead_code)]
    fn config_file(&self) -> Result<PathBuf>;

    // ── Config sync ──

    /// Path to the MCP config file for this CLI.
    fn mcp_config_path(&self) -> Result<PathBuf>;

    /// Write MCP servers config in this CLI's native format.
    fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()>;

    /// Whether this CLI supports custom provider config.
    fn supports_provider_sync(&self) -> bool {
        false
    }

    /// Write provider config in this CLI's native format.
    fn write_provider_config(&self, _provider: &crate::models::Provider) -> Result<()> {
        Ok(())
    }

    /// Whether this CLI supports direct model configuration.
    fn supports_model_config(&self) -> bool {
        false
    }

    /// Write model config in this CLI's native format.
    fn write_model_config(
        &self,
        _provider: &crate::models::Provider,
        _model: &str,
    ) -> Result<()> {
        Ok(())
    }

    /// Read the currently effective model from this CLI's native config.
    fn read_model_config(&self) -> Result<Option<String>> {
        Ok(None)
    }

    /// Clear Console-managed model config so the CLI falls back to its default behavior.
    fn clear_model_config(&self) -> Result<()> {
        Ok(())
    }

    /// Whether this CLI uses switch mode (one provider) or additive mode (all providers).
    fn switch_mode(&self) -> crate::models::SwitchMode {
        crate::models::SwitchMode::Switch
    }

    /// Read current MCP config from this CLI's native file.
    #[allow(dead_code)]
    fn read_mcp_config(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({}))
    }
}

/// Registry holding all known adapters.
pub struct AdapterRegistry {
    adapters: Vec<Box<dyn CliAdapter>>,
}

impl AdapterRegistry {
    pub fn adapters(&self) -> &[Box<dyn CliAdapter>] {
        &self.adapters
    }

    pub fn find(&self, name: &str) -> Option<&dyn CliAdapter> {
        self.adapters
            .iter()
            .find(|a| a.name() == name)
            .map(|a| a.as_ref())
    }
}

/// Build the default registry with all known adapters.
pub fn registry() -> AdapterRegistry {
    AdapterRegistry {
        adapters: vec![
            Box::new(claude::ClaudeAdapter),
            Box::new(codex::CodexAdapter),
            Box::new(gemini::GeminiAdapter),
            Box::new(cursor::CursorAdapter),
            Box::new(opencode::OpenCodeAdapter),
        ],
    }
}

// ── Helpers ──

/// Run a command and capture stdout, trimming whitespace.
pub(crate) fn run_command_stdout(cmd: &str, args: &[&str]) -> Result<String> {
    let output = std::process::Command::new(cmd).args(args).output()?;
    if !output.status.success() {
        anyhow::bail!("{} exited with {}", cmd, output.status);
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Find a binary in PATH (cross-platform).
pub(crate) fn which(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(name);
        if candidate.exists() {
            return Some(candidate);
        }
        #[cfg(windows)]
        {
            for ext in &[".exe", ".cmd", ".bat"] {
                let with_ext = dir.join(format!("{name}{ext}"));
                if with_ext.exists() {
                    return Some(with_ext);
                }
            }
        }
    }
    None
}

/// Extract a semver-like version number from a `--version` output string.
///
/// Many CLIs include extra text (e.g. "codex-cli 0.115.0", "2.1.74 (Claude Code)").
/// This function finds the first token that looks like a version number (digits + dots).
pub(crate) fn extract_version(raw: &str) -> String {
    raw.split_whitespace()
        .find(|token| {
            let t = token.strip_prefix('v').unwrap_or(token);
            !t.is_empty() && t.chars().next().map_or(false, |c| c.is_ascii_digit()) && t.contains('.')
        })
        .map(|v| v.strip_prefix('v').unwrap_or(v).to_string())
        .unwrap_or_else(|| raw.trim().to_string())
}

/// Cross-platform npm command runner.
pub(crate) fn npm_command() -> std::process::Command {
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "npm"]);
        cmd
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("npm")
    }
}
