use anyhow::Result;
use chrono::Utc;

use crate::adapters;
use crate::models::{AgentSource, AgentSourceType, AgentSourcesState};
use crate::storage::{self, ConsolePaths};

pub fn load() -> Result<AgentSourcesState> {
    let paths = ConsolePaths::default();
    storage::read_json(&paths.agent_sources_file())
}

pub fn save(state: &AgentSourcesState) -> Result<()> {
    let paths = ConsolePaths::default();
    storage::write_json(&paths.agent_sources_file(), state)
}

pub fn list_agent_sources() -> Result<Vec<AgentSource>> {
    let cli_state = crate::services::version::load()?;
    let registry = adapters::registry();

    let mut sources: Vec<AgentSource> = cli_state
        .tools
        .iter()
        .map(|tool| {
            let adapter = registry.find(&tool.name);
            let source_type = AgentSourceType::LocalCli;
            let managed_by_console = true;

            let supported_models = if let Some(adapter) = adapter {
                adapter.supported_models().unwrap_or_default()
            } else {
                vec![]
            };

            let current_model = if let Some(adapter) = adapter {
                if tool.supports_model_config {
                    adapter.read_model_config().ok().flatten()
                } else {
                    None
                }
            } else {
                None
            };

            AgentSource {
                id: tool.name.clone(),
                name: tool.name.clone(),
                display_name: tool.display_name.clone(),
                source_type,
                managed_by_console,
                executable: Some(tool.name.clone()),
                endpoint: None,
                api_key: None,
                origin: None,
                supported_models,
                default_model: current_model.clone(),
                healthy: tool.installed,
                installed: tool.installed,
                local_version: tool.local_version.clone(),
                remote_version: tool.remote_version.clone(),
                path: tool.path.clone(),
                supports_auto_install: tool.auto_install,
                install_url: tool.install_url.clone(),
                supports_model_config: tool.supports_model_config,
                last_checked_at: tool.last_checked,
            }
        })
        .collect();

    let agent_sources_state = load()?;
    for source in agent_sources_state.sources {
        if source.source_type == AgentSourceType::RemoteOpenClawWs {
            sources.push(source);
        }
    }

    let remote_agents = crate::services::remote_agent::load()?.agents;
    for agent in remote_agents {
        if agent.source_type.as_deref() == Some("openclaw_ws") {
            continue;
        }
        let is_online = agent.status == crate::models::RemoteAgentStatus::Online;
        let source_type = AgentSourceType::RemoteAgent;
        let remote_source = AgentSource {
            id: agent.id.clone(),
            name: agent.name.clone(),
            display_name: agent.display_name.clone(),
            source_type,
            managed_by_console: false,
            executable: None,
            endpoint: Some(agent.endpoint.clone()),
            api_key: agent.api_key.clone(),
            origin: agent.origin.clone(),
            supported_models: vec![],
            default_model: None,
            healthy: is_online,
            installed: true,
            local_version: None,
            remote_version: agent.version.clone(),
            path: None,
            supports_auto_install: false,
            install_url: None,
            supports_model_config: false,
            last_checked_at: agent.last_ping,
        };
        sources.push(remote_source);
    }

    Ok(sources)
}

pub fn scan_all() -> Result<AgentSourcesState> {
    let cli_state = crate::services::version::scan_all()?;
    crate::services::version::save(&cli_state)?;

    let sources = list_agent_sources()?;
    let state = AgentSourcesState { sources };
    save(&state)?;

    Ok(state)
}

pub fn check_updates() -> Result<AgentSourcesState> {
    let mut cli_state = crate::services::version::load()?;
    crate::services::version::check_updates(&mut cli_state);
    crate::services::version::save(&cli_state)?;

    let sources = list_agent_sources()?;
    let state = AgentSourcesState { sources };
    save(&state)?;

    Ok(state)
}

pub fn install(name: &str) -> Result<()> {
    crate::services::version::install(name)
}

pub fn upgrade(name: &str) -> Result<()> {
    crate::services::version::upgrade(name)
}

pub fn uninstall(name: &str) -> Result<()> {
    crate::services::version::uninstall(name)
}

pub async fn scan_all_with_refresh() -> Result<AgentSourcesState> {
    let cli_state = crate::services::version::scan_all()?;
    crate::services::version::save(&cli_state)?;

    let mut sources = list_agent_sources()?;
    
    for source in sources.iter_mut() {
        if source.source_type == AgentSourceType::RemoteOpenClawWs {
            let result = crate::services::openclaw::test_source(&source).await;
            source.healthy = result.ok;
            source.remote_version = result.version.clone();
            source.last_checked_at = Some(Utc::now());

            if result.ok {
                source.supported_models = vec![];
                match crate::services::openclaw::list_agents(&source).await {
                    Ok(agents_result) => {
                        source.supported_models = agents_result.agents.iter().map(|a| a.name.clone()).collect();
                    }
                    Err(e) => {
                        tracing::warn!("Failed to list agents for {}: {}", source.id, e);
                    }
                }
            } else {
                source.supported_models = vec![];
                if let Some(err) = result.error {
                    tracing::warn!("Failed to refresh OpenClaw source {}: {}", source.id, err);
                }
            }
        }
    }
    
    let state = AgentSourcesState { sources };
    save(&state)?;

    Ok(state)
}

pub fn get_source(id: &str) -> Result<AgentSource> {
    let sources = list_agent_sources()?;
    sources
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| anyhow::anyhow!("Agent source not found: {}", id))
}

pub fn get_source_opt(id: &str) -> Result<Option<AgentSource>> {
    let sources = list_agent_sources()?;
    Ok(sources.into_iter().find(|s| s.id == id))
}

pub fn check_remote_version(name: &str) -> Result<Option<String>> {
    let registry = adapters::registry();
    let adapter = registry
        .find(name)
        .ok_or_else(|| anyhow::anyhow!("Unknown CLI: {}", name))?;
    adapter.check_remote_version().map_err(Into::into)
}

pub fn read_current_model(name: &str) -> Result<Option<String>> {
    let registry = adapters::registry();
    let adapter = registry
        .find(name)
        .ok_or_else(|| anyhow::anyhow!("Unknown CLI: {}", name))?;

    if !adapter.supports_model_config() {
        return Ok(None);
    }

    adapter.read_model_config().map_err(Into::into)
}

pub fn supported_models(name: &str) -> Result<Vec<String>> {
    let registry = adapters::registry();
    let adapter = registry
        .find(name)
        .ok_or_else(|| anyhow::anyhow!("Unknown CLI: {}", name))?;

    adapter.supported_models().map_err(Into::into)
}

pub fn set_default_model(name: &str, model: &str) -> Result<()> {
    let registry = adapters::registry();
    let adapter = registry
        .find(name)
        .ok_or_else(|| anyhow::anyhow!("Unknown CLI: {}", name))?;

    if !adapter.supports_model_config() {
        anyhow::bail!("{} does not support model configuration", name);
    }

    let provider = crate::models::Provider {
        id: format!("{}-provider", name),
        name: name.to_string(),
        api_endpoint: String::new(),
        api_key_ref: String::new(),
        active: true,
        apps: vec![],
        models: vec![],
        created_at: Utc::now(),
        modified_at: Utc::now(),
    };

    adapter
        .write_model_config(&provider, model)
        .map_err(Into::into)
}

pub fn test_source(id: &str) -> Result<bool> {
    let source = get_source(id)?;

    if !source.installed {
        return Ok(false);
    }

    let registry = adapters::registry();
    let adapter = registry
        .find(&id)
        .ok_or_else(|| anyhow::anyhow!("Unknown CLI: {}", id))?;

    match adapter.detect_installation() {
        Ok(Some(_)) => Ok(true),
        Ok(None) => Ok(false),
        Err(_) => Ok(false),
    }
}

pub fn add_source(
    name: &str,
    display_name: &str,
    endpoint: &str,
    api_key: Option<&str>,
    source_type: AgentSourceType,
    origin: Option<&str>,
) -> Result<AgentSource> {
    let mut state = load()?;

    let id = uuid::Uuid::new_v4().to_string();

    let source = AgentSource {
        id: id.clone(),
        name: name.to_string(),
        display_name: display_name.to_string(),
        source_type,
        managed_by_console: false,
        executable: None,
        endpoint: Some(endpoint.to_string()),
        api_key: api_key.map(String::from),
        origin: origin.map(String::from),
        supported_models: vec![],
        default_model: None,
        healthy: false,
        installed: true,
        local_version: None,
        remote_version: None,
        path: None,
        supports_auto_install: false,
        install_url: None,
        supports_model_config: false,
        last_checked_at: None,
    };

    state.sources.push(source.clone());
    save(&state)?;

    Ok(source)
}

pub fn update_source(
    id: &str,
    display_name: Option<&str>,
    endpoint: Option<&str>,
    api_key: Option<&str>,
    origin: Option<&str>,
) -> Result<AgentSource> {
    let mut state = load()?;

    let source = state
        .sources
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| anyhow::anyhow!("Source not found: {}", id))?;

    if let Some(dn) = display_name {
        source.display_name = dn.to_string();
    }
    if let Some(ep) = endpoint {
        source.endpoint = Some(ep.to_string());
    }
    if let Some(key) = api_key {
        source.api_key = Some(key.to_string());
    }
    if let Some(orig) = origin {
        source.origin = Some(orig.to_string());
    }

    let updated = source.clone();
    save(&state)?;

    Ok(updated)
}

pub fn delete_source(id: &str) -> Result<()> {
    let mut state = load()?;

    let initial_len = state.sources.len();
    state.sources.retain(|s| s.id != id);

    if state.sources.len() == initial_len {
        anyhow::bail!("Source not found: {}", id);
    }

    save(&state)?;
    Ok(())
}

pub fn get_source_by_id(id: &str) -> Result<Option<AgentSource>> {
    let state = load()?;
    Ok(state.sources.into_iter().find(|s| s.id == id))
}
