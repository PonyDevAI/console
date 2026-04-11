use anyhow::Result;
use std::collections::HashMap;

use crate::models::{Agent, AgentStatus, AgentType, AgentsState};
use crate::services::agent_source;

pub fn load() -> Result<AgentsState> {
    let paths = crate::storage::ConsolePaths::default();
    crate::storage::read_json(&paths.agents_file())
        .or_else(|_| Ok(AgentsState { agents: vec![] }))
}

pub fn save(state: &AgentsState) -> Result<()> {
    let paths = crate::storage::ConsolePaths::default();
    crate::storage::write_json(&paths.agents_file(), state)
}

pub fn list_agents() -> Result<Vec<Agent>> {
    let mut agents = Vec::new();
    
    agents.extend(list_local_agents()?);
    agents.extend(list_remote_agents()?);
    
    Ok(agents)
}

pub fn list_local_agents() -> Result<Vec<Agent>> {
    let sources = agent_source::list_agent_sources()?;
    let mut agents = Vec::new();
    
    for source in sources {
        if source.source_type != crate::models::AgentSourceType::LocalCli {
            continue;
        }
        
        let status = if source.installed {
            AgentStatus::Online
        } else {
            AgentStatus::Offline
        };
        
        let agent = Agent {
            id: format!("{}-cli", source.name),
            source_id: source.id.clone(),
            name: source.name.clone(),
            display_name: format!("{} CLI", source.display_name),
            agent_type: AgentType::LocalCli,
            status,
            supported_models: source.supported_models,
            default_model: source.default_model,
            metadata: HashMap::new(),
        };
        agents.push(agent);
    }
    
    Ok(agents)
}

pub fn list_remote_agents() -> Result<Vec<Agent>> {
    Ok(vec![])
}

pub fn get_agent(id: &str) -> Result<Option<Agent>> {
    if let Some(agent) = list_agents()?.into_iter().find(|a| a.id == id) {
        return Ok(Some(agent));
    }
    
    if let Some((source_id, _agent_name)) = id.rsplit_once('/') {
        let remote_agents = {
            let rt = tokio::runtime::Handle::current();
            rt.block_on(fetch_remote_agents_from_source(source_id))
        };
        if let Ok(agents) = remote_agents {
            if let Some(agent) = agents.into_iter().find(|a| a.id == id) {
                return Ok(Some(agent));
            }
        }
    }
    
    Ok(None)
}

pub fn get_agents_by_source(source_id: &str) -> Result<Vec<Agent>> {
    let agents = list_agents()?;
    Ok(agents.into_iter().filter(|a| a.source_id == source_id).collect())
}

pub fn get_local_agent_by_source(source_id: &str) -> Result<Option<Agent>> {
    let sources = agent_source::list_agent_sources()?;
    let source = sources.into_iter().find(|s| s.id == source_id);
    
    match source {
        Some(source) if source.source_type == crate::models::AgentSourceType::LocalCli => {
            let status = if source.installed {
                AgentStatus::Online
            } else {
                AgentStatus::Offline
            };
            
            Ok(Some(Agent {
                id: format!("{}-cli", source.name),
                source_id: source.id.clone(),
                name: source.name.clone(),
                display_name: format!("{} CLI", source.display_name),
                agent_type: AgentType::LocalCli,
                status,
                supported_models: source.supported_models,
                default_model: source.default_model,
                metadata: HashMap::new(),
            }))
        }
        _ => Ok(None),
    }
}

fn normalize_remote_agent_name(raw_id: &str) -> String {
    raw_id.split('/').last().unwrap_or(raw_id).to_string()
}

pub async fn fetch_remote_agents_from_source(source_id: &str) -> Result<Vec<Agent>> {
    let sources = agent_source::list_agent_sources()?;
    let source = sources.into_iter()
        .find(|s| s.id == source_id)
        .ok_or_else(|| anyhow::anyhow!("Agent source not found: {}", source_id))?;
    
    match source.source_type {
        crate::models::AgentSourceType::RemoteOpenClawWs => {
            let openclaw_response = crate::services::openclaw::list_agents(&source).await?;
            Ok(openclaw_response.agents.into_iter().map(|a| Agent {
                id: a.id,
                source_id: a.source_id,
                name: a.name,
                display_name: a.display_name,
                agent_type: AgentType::RemoteAgent,
                status: if a.status == "online" { AgentStatus::Online } else { AgentStatus::Offline },
                supported_models: vec![],
                default_model: None,
                metadata: HashMap::new(),
            }).collect())
        }
        crate::models::AgentSourceType::RemoteAgent => {
            let endpoint = source.endpoint.as_ref()
                .ok_or_else(|| anyhow::anyhow!("Remote source has no endpoint"))?;
            
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .danger_accept_invalid_certs(true)
                .build()?;
            
            let base = endpoint.trim_end_matches('/');
            let mut request = client.get(format!("{}/v1/models", base));
            if let Some(ref api_key) = source.api_key {
                request = request.header("Authorization", format!("Bearer {}", api_key));
            }
            
            let response = request.send().await?;
            if !response.status().is_success() {
                anyhow::bail!("Failed to fetch remote agents: HTTP {}", response.status());
            }
            
            let body: serde_json::Value = response.json().await?;
            let agents = body.get("data")
                .and_then(|d| d.as_array())
                .map(|items| {
                    items.iter()
                        .filter_map(|item| {
                            let raw_id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
                            if raw_id.is_empty() {
                                return None;
                            }
                            
                            let agent_name = normalize_remote_agent_name(raw_id);
                            let agent_id = format!("{}/{}", source_id, agent_name);
                            
                            let display_name_str = item.get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or(agent_name.as_str())
                                .to_string();
                            
                            let status = if source.healthy {
                                AgentStatus::Online
                            } else {
                                AgentStatus::Offline
                            };
                            
                            Some(Agent {
                                id: agent_id,
                                source_id: source_id.to_string(),
                                name: agent_name,
                                display_name: display_name_str,
                                agent_type: AgentType::RemoteAgent,
                                status,
                                supported_models: vec![],
                                default_model: None,
                                metadata: HashMap::new(),
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            
            Ok(agents)
        }
        _ => anyhow::bail!("Source {} is not a remote agent source", source_id),
    }
}

pub fn calculate_agent_status(agent: &Agent) -> AgentStatus {
    match agent.agent_type {
        AgentType::LocalCli => {
            if let Ok(sources) = agent_source::list_agent_sources() {
                if let Some(source) = sources.iter().find(|s| s.id == agent.source_id) {
                    if source.installed {
                        return AgentStatus::Online;
                    }
                }
            }
            AgentStatus::Offline
        }
        AgentType::RemoteAgent => {
            if let Ok(sources) = agent_source::list_agent_sources() {
                if let Some(source) = sources.iter().find(|s| s.id == agent.source_id) {
                    if source.healthy {
                        return AgentStatus::Online;
                    }
                }
            }
            AgentStatus::Offline
        }
    }
}
