use anyhow::Result;
use std::collections::HashMap;

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

pub fn import_from_app(app_name: &str) -> Result<Vec<McpServer>> {
    let registry = crate::adapters::registry();
    let adapter = registry
        .find(app_name)
        .ok_or_else(|| anyhow::anyhow!("unknown app: {app_name}"))?;
    let native_config = adapter.read_mcp_config()?;
    let mut imported = Vec::new();
    let mut state = load()?;

    if let Some(servers) = native_config.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, config) in servers {
            if state.servers.iter().any(|s| s.name == *name) {
                continue;
            }

            let transport = if config.get("url").is_some() {
                if config
                    .get("transport")
                    .and_then(|v| v.as_str())
                    .map(|s| s.eq_ignore_ascii_case("sse"))
                    .unwrap_or(false)
                {
                    crate::models::McpTransport::Sse
                } else {
                    crate::models::McpTransport::Http
                }
            } else {
                crate::models::McpTransport::Stdio
            };

            let args = config
                .get("args")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(ToString::to_string))
                        .collect::<Vec<String>>()
                })
                .unwrap_or_default();

            let env = config
                .get("env")
                .and_then(|v| v.as_object())
                .map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                        .collect::<HashMap<String, String>>()
                })
                .unwrap_or_default();

            let server = McpServer {
                id: uuid::Uuid::new_v4().to_string(),
                name: name.clone(),
                transport,
                command: config.get("command").and_then(|v| v.as_str()).map(ToString::to_string),
                args,
                url: config.get("url").and_then(|v| v.as_str()).map(ToString::to_string),
                env,
                enabled_apps: vec![app_name.to_string()],
            };
            state.servers.push(server.clone());
            imported.push(server);
        }
        save(&state)?;
    }

    Ok(imported)
}
