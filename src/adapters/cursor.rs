use anyhow::Result;
use std::path::PathBuf;

use super::{which, run_command_stdout, CliAdapter};
use crate::models::InstalledInfo;

pub struct CursorAdapter;

impl CliAdapter for CursorAdapter {
    fn name(&self) -> &str { "cursor" }
    fn display_name(&self) -> &str { "Cursor CLI" }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("cursor") {
            Some(p) => p,
            None => return Ok(None),
        };
        let version = run_command_stdout("cursor", &["--version"])
            .unwrap_or_else(|_| "unknown".into());
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        // Cursor doesn't have a simple npm/pip version check;
        // would need to query GitHub releases or Cursor API.
        Ok(None)
    }

    fn install(&self) -> Result<()> {
        anyhow::bail!("Cursor CLI must be installed via the Cursor application. Visit https://cursor.com")
    }

    fn upgrade(&self) -> Result<()> {
        anyhow::bail!("Cursor CLI is upgraded via the Cursor application auto-updater")
    }

    fn uninstall(&self) -> Result<()> {
        anyhow::bail!("Cursor CLI is managed by the Cursor application")
    }

    fn config_dir(&self) -> Result<PathBuf> {
        dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))
            .map(|home| home.join(".cursor"))
    }

    fn config_file(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("settings.json"))
    }
}
