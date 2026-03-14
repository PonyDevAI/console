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

    fn mcp_config_path(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("mcp_servers.json"))
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
        tracing::info!("Wrote Claude MCP config: {}", path.display());
        Ok(())
    }

    fn supports_provider_sync(&self) -> bool {
        false
    }
}
