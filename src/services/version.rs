use anyhow::Result;

use crate::adapters;
use crate::models::{CliTool, CliToolsState};
use crate::storage::{self, ConsolePaths};

/// Load CLI tool state from disk.
pub fn load() -> Result<CliToolsState> {
    let paths = ConsolePaths::default();
    storage::read_json(&paths.cli_tools_file())
}

/// Scan all adapters and return current tool states.
pub fn scan_all() -> Result<CliToolsState> {
    let registry = adapters::registry();
    let mut tools = Vec::new();

    for adapter in registry.adapters() {
        let tool = match adapter.detect_installation() {
            Ok(Some(info)) => CliTool {
                name: adapter.name().to_string(),
                display_name: adapter.display_name().to_string(),
                installed: true,
                local_version: Some(info.version),
                remote_version: None,
                path: Some(info.path),
                last_checked: Some(chrono::Utc::now()),
                auto_install: adapter.supports_auto_install(),
                install_url: adapter.install_url().map(|s| s.to_string()),
            },
            _ => CliTool {
                name: adapter.name().to_string(),
                display_name: adapter.display_name().to_string(),
                installed: false,
                local_version: None,
                remote_version: None,
                path: None,
                last_checked: Some(chrono::Utc::now()),
                auto_install: adapter.supports_auto_install(),
                install_url: adapter.install_url().map(|s| s.to_string()),
            },
        };
        tools.push(tool);
    }

    Ok(CliToolsState { tools })
}

/// Check remote versions for all tools and update state.
pub fn check_updates(state: &mut CliToolsState) {
    let registry = adapters::registry();
    for tool in &mut state.tools {
        if let Some(adapter) = registry.find(&tool.name) {
            if let Ok(Some(ver)) = adapter.check_remote_version() {
                tool.remote_version = Some(ver);
            }
        }
    }
}

/// Install a CLI tool by name.
pub fn install(name: &str) -> Result<()> {
    let registry = adapters::registry();
    let adapter = registry.find(name).ok_or_else(|| anyhow::anyhow!("unknown CLI: {name}"))?;
    adapter.install()
}

/// Upgrade a CLI tool by name.
pub fn upgrade(name: &str) -> Result<()> {
    let registry = adapters::registry();
    let adapter = registry.find(name).ok_or_else(|| anyhow::anyhow!("unknown CLI: {name}"))?;
    adapter.upgrade()
}

/// Uninstall a CLI tool by name.
pub fn uninstall(name: &str) -> Result<()> {
    let registry = adapters::registry();
    let adapter = registry.find(name).ok_or_else(|| anyhow::anyhow!("unknown CLI: {name}"))?;
    adapter.uninstall()
}

/// Persist tool state to disk.
pub fn save(state: &CliToolsState) -> Result<()> {
    let paths = ConsolePaths::default();
    storage::write_json(&paths.cli_tools_file(), state)
}
