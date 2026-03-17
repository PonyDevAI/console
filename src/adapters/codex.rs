use anyhow::Result;
use std::path::PathBuf;

use super::{run_command_stdout, which, CliAdapter};
use crate::models::InstalledInfo;

pub struct CodexAdapter;

impl CliAdapter for CodexAdapter {
    fn name(&self) -> &str {
        "codex"
    }
    fn display_name(&self) -> &str {
        "Codex"
    }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("codex") {
            Some(p) => p,
            None => return Ok(None),
        };
        let version =
            run_command_stdout(path.to_str().unwrap_or("codex"), &["--version"]).unwrap_or_else(|_| "unknown".into());
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        #[cfg(windows)]
        let output = run_command_stdout("cmd", &["/C", "npm", "view", "@openai/codex", "version"]);
        #[cfg(not(windows))]
        let output = run_command_stdout("npm", &["view", "@openai/codex", "version"]);
        Ok(output.ok())
    }

    fn install(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["install", "-g", "@openai/codex"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm install failed for Codex CLI");
        }
        Ok(())
    }

    fn upgrade(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["update", "-g", "@openai/codex"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm update failed for Codex CLI");
        }
        Ok(())
    }

    fn uninstall(&self) -> Result<()> {
        let status = super::npm_command()
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
        Ok(self.config_dir()?.join("config.toml"))
    }

    fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()> {
        let config_dir = self.config_dir()?;
        std::fs::create_dir_all(&config_dir)?;
        let config_path = config_dir.join("config.toml");

        let mut config: toml::Value = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            content
                .parse()
                .unwrap_or(toml::Value::Table(toml::map::Map::new()))
        } else {
            toml::Value::Table(toml::map::Map::new())
        };

        let mut mcp_table = toml::map::Map::new();
        for server in servers {
            let mut entry = toml::map::Map::new();
            if let Some(cmd) = &server.command {
                entry.insert("command".to_string(), toml::Value::String(cmd.clone()));
            }
            if !server.args.is_empty() {
                entry.insert(
                    "args".to_string(),
                    toml::Value::Array(
                        server
                            .args
                            .iter()
                            .map(|arg| toml::Value::String(arg.clone()))
                            .collect(),
                    ),
                );
            }
            if let Some(url) = &server.url {
                entry.insert("url".to_string(), toml::Value::String(url.clone()));
            }
            if !server.env.is_empty() {
                let mut env_table = toml::map::Map::new();
                for (k, v) in &server.env {
                    env_table.insert(k.clone(), toml::Value::String(v.clone()));
                }
                entry.insert("env".to_string(), toml::Value::Table(env_table));
            }
            mcp_table.insert(server.name.clone(), toml::Value::Table(entry));
        }

        if let Some(table) = config.as_table_mut() {
            table.insert("mcp_servers".to_string(), toml::Value::Table(mcp_table));
        }

        std::fs::write(&config_path, toml::to_string_pretty(&config)?)?;
        tracing::info!("Wrote Codex MCP config (TOML): {}", config_path.display());
        Ok(())
    }

    fn supports_provider_sync(&self) -> bool {
        true
    }

    fn write_provider_config(&self, provider: &crate::models::Provider) -> Result<()> {
        let config_dir = self.config_dir()?;
        std::fs::create_dir_all(&config_dir)?;

        let auth_path = config_dir.join("auth.json");
        let mut auth: serde_json::Value = if auth_path.exists() {
            let content = std::fs::read_to_string(&auth_path)?;
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };
        if let Some(obj) = auth.as_object_mut() {
            obj.insert(
                "OPENAI_API_KEY".to_string(),
                serde_json::json!(provider.api_key_ref),
            );
        }
        std::fs::write(&auth_path, serde_json::to_string_pretty(&auth)?)?;

        let config_path = config_dir.join("config.toml");
        let mut config: toml::Value = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            content
                .parse()
                .unwrap_or(toml::Value::Table(toml::map::Map::new()))
        } else {
            toml::Value::Table(toml::map::Map::new())
        };
        if let Some(table) = config.as_table_mut() {
            table.insert(
                "model_provider".to_string(),
                toml::Value::String("openai".to_string()),
            );
            table.insert(
                "base_url".to_string(),
                toml::Value::String(provider.api_endpoint.clone()),
            );
        }
        std::fs::write(&config_path, toml::to_string_pretty(&config)?)?;

        tracing::info!("Wrote Codex provider config: auth.json + config.toml");
        Ok(())
    }
}
