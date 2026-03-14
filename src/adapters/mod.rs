pub mod claude;
pub mod codex;
pub mod gemini;
pub mod cursor;
pub mod opencode;
pub mod openclaw;

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

    /// Whether this CLI uses switch mode (one provider) or additive mode (all providers).
    fn switch_mode(&self) -> crate::models::SwitchMode {
        crate::models::SwitchMode::Switch
    }

    /// Read current MCP config from this CLI's native file.
    #[allow(dead_code)]
    fn read_mcp_config(&self) -> Result<serde_json::Value> {
        let path = self.mcp_config_path()?;
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Ok(serde_json::json!({ "mcpServers": {} }))
        }
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
        self.adapters.iter().find(|a| a.name() == name).map(|a| a.as_ref())
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
            Box::new(openclaw::OpenClawAdapter),
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

/// Find a binary in PATH using `which`.
pub(crate) fn which(name: &str) -> Option<PathBuf> {
    std::process::Command::new("which")
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| PathBuf::from(String::from_utf8_lossy(&o.stdout).trim().to_string()))
}
