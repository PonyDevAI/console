use anyhow::Result;
use std::path::PathBuf;

use super::{run_command_stdout, which, CliAdapter, extract_version};
use crate::models::InstalledInfo;

pub struct ClaudeAdapter;

fn load_settings(path: &std::path::Path) -> Result<serde_json::Value> {
    if path.exists() {
        let content = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&content).unwrap_or(serde_json::json!({})))
    } else {
        Ok(serde_json::json!({}))
    }
}

fn ensure_env_object(settings: &mut serde_json::Value) -> Result<&mut serde_json::Map<String, serde_json::Value>> {
    let obj = settings
        .as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("Claude settings.json must be a JSON object"))?;
    let env = obj
        .entry("env".to_string())
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
    env.as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("Claude settings.json env must be a JSON object"))
}

fn save_settings(path: &std::path::Path, settings: &serde_json::Value) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(settings)?)?;
    Ok(())
}

impl CliAdapter for ClaudeAdapter {
    fn name(&self) -> &str {
        "claude"
    }
    fn display_name(&self) -> &str {
        "Claude"
    }

    fn detect_installation(&self) -> Result<Option<InstalledInfo>> {
        let path = match which("claude") {
            Some(p) => p,
            None => return Ok(None),
        };
        let raw =
            run_command_stdout(path.to_str().unwrap_or("claude"), &["--version"]).unwrap_or_else(|_| "unknown".into());
        // `claude --version` outputs "2.1.74 (Claude Code)"; extract the version number only.
        let version = extract_version(&raw);
        Ok(Some(InstalledInfo { version, path }))
    }

    fn check_remote_version(&self) -> Result<Option<String>> {
        #[cfg(windows)]
        let output = run_command_stdout(
            "cmd",
            &["/C", "npm", "view", "@anthropic-ai/claude-code", "version"],
        );
        #[cfg(not(windows))]
        let output = run_command_stdout("npm", &["view", "@anthropic-ai/claude-code", "version"]);
        Ok(output.ok())
    }

    fn install(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["install", "-g", "@anthropic-ai/claude-code"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm install failed for Claude CLI");
        }
        Ok(())
    }

    fn upgrade(&self) -> Result<()> {
        let status = super::npm_command()
            .args(["update", "-g", "@anthropic-ai/claude-code"])
            .status()?;
        if !status.success() {
            anyhow::bail!("npm update failed for Claude CLI");
        }
        Ok(())
    }

    fn uninstall(&self) -> Result<()> {
        let status = super::npm_command()
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

    fn read_mcp_config(&self) -> Result<serde_json::Value> {
        let home =
            dirs::home_dir().ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))?;
        let desktop_path = home.join(".claude").join("claude_desktop_config.json");
        if desktop_path.exists() {
            let content = std::fs::read_to_string(&desktop_path)?;
            let parsed: serde_json::Value = serde_json::from_str(&content)?;
            if let Some(mcp) = parsed.get("mcpServers") {
                return Ok(serde_json::json!({ "mcpServers": mcp }));
            }
        }

        let path = self.mcp_config_path()?;
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            return Ok(serde_json::from_str(&content)?);
        }

        let legacy_path = home.join(".claude.json");
        if legacy_path.exists() {
            let content = std::fs::read_to_string(&legacy_path)?;
            return Ok(serde_json::from_str(&content)?);
        }

        Ok(serde_json::json!({ "mcpServers": {} }))
    }

    fn supports_provider_sync(&self) -> bool {
        true
    }

    fn write_provider_config(&self, provider: &crate::models::Provider) -> Result<()> {
        let settings_path = self.config_file()?;
        let mut settings = load_settings(&settings_path)?;
        let env = ensure_env_object(&mut settings)?;
        env.insert(
            "ANTHROPIC_BASE_URL".to_string(),
            serde_json::Value::String(provider.api_endpoint.clone()),
        );
        env.insert(
            "ANTHROPIC_AUTH_TOKEN".to_string(),
            serde_json::Value::String(provider.api_key_ref.clone()),
        );
        save_settings(&settings_path, &settings)?;
        tracing::info!("Wrote Claude provider config: {}", settings_path.display());
        Ok(())
    }

    fn supports_model_config(&self) -> bool {
        true
    }

    fn write_model_config(&self, provider: &crate::models::Provider, model: &str) -> Result<()> {
        let settings_path = self.config_file()?;
        let mut settings = load_settings(&settings_path)?;
        let env = ensure_env_object(&mut settings)?;
        env.insert(
            "ANTHROPIC_MODEL".to_string(),
            serde_json::Value::String(model.to_string()),
        );
        env.insert(
            "ANTHROPIC_BASE_URL".to_string(),
            serde_json::Value::String(provider.api_endpoint.clone()),
        );
        env.insert(
            "ANTHROPIC_AUTH_TOKEN".to_string(),
            serde_json::Value::String(provider.api_key_ref.clone()),
        );
        save_settings(&settings_path, &settings)?;
        tracing::info!("Wrote Claude model config: model={}", model);
        Ok(())
    }

    fn read_model_config(&self) -> Result<Option<String>> {
        let settings_path = self.config_file()?;
        if !settings_path.exists() {
            return Ok(None);
        }

        let settings = load_settings(&settings_path)?;
        Ok(settings
            .get("env")
            .and_then(|env| env.get("ANTHROPIC_MODEL"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()))
    }

    fn clear_model_config(&self) -> Result<()> {
        let settings_path = self.config_file()?;
        if !settings_path.exists() {
            return Ok(());
        }

        let mut settings = load_settings(&settings_path)?;
        if let Some(env) = settings.get_mut("env").and_then(|value| value.as_object_mut()) {
            env.remove("ANTHROPIC_MODEL");
            env.remove("ANTHROPIC_BASE_URL");
            env.remove("ANTHROPIC_AUTH_TOKEN");
        }

        save_settings(&settings_path, &settings)?;
        tracing::info!("Cleared Claude model config");
        Ok(())
    }
}
