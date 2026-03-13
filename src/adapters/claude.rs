use anyhow::Result;
use std::path::PathBuf;

use super::{which, run_command_stdout, CliAdapter};
use crate::models::InstalledInfo;

pub struct ClaudeAdapter;

impl CliAdapter for ClaudeAdapter {
    fn name(&self) -> &str { "claude" }
    fn display_name(&self) -> &str { "Claude CLI" }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("claude") {
            Some(p) => p,
            None => return Ok(None),
        };
        let version = run_command_stdout("claude", &["--version"])
            .unwrap_or_else(|_| "unknown".into());
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        // npm: @anthropic-ai/claude-code
        let output = run_command_stdout("npm", &["view", "@anthropic-ai/claude-code", "version"]);
        Ok(output.ok())
    }

    fn install(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["install", "-g", "@anthropic-ai/claude-code"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm install failed for Claude CLI");
        }
        Ok(())
    }

    fn upgrade(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["update", "-g", "@anthropic-ai/claude-code"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm update failed for Claude CLI");
        }
        Ok(())
    }

    fn uninstall(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["uninstall", "-g", "@anthropic-ai/claude-code"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm uninstall failed for Claude CLI");
        }
        Ok(())
    }

    fn config_dir(&self) -> Result<PathBuf> {
        dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))
            .map(|home| home.join(".claude"))
    }

    fn config_file(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("settings.json"))
    }
}
