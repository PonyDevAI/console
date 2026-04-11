use anyhow::Result;
use chrono::Utc;
use std::time::Instant;
use tokio::sync::Mutex;

use crate::models::{RemoteAgent, RemoteAgentStatus, RemoteAgentsState};
use crate::storage::{read_json, write_json, ConsolePaths};

static STATE: Mutex<Option<RemoteAgentsState>> = Mutex::const_new(None);

pub fn load() -> Result<RemoteAgentsState> {
    let paths = ConsolePaths::default();
    let state = read_json(&paths.remote_agents_file()).unwrap_or_else(|_| RemoteAgentsState { agents: vec![] });
    Ok(state)
}

pub fn save(state: &RemoteAgentsState) -> Result<()> {
    let paths = ConsolePaths::default();
    write_json(&paths.remote_agents_file(), state)?;
    Ok(())
}

async fn get_state() -> Result<RemoteAgentsState> {
    let global = STATE.lock().await;
    if let Some(ref state) = *global {
        Ok(state.clone())
    } else {
        let state = load()?;
        Ok(state)
    }
}

async fn set_state(state: RemoteAgentsState) -> Result<()> {
    let mut global = STATE.lock().await;
    *global = Some(state.clone());
    save(&state)?;
    Ok(())
}

pub async fn add(
    name: &str,
    display_name: &str,
    endpoint: &str,
    api_key: Option<&str>,
    tags: Vec<String>,
    source_type: Option<&str>,
    origin: Option<&str>,
) -> Result<RemoteAgent> {
    let mut state = get_state().await?;
    
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();
    
    let agent = RemoteAgent {
        id,
        name: name.to_string(),
        display_name: display_name.to_string(),
        endpoint: endpoint.to_string(),
        api_key: api_key.map(String::from),
        status: RemoteAgentStatus::Unknown,
        version: None,
        latency_ms: None,
        last_ping: None,
        created_at: now,
        tags,
        source_type: source_type.map(String::from),
        origin: origin.map(String::from),
    };
    
    state.agents.push(agent.clone());
    set_state(state).await?;
    
    Ok(agent)
}

pub async fn update(
    id: &str,
    display_name: Option<&str>,
    endpoint: Option<&str>,
    api_key: Option<&str>,
    tags: Option<Vec<String>>,
    source_type: Option<&str>,
    origin: Option<&str>,
) -> Result<RemoteAgent> {
    let mut state = get_state().await?;
    
    let agent = state.agents
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or_else(|| anyhow::anyhow!("Remote agent not found"))?;
    
    if let Some(dn) = display_name {
        agent.display_name = dn.to_string();
    }
    if let Some(ep) = endpoint {
        agent.endpoint = ep.to_string();
    }
    if let Some(key) = api_key {
        agent.api_key = Some(key.to_string());
    }
    if let Some(t) = tags {
        agent.tags = t;
    }
    if let Some(st) = source_type {
        agent.source_type = Some(st.to_string());
    }
    if let Some(o) = origin {
        agent.origin = Some(o.to_string());
    }
    
    let updated = agent.clone();
    set_state(state).await?;
    
    Ok(updated)
}

pub async fn remove(id: &str) -> Result<()> {
    let mut state = get_state().await?;
    
    let initial_len = state.agents.len();
    state.agents.retain(|a| a.id != id);
    
    if state.agents.len() == initial_len {
        anyhow::bail!("Remote agent not found");
    }
    
    set_state(state).await?;
    Ok(())
}

pub async fn list() -> Result<Vec<RemoteAgent>> {
    let state = get_state().await?;
    Ok(state.agents)
}

async fn ping_single(agent: &RemoteAgent) -> (RemoteAgentStatus, Option<String>, Option<u64>) {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let base = agent.endpoint.trim_end_matches('/');
    let start = Instant::now();

    let mut request = client.get(format!("{}/health", base));
    if let Some(ref api_key) = agent.api_key {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    match request.send().await {
        Ok(response) if response.status().is_success() => {
            let latency_ms = start.elapsed().as_millis() as u64;
            let mut version: Option<String> = None;

            if let Ok(json) = response.json::<serde_json::Value>().await {
                version = json.get("version")
                    .and_then(|v| v.as_str())
                    .map(String::from);
            }

            if version.is_none() {
                if let Ok(resp) = client.get(format!("{}/__openclaw/control-ui-config.json", base)).send().await {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        version = json.get("serverVersion")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                    }
                }
            }

            (RemoteAgentStatus::Online, version, Some(latency_ms))
        }
        _ => (RemoteAgentStatus::Offline, None, Some(start.elapsed().as_millis() as u64)),
    }
}

pub async fn ping_all(state: &mut RemoteAgentsState) -> Result<()> {
    let handles: Vec<_> = state.agents
        .iter()
        .map(|agent| {
            let agent_clone = agent.clone();
            tokio::spawn(async move {
                let (status, version, latency_ms) = ping_single(&agent_clone).await;
                (agent_clone.id.clone(), status, version, latency_ms)
            })
        })
        .collect();
    
    let now = Utc::now();
    
    for handle in handles {
        if let Ok((id, status, version, latency_ms)) = handle.await {
            if let Some(agent) = state.agents.iter_mut().find(|a| a.id == id) {
                agent.status = status;
                agent.version = version;
                agent.latency_ms = latency_ms;
                agent.last_ping = Some(now);
            }
        }
    }
    
    Ok(())
}

pub async fn ping_by_id(id: &str) -> Result<RemoteAgent> {
    let mut state = get_state().await?;
    
    let agent = state.agents
        .iter()
        .find(|a| a.id == id)
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("Remote agent not found"))?;
    
    let (status, version, latency_ms) = ping_single(&agent).await;
    
    let now = Utc::now();
    if let Some(a) = state.agents.iter_mut().find(|a| a.id == id) {
        a.status = status;
        a.version = version;
        a.latency_ms = latency_ms;
        a.last_ping = Some(now);
    }
    
    set_state(state).await?;
    
    let agents = list().await?;
    let updated = agents
        .into_iter()
        .find(|a| a.id == id)
        .ok_or_else(|| anyhow::anyhow!("Remote agent not found"))?;
    
    Ok(updated)
}

pub async fn get_latest_version() -> Result<Option<String>> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    
    let response = client.get("https://registry.npmjs.org/openclaw/latest").send().await?;
    
    if !response.status().is_success() {
        return Ok(None);
    }
    
    let json: serde_json::Value = response.json().await?;
    let version = json.get("version")
        .and_then(|v| v.as_str())
        .map(String::from);
    
    Ok(version)
}
