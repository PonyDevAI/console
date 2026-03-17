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
        let path = which("agent").or_else(|| {
            #[allow(unused_mut)]
            let mut known_paths: Vec<Option<PathBuf>> = vec![
                dirs::home_dir().map(|h| h.join(".local/bin/agent")),
                Some(PathBuf::from("/usr/local/bin/agent")),
            ];
            #[cfg(windows)]
            {
                if let Some(local_app) = dirs::data_local_dir() {
                    known_paths.push(Some(
                        local_app
                            .join("Programs")
                            .join("cursor-agent")
                            .join("agent.exe"),
                    ));
                }
                if let Some(home) = dirs::home_dir() {
                    known_paths.push(Some(
                        home.join("AppData")
                            .join("Local")
                            .join("Programs")
                            .join("cursor-agent")
                            .join("agent.exe"),
                    ));
                }
            }
            known_paths.into_iter().flatten().find(|p| p.exists())
        });

        let path = match path {
            Some(p) => p,
            None => return Ok(None),
        };

        let path_str = path.to_str().unwrap_or("agent");
        let version =
            run_command_stdout(path_str, &["--version"]).unwrap_or_else(|_| "unknown".into());

        // Cursor agent --version 输出格式为日期+hash（如 2026.03.11-6dfa30c）
        // 只要二进制名为 agent 且能正常返回版本号，就认为是 Cursor CLI
        // 排除明显不是 Cursor 的情况（如输出包含其他已知工具名）
        let version_lower = version.to_lowercase();
        let dominated_by_other = version_lower.contains("claude")
            || version_lower.contains("codex")
            || version_lower.contains("gemini");
        if dominated_by_other {
            return Ok(None);
        }
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        Ok(None)
    }

    fn install(&self) -> Result<()> {
        #[cfg(windows)]
        {
            let output = std::process::Command::new("powershell")
                .args(["-Command", "irm https://cursor.com/install | iex"])
                .output();
            return match output {
                Ok(out) if out.status.success() => Ok(()),
                Ok(out) => {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    anyhow::bail!("Cursor CLI 安装失败：{}", stderr);
                }
                Err(_) => {
                    anyhow::bail!(
                        "Cursor CLI 安装失败，请手动执行：irm https://cursor.com/install | iex"
                    );
                }
            };
        }
        #[cfg(not(windows))]
        {
            let output = std::process::Command::new("sh")
                .arg("-c")
                .arg("curl https://cursor.com/install -fsS | bash")
                .output();
            match output {
                Ok(out) if out.status.success() => Ok(()),
                Ok(out) => {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    anyhow::bail!("Cursor CLI 安装失败：{}", stderr)
                }
                Err(_) => {
                    anyhow::bail!("Cursor CLI 安装失败，请手动执行：curl https://cursor.com/install -fsS | bash")
                }
            }
        }
    }

    fn upgrade(&self) -> Result<()> {
        #[cfg(windows)]
        {
            let output = std::process::Command::new("powershell")
                .args(["-Command", "irm https://cursor.com/install | iex"])
                .output();
            return match output {
                Ok(out) if out.status.success() => Ok(()),
                Ok(out) => {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    anyhow::bail!("Cursor CLI 升级失败：{}", stderr);
                }
                Err(_) => {
                    anyhow::bail!(
                        "Cursor CLI 升级失败，请手动执行：irm https://cursor.com/install | iex"
                    );
                }
            };
        }
        #[cfg(not(windows))]
        {
            let output = std::process::Command::new("sh")
                .arg("-c")
                .arg("curl https://cursor.com/install -fsS | bash")
                .output();
            match output {
                Ok(out) if out.status.success() => Ok(()),
                Ok(out) => {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    anyhow::bail!("Cursor CLI 升级失败：{}", stderr)
                }
                Err(_) => {
                    anyhow::bail!("Cursor CLI 升级失败，请手动执行：curl https://cursor.com/install -fsS | bash")
                }
            }
        }
    }

    fn uninstall(&self) -> Result<()> {
        let home =
            dirs::home_dir().ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))?;

        #[allow(unused_mut)]
        let mut candidates = vec![home.join(".local/bin/agent")];
        #[cfg(windows)]
        {
            if let Some(local_app) = dirs::data_local_dir() {
                candidates.push(
                    local_app
                        .join("Programs")
                        .join("cursor-agent")
                        .join("agent.exe"),
                );
            }
        }

        let agent_path = candidates.into_iter().find(|p| p.exists());
        match agent_path {
            Some(p) => {
                std::fs::remove_file(&p)?;
                tracing::info!("Removed Cursor CLI: {}", p.display());
                Ok(())
            }
            None => anyhow::bail!("Cursor CLI 未安装"),
        }
    }

    fn config_dir(&self) -> Result<PathBuf> {
        #[cfg(windows)]
        {
            dirs::config_dir()
                .ok_or_else(|| anyhow::anyhow!("cannot determine config directory"))
                .map(|d| d.join("Cursor"))
        }
        #[cfg(not(windows))]
        {
            dirs::home_dir()
                .ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))
                .map(|home| home.join(".cursor"))
        }
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
