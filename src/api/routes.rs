use axum::{
    extract::{Path, Query},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::models::{CreateMcpServerRequest, CreateProviderRequest, McpServer, McpTransport, Provider};
use crate::services;

pub fn api_routes() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/cli-tools", get(list_cli_tools))
        .route("/cli-tools/scan", post(scan_cli_tools))
        .route("/cli-tools/check-updates", post(check_updates))
        .route("/cli-tools/{name}/install", post(install_tool))
        .route("/cli-tools/{name}/upgrade", post(upgrade_tool))
        .route("/cli-tools/{name}/uninstall", post(uninstall_tool))
        .route("/providers", get(list_providers))
        .route("/providers", post(create_provider))
        .route("/providers/{id}", put(update_provider))
        .route("/providers/{id}", delete(delete_provider))
        .route("/providers/{id}/activate", post(activate_provider))
        .route("/providers/{id}/test", post(test_provider))
        .route("/mcp-servers", get(list_mcp_servers))
        .route("/mcp-servers", post(create_mcp_server))
        .route("/mcp-servers/{id}", put(update_mcp_server))
        .route("/mcp-servers/{id}", delete(delete_mcp_server))
        .route("/mcp-servers/{id}/ping", post(ping_mcp_server))
        .route("/skills", get(list_skills))
        .route("/skills/{id}/install", post(install_skill))
        .route("/skills/{id}/uninstall", post(uninstall_skill))
        .route("/settings", get(get_settings))
        .route("/settings", put(update_settings))
        .route("/logs", get(get_logs))
        .route("/config-sync", get(get_config_sync))
        .route("/config-sync/sync-all", post(sync_all_config))
        .route("/config-sync/{id}/sync", post(sync_single_config))
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn list_cli_tools() -> Result<Json<Value>, StatusCode> {
    let tools = services::version::load().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "tools": tools.tools })))
}

async fn scan_cli_tools() -> Result<Json<Value>, StatusCode> {
    let state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(state)))
}

async fn check_updates() -> Result<Json<Value>, StatusCode> {
    let mut state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::check_updates(&mut state);
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "tools": state.tools })))
}

async fn install_tool(Path(name): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::version::install(&name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let tool = state.tools.into_iter().find(|t| t.name == name);
    Ok(Json(json!(tool)))
}

async fn upgrade_tool(Path(name): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::version::upgrade(&name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let tool = state.tools.into_iter().find(|t| t.name == name);
    Ok(Json(json!(tool)))
}

async fn uninstall_tool(Path(name): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::version::uninstall(&name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn list_providers() -> Result<Json<Value>, StatusCode> {
    let providers = services::provider::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "providers": providers })))
}

async fn create_provider(Json(req): Json<CreateProviderRequest>) -> Result<Json<Value>, StatusCode> {
    let provider = services::provider::create(req.name, req.api_endpoint, req.api_key_ref, req.apps)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(provider)))
}

async fn update_provider(
    Path(id): Path<String>,
    Json(req): Json<CreateProviderRequest>,
) -> Result<Json<Value>, StatusCode> {
    let provider = Provider {
        id: id.clone(),
        name: req.name,
        api_endpoint: req.api_endpoint,
        api_key_ref: req.api_key_ref,
        active: false,
        apps: req.apps,
        created_at: chrono::Utc::now(),
        modified_at: chrono::Utc::now(),
    };

    let updated = services::provider::update(&id, provider).map_err(map_not_found)?;
    Ok(Json(json!(updated)))
}

async fn delete_provider(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let exists = services::provider::list()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .into_iter()
        .any(|p| p.id == id);
    if !exists {
        return Err(StatusCode::NOT_FOUND);
    }

    services::provider::delete(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn activate_provider(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let exists = services::provider::list()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .into_iter()
        .any(|p| p.id == id);
    if !exists {
        return Err(StatusCode::NOT_FOUND);
    }

    services::provider::activate(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn test_provider(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let providers = services::provider::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let provider = providers
        .into_iter()
        .find(|p| p.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let start = std::time::Instant::now();
    let client = reqwest::Client::new();
    // NOTE: api_key_ref is currently used directly as the API key.
    // TODO: Phase 2 — resolve key references (e.g. env var names, keychain refs)
    let result = client
        .get(format!("{}/models", provider.api_endpoint.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", provider.api_key_ref))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            let latency = start.elapsed().as_millis();
            Ok(Json(json!({ "ok": true, "latency_ms": latency })))
        }
        Ok(resp) => {
            let latency = start.elapsed().as_millis();
            Ok(Json(json!({
                "ok": false,
                "latency_ms": latency,
                "status": resp.status().as_u16()
            })))
        }
        Err(e) => Ok(Json(json!({ "ok": false, "error": e.to_string() }))),
    }
}

async fn list_mcp_servers() -> Result<Json<Value>, StatusCode> {
    let servers = services::mcp::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "servers": servers })))
}

async fn create_mcp_server(
    Json(req): Json<CreateMcpServerRequest>,
) -> Result<Json<Value>, StatusCode> {
    let server = services::mcp::create(req).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(server)))
}

async fn update_mcp_server(
    Path(id): Path<String>,
    Json(req): Json<McpServer>,
) -> Result<Json<Value>, StatusCode> {
    let server = services::mcp::update(&id, req).map_err(map_not_found)?;
    Ok(Json(json!(server)))
}

async fn delete_mcp_server(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let exists = services::mcp::list()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .into_iter()
        .any(|s| s.id == id);
    if !exists {
        return Err(StatusCode::NOT_FOUND);
    }

    services::mcp::delete(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn ping_mcp_server(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let servers = services::mcp::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let server = servers
        .into_iter()
        .find(|s| s.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;

    match server.transport {
        McpTransport::Http | McpTransport::Sse => {
            if let Some(url) = &server.url {
                let start = std::time::Instant::now();
                let client = reqwest::Client::new();
                let result = client
                    .get(url.as_str())
                    .timeout(std::time::Duration::from_secs(5))
                    .send()
                    .await;
                match result {
                    Ok(_) => {
                        let latency = start.elapsed().as_millis();
                        Ok(Json(json!({ "ok": true, "latency_ms": latency })))
                    }
                    Err(e) => Ok(Json(json!({ "ok": false, "error": e.to_string() }))),
                }
            } else {
                Ok(Json(json!({ "ok": false, "error": "no URL configured" })))
            }
        }
        McpTransport::Stdio => {
            if let Some(cmd) = &server.command {
                let exists = std::process::Command::new("which")
                    .arg(cmd.as_str())
                    .output()
                    .map(|o| o.status.success())
                    .unwrap_or(false);
                Ok(Json(json!({ "ok": exists, "transport": "stdio" })))
            } else {
                Ok(Json(json!({ "ok": false, "error": "no command configured" })))
            }
        }
    }
}

async fn list_skills() -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "skills": skills })))
}

async fn install_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::skill::install_by_id(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let skills = services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let skill = skills
        .into_iter()
        .find(|s| s.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(serde_json::to_value(skill).unwrap()))
}

async fn uninstall_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::skill::uninstall_by_id(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn get_settings() -> Result<Json<Value>, StatusCode> {
    let settings = services::settings::load().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::to_value(settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?))
}

async fn update_settings(Json(body): Json<Value>) -> Result<Json<Value>, StatusCode> {
    let settings: services::settings::Settings =
        serde_json::from_value(body).map_err(|_| StatusCode::BAD_REQUEST)?;
    services::settings::save(&settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::to_value(settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?))
}

async fn get_logs(Query(params): Query<HashMap<String, String>>) -> Result<Json<Value>, StatusCode> {
    let level = params.get("level").map(String::as_str);
    let source = params.get("source").map(String::as_str);
    let limit = params.get("limit").and_then(|s| s.parse().ok());
    let logs = services::logs::list(level, source, limit);
    Ok(Json(json!({ "logs": logs })))
}

async fn get_config_sync() -> Result<Json<Value>, StatusCode> {
    let registry = crate::adapters::registry();
    let mut entries = Vec::new();

    for adapter in registry.adapters() {
        for config_type in ["providers", "mcp_servers", "skills"] {
            entries.push(json!({
                "id": format!("{}_{}", adapter.name(), config_type),
                "app": adapter.name(),
                "config_type": config_type,
                "status": "synced",
                "last_synced": chrono::Utc::now(),
                "local_hash": "",
                "remote_hash": "",
            }));
        }
    }

    Ok(Json(json!({ "entries": entries })))
}

async fn sync_all_config() -> Result<Json<Value>, StatusCode> {
    let report = crate::sync::sync_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "sync", &format!("Sync all completed: {:?}", report));
    Ok(Json(json!({ "ok": true, "report": format!("{:?}", report) })))
}

async fn sync_single_config(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let _ = crate::sync::sync_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "sync", &format!("Sync completed for {}", id));
    Ok(Json(json!({ "id": id, "status": "synced", "last_synced": chrono::Utc::now() })))
}

fn map_not_found(err: anyhow::Error) -> StatusCode {
    if err.to_string().contains("not found") {
        StatusCode::NOT_FOUND
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}
