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

    fn mcp_config_path(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("mcp.json"))
    }

    fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()> {
        let mut mcp_servers = serde_json::Map::new();
        for server in servers {
            let mut entry = serde_json::Map::new();
            if let Some(cmd) = &server.command {
                entry.insert("command".to_string(), serde_json::json!(cmd));
            }
            if !server.args.is_empty() {
                entry.insert("args".to_string(), serde_json::json!(server.args));
            }
            if let Some(url) = &server.url {
                entry.insert("url".to_string(), serde_json::json!(url));
            }
            if !server.env.is_empty() {
                entry.insert("env".to_string(), serde_json::json!(server.env));
            }
            mcp_servers.insert(server.name.clone(), serde_json::Value::Object(entry));
        }

        let config = serde_json::json!({ "mcpServers": mcp_servers });
        let path = self.mcp_config_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, serde_json::to_string_pretty(&config)?)?;
        tracing::info!("Wrote Codex MCP config: {}", path.display());
        Ok(())
    }

    fn supports_provider_sync(&self) -> bool {
        true
    }

    fn write_provider_config(&self, provider: &crate::models::Provider) -> Result<()> {
        let config = serde_json::json!({
            "provider": provider.name.to_lowercase(),
            "apiKey": provider.api_key_ref,
        });
        let path = self.config_dir()?.join("config.json");
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut existing: serde_json::Value = if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        if !existing.is_object() {
            existing = serde_json::json!({});
        }
        if let Some(obj) = existing.as_object_mut() {
            obj.insert("provider".to_string(), config["provider"].clone());
            obj.insert("apiKey".to_string(), config["apiKey"].clone());
        }

        std::fs::write(&path, serde_json::to_string_pretty(&existing)?)?;
        tracing::info!("Wrote Codex provider config: {}", path.display());
        Ok(())
    }
}
