use anyhow::Result;
use std::path::PathBuf;

use super::{which, run_command_stdout, CliAdapter};
use crate::models::InstalledInfo;

pub struct GeminiAdapter;

impl CliAdapter for GeminiAdapter {
    fn name(&self) -> &str { "gemini" }
    fn display_name(&self) -> &str { "Gemini CLI" }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("gemini") {
            Some(p) => p,
            None => return Ok(None),
        };
        let version = run_command_stdout("gemini", &["--version"])
            .unwrap_or_else(|_| "unknown".into());
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        let output = run_command_stdout("npm", &["view", "@google/gemini-cli", "version"]);
        Ok(output.ok())
    }

    fn install(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["install", "-g", "@google/gemini-cli"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm install failed for Gemini CLI");
        }
        Ok(())
    }

    fn upgrade(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["update", "-g", "@google/gemini-cli"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm update failed for Gemini CLI");
        }
        Ok(())
    }

    fn uninstall(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["uninstall", "-g", "@google/gemini-cli"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm uninstall failed for Gemini CLI");
        }
        Ok(())
    }

    fn config_dir(&self) -> Result<PathBuf> {
        dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))
            .map(|home| home.join(".gemini"))
    }

    fn config_file(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("settings.json"))
    }
}
