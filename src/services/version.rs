use anyhow::Result;

use crate::adapters;
use crate::models::{CliTool, CliToolsState};
use crate::storage::{self, CloudCodePaths};

/// Load CLI tool state from disk.
pub fn load() -> Result<CliToolsState> {
    let paths = CloudCodePaths::default();
    storage::read_json(&paths.cli_tools_file())
}

/// Scan all adapters and return current tool states (parallel).
/// Preserves existing remote_version from cached state.
pub fn scan_all() -> Result<CliToolsState> {
    // 读取已有缓存，用于保留 remote_version
    let cached = load().unwrap_or_else(|_| CliToolsState { tools: vec![] });

    let registry = adapters::registry();
    let adapter_list = registry.adapters();

    // 并行检测所有 adapter
    let tools: Vec<CliTool> = std::thread::scope(|s| {
        let handles: Vec<_> = adapter_list
            .iter()
            .map(|adapter| {
                let cached_tool = cached.tools.iter().find(|t| t.name == adapter.name()).cloned();
                s.spawn(move || -> CliTool {
                    let now = chrono::Utc::now();
                    let cached_remote = cached_tool.and_then(|t| t.remote_version);
                    match adapter.detect_installation() {
                        Ok(Some(info)) => CliTool {
                            name: adapter.name().to_string(),
                            display_name: adapter.display_name().to_string(),
                            installed: true,
                            local_version: Some(info.version),
                            remote_version: cached_remote,
                            path: Some(info.path),
                            last_checked: Some(now),
                            auto_install: adapter.supports_auto_install(),
                            supports_model_config: adapter.supports_model_config(),
                            install_url: adapter.install_url().map(|u| u.to_string()),
                        },
                        _ => CliTool {
                            name: adapter.name().to_string(),
                            display_name: adapter.display_name().to_string(),
                            installed: false,
                            local_version: None,
                            remote_version: cached_remote,
                            path: None,
                            last_checked: Some(now),
                            auto_install: adapter.supports_auto_install(),
                            supports_model_config: adapter.supports_model_config(),
                            install_url: adapter.install_url().map(|u| u.to_string()),
                        },
                    }
                })
            })
            .collect();

        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    let mut state = CliToolsState { tools };
    // save 之前重新读一次磁盘，合并最新的 remote_version（避免覆盖并发的 check-remote 结果）
    if let Ok(latest) = load() {
        for tool in &mut state.tools {
            if tool.remote_version.is_none() {
                if let Some(lt) = latest.tools.iter().find(|t| t.name == tool.name) {
                    tool.remote_version = lt.remote_version.clone();
                }
            }
        }
    }
    let _ = save(&state);
    Ok(state)
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
    let paths = CloudCodePaths::default();
    storage::write_json(&paths.cli_tools_file(), state)
}
