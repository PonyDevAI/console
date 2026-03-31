use axum::{
    extract::{Multipart, Path, Query},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::models::{CreateMcpServerRequest, CreateProviderRequest, McpServer, McpTransport, SwitchMode};
use crate::models::{CreateRemoteAgentRequest, RemoteAgentsState, UpdateRemoteAgentRequest};
use crate::models::{CreateEmployeeRequest, SoulFiles, UpdateEmployeeRequest, UpdateBindingRequest};
use crate::services;
use crate::services::task_queue::{TaskQueue, TaskStatus};

#[derive(serde::Deserialize)]
struct UpdateSkillRequest {
    apps: Vec<String>,
}

#[derive(serde::Deserialize)]
struct SetSwitchModeRequest {
    mode: SwitchMode,
}

#[derive(serde::Deserialize)]
struct ImportProvidersRequest {
    data: String,
}

#[derive(serde::Deserialize)]
struct AddSkillRepoRequest {
    name: String,
    url: String,
}

#[derive(serde::Deserialize)]
struct ToggleSkillRepoRequest {
    enabled: bool,
}

#[derive(serde::Deserialize)]
struct SetModelAssignmentRequest {
    provider_id: String,
    model: String,
}

#[derive(serde::Deserialize)]
struct InstallFromUrlRequest {
    name: String,
    source_url: String,
    apps: Vec<String>,
}

pub fn api_routes() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/system/version", get(system_version))
        .route("/system/check-update", get(system_check_update))
        .route("/cli-tools", get(list_cli_tools))
        .route("/cli-tools/scan", post(scan_cli_tools))
        .route("/cli-tools/check-updates", post(check_updates))
        .route("/cli-tools/:name/check-remote", get(check_remote_version))
        .route("/providers", get(list_providers))
        .route("/providers", post(create_provider))
        .route("/providers/export", get(export_providers))
        .route("/providers/import", post(import_providers))
        .route("/providers/switch-modes", get(get_switch_modes))
        .route("/providers/switch-modes/:app", put(set_switch_mode))
        .route("/providers/:id", put(update_provider))
        .route("/providers/:id", delete(delete_provider))
        .route("/providers/:id/activate", post(activate_provider))
        .route("/providers/:id/test", post(test_provider))
        .route("/providers/:id/fetch-models", post(fetch_provider_models))
        .route("/model-assignments", get(list_model_assignments))
        .route("/model-assignments/:app", put(set_model_assignment))
        .route("/model-assignments/:app", delete(remove_model_assignment))
        .route("/model-assignments/:app/current", get(get_current_model))
        .route("/mcp-servers", get(list_mcp_servers))
        .route("/mcp-servers", post(create_mcp_server))
        .route("/mcp-servers/import-from/:app", post(import_mcp_from_app))
        .route("/mcp-servers/:id", put(update_mcp_server))
        .route("/mcp-servers/:id", delete(delete_mcp_server))
        .route("/mcp-servers/:id/ping", post(ping_mcp_server))
        .route("/skills", get(list_skills))
        .route("/skill-repos", get(list_skill_repos))
        .route("/skill-repos", post(add_skill_repo))
        .route("/skill-repos/:id", delete(remove_skill_repo))
        .route("/skill-repos/:id/toggle", post(toggle_skill_repo))
        .route("/skills/:id", put(update_skill))
        .route("/skills/:id/install", post(install_skill))
        .route("/skills/:id/uninstall", post(uninstall_skill))
        .route("/skills/:id/sync", post(sync_skill))
        .route("/skills/install-url", post(install_skill_from_url))
        .route("/skills/install-zip", post(install_skill_from_zip))
        .route("/skills/import-from/:app", post(import_skills_from_app))
        .route("/skill-repos/:id/fetch", post(fetch_skill_repo))
        .route("/skill-repos/:id/cache", get(get_skill_repo_cache))
        .route("/settings", get(get_settings))
        .route("/settings", put(update_settings))
        .route("/logs", get(get_logs))
        .route("/config-sync", get(get_config_sync))
        .route("/config-sync/sync-all", post(sync_all_config))
        .route("/config-sync/:id/sync", post(sync_single_config))
        .route("/remote-agents", get(list_remote_agents))
        .route("/remote-agents", post(add_remote_agent))
        .route("/remote-agents/ping-all", post(ping_all_remote_agents))
        .route("/remote-agents/:id/detail", get(get_remote_agent_detail))
        .route("/remote-agents/:id", put(update_remote_agent))
        .route("/remote-agents/:id", delete(delete_remote_agent))
        .route("/remote-agents/:id/ping", post(ping_remote_agent))
        .route("/remote-agents/:id/workers", get(list_remote_workers))
        .route("/employees", get(list_employees))
        .route("/employees", post(create_employee))
        .route("/employees/:id", get(get_employee))
        .route("/employees/:id", put(update_employee))
        .route("/employees/:id", delete(delete_employee))
        .route("/employees/:id/soul-files", get(get_soul_files))
        .route("/employees/:id/soul-files", put(update_soul_files))
        .route("/employees/:id/bindings", post(add_binding))
        .route("/employees/:id/bindings/:bid", put(update_binding))
        .route("/employees/:id/bindings/:bid", delete(delete_binding))
        .route("/employees/:id/bindings/:bid/test", post(test_employee_binding))
        .route("/employees/:id/history", get(get_dispatch_history))
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn system_version() -> Json<Value> {
    Json(json!({
        "version": env!("CARGO_PKG_VERSION"),
        "name": env!("CARGO_PKG_NAME"),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    }))
}

async fn system_check_update() -> Result<Json<Value>, StatusCode> {
    let current = crate::services::self_update::current_version();
    let latest = crate::services::self_update::check_latest()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({
        "current": current,
        "latest": latest,
        "update_available": crate::services::self_update::update_available(current, &latest),
    })))
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

/// 查询单个工具的远程最新版本
async fn check_remote_version(Path(name): Path<String>) -> Result<Json<Value>, StatusCode> {
    let registry = crate::adapters::registry();
    let adapter = registry.find(&name).ok_or(StatusCode::NOT_FOUND)?;
    let remote = adapter.check_remote_version().unwrap_or(None);

    // 保存远程版本到缓存
    if let Ok(mut state) = services::version::load() {
        if let Some(tool) = state.tools.iter_mut().find(|t| t.name == name) {
            tool.remote_version = remote.clone();
            let _ = services::version::save(&state);
        }
    }

    Ok(Json(json!({ "name": name, "remote_version": remote })))
}

fn spawn_tool_task(
    queue: &Arc<TaskQueue>,
    action: &str,
    name: String,
    op: fn(&str) -> anyhow::Result<()>,
) -> Json<Value> {
    let task = queue.submit(action, &name);
    let task_id = task.id.clone();
    let q = queue.clone();
    let action_label = action.to_string();
    tokio::spawn(async move {
        q.update_status(&task_id, TaskStatus::Running, Some(format!("{}ing {}...", action_label, name)));
        match tokio::task::spawn_blocking(move || op(&name)).await {
            Ok(Ok(())) => {
                let _ = tokio::task::spawn_blocking(|| {
                    if let Ok(state) = services::version::scan_all() {
                        let _ = services::version::save(&state);
                    }
                }).await;
                q.update_status(&task_id, TaskStatus::Completed, Some(format!("{} completed", action_label)));
            }
            Ok(Err(e)) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
            Err(e) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
        }
    });
    Json(json!({ "task_id": task.id, "status": "pending" }))
}

pub async fn install_tool(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    Ok(spawn_tool_task(&queue, "install", name, services::version::install))
}

pub async fn upgrade_tool(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    Ok(spawn_tool_task(&queue, "upgrade", name, services::version::upgrade))
}

pub async fn uninstall_tool(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    Ok(spawn_tool_task(&queue, "uninstall", name, services::version::uninstall))
}

pub async fn list_tasks(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
) -> Json<Value> {
    Json(json!({ "tasks": queue.list() }))
}

pub async fn get_task(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match queue.get(&id) {
        Some(task) => Ok(Json(json!(task))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn list_providers() -> Result<Json<Value>, StatusCode> {
    let providers = services::provider::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "providers": providers })))
}

async fn get_switch_modes() -> Result<Json<Value>, StatusCode> {
    let modes = services::provider::get_switch_modes().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "modes": modes })))
}

async fn set_switch_mode(
    Path(app): Path<String>,
    Json(req): Json<SetSwitchModeRequest>,
) -> Result<Json<Value>, StatusCode> {
    services::provider::set_switch_mode(&app, req.mode).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn create_provider(Json(req): Json<CreateProviderRequest>) -> Result<Json<Value>, StatusCode> {
    let provider = services::provider::create(
        req.name,
        req.api_endpoint,
        req.api_key_ref,
        req.apps,
        req.models,
    )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(provider)))
}

async fn export_providers() -> Result<Json<Value>, StatusCode> {
    let state = services::provider::export_state().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(state))
}

async fn import_providers(
    Json(req): Json<ImportProvidersRequest>,
) -> Result<Json<Value>, StatusCode> {
    let imported = services::provider::import_all(&req.data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "imported": imported })))
}

async fn update_provider(
    Path(id): Path<String>,
    Json(req): Json<CreateProviderRequest>,
) -> Result<Json<Value>, StatusCode> {
    let updated = services::provider::update_fields(
        &id,
        req.name,
        req.api_endpoint,
        req.api_key_ref,
        req.apps,
        req.models,
    )
        .map_err(map_not_found)?;
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

async fn fetch_provider_models(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let providers = services::provider::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let provider = providers
        .into_iter()
        .find(|provider| provider.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/models", provider.api_endpoint.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", provider.api_key_ref))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !response.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: Value = response
        .json()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    let models = body
        .get("data")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("id").and_then(|value| value.as_str()))
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    services::provider::update_fields(
        &provider.id,
        provider.name,
        provider.api_endpoint,
        provider.api_key_ref,
        provider.apps,
        models.clone(),
    )
    .map_err(map_not_found)?;

    Ok(Json(json!({ "models": models })))
}

async fn list_model_assignments() -> Result<Json<Value>, StatusCode> {
    let assignments = services::model_assignment::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "assignments": assignments })))
}

async fn set_model_assignment(
    Path(app): Path<String>,
    Json(req): Json<SetModelAssignmentRequest>,
) -> Result<Json<Value>, StatusCode> {
    let providers = services::provider::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let provider = providers
        .into_iter()
        .find(|provider| provider.id == req.provider_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let registry = crate::adapters::registry();
    let adapter = registry.find(&app).ok_or(StatusCode::NOT_FOUND)?;
    if !adapter.supports_model_config() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let assignment = services::model_assignment::set(app, req.provider_id, req.model.clone())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    adapter
        .write_model_config(&provider, &req.model)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!(assignment)))
}

async fn remove_model_assignment(Path(app): Path<String>) -> Result<Json<Value>, StatusCode> {
    let registry = crate::adapters::registry();
    let adapter = registry.find(&app).ok_or(StatusCode::NOT_FOUND)?;
    if !adapter.supports_model_config() {
        return Err(StatusCode::BAD_REQUEST);
    }

    services::model_assignment::remove(&app).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    adapter
        .clear_model_config()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "ok": true })))
}

async fn get_current_model(Path(app): Path<String>) -> Result<Json<Value>, StatusCode> {
    let registry = crate::adapters::registry();
    let adapter = registry.find(&app).ok_or(StatusCode::NOT_FOUND)?;
    if !adapter.supports_model_config() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let assignment = services::model_assignment::get(&app).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let current_model = adapter
        .read_model_config()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "assignment": assignment,
        "current_model": current_model,
    })))
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

async fn import_mcp_from_app(Path(app): Path<String>) -> Result<Json<Value>, StatusCode> {
    let imported = services::mcp::import_from_app(&app).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "imported": imported })))
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

async fn list_skill_repos() -> Result<Json<Value>, StatusCode> {
    let repos = services::skill::list_repos().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "repos": repos })))
}

async fn add_skill_repo(
    Json(req): Json<AddSkillRepoRequest>,
) -> Result<Json<Value>, StatusCode> {
    let repo = services::skill::add_repo(req.name, req.url).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(repo)))
}

async fn remove_skill_repo(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::skill::remove_repo(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn toggle_skill_repo(
    Path(id): Path<String>,
    Json(req): Json<ToggleSkillRepoRequest>,
) -> Result<Json<Value>, StatusCode> {
    services::skill::toggle_repo(&id, req.enabled).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
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

async fn update_skill(
    Path(id): Path<String>,
    Json(req): Json<UpdateSkillRequest>,
) -> Result<Json<Value>, StatusCode> {
    let updated = services::skill::update_apps(&id, req.apps).map_err(map_not_found)?;
    Ok(Json(serde_json::to_value(updated).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?))
}

async fn uninstall_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::skill::uninstall_by_id(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn sync_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let skill = skills.into_iter().find(|s| s.id == id).ok_or(StatusCode::NOT_FOUND)?;
    let count = services::skill_sync::sync_skill_to_apps(&skill).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "skill", &format!("Synced skill '{}' to {} apps", skill.name, count));
    Ok(Json(json!({ "ok": true, "synced_count": count })))
}

async fn fetch_skill_repo(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::fetch_repo(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "skills": skills })))
}

async fn get_skill_repo_cache(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::get_repo_cache(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "skills": skills })))
}

async fn install_skill_from_url(
    Json(req): Json<InstallFromUrlRequest>,
) -> Result<Json<Value>, StatusCode> {
    let skill = services::skill::install_from_url(&req.name, &req.source_url, req.apps)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "skill", &format!("Installed skill '{}' from URL", skill.name));
    Ok(Json(serde_json::to_value(skill).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?))
}

async fn install_skill_from_zip(
    mut multipart: Multipart,
) -> Result<Json<Value>, StatusCode> {
    let mut zip_data = Vec::new();
    while let Some(field) = multipart.next_field().await.map_err(|_| StatusCode::BAD_REQUEST)? {
        if field.name() == Some("file") {
            zip_data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?.to_vec();
            break;
        }
    }

    if zip_data.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if zip_data.len() > 50 * 1024 * 1024 {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    let installed = services::skill::install_from_zip(&zip_data)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    services::logs::push("info", "skill", &format!("Installed {} skills from ZIP", installed.len()));
    Ok(Json(json!({ "installed": installed })))
}

async fn import_skills_from_app(Path(app): Path<String>) -> Result<Json<Value>, StatusCode> {
    let imported = services::skill::import_from_app(&app)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "skill", &format!("Imported {} skills from {}", imported.len(), app));
    Ok(Json(json!({ "imported": imported })))
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
    let _ = crate::sync::sync_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "sync", "Sync all completed");

    // Rebuild entries to return full ConfigSyncEntry list
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

async fn sync_single_config(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let _ = crate::sync::sync_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "sync", &format!("Sync completed for {}", id));

    // Rebuild entries and find the matching one by id
    let registry = crate::adapters::registry();
    let mut entries = Vec::new();
    for adapter in registry.adapters() {
        for config_type in ["providers", "mcp_servers", "skills"] {
            let entry_id = format!("{}_{}", adapter.name(), config_type);
            if entry_id == id {
                entries.push(json!({
                    "id": entry_id,
                    "app": adapter.name(),
                    "config_type": config_type,
                    "status": "synced",
                    "last_synced": chrono::Utc::now(),
                    "local_hash": "",
                    "remote_hash": "",
                }));
            }
        }
    }

    // Return the matching entry or a default one
    let entry = entries.into_iter().next().unwrap_or_else(|| json!({
        "id": id,
        "app": "unknown",
        "config_type": "unknown",
        "status": "synced",
        "last_synced": chrono::Utc::now(),
        "local_hash": "",
        "remote_hash": "",
    }));
    Ok(Json(entry))
}

fn map_not_found(err: anyhow::Error) -> StatusCode {
    if err.to_string().contains("not found") {
        StatusCode::NOT_FOUND
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}

async fn list_remote_agents() -> Result<Json<Value>, StatusCode> {
    let agents = services::remote_agent::list().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "agents": agents })))
}

async fn add_remote_agent(
    Json(req): Json<CreateRemoteAgentRequest>,
) -> Result<Json<Value>, StatusCode> {
    let agent = services::remote_agent::add(
        &req.name,
        &req.display_name,
        &req.endpoint,
        req.api_key.as_deref(),
        req.tags,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(agent)))
}

async fn update_remote_agent(
    Path(id): Path<String>,
    Json(req): Json<UpdateRemoteAgentRequest>,
) -> Result<Json<Value>, StatusCode> {
    let agent = services::remote_agent::update(
        &id,
        req.display_name.as_deref(),
        req.endpoint.as_deref(),
        req.api_key.as_deref(),
        req.tags,
    )
    .await
    .map_err(map_not_found)?;
    Ok(Json(json!(agent)))
}

async fn delete_remote_agent(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::remote_agent::remove(&id).await.map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

async fn ping_remote_agent(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let agent = services::remote_agent::ping_by_id(&id).await.map_err(map_not_found)?;
    Ok(Json(json!(agent)))
}

async fn ping_all_remote_agents() -> Result<Json<Value>, StatusCode> {
    let agents = services::remote_agent::list().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut state = RemoteAgentsState { agents };
    services::remote_agent::ping_all(&mut state).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::remote_agent::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "agents": state.agents })))
}

async fn get_remote_agent_detail(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let agents = services::remote_agent::list().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let agent = agents
        .into_iter()
        .find(|a| a.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let base = agent.endpoint.trim_end_matches('/');
    let detail = match client
        .get(format!("{}/__openclaw/control-ui-config.json", base))
        .send()
        .await
    {
        Ok(resp) => resp.json::<serde_json::Value>().await.ok(),
        Err(_) => None,
    };

    let detail = match detail {
        Some(raw) => Some(json!({
            "assistant_name": raw.get("assistantName").and_then(|v| v.as_str()).unwrap_or(""),
            "assistant_avatar": raw.get("assistantAvatar").and_then(|v| v.as_str()).unwrap_or(""),
            "assistant_agent_id": raw.get("assistantAgentId").and_then(|v| v.as_str()).unwrap_or(""),
            "server_version": raw.get("serverVersion").and_then(|v| v.as_str()).unwrap_or(""),
            "base_path": raw.get("basePath").and_then(|v| v.as_str()).unwrap_or(""),
        })),
        None => None,
    };

    Ok(Json(json!({
        "id": agent.id,
        "name": agent.name,
        "display_name": agent.display_name,
        "endpoint": agent.endpoint,
        "status": agent.status,
        "version": agent.version,
        "latency_ms": agent.latency_ms,
        "last_ping": agent.last_ping,
        "created_at": agent.created_at,
        "tags": agent.tags,
        "detail": detail,
    })))
}

async fn list_remote_workers(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let agents = services::remote_agent::list().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let agent = agents
        .into_iter()
        .find(|a| a.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let base = agent.endpoint.trim_end_matches('/');
    let mut request = client.get(format!("{}/v1/models", base));
    if let Some(ref api_key) = agent.api_key {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request.send().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    if !response.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: Value = response.json().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    let workers = body
        .get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let raw_id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    if raw_id.is_empty() { return None; }
                    let final_id = if raw_id.starts_with("openclaw/") {
                        raw_id.to_string()
                    } else {
                        format!("openclaw/{}", raw_id)
                    };
                    let display_name = item.get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or(raw_id);
                    Some(json!({ "id": final_id, "display_name": display_name }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(Json(json!({ "workers": workers })))
}

async fn list_employees() -> Result<Json<Value>, StatusCode> {
    let employees = services::employee::list().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "employees": employees })))
}

#[derive(serde::Deserialize)]
struct AddBindingRequest {
    label: String,
    is_primary: bool,
    protocol: crate::models::AgentProtocol,
}

#[derive(serde::Deserialize)]
pub struct DispatchRequest {
    pub task: String,
    pub cwd: Option<String>,
    pub binding_id: Option<String>,
}

async fn create_employee(Json(req): Json<CreateEmployeeRequest>) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::create(
        &req.name,
        &req.display_name,
        &req.role,
        &req.avatar_color,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(employee)))
}

async fn get_employee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::get(&id)
        .await
        .map_err(map_not_found)?;
    let soul_files = services::employee::read_soul_files(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({
        "employee": employee,
        "soul_files": soul_files,
    })))
}

async fn update_employee(
    Path(id): Path<String>,
    Json(req): Json<UpdateEmployeeRequest>,
) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::update(
        &id,
        req.display_name.as_deref(),
        req.role.as_deref(),
        req.avatar_color.as_deref(),
    )
    .await
    .map_err(map_not_found)?;
    Ok(Json(json!(employee)))
}

async fn delete_employee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::employee::delete(&id)
        .await
        .map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

async fn get_soul_files(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let soul_files = services::employee::read_soul_files(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(soul_files)))
}

async fn update_soul_files(
    Path(id): Path<String>,
    Json(req): Json<SoulFiles>,
) -> Result<Json<Value>, StatusCode> {
    services::employee::write_soul_files(&id, &req)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn add_binding(
    Path(id): Path<String>,
    Json(req): Json<AddBindingRequest>,
) -> Result<Json<Value>, StatusCode> {
    let binding = crate::models::AgentBinding {
        id: uuid::Uuid::new_v4().to_string(),
        label: req.label,
        is_primary: req.is_primary,
        protocol: req.protocol,
    };
    let employee = services::employee::add_binding(&id, binding)
        .await
        .map_err(map_not_found)?;
    Ok(Json(json!(employee)))
}

async fn update_binding(
    Path((id, bid)): Path<(String, String)>,
    Json(req): Json<UpdateBindingRequest>,
) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::update_binding(
        &id,
        &bid,
        req.label.as_deref(),
        req.is_primary,
    )
    .await
    .map_err(map_not_found)?;
    Ok(Json(json!(employee)))
}

async fn delete_binding(
    Path((id, bid)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::delete_binding(&id, &bid)
        .await
        .map_err(map_not_found)?;
    Ok(Json(json!(employee)))
}

pub async fn dispatch_employee(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(id): Path<String>,
    Json(req): Json<DispatchRequest>,
) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::get(&id)
        .await
        .map_err(map_not_found)?;

    let binding = if let Some(bid) = &req.binding_id {
        employee.bindings
            .iter()
            .find(|b| b.id == *bid)
            .ok_or(StatusCode::NOT_FOUND)?
            .clone()
    } else {
        employee.bindings
            .iter()
            .find(|b| b.is_primary)
            .or_else(|| employee.bindings.first())
            .ok_or(StatusCode::BAD_REQUEST)?
            .clone()
    };
    
    let soul_files = services::employee::read_soul_files(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let task = queue.submit("dispatch", &employee.display_name);
    let task_id = task.id.clone();
    let q = queue.clone();
    let emp_name = employee.display_name.clone();
    let task_id_spawn = task_id.clone();
    let cwd_clone = req.cwd.clone();
    let task_str = req.task.clone();
    let id_clone = id.clone();
    let binding_clone = binding.clone();

    tokio::spawn(async move {
        q.update_status(&task_id_spawn, TaskStatus::Running,
            Some(format!("Dispatching to {}...", emp_name)));

        match services::employee_dispatch::dispatch(
            &binding_clone.protocol,
            &soul_files,
            &task_str,
            cwd_clone.as_deref(),
        ).await {
            Ok(result) => {
                services::logs::push("info", "dispatch",
                    &format!("Dispatched to {} - exit code {}", emp_name, result.exit_code));
                
                let record = crate::models::DispatchRecord {
                    id: uuid::Uuid::new_v4().to_string(),
                    task: task_str.clone(),
                    binding_label: binding_clone.label.clone(),
                    status: if result.exit_code == 0 { "completed".into() } else { "failed".into() },
                    output: result.output.clone(),
                    exit_code: result.exit_code,
                    started_at: chrono::Utc::now(),
                    completed_at: chrono::Utc::now(),
                };
                let _ = services::employee::append_dispatch_record(&id_clone, record);
                let _ = services::employee::record_dispatch_result(&id_clone, result.exit_code == 0).await;
                
                q.update_status(&task_id_spawn, TaskStatus::Completed,
                    Some(result.output));
            }
            Err(e) => {
                services::logs::push("error", "dispatch",
                    &format!("Dispatch failed: {}", e));
                q.update_status(&task_id_spawn, TaskStatus::Failed,
                    Some(e.to_string()));
                
                let record = crate::models::DispatchRecord {
                    id: uuid::Uuid::new_v4().to_string(),
                    task: task_str.clone(),
                    binding_label: binding_clone.label.clone(),
                    status: "failed".into(),
                    output: e.to_string(),
                    exit_code: -1,
                    started_at: chrono::Utc::now(),
                    completed_at: chrono::Utc::now(),
                };
                let _ = services::employee::append_dispatch_record(&id_clone, record);
                let _ = services::employee::record_dispatch_result(&id_clone, false).await;
            }
        }
    });

    Ok(Json(json!({ "task_id": task_id })))
}

async fn test_employee_binding(
    Path((id, bid)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::get(&id)
        .await
        .map_err(map_not_found)?;

    let binding = employee.bindings
        .iter()
        .find(|b| b.id == bid)
        .ok_or(StatusCode::NOT_FOUND)?;

    let start = std::time::Instant::now();

    match &binding.protocol {
        crate::models::AgentProtocol::LocalProcess { executable, .. } => {
            let exists = tokio::process::Command::new("which")
                .arg(executable.as_str())
                .output()
                .await
                .map(|o| o.status.success())
                .unwrap_or(false);
            if exists {
                Ok(Json(json!({ "ok": true, "type": "local_process", "executable": executable })))
            } else {
                Ok(Json(json!({ "ok": false, "type": "local_process", "error": format!("'{}' not found in PATH", executable) })))
            }
        }
        crate::models::AgentProtocol::OpenAiCompatible { endpoint, api_key, .. } => {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let base = endpoint.trim_end_matches('/');
            let mut req = client.get(format!("{}/v1/models", base));
            if let Some(key) = api_key {
                req = req.header("Authorization", format!("Bearer {}", key));
            }

            match req.send().await {
                Ok(resp) => {
                    let latency = start.elapsed().as_millis();
                    if resp.status().is_success() {
                        Ok(Json(json!({ "ok": true, "type": "openai_compatible", "latency_ms": latency })))
                    } else {
                        Ok(Json(json!({ "ok": false, "type": "openai_compatible", "error": format!("HTTP {}", resp.status()) })))
                    }
                }
                Err(e) => Ok(Json(json!({ "ok": false, "type": "openai_compatible", "error": e.to_string() }))),
            }
        }
        crate::models::AgentProtocol::SshExec { host, port, user, key_path, .. } => {
            let result = tokio::process::Command::new("ssh")
                .arg("-i").arg(key_path.as_str())
                .arg("-p").arg(port.to_string())
                .arg("-o").arg("ConnectTimeout=5")
                .arg("-o").arg("BatchMode=yes")
                .arg("-o").arg("StrictHostKeyChecking=accept-new")
                .arg(format!("{}@{}", user, host))
                .arg("echo ok")
                .output()
                .await;

            let latency = start.elapsed().as_millis();
            match result {
                Ok(out) if out.status.success() => {
                    Ok(Json(json!({ "ok": true, "type": "ssh_exec", "latency_ms": latency })))
                }
                Ok(out) => {
                    let err = String::from_utf8_lossy(&out.stderr).to_string();
                    Ok(Json(json!({ "ok": false, "type": "ssh_exec", "error": err })))
                }
                Err(e) => Ok(Json(json!({ "ok": false, "type": "ssh_exec", "error": e.to_string() }))),
            }
        }
    }
}

async fn get_dispatch_history(
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let history = services::employee::get_dispatch_history(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(history)))
}
