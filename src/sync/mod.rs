//! Config sync engine — translates Console's unified config into each CLI's native format.
//!
//! This module is the core integration layer. It reads Console state and writes
//! to each CLI tool's native config files via the adapter layer.

use anyhow::Result;

use crate::adapters;
use crate::services;

/// Sync all Console configuration to all managed CLI tools.
/// This is the main entry point called by `console sync` and the API.
pub fn sync_all() -> Result<SyncReport> {
    let mut report = SyncReport::default();

    match sync_providers() {
        Ok(count) => report.providers_synced = count,
        Err(e) => report.errors.push(format!("provider sync: {e}")),
    }

    match sync_mcp_servers() {
        Ok(count) => report.mcp_servers_synced = count,
        Err(e) => report.errors.push(format!("mcp sync: {e}")),
    }

    tracing::info!("sync_all completed: {report:?}");
    Ok(report)
}

fn sync_providers() -> Result<u32> {
    let active = services::provider::get_active()?;
    let registry = adapters::registry();
    let mut count = 0u32;

    if let Some(provider) = active {
        for adapter in registry.adapters() {
            if provider.apps.contains(&adapter.name().to_string()) {
                if let Ok(config_dir) = adapter.config_dir() {
                    let config = serde_json::json!({
                        "provider": provider.name,
                        "api_endpoint": provider.api_endpoint,
                        "api_key_ref": provider.api_key_ref,
                    });
                    let target = config_dir.join("console_provider.json");
                    if let Some(parent) = target.parent() {
                        std::fs::create_dir_all(parent)?;
                    }
                    std::fs::write(&target, serde_json::to_string_pretty(&config)?)?;
                    count += 1;
                    tracing::info!("Synced provider to {}", target.display());
                }
            }
        }
    }

    Ok(count)
}

fn sync_mcp_servers() -> Result<u32> {
    let servers = services::mcp::list()?;
    let registry = adapters::registry();
    let mut count = 0u32;

    for adapter in registry.adapters() {
        let app_name = adapter.name().to_string();
        let enabled: Vec<_> = servers
            .iter()
            .filter(|s| s.enabled_apps.contains(&app_name))
            .collect();

        if enabled.is_empty() {
            continue;
        }

        if let Ok(config_dir) = adapter.config_dir() {
            let mut mcp_config = serde_json::Map::new();
            for server in &enabled {
                let mut entry = serde_json::Map::new();
                entry.insert("transport".to_string(), serde_json::json!(server.transport));
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
                mcp_config.insert(server.name.clone(), serde_json::Value::Object(entry));
            }

            let target = config_dir.join(".mcp.json");
            let wrapper = serde_json::json!({ "mcpServers": mcp_config });
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&target, serde_json::to_string_pretty(&wrapper)?)?;
            count += 1;
            tracing::info!("Synced {} MCP servers to {}", enabled.len(), target.display());
        }
    }

    Ok(count)
}

#[allow(dead_code)]
#[derive(Debug, Default)]
pub struct SyncReport {
    pub providers_synced: u32,
    pub mcp_servers_synced: u32,
    pub skills_synced: u32,
    pub prompts_synced: u32,
    pub errors: Vec<String>,
}
