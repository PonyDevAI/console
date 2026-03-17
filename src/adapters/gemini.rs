use anyhow::Result;
use std::path::PathBuf;

use super::{run_command_stdout, which, CliAdapter, extract_version};
use crate::models::InstalledInfo;

pub struct GeminiAdapter;

impl CliAdapter for GeminiAdapter {
    fn name(&self) -> &str {
        "gemini"
    }
    fn display_name(&self) -> &str {
        "Gemini"
    }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("gemini") {
            Some(p) => p,
            None => return Ok(None),
        };
        let raw =
            run_command_stdout(path.to_str().unwrap_or("gemini"), &["--version"]).unwrap_or_else(|_| "unknown".into());
        let version = extract_version(&raw);
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        #[cfg(windows)]
        let output = run_command_stdout(
            "cmd",
            &["/C", "npm", "view", "@google/gemini-cli", "version"],
        );
        #[cfg(not(windows))]
        let output = run_command_stdout("npm", &["view", "@google/gemini-cli", "version"]);
        Ok(output.ok())
    }

    fn install(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["install", "-g", "@google/gemini-cli"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm install failed for Gemini CLI");
        }
        Ok(())
    }

    fn upgrade(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["update", "-g", "@google/gemini-cli"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm update failed for Gemini CLI");
        }
        Ok(())
    }

    fn uninstall(&self) -> Result<()> {
        let status = super::npm_command()
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

    fn mcp_config_path(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("settings").join("mcp.json"))
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
        tracing::info!("Wrote Gemini MCP config: {}", path.display());
        Ok(())
    }

    fn supports_provider_sync(&self) -> bool {
        false
    }
}
