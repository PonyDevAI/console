use anyhow::Result;

use crate::models::{CreateMcpServerRequest, McpServer, McpServersState};
use crate::storage::{self, ConsolePaths};

fn load() -> Result<McpServersState> {
    let paths = ConsolePaths::default();
    storage::read_json(&paths.mcp_servers_file())
}

fn save(state: &McpServersState) -> Result<()> {
    let paths = ConsolePaths::default();
    storage::write_json(&paths.mcp_servers_file(), state)
}

pub fn list() -> Result<Vec<McpServer>> {
    Ok(load()?.servers)
}

pub fn create(req: CreateMcpServerRequest) -> Result<McpServer> {
    let mut state = load()?;
    let server = McpServer {
        id: uuid::Uuid::new_v4().to_string(),
        name: req.name,
        transport: req.transport,
        command: req.command,
        args: req.args,
        url: req.url,
        env: req.env,
        enabled_apps: req.enabled_apps,
    };
    state.servers.push(server.clone());
    save(&state)?;
    Ok(server)
}

pub fn update(id: &str, updated: McpServer) -> Result<McpServer> {
    let mut state = load()?;
    if let Some(s) = state.servers.iter_mut().find(|s| s.id == id) {
        s.name = updated.name;
        s.transport = updated.transport;
        s.command = updated.command;
        s.args = updated.args;
        s.url = updated.url;
        s.env = updated.env;
        s.enabled_apps = updated.enabled_apps;
        let result = s.clone();
        save(&state)?;
        Ok(result)
    } else {
        anyhow::bail!("MCP server not found: {id}")
    }
}

pub fn delete(id: &str) -> Result<()> {
    let mut state = load()?;
    state.servers.retain(|s| s.id != id);
    save(&state)
}

#[allow(dead_code)]
pub fn enable_for_app(id: &str, app: &str) -> Result<()> {
    let mut state = load()?;
    if let Some(s) = state.servers.iter_mut().find(|s| s.id == id) {
        if !s.enabled_apps.contains(&app.to_string()) {
            s.enabled_apps.push(app.to_string());
        }
        save(&state)
    } else {
        anyhow::bail!("MCP server not found: {id}")
    }
}

#[allow(dead_code)]
pub fn disable_for_app(id: &str, app: &str) -> Result<()> {
    let mut state = load()?;
    if let Some(s) = state.servers.iter_mut().find(|s| s.id == id) {
        s.enabled_apps.retain(|a| a != app);
        save(&state)
    } else {
        anyhow::bail!("MCP server not found: {id}")
    }
}
