use anyhow::Result;
use std::path::PathBuf;

use super::{run_command_stdout, which, CliAdapter};
use crate::models::{InstalledInfo, SwitchMode};

pub struct OpenCodeAdapter;

impl CliAdapter for OpenCodeAdapter {
    fn name(&self) -> &str {
        "opencode"
    }
    fn display_name(&self) -> &str {
        "OpenCode"
    }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("opencode") {
            Some(p) => p,
            None => return Ok(None),
        };
        let version =
            run_command_stdout(path.to_str().unwrap_or("opencode"), &["--version"]).unwrap_or_else(|_| "unknown".into());
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        // OpenCode 通过 GitHub Releases 发布，不在 npm 上
        let output = std::process::Command::new("curl")
            .args(["-sfL", "https://api.github.com/repos/opencode-ai/opencode/releases/latest"])
            .output();
        match output {
            Ok(out) if out.status.success() => {
                let body = String::from_utf8_lossy(&out.stdout);
                // 简单提取 "tag_name":"vX.Y.Z"
                if let Some(start) = body.find("\"tag_name\"") {
                    let rest = &body[start..];
                    if let Some(colon) = rest.find(':') {
                        let after = rest[colon + 1..].trim().trim_start_matches('"');
                        if let Some(end) = after.find('"') {
                            let tag = after[..end].trim_start_matches('v');
                            return Ok(Some(tag.to_string()));
                        }
                    }
                }
                Ok(None)
            }
            _ => Ok(None),
        }
    }

    fn install(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["install", "-g", "opencode"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm install failed for OpenCode");
        }
        Ok(())
    }

    fn upgrade(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["update", "-g", "opencode"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm update failed for OpenCode");
        }
        Ok(())
    }

    fn uninstall(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["uninstall", "-g", "opencode"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm uninstall failed for OpenCode");
        }
        Ok(())
    }

    fn config_dir(&self) -> Result<PathBuf> {
        dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("cannot determine config directory"))
            .map(|d| d.join("opencode"))
    }

    fn config_file(&self) -> Result<PathBuf> {
        Ok(self.config_dir()?.join("opencode.json"))
    }

    fn mcp_config_path(&self) -> Result<PathBuf> {
        self.config_file()
    }

    fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()> {
        let config_path = self.config_file()?;
        let mut config: serde_json::Value = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        let mut mcp = serde_json::Map::new();
        for server in servers {
            let mut entry = serde_json::Map::new();
            match server.transport {
                crate::models::McpTransport::Stdio => {
                    entry.insert("type".to_string(), serde_json::json!("local"));
                    if let Some(cmd) = &server.command {
                        let mut command_arr = vec![serde_json::json!(cmd)];
                        for arg in &server.args {
                            command_arr.push(serde_json::json!(arg));
                        }
                        entry.insert("command".to_string(), serde_json::Value::Array(command_arr));
                    }
                }
                crate::models::McpTransport::Http | crate::models::McpTransport::Sse => {
                    entry.insert("type".to_string(), serde_json::json!("remote"));
                    if let Some(url) = &server.url {
                        entry.insert("url".to_string(), serde_json::json!(url));
                    }
                }
            }
            if !server.env.is_empty() {
                entry.insert("environment".to_string(), serde_json::json!(server.env));
            }
            mcp.insert(server.name.clone(), serde_json::Value::Object(entry));
        }

        if let Some(obj) = config.as_object_mut() {
            obj.insert("mcp".to_string(), serde_json::Value::Object(mcp));
        }

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&config_path, serde_json::to_string_pretty(&config)?)?;
        tracing::info!("Wrote OpenCode MCP config: {}", config_path.display());
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
        });

        if let Some(obj) = config.as_object_mut() {
            let providers = obj.entry("provider").or_insert(serde_json::json!({}));
            if let Some(p) = providers.as_object_mut() {
                p.insert(provider.id.clone(), provider_entry);
            }
        }

        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&config_path, serde_json::to_string_pretty(&config)?)?;
        tracing::info!("Wrote OpenCode provider config: {}", config_path.display());
        Ok(())
    }
}
