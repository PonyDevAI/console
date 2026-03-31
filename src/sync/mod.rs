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

    match sync_prompts() {
        Ok(count) => report.prompts_synced = count,
        Err(e) => report.errors.push(format!("prompt sync: {e}")),
    }

    tracing::info!("sync_all completed: {report:?}");
    Ok(report)
}

fn sync_providers() -> Result<u32> {
    let all_providers = services::provider::list()?;
    let active = services::provider::get_active()?;
    let switch_modes = services::provider::get_switch_modes()?;
    let registry = adapters::registry();
    let mut count = 0u32;

    for adapter in registry.adapters() {
        let app_name = adapter.name().to_string();
        if !adapter.supports_provider_sync() {
            continue;
        }

        let mode = switch_modes
            .get(&app_name)
            .copied()
            .unwrap_or_else(|| adapter.switch_mode());

        match mode {
            crate::models::SwitchMode::Switch => {
                if let Some(ref provider) = active {
                    if provider.apps.contains(&app_name) {
                        match adapter.write_provider_config(provider) {
                            Ok(()) => {
                                count += 1;
                                services::logs::push(
                                    "info",
                                    "sync",
                                    &format!(
                                        "Synced active provider '{}' to {}",
                                        provider.name,
                                        adapter.display_name()
                                    ),
                                );
                            }
                            Err(e) => {
                                services::logs::push(
                                    "error",
                                    "sync",
                                    &format!(
                                        "Failed to sync provider to {}: {e}",
                                        adapter.display_name()
                                    ),
                                );
                            }
                        }
                    }
                }
            }
            crate::models::SwitchMode::Additive => {
                let targeted: Vec<_> = all_providers
                    .iter()
                    .filter(|p| p.apps.contains(&app_name))
                    .collect();
                for provider in targeted {
                    match adapter.write_provider_config(provider) {
                        Ok(()) => {
                            count += 1;
                            services::logs::push(
                                "info",
                                "sync",
                                &format!(
                                    "Synced provider '{}' to {} (additive)",
                                    provider.name,
                                    adapter.display_name()
                                ),
                            );
                        }
                        Err(e) => {
                            services::logs::push(
                                "error",
                                "sync",
                                &format!(
                                    "Failed to sync provider to {}: {e}",
                                    adapter.display_name()
                                ),
                            );
                        }
                    }
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
            .cloned()
            .collect();

        if enabled.is_empty() {
            continue;
        }

        match adapter.write_mcp_config(&enabled) {
            Ok(()) => {
                count += 1;
                services::logs::push(
                    "info",
                    "sync",
                    &format!(
                        "Synced {} MCP servers to {}",
                        enabled.len(),
                        adapter.display_name()
                    ),
                );
            }
            Err(e) => {
                services::logs::push(
                    "error",
                    "sync",
                    &format!("Failed to sync MCP to {}: {e}", adapter.display_name()),
                );
            }
        }
    }

    Ok(count)
}

fn sync_prompts() -> Result<u32> {
    let prompts = services::prompt::list()?;
    let active = prompts.iter().find(|p| p.active);
    let Some(active_prompt) = active else {
        return Ok(0);
    };

    let registry = adapters::registry();
    let mut count = 0u32;

    for adapter in registry.adapters() {
        let app_name = adapter.name().to_string();
        if active_prompt.apps.is_empty() || !active_prompt.apps.contains(&app_name) {
            continue;
        }

        let config_dir = match app_name.as_str() {
            "claude" => dirs::home_dir().map(|h| h.join(".claude")),
            "codex" => dirs::home_dir().map(|h| h.join(".codex")),
            "opencode" => dirs::home_dir().map(|h| h.join(".opencode")),
            "gemini" => dirs::home_dir().map(|h| h.join(".gemini")),
            _ => None,
        };

        let filename = match app_name.as_str() {
            "claude" => Some("CLAUDE.md"),
            "codex" => Some("CODEX.md"),
            "opencode" => Some("OPENCODE.md"),
            "gemini" => Some("GEMINI.md"),
            _ => None,
        };

        if let (Some(dir), Some(fname)) = (config_dir, filename) {
            let path = dir.join(fname);
            let content = format!(
                "<!-- Managed by Console. Last synced: {} -->\n\n{}",
                chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
                active_prompt.content
            );
            match std::fs::write(&path, content) {
                Ok(()) => {
                    count += 1;
                    services::logs::push(
                        "info",
                        "sync",
                        &format!(
                            "Synced prompt '{}' to {}",
                            active_prompt.name,
                            adapter.display_name()
                        ),
                    );
                }
                Err(e) => {
                    services::logs::push(
                        "error",
                        "sync",
                        &format!("Failed to sync prompt to {}: {e}", adapter.display_name()),
                    );
                }
            }
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
