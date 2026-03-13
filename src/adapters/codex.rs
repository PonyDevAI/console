use anyhow::Result;
use std::path::PathBuf;

use super::{which, run_command_stdout, CliAdapter};
use crate::models::InstalledInfo;

pub struct CodexAdapter;

impl CliAdapter for CodexAdapter {
    fn name(&self) -> &str { "codex" }
    fn display_name(&self) -> &str { "Codex CLI" }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("codex") {
            Some(p) => p,
            None => return Ok(None),
        };
        let version = run_command_stdout("codex", &["--version"])
            .unwrap_or_else(|_| "unknown".into());
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        let output = run_command_stdout("npm", &["view", "@openai/codex", "version"]);
        Ok(output.ok())
    }

    fn install(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["install", "-g", "@openai/codex"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm install failed for Codex CLI");
        }
        Ok(())
    }

    fn upgrade(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["update", "-g", "@openai/codex"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm update failed for Codex CLI");
        }
        Ok(())
    }

    fn uninstall(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["uninstall", "-g", "@openai/codex"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm uninstall failed for Codex CLI");
        }
        Ok(())
    }

    fn config_dir(&self) -> Result<PathBuf> {
        dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))
            .map(|home| home.join(".codex"))
    }

    fn config_file(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("config.toml"))
    }
}
