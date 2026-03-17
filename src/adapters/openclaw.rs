use anyhow::Result;
use std::path::PathBuf;

use super::{run_command_stdout, which, CliAdapter};
use crate::models::{InstalledInfo, SwitchMode};

pub struct OpenClawAdapter;

impl CliAdapter for OpenClawAdapter {
    fn name(&self) -> &str {
        "openclaw"
    }
    fn display_name(&self) -> &str {
        "OpenClaw"
    }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("openclaw") {
            Some(p) => p,
            None => return Ok(None),
        };
        let version =
            run_command_stdout("openclaw", &["--version"]).unwrap_or_else(|_| "unknown".into());
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        let output = run_command_stdout("npm", &["view", "openclaw", "version"]);
        Ok(output.ok())
    }

    fn install(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["install", "-g", "openclaw"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm install failed for OpenClaw");
        }
        Ok(())
    }

    fn upgrade(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["update", "-g", "openclaw"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm update failed for OpenClaw");
        }
        Ok(())
    }

    fn uninstall(&self) -> Result<()> {
        let status = std::process::Command::new("npm")
            .args(["uninstall", "-g", "openclaw"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm uninstall failed for OpenClaw");
        }
        Ok(())
    }

    fn config_dir(&self) -> Result<PathBuf> {
        let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("no home dir"))?;
        Ok(home.join(".openclaw"))
    }

    fn config_file(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("openclaw.json"))
    }

    fn mcp_config_path(&self) -> Result<PathBuf> {
        self.config_file()
    }

    fn write_mcp_config(&self, _servers: &[crate::models::McpServer]) -> Result<()> {
        tracing::info!("OpenClaw MCP sync not yet supported (upstream in development)");
        Ok(())
    }

    fn supports_provider_sync(&self) -> bool {
        true
    }

    fn switch_mode(&self) -> SwitchMode {
        SwitchMode::Additive
    }

    fn write_provider_config(&self, provider: &crate::models::Provider) -> Result<()> {
        let config_path = self.config_file()?;
        let mut config: serde_json::Value = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        let provider_entry = serde_json::json!({
            "baseUrl": provider.api_endpoint,
            "apiKey": provider.api_key_ref,
            "api": "openai",
        });

        if let Some(obj) = config.as_object_mut() {
            let models = obj.entry("models").or_insert(serde_json::json!({}));
            if let Some(m) = models.as_object_mut() {
                let providers = m.entry("providers").or_insert(serde_json::json!({}));
                if let Some(p) = providers.as_object_mut() {
                    p.insert(provider.id.clone(), provider_entry);
                }
            }
        }

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&config_path, serde_json::to_string_pretty(&config)?)?;
        tracing::info!("Wrote OpenClaw provider config: {}", config_path.display());
        Ok(())
    }
}
