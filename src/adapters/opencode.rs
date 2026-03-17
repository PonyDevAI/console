use anyhow::Result;
use std::path::PathBuf;

use super::{run_command_stdout, which, CliAdapter, extract_version};
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
        let raw =
            run_command_stdout(path.to_str().unwrap_or("opencode"), &["--version"]).unwrap_or_else(|_| "unknown".into());
        let version = extract_version(&raw);
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        // npm 包名是 opencode-ai（不是 opencode）
        #[cfg(windows)]
        let output = run_command_stdout("cmd", &["/C", "npm", "view", "opencode-ai", "version"]);
        #[cfg(not(windows))]
        let output = run_command_stdout("npm", &["view", "opencode-ai", "version"]);
        Ok(output.ok())
    }

    fn install(&self) -> Result<()> {
        // 官方推荐 curl 安装
        #[cfg(windows)]
        {
            let status = super::npm_command()
                .args(["install", "-g", "opencode-ai@latest"])
                .status()?;
            if !status.success() {
                anyhow::bail!("npm install failed for OpenCode");
            }
            return Ok(());
        }
        #[cfg(not(windows))]
        {
            let output = std::process::Command::new("sh")
                .arg("-c")
                .arg("curl -fsSL https://opencode.ai/install | bash")
                .output();
            match output {
                Ok(out) if out.status.success() => Ok(()),
                Ok(out) => {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    anyhow::bail!("OpenCode 安装失败：{}", stderr)
                }
                Err(_) => {
                    anyhow::bail!("OpenCode 安装失败，请手动执行：curl -fsSL https://opencode.ai/install | bash")
                }
            }
        }
    }

    fn upgrade(&self) -> Result<()> {
        // 重新执行安装脚本即可升级
        self.install()
    }

    fn uninstall(&self) -> Result<()> {
        let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))?;
        let bin_path = home.join(".opencode/bin/opencode");
        if bin_path.exists() {
            std::fs::remove_file(&bin_path)?;
            tracing::info!("Removed OpenCode: {}", bin_path.display());
            Ok(())
        } else {
            // fallback: try npm uninstall
            let status = super::npm_command()
                .args(["uninstall", "-g", "opencode-ai"])
                .status()?;
            if !status.success() {
                anyhow::bail!("OpenCode 卸载失败");
            }
            Ok(())
        }
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
