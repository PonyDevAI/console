use anyhow::Result;
use std::path::PathBuf;

use super::{run_command_stdout, which, CliAdapter};
use crate::models::InstalledInfo;

pub struct CursorAdapter;

impl CliAdapter for CursorAdapter {
    fn name(&self) -> &str {
        "cursor"
    }
    fn display_name(&self) -> &str {
        "Cursor"
    }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("agent") {
            Some(p) => p,
            None => return Ok(None),
        };
        let version =
            run_command_stdout("agent", &["--version"]).unwrap_or_else(|_| "unknown".into());
        // Verify it's actually Cursor's agent, not some other "agent" binary
        let version_lower = version.to_lowercase();
        if !version_lower.contains("cursor") && !version_lower.contains("agent") {
            return Ok(None);
        }
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        Ok(None)
    }

    fn install(&self) -> Result<()> {
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg("curl -fsSL https://www.cursor.com/install.sh | sh")
            .output();

        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                anyhow::bail!("Cursor CLI 安装失败：{}", stderr)
            }
            Err(_e) => {
                anyhow::bail!("Cursor CLI 安装失败，请手动执行：curl -fsSL https://www.cursor.com/install.sh | sh")
            }
        }
    }

    fn upgrade(&self) -> Result<()> {
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg("curl -fsSL https://www.cursor.com/install.sh | sh")
            .output();

        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                anyhow::bail!("Cursor CLI 升级失败：{}", stderr)
            }
            Err(_e) => {
                anyhow::bail!("Cursor CLI 升级失败，请手动执行：curl -fsSL https://www.cursor.com/install.sh | sh")
            }
        }
    }

    fn uninstall(&self) -> Result<()> {
        let home =
            dirs::home_dir().ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))?;
        let agent_path = home.join(".local/bin/agent");

        if !agent_path.exists() {
            anyhow::bail!("Cursor CLI 未安装");
        }

        std::fs::remove_file(&agent_path)?;
        tracing::info!("Removed Cursor CLI: {}", agent_path.display());
        Ok(())
    }

    fn supports_auto_install(&self) -> bool {
        true
    }
    fn install_url(&self) -> Option<&str> {
        None
    }

    fn config_dir(&self) -> Result<PathBuf> {
        dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))
            .map(|home| home.join(".cursor"))
    }

    fn config_file(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("settings.json"))
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
        tracing::info!("Wrote Cursor MCP config: {}", path.display());
        Ok(())
    }

    fn read_mcp_config(&self) -> Result<serde_json::Value> {
        let path = self.mcp_config_path()?;
        if !path.exists() {
            return Ok(serde_json::json!({ "mcpServers": {} }));
        }
        let content = std::fs::read_to_string(&path)?;
        let parsed: serde_json::Value = serde_json::from_str(&content)?;
        if parsed.get("mcpServers").is_some() {
            Ok(parsed)
        } else {
            Ok(serde_json::json!({ "mcpServers": parsed }))
        }
    }

    fn supports_provider_sync(&self) -> bool {
        false
    }
}
