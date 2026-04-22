use axum::{
    extract::{Multipart, Path, Query},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use cloudcode_contracts::agent_sources::{
    CreateAgentSourceRequest, SetDefaultModelRequest, UpdateAgentSourceRequest,
};
use cloudcode_contracts::employees::{
    CreateEmployeeRequest, PersonaFiles, SoulFiles, UpdateEmployeeRequest,
};
use cloudcode_contracts::mcp::CreateMcpServerRequest;
use cloudcode_contracts::prompts::{CreatePromptRequest, UpdatePromptRequest};
use cloudcode_contracts::providers::{
    CreateProviderRequest, ImportProvidersRequest, SetModelAssignmentRequest, SetSwitchModeRequest,
};
use cloudcode_contracts::remote_agents::{CreateRemoteAgentRequest, UpdateRemoteAgentRequest};
use cloudcode_contracts::sessions::{
    CreateProposalRequest, CreateSessionRequest, PostMessageRequest, UpdateParticipantsRequest,
    UpdateSessionTitleRequest,
};
use cloudcode_contracts::skills::{
    AddSkillRepoRequest, InstallFromUrlRequest, ToggleSkillRepoRequest, UpdateSkillRequest,
};

use crate::models::{McpServer, McpTransport, RemoteAgentsState};
use crate::services;
use crate::services::task_queue::{TaskQueue, TaskStatus};

pub fn api_routes() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/system/version", get(system_version))
        .route("/system/check-update", get(system_check_update))
        .route("/cli-tools", get(list_cli_tools))
        .route("/cli-tools/scan", post(scan_cli_tools))
        .route("/cli-tools/check-updates", post(check_updates))
        .route("/cli-tools/:name/check-remote", get(check_remote_version))
        .route("/agent-sources", get(list_agent_sources))
        .route("/agent-sources", post(create_agent_source))
        .route("/agent-sources/scan", post(scan_agent_sources))
        .route(
            "/agent-sources/check-updates",
            post(check_agent_source_updates),
        )
        .route("/agent-sources/:id", get(get_agent_source))
        .route("/agent-sources/:id", put(update_agent_source))
        .route("/agent-sources/:id", delete(delete_agent_source))
        .route(
            "/agent-sources/:id/check-update",
            post(check_single_agent_source_update),
        )
        .route("/agent-sources/:id/test", post(test_agent_source))
        .route("/agent-sources/:id/models", get(get_agent_source_models))
        .route(
            "/agent-sources/:id/default-model",
            put(set_agent_source_default_model),
        )
        .route("/agent-sources/:id/agents", get(list_agent_source_agents))
        .route("/agents", get(list_agents))
        .route("/agents/:id", get(get_agent))
        .route("/agents/source/:source_id", get(get_agents_by_source))
        .route(
            "/agents/source/:source_id/remote",
            get(fetch_remote_agents_for_source),
        )
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
        .route("/backups", get(list_backups))
        .route("/backups", post(create_backup))
        .route("/backups/:id/restore", post(restore_backup))
        .route("/backups/:id", delete(delete_backup))
        .route("/remote-agents", get(list_remote_agents))
        .route("/remote-agents", post(add_remote_agent))
        .route("/remote-agents/ping-all", post(ping_all_remote_agents))
        .route(
            "/remote-agents/latest-version",
            get(get_remote_agent_latest_version),
        )
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
        .route("/employees/:id/persona-files", get(get_persona_files))
        .route("/employees/:id/persona-files", put(update_persona_files))
        .route("/employees/:id/test", post(test_employee))
        .route("/employees/:id/bindings", post(add_binding))
        .route("/employees/:id/bindings/:bid", put(update_binding))
        .route("/employees/:id/bindings/:bid", delete(delete_binding))
        .route(
            "/employees/:id/bindings/:bid/test",
            post(test_employee_binding),
        )
        .route("/employees/:id/history", get(get_dispatch_history))
        .route("/prompts", get(list_prompts))
        .route("/prompts", post(create_prompt))
        .route("/prompts/:id", put(update_prompt))
        .route("/prompts/:id", delete(delete_prompt))
        .route("/prompts/:id/activate", post(activate_prompt))
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
        q.update_status(
            &task_id,
            TaskStatus::Running,
            Some(format!("{}ing {}...", action_label, name)),
        );
        match tokio::task::spawn_blocking(move || op(&name)).await {
            Ok(Ok(())) => {
                let _ = tokio::task::spawn_blocking(|| {
                    if let Ok(state) = services::version::scan_all() {
                        let _ = services::version::save(&state);
                    }
                })
                .await;
                q.update_status(
                    &task_id,
                    TaskStatus::Completed,
                    Some(format!("{} completed", action_label)),
                );
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

async fn list_agent_sources() -> Result<Json<Value>, StatusCode> {
    let sources = services::agent_source::list_agent_sources()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "sources": sources })))
}

async fn get_agent_source(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let source = services::agent_source::get_source(&id).map_err(|_| StatusCode::NOT_FOUND)?;
    Ok(Json(json!(source)))
}

async fn create_agent_source(
    Json(req): Json<CreateAgentSourceRequest>,
) -> Result<Json<Value>, StatusCode> {
    let source_type = match req.source_type.as_str() {
        "remote_openclaw_ws" => crate::models::AgentSourceType::RemoteOpenClawWs,
        "openai_compatible" => crate::models::AgentSourceType::OpenAiCompatible,
        "remote_agent" => crate::models::AgentSourceType::RemoteAgent,
        _ => crate::models::AgentSourceType::LocalCli,
    };

    let source = tokio::task::spawn_blocking(move || {
        services::agent_source::add_source(
            &req.name,
            &req.display_name,
            req.endpoint.as_deref().unwrap_or(""),
            req.api_key.as_deref(),
            source_type,
            req.origin.as_deref(),
        )
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!(source)))
}

async fn update_agent_source(
    Path(id): Path<String>,
    Json(req): Json<UpdateAgentSourceRequest>,
) -> Result<Json<Value>, StatusCode> {
    let source = tokio::task::spawn_blocking(move || {
        services::agent_source::update_source(
            &id,
            req.display_name.as_deref(),
            req.endpoint.as_deref(),
            req.api_key.as_deref(),
            req.origin.as_deref(),
        )
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(map_not_found)?;

    Ok(Json(json!(source)))
}

async fn delete_agent_source(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    tokio::task::spawn_blocking(move || services::agent_source::delete_source(&id))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map_err(map_not_found)?;

    Ok(Json(json!({ "ok": true })))
}

async fn scan_agent_sources() -> Result<Json<Value>, StatusCode> {
    let state = services::agent_source::scan_all_with_refresh()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(state)))
}

async fn check_agent_source_updates() -> Result<Json<Value>, StatusCode> {
    let state =
        services::agent_source::check_updates().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(state)))
}

pub async fn scan_single_agent_source(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let task = queue.submit("scan", &id);
    let task_id = task.id.clone();
    let q = queue.clone();
    let source_id = id.clone();
    tokio::spawn(async move {
        q.update_status(
            &task_id,
            TaskStatus::Running,
            Some(format!("Scanning {}...", source_id)),
        );
        match tokio::task::spawn_blocking(move || {
            let state = services::agent_source::scan_all()?;
            services::agent_source::save(&state)
        })
        .await
        {
            Ok(Ok(())) => {
                q.update_status(
                    &task_id,
                    TaskStatus::Completed,
                    Some("Scan completed".into()),
                );
            }
            Ok(Err(e)) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
            Err(e) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
        }
    });
    Ok(Json(json!({ "task_id": task.id, "status": "pending" })))
}

pub async fn install_agent_source(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let task = queue.submit("install", &id);
    let task_id = task.id.clone();
    let q = queue.clone();
    let source_id = id.clone();
    tokio::spawn(async move {
        q.update_status(
            &task_id,
            TaskStatus::Running,
            Some(format!("Installing {}...", source_id)),
        );
        match tokio::task::spawn_blocking(move || services::agent_source::install(&source_id)).await
        {
            Ok(Ok(())) => {
                if let Ok(state) = services::agent_source::scan_all() {
                    let _ = services::agent_source::save(&state);
                }
                q.update_status(
                    &task_id,
                    TaskStatus::Completed,
                    Some("Install completed".into()),
                );
            }
            Ok(Err(e)) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
            Err(e) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
        }
    });
    Ok(Json(json!({ "task_id": task.id, "status": "pending" })))
}

pub async fn upgrade_agent_source(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let task = queue.submit("upgrade", &id);
    let task_id = task.id.clone();
    let q = queue.clone();
    let source_id = id.clone();
    tokio::spawn(async move {
        q.update_status(
            &task_id,
            TaskStatus::Running,
            Some(format!("Upgrading {}...", source_id)),
        );
        match tokio::task::spawn_blocking(move || services::agent_source::upgrade(&source_id)).await
        {
            Ok(Ok(())) => {
                if let Ok(state) = services::agent_source::scan_all() {
                    let _ = services::agent_source::save(&state);
                }
                q.update_status(
                    &task_id,
                    TaskStatus::Completed,
                    Some("Upgrade completed".into()),
                );
            }
            Ok(Err(e)) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
            Err(e) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
        }
    });
    Ok(Json(json!({ "task_id": task.id, "status": "pending" })))
}

pub async fn uninstall_agent_source(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let task = queue.submit("uninstall", &id);
    let task_id = task.id.clone();
    let q = queue.clone();
    let source_id = id.clone();
    tokio::spawn(async move {
        q.update_status(
            &task_id,
            TaskStatus::Running,
            Some(format!("Uninstalling {}...", source_id)),
        );
        match tokio::task::spawn_blocking(move || services::agent_source::uninstall(&source_id))
            .await
        {
            Ok(Ok(())) => {
                if let Ok(state) = services::agent_source::scan_all() {
                    let _ = services::agent_source::save(&state);
                }
                q.update_status(
                    &task_id,
                    TaskStatus::Completed,
                    Some("Uninstall completed".into()),
                );
            }
            Ok(Err(e)) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
            Err(e) => {
                q.update_status(&task_id, TaskStatus::Failed, Some(e.to_string()));
            }
        }
    });
    Ok(Json(json!({ "task_id": task.id, "status": "pending" })))
}

async fn check_single_agent_source_update(
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let remote = services::agent_source::check_remote_version(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "source_id": id, "remote_version": remote })))
}

async fn test_agent_source(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let source = services::agent_source::get_source(&id).map_err(|_| StatusCode::NOT_FOUND)?;

    match source.source_type {
        crate::models::AgentSourceType::RemoteOpenClawWs => {
            let result = services::openclaw::test_source(&source).await;
            if !result.ok {
                tracing::warn!(
                    "OpenClaw source {} health check failed: {:?}",
                    id,
                    result.error
                );
            }
            Ok(Json(json!({
                "ok": result.ok,
                "type": "remote_openclaw_ws",
                "version": result.version,
                "default_agent_id": result.default_agent_id,
                "latency_ms": result.latency_ms,
                "error": result.error,
            })))
        }
        _ => {
            let healthy = services::agent_source::test_source(&id)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(json!({ "source_id": id, "healthy": healthy })))
        }
    }
}

async fn get_agent_source_models(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let source = services::agent_source::get_source(&id).map_err(|_| StatusCode::NOT_FOUND)?;

    match source.source_type {
        crate::models::AgentSourceType::RemoteOpenClawWs => {
            let result = services::openclaw::list_models(&source)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to list OpenClaw models: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            Ok(Json(json!({
                "source_id": id,
                "current_model": null,
                "default_model": null,
                "supported_models": result.models,
            })))
        }
        _ => {
            let current = services::agent_source::read_current_model(&id)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let supported = services::agent_source::supported_models(&id)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(json!({
                "source_id": id,
                "current_model": current,
                "default_model": source.default_model,
                "supported_models": supported,
            })))
        }
    }
}

async fn set_agent_source_default_model(
    Path(id): Path<String>,
    Json(req): Json<SetDefaultModelRequest>,
) -> Result<Json<Value>, StatusCode> {
    services::agent_source::set_default_model(&id, &req.model).map_err(|e| {
        tracing::error!("Failed to set default model: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(json!({ "source_id": id, "default_model": req.model })))
}

async fn list_agent_source_agents(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let source = services::agent_source::get_source(&id).map_err(|_| StatusCode::NOT_FOUND)?;

    match source.source_type {
        crate::models::AgentSourceType::RemoteOpenClawWs => {
            let result = services::openclaw::list_agents(&source)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to list OpenClaw agents: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            Ok(Json(json!({ "agents": result.agents })))
        }
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

#[allow(dead_code)]
async fn list_openclaw_models(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let source = services::agent_source::get_source(&id).map_err(|_| StatusCode::NOT_FOUND)?;

    match source.source_type {
        crate::models::AgentSourceType::RemoteOpenClawWs => {
            let result = services::openclaw::list_models(&source)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to list OpenClaw models: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            Ok(Json(json!({ "models": result.models })))
        }
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

async fn list_agents() -> Result<Json<Value>, StatusCode> {
    let agents =
        services::agent_registry::list_agents().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "agents": agents })))
}

async fn get_agent(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let agent = services::agent_registry::get_agent(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(json!(agent)))
}

async fn get_agents_by_source(Path(source_id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let agents = services::agent_registry::get_agents_by_source(&source_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "agents": agents })))
}

async fn fetch_remote_agents_for_source(
    Path(source_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let agents = services::agent_registry::fetch_remote_agents_from_source(&source_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch remote agents: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!({ "agents": agents })))
}

pub async fn install_tool(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    Ok(spawn_tool_task(
        &queue,
        "install",
        name,
        services::version::install,
    ))
}

pub async fn upgrade_tool(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    Ok(spawn_tool_task(
        &queue,
        "upgrade",
        name,
        services::version::upgrade,
    ))
}

pub async fn uninstall_tool(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
    Path(name): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    Ok(spawn_tool_task(
        &queue,
        "uninstall",
        name,
        services::version::uninstall,
    ))
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
    let modes =
        services::provider::get_switch_modes().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "modes": modes })))
}

async fn set_switch_mode(
    Path(app): Path<String>,
    Json(req): Json<SetSwitchModeRequest>,
) -> Result<Json<Value>, StatusCode> {
    services::provider::set_switch_mode(&app, req.mode)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn create_provider(
    Json(req): Json<CreateProviderRequest>,
) -> Result<Json<Value>, StatusCode> {
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
    let state =
        services::provider::export_state().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(state))
}

async fn import_providers(
    Json(req): Json<ImportProvidersRequest>,
) -> Result<Json<Value>, StatusCode> {
    let imported =
        services::provider::import_all(&req.data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
        .get(format!(
            "{}/models",
            provider.api_endpoint.trim_end_matches('/')
        ))
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
        .get(format!(
            "{}/models",
            provider.api_endpoint.trim_end_matches('/')
        ))
        .header("Authorization", format!("Bearer {}", provider.api_key_ref))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    if !response.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }

    let body: Value = response.json().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
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
    let assignments =
        services::model_assignment::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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

    let assignment =
        services::model_assignment::get(&app).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
    let imported =
        services::mcp::import_from_app(&app).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
                Ok(Json(
                    json!({ "ok": false, "error": "no command configured" }),
                ))
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

async fn add_skill_repo(Json(req): Json<AddSkillRepoRequest>) -> Result<Json<Value>, StatusCode> {
    let repo = services::skill::add_repo(req.name, req.url)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
    services::skill::toggle_repo(&id, req.enabled)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
    Ok(Json(
        serde_json::to_value(updated).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    ))
}

async fn uninstall_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::skill::uninstall_by_id(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn sync_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let skill = skills
        .into_iter()
        .find(|s| s.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    let count = services::skill_sync::sync_skill_to_apps(&skill)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push(
        "info",
        "skill",
        &format!("Synced skill '{}' to {} apps", skill.name, count),
    );
    Ok(Json(json!({ "ok": true, "synced_count": count })))
}

async fn fetch_skill_repo(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::fetch_repo(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "skills": skills })))
}

async fn get_skill_repo_cache(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let skills =
        services::skill::get_repo_cache(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "skills": skills })))
}

async fn install_skill_from_url(
    Json(req): Json<InstallFromUrlRequest>,
) -> Result<Json<Value>, StatusCode> {
    let skill = services::skill::install_from_url(&req.name, &req.source_url, req.apps)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push(
        "info",
        "skill",
        &format!("Installed skill '{}' from URL", skill.name),
    );
    Ok(Json(
        serde_json::to_value(skill).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    ))
}

async fn install_skill_from_zip(mut multipart: Multipart) -> Result<Json<Value>, StatusCode> {
    let mut zip_data = Vec::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        if field.name() == Some("file") {
            zip_data = field
                .bytes()
                .await
                .map_err(|_| StatusCode::BAD_REQUEST)?
                .to_vec();
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

    services::logs::push(
        "info",
        "skill",
        &format!("Installed {} skills from ZIP", installed.len()),
    );
    Ok(Json(json!({ "installed": installed })))
}

async fn import_skills_from_app(Path(app): Path<String>) -> Result<Json<Value>, StatusCode> {
    let imported =
        services::skill::import_from_app(&app).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push(
        "info",
        "skill",
        &format!("Imported {} skills from {}", imported.len(), app),
    );
    Ok(Json(json!({ "imported": imported })))
}

async fn get_settings() -> Result<Json<Value>, StatusCode> {
    let settings = services::settings::load().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(
        serde_json::to_value(settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    ))
}

async fn update_settings(Json(body): Json<Value>) -> Result<Json<Value>, StatusCode> {
    let settings: services::settings::Settings =
        serde_json::from_value(body).map_err(|_| StatusCode::BAD_REQUEST)?;
    services::settings::save(&settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(
        serde_json::to_value(settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    ))
}

async fn get_logs(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, StatusCode> {
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
    let entry = entries.into_iter().next().unwrap_or_else(|| {
        json!({
            "id": id,
            "app": "unknown",
            "config_type": "unknown",
            "status": "synced",
            "last_synced": chrono::Utc::now(),
            "local_hash": "",
            "remote_hash": "",
        })
    });
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
    let agents = services::remote_agent::list()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "agents": agents })))
}

async fn add_remote_agent(
    Json(req): Json<CreateRemoteAgentRequest>,
) -> Result<Json<Value>, StatusCode> {
    if req.source_type.as_deref() == Some("openclaw_ws") {
        let source = tokio::task::spawn_blocking(move || {
            services::agent_source::add_source(
                &req.name,
                &req.display_name,
                &req.endpoint,
                req.api_key.as_deref(),
                crate::models::AgentSourceType::RemoteOpenClawWs,
                req.origin.as_deref(),
            )
        })
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok(Json(json!(source)));
    }

    let agent = services::remote_agent::add(
        &req.name,
        &req.display_name,
        &req.endpoint,
        req.api_key.as_deref(),
        req.tags,
        req.source_type.as_deref(),
        req.origin.as_deref(),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(agent)))
}

async fn update_remote_agent(
    Path(id): Path<String>,
    Json(req): Json<UpdateRemoteAgentRequest>,
) -> Result<Json<Value>, StatusCode> {
    if req.source_type.as_deref() == Some("openclaw_ws") {
        let display_name = req.display_name.clone();
        let endpoint = req.endpoint.clone();
        let api_key = req.api_key.clone();
        let origin = req.origin.clone();

        let updated = tokio::task::spawn_blocking(move || {
            services::agent_source::update_source(
                &id,
                display_name.as_deref(),
                endpoint.as_deref(),
                api_key.as_deref(),
                origin.as_deref(),
            )
        })
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map_err(map_not_found)?;
        return Ok(Json(json!(updated)));
    }

    let agent = services::remote_agent::update(
        &id,
        req.display_name.as_deref(),
        req.endpoint.as_deref(),
        req.api_key.as_deref(),
        req.tags,
        req.source_type.as_deref(),
        req.origin.as_deref(),
    )
    .await
    .map_err(map_not_found)?;
    Ok(Json(json!(agent)))
}

async fn delete_remote_agent(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let source_result = tokio::task::spawn_blocking({
        let id = id.clone();
        move || services::agent_source::get_source_by_id(&id)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(source) = source_result {
        if source.source_type == crate::models::AgentSourceType::RemoteOpenClawWs {
            let id_for_delete = id.clone();
            tokio::task::spawn_blocking(move || {
                services::agent_source::delete_source(&id_for_delete)
            })
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .map_err(map_not_found)?;
            return Ok(Json(json!({ "ok": true })));
        }
    }

    services::remote_agent::remove(&id)
        .await
        .map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

async fn ping_remote_agent(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let agent = services::remote_agent::ping_by_id(&id)
        .await
        .map_err(map_not_found)?;
    Ok(Json(json!(agent)))
}

async fn ping_all_remote_agents() -> Result<Json<Value>, StatusCode> {
    let agents = services::remote_agent::list()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut state = RemoteAgentsState { agents };
    services::remote_agent::ping_all(&mut state)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::remote_agent::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "agents": state.agents })))
}

async fn get_remote_agent_latest_version() -> Result<Json<Value>, StatusCode> {
    let latest = services::remote_agent::get_latest_version()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "latest_version": latest })))
}

async fn get_remote_agent_detail(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let agents = services::remote_agent::list()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
    let agents = services::remote_agent::list()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
                    if raw_id.is_empty() {
                        return None;
                    }
                    let final_id = if raw_id.starts_with("openclaw/") {
                        raw_id.to_string()
                    } else {
                        format!("openclaw/{}", raw_id)
                    };
                    let display_name = item.get("name").and_then(|v| v.as_str()).unwrap_or(raw_id);
                    Some(json!({ "id": final_id, "display_name": display_name }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(Json(json!({ "workers": workers })))
}

async fn list_employees() -> Result<Json<Value>, StatusCode> {
    let employees = services::employee::list_employees_with_status()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
}

#[derive(serde::Deserialize)]
struct UpdateBindingRequest {
    label: Option<String>,
    is_primary: Option<bool>,
    protocol: Option<crate::models::AgentProtocol>,
}

#[derive(serde::Deserialize)]
pub struct ReviewProposalRequest {
    reviewer_employee_id: String,
}

#[derive(serde::Deserialize)]
pub struct ReviseProposalRequest {
    description: Option<String>,
}

#[derive(serde::Deserialize)]
struct CreateBackupRequest {
    label: Option<String>,
}

async fn create_employee(
    Json(req): Json<CreateEmployeeRequest>,
) -> Result<Json<Value>, StatusCode> {
    let employee_type = match req.employee_type.as_deref() {
        Some("local") => Some(crate::models::EmployeeType::Local),
        Some("remote") => Some(crate::models::EmployeeType::Remote),
        Some(_) => return Err(StatusCode::BAD_REQUEST),
        None => None,
    };

    let employee = services::employee::create(
        &req.name,
        req.display_name.as_deref(),
        &req.agent_id,
        req.model.as_deref(),
        req.avatar_color.as_deref(),
        req.tags.clone(),
        req.role.as_deref(),
        employee_type,
        req.source_id.as_deref(),
        req.remote_agent_name.as_deref(),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(employee)))
}

async fn get_employee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::get_employee_with_status(&id)
        .await
        .map_err(map_not_found)?;
    let persona_files = services::employee::read_persona_files(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({
        "employee": employee,
        "persona_files": persona_files,
    })))
}

async fn update_employee(
    Path(id): Path<String>,
    Json(req): Json<UpdateEmployeeRequest>,
) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::update(
        &id,
        req.display_name.as_deref(),
        req.agent_id.as_deref(),
        req.model.as_deref(),
        req.avatar_color.as_deref(),
        req.tags,
        req.role.as_deref(),
        req.source_id.as_deref(),
        req.remote_agent_name.as_deref(),
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
    let soul_files =
        services::employee::read_soul_files(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(soul_files)))
}

async fn update_soul_files(
    Path(id): Path<String>,
    Json(req): Json<SoulFiles>,
) -> Result<Json<Value>, StatusCode> {
    let persona = PersonaFiles {
        identity: String::new(),
        soul: req.soul,
        skills: req.skills,
        rules: req.rules,
    };
    services::employee::write_persona_files(&id, &persona)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn get_persona_files(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let persona_files = services::employee::read_persona_files(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(persona_files)))
}

async fn update_persona_files(
    Path(id): Path<String>,
    Json(req): Json<PersonaFiles>,
) -> Result<Json<Value>, StatusCode> {
    services::employee::write_persona_files(&id, &req)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}

async fn test_employee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::get_employee_with_status(&id)
        .await
        .map_err(map_not_found)?;

    let agent_id = match &employee.agent_id {
        Some(id) => id.clone(),
        None => {
            let resolved = services::employee::resolve_agent_id_for_employee(&employee);
            if resolved == "unresolved" {
                return Ok(Json(json!({
                    "ok": false,
                    "error": "Employee has no agent. Please rebind this employee to an agent."
                })));
            }
            resolved
        }
    };

    let agent = match services::agent_registry::get_agent(&agent_id) {
        Ok(Some(a)) => a,
        Ok(None) => {
            return Ok(Json(json!({
                "ok": false,
                "error": "Employee has no agent. Please rebind this employee to an agent."
            })));
        }
        Err(_) => {
            return Ok(Json(json!({
                "ok": false,
                "error": "Failed to get agent for employee."
            })));
        }
    };

    let source = match services::agent_source::get_source(&agent.source_id) {
        Ok(s) => s,
        Err(_) => {
            return Ok(Json(json!({
                "ok": false,
                "error": "Agent source not found."
            })));
        }
    };

    let start = std::time::Instant::now();

    match source.source_type {
        crate::models::AgentSourceType::LocalCli => {
            if !source.installed {
                return Ok(Json(json!({
                    "ok": false,
                    "type": "local_cli",
                    "error": format!("{} is not installed", source.display_name)
                })));
            }
            let executable = source.executable.as_deref().unwrap_or(&source.name);
            let exists = tokio::process::Command::new("which")
                .arg(executable)
                .output()
                .await
                .map(|o| o.status.success())
                .unwrap_or(false);
            if exists {
                let latency = start.elapsed().as_millis();
                Ok(Json(json!({
                    "ok": true,
                    "type": "local_cli",
                    "executable": executable,
                    "latency_ms": latency
                })))
            } else {
                Ok(Json(json!({
                    "ok": false,
                    "type": "local_cli",
                    "error": format!("'{}' not found in PATH", executable)
                })))
            }
        }
        crate::models::AgentSourceType::OpenAiCompatible => {
            let endpoint = source
                .endpoint
                .as_ref()
                .ok_or_else(|| StatusCode::BAD_REQUEST)?;
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let base = endpoint.trim_end_matches('/');
            let mut req_builder = client.get(format!("{}/v1/models", base));
            if let Some(ref api_key) = source.api_key {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", api_key));
            }

            match req_builder.send().await {
                Ok(resp) => {
                    let latency = start.elapsed().as_millis();
                    if resp.status().is_success() {
                        Ok(Json(json!({
                            "ok": true,
                            "type": "openai_compatible",
                            "latency_ms": latency
                        })))
                    } else {
                        Ok(Json(json!({
                            "ok": false,
                            "type": "openai_compatible",
                            "error": format!("HTTP {}", resp.status())
                        })))
                    }
                }
                Err(e) => Ok(Json(json!({
                    "ok": false,
                    "type": "openai_compatible",
                    "error": e.to_string()
                }))),
            }
        }
        crate::models::AgentSourceType::RemoteAgent => {
            let endpoint = source
                .endpoint
                .as_ref()
                .ok_or_else(|| StatusCode::BAD_REQUEST)?;

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let base = endpoint.trim_end_matches('/');
            let mut req_builder = client.get(format!("{}/health", base));
            if let Some(ref api_key) = source.api_key {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", api_key));
            }

            let latency = start.elapsed().as_millis();

            match req_builder.send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        Ok(Json(json!({
                            "ok": true,
                            "type": "remote_agent",
                            "agent_id": agent.id,
                            "latency_ms": latency
                        })))
                    } else {
                        Ok(Json(json!({
                            "ok": false,
                            "type": "remote_agent",
                            "error": format!("HTTP {}", resp.status())
                        })))
                    }
                }
                Err(e) => Ok(Json(json!({
                    "ok": false,
                    "type": "remote_agent",
                    "error": e.to_string()
                }))),
            }
        }
        crate::models::AgentSourceType::RemoteOpenClawWs => {
            let result = services::openclaw::test_source(&source).await;
            Ok(Json(json!({
                "ok": result.ok,
                "type": "remote_openclaw_ws",
                "version": result.version,
                "default_agent_id": result.default_agent_id,
                "latency_ms": result.latency_ms,
                "error": result.error
            })))
        }
    }
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
        req.protocol,
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
    let employee = services::employee::get(&id).await.map_err(map_not_found)?;

    let agent_id = match &employee.agent_id {
        Some(id) => id.clone(),
        None => {
            let resolved = services::employee::resolve_agent_id_for_employee(&employee);
            if resolved == "unresolved" {
                return Ok(Json(json!({
                    "error": "Employee has no agent. Please rebind this employee to an agent."
                })));
            }
            resolved
        }
    };

    let agent = match services::agent_registry::get_agent(&agent_id) {
        Ok(Some(a)) => a,
        Ok(None) => {
            return Ok(Json(json!({
                "error": "Employee has no agent. Please rebind this employee to an agent."
            })));
        }
        Err(_) => {
            return Ok(Json(json!({
                "error": "Failed to get agent for employee."
            })));
        }
    };

    let source = match services::agent_source::get_source(&agent.source_id) {
        Ok(s) => s,
        Err(_) => {
            return Ok(Json(json!({
                "error": "Agent source not found."
            })));
        }
    };

    let persona = if source.source_type == crate::models::AgentSourceType::LocalCli {
        services::employee::read_persona_files(&id)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        PersonaFiles::default()
    };

    let task = queue.submit("dispatch", &employee.display_name);
    let task_id = task.id.clone();
    let q = queue.clone();
    let emp_name = employee.display_name.clone();
    let emp_id = id.clone();
    let task_id_spawn = task_id.clone();
    let cwd_clone = req.cwd.clone();
    let task_str = req.task.clone();
    let source_clone = source.clone();
    let agent_clone = agent.clone();
    let employee_clone = employee.clone();

    tokio::spawn(async move {
        let started_at = chrono::Utc::now();
        q.update_status(
            &task_id_spawn,
            TaskStatus::Running,
            Some(format!("Dispatching to {}...", emp_name)),
        );

        match services::employee_dispatch::dispatch_via_agent(
            &agent_clone,
            &source_clone,
            &employee_clone,
            &persona,
            &task_str,
            cwd_clone.as_deref(),
        )
        .await
        {
            Ok(result) => {
                services::logs::push(
                    "info",
                    "dispatch",
                    &format!(
                        "Dispatched to {} - exit code {}",
                        emp_name, result.exit_code
                    ),
                );

                let record = crate::models::DispatchRecord {
                    id: uuid::Uuid::new_v4().to_string(),
                    task: task_str.clone(),
                    binding_label: source_clone.name.clone(),
                    status: if result.exit_code == 0 {
                        "completed".into()
                    } else {
                        "failed".into()
                    },
                    output: result.output.clone(),
                    exit_code: result.exit_code,
                    started_at,
                    completed_at: chrono::Utc::now(),
                };
                let _ = services::employee::append_dispatch_record(&emp_id, record);
                let _ = services::employee::record_dispatch_result(&emp_id, result.exit_code == 0)
                    .await;

                q.update_status(&task_id_spawn, TaskStatus::Completed, Some(result.output));
            }
            Err(e) => {
                services::logs::push("error", "dispatch", &format!("Dispatch failed: {}", e));
                q.update_status(&task_id_spawn, TaskStatus::Failed, Some(e.to_string()));

                let record = crate::models::DispatchRecord {
                    id: uuid::Uuid::new_v4().to_string(),
                    task: task_str.clone(),
                    binding_label: source_clone.name.clone(),
                    status: "failed".into(),
                    output: e.to_string(),
                    exit_code: -1,
                    started_at,
                    completed_at: chrono::Utc::now(),
                };
                let _ = services::employee::append_dispatch_record(&emp_id, record);
                let _ = services::employee::record_dispatch_result(&emp_id, false).await;
            }
        }
    });

    Ok(Json(json!({ "task_id": task_id })))
}

async fn test_employee_binding(
    Path((id, bid)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    let employee = services::employee::get(&id).await.map_err(map_not_found)?;

    let bindings = employee.bindings.as_ref().ok_or(StatusCode::BAD_REQUEST)?;
    let binding = bindings
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
                Ok(Json(
                    json!({ "ok": true, "type": "local_process", "executable": executable }),
                ))
            } else {
                Ok(Json(
                    json!({ "ok": false, "type": "local_process", "error": format!("'{}' not found in PATH", executable) }),
                ))
            }
        }
        crate::models::AgentProtocol::OpenAiCompatible {
            endpoint, api_key, ..
        } => {
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
                        Ok(Json(
                            json!({ "ok": true, "type": "openai_compatible", "latency_ms": latency }),
                        ))
                    } else {
                        Ok(Json(
                            json!({ "ok": false, "type": "openai_compatible", "error": format!("HTTP {}", resp.status()) }),
                        ))
                    }
                }
                Err(e) => Ok(Json(
                    json!({ "ok": false, "type": "openai_compatible", "error": e.to_string() }),
                )),
            }
        }
        crate::models::AgentProtocol::SshExec {
            host,
            port,
            user,
            key_path,
            ..
        } => {
            let result = tokio::process::Command::new("ssh")
                .arg("-i")
                .arg(key_path.as_str())
                .arg("-p")
                .arg(port.to_string())
                .arg("-o")
                .arg("ConnectTimeout=5")
                .arg("-o")
                .arg("BatchMode=yes")
                .arg("-o")
                .arg("StrictHostKeyChecking=accept-new")
                .arg(format!("{}@{}", user, host))
                .arg("echo ok")
                .output()
                .await;

            let latency = start.elapsed().as_millis();
            match result {
                Ok(out) if out.status.success() => Ok(Json(
                    json!({ "ok": true, "type": "ssh_exec", "latency_ms": latency }),
                )),
                Ok(out) => {
                    let err = String::from_utf8_lossy(&out.stderr).to_string();
                    Ok(Json(
                        json!({ "ok": false, "type": "ssh_exec", "error": err }),
                    ))
                }
                Err(e) => Ok(Json(
                    json!({ "ok": false, "type": "ssh_exec", "error": e.to_string() }),
                )),
            }
        }
    }
}

async fn get_dispatch_history(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let history = services::employee::get_dispatch_history(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(history)))
}

async fn list_prompts() -> Result<Json<Value>, StatusCode> {
    let prompts = services::prompt::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "prompts": prompts })))
}

async fn create_prompt(Json(req): Json<CreatePromptRequest>) -> Result<Json<Value>, StatusCode> {
    let preset = crate::models::PromptPreset {
        id: uuid::Uuid::new_v4().to_string(),
        name: req.name,
        content: req.content,
        active: false,
        apps: req.apps,
        created_at: chrono::Utc::now(),
        modified_at: chrono::Utc::now(),
    };
    let created =
        services::prompt::create(preset).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(created)))
}

async fn update_prompt(
    Path(id): Path<String>,
    Json(req): Json<UpdatePromptRequest>,
) -> Result<Json<Value>, StatusCode> {
    let updated =
        services::prompt::update(&id, req.name.as_deref(), req.content.as_deref(), req.apps)
            .map_err(map_not_found)?;
    Ok(Json(json!(updated)))
}

async fn delete_prompt(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::prompt::delete(&id).map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

async fn activate_prompt(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::prompt::activate(&id).map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

async fn list_backups() -> Result<Json<Value>, StatusCode> {
    let backups = services::backup::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "backups": backups })))
}

async fn create_backup(Json(req): Json<CreateBackupRequest>) -> Result<Json<Value>, StatusCode> {
    let label = req.label.unwrap_or_else(|| "手动备份".to_string());
    let meta = services::backup::create(&label).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(meta)))
}

async fn restore_backup(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::backup::restore(&id).map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

async fn delete_backup(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::backup::delete(&id).map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

// ── Session Handlers ──

pub async fn list_sessions() -> Result<Json<Value>, StatusCode> {
    let sessions = services::session::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "sessions": sessions })))
}

pub async fn create_session(
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<Value>, StatusCode> {
    let session = services::session::create(&req.title, &req.participant_ids)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(session)))
}

pub async fn get_session(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let session = services::session::get(&id).map_err(map_not_found)?;
    let messages = services::session::list_messages(&id).unwrap_or_default();
    Ok(Json(json!({ "session": session, "messages": messages })))
}

pub async fn delete_session(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::session::delete(&id).map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn list_session_messages(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let messages =
        services::session::list_messages(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "messages": messages })))
}

pub async fn post_session_message(
    Path(id): Path<String>,
    Json(req): Json<PostMessageRequest>,
) -> Result<Json<Value>, StatusCode> {
    let _session = services::session::get(&id).map_err(map_not_found)?;

    let user_msg = crate::models::SessionMessage {
        id: uuid::Uuid::new_v4().to_string(),
        session_id: id.clone(),
        kind: crate::models::MessageKind::Chat,
        role: crate::models::MessageRole::User,
        author_id: None,
        author_label: "You".to_string(),
        content: req.content.clone(),
        mentions: req.mentions.clone(),
        created_at: chrono::Utc::now(),
    };
    services::session::append_message(&id, user_msg.clone())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let registry = crate::api::session_registry();
    registry.publish(
        &id,
        crate::services::session_stream::SessionEvent::MessageCreated {
            message_id: user_msg.id.clone(),
            author_label: user_msg.author_label.clone(),
            author_id: None,
            kind: "chat".into(),
            role: "user".into(),
            content: user_msg.content.clone(),
            mentions: user_msg.mentions.clone(),
            created_at: user_msg.created_at.to_rfc3339(),
        },
    );

    if !req.mentions.is_empty() {
        let session_id = id.clone();
        let mentions = req.mentions.clone();
        let content = req.content.clone();
        let registry = registry.clone();

        tokio::spawn(async move {
            for emp_id in &mentions {
                let emp = match services::employee::get(emp_id).await {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                let message_id = uuid::Uuid::new_v4().to_string();
                let binding = {
                    let bindings = match emp.bindings.as_ref() {
                        Some(b) => b,
                        None => {
                            tracing::warn!("Employee {} has no bindings - this is a legacy path that needs migration to source_id", emp_id);
                            registry.publish(
                                &session_id,
                                crate::services::session_stream::SessionEvent::MessageDone {
                                    message_id: message_id.clone(),
                                    content: format!(
                                        "（员工 {} 尚未配置 bindings，请联系管理员）",
                                        emp.display_name
                                    ),
                                },
                            );
                            continue;
                        }
                    };
                    match bindings
                        .iter()
                        .find(|b| b.is_primary)
                        .or_else(|| bindings.first())
                    {
                        Some(b) => b.clone(),
                        None => {
                            tracing::warn!("Employee {} has no primary binding - this is a legacy path that needs migration to source_id", emp_id);
                            registry.publish(
                                &session_id,
                                crate::services::session_stream::SessionEvent::MessageDone {
                                    message_id: message_id.clone(),
                                    content: format!(
                                        "（员工 {} 尚未配置有效的 binding，请联系管理员）",
                                        emp.display_name
                                    ),
                                },
                            );
                            continue;
                        }
                    }
                };

                let soul_files = services::employee::read_soul_files(emp_id).unwrap_or_default();

                registry.publish(
                    &session_id,
                    crate::services::session_stream::SessionEvent::MessageCreated {
                        message_id: message_id.clone(),
                        author_label: emp.display_name.clone(),
                        author_id: Some(emp_id.clone()),
                        kind: "chat".into(),
                        role: "assistant".into(),
                        content: String::new(),
                        mentions: vec![],
                        created_at: chrono::Utc::now().to_rfc3339(),
                    },
                );

                let history = services::session::list_messages(&session_id).unwrap_or_default();

                let system_prompt = services::employee_dispatch::build_system_prompt(&soul_files);
                let mut full_content = String::new();

                match &binding.protocol {
                    crate::models::AgentProtocol::OpenAiCompatible {
                        endpoint,
                        api_key,
                        model,
                        ..
                    } => {
                        let mut messages_payload = vec![];
                        if !system_prompt.is_empty() {
                            messages_payload.push(serde_json::json!({
                                "role": "system",
                                "content": system_prompt
                            }));
                        }
                        let chat_history: Vec<_> = history
                            .iter()
                            .filter(|m| m.kind == crate::models::MessageKind::Chat)
                            .collect();
                        for msg in chat_history.iter().rev().take(20).rev() {
                            let role = match msg.role {
                                crate::models::MessageRole::User => "user",
                                crate::models::MessageRole::Assistant => "assistant",
                            };
                            messages_payload.push(serde_json::json!({
                                "role": role,
                                "content": msg.content
                            }));
                        }

                        let client = reqwest::Client::builder()
                            .timeout(std::time::Duration::from_secs(120))
                            .danger_accept_invalid_certs(true)
                            .build()
                            .unwrap();

                        let base = endpoint.trim_end_matches('/');
                        let mut req_builder = client
                            .post(format!("{}/v1/chat/completions", base))
                            .json(&serde_json::json!({
                                "model": model,
                                "messages": messages_payload,
                                "stream": true
                            }));

                        if let Some(key) = api_key {
                            req_builder =
                                req_builder.header("Authorization", format!("Bearer {}", key));
                        }

                        if let Ok(resp) = req_builder.send().await {
                            use futures::StreamExt;
                            let mut stream = resp.bytes_stream();
                            let mut done = false;
                            while !done {
                                match stream.next().await {
                                    Some(Ok(chunk)) => {
                                        let text = String::from_utf8_lossy(&chunk);
                                        for line in text.lines() {
                                            if let Some(data) = line.strip_prefix("data: ") {
                                                if data == "[DONE]" {
                                                    done = true;
                                                    break;
                                                }
                                                if let Ok(json) =
                                                    serde_json::from_str::<serde_json::Value>(data)
                                                {
                                                    if let Some(delta) = json
                                                        .get("choices")
                                                        .and_then(|c| c.get(0))
                                                        .and_then(|c| c.get("delta"))
                                                        .and_then(|d| d.get("content"))
                                                        .and_then(|c| c.as_str())
                                                    {
                                                        full_content.push_str(delta);
                                                        registry.publish(&session_id,
                                                            crate::services::session_stream::SessionEvent::MessageDelta {
                                                                message_id: message_id.clone(),
                                                                delta: delta.to_string(),
                                                            });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    _ => break,
                                }
                            }
                        }
                    }
                    crate::models::AgentProtocol::LocalProcess {
                        executable,
                        soul_arg,
                        extra_args,
                    } => {
                        let chat_history: Vec<_> = history
                            .iter()
                            .filter(|m| m.kind == crate::models::MessageKind::Chat)
                            .collect();
                        let history_text = chat_history
                            .iter()
                            .rev()
                            .take(10)
                            .rev()
                            .map(|m| format!("[{}] {}", m.author_label, m.content))
                            .collect::<Vec<_>>()
                            .join("\n");

                        let combined_prompt = if history_text.is_empty() {
                            system_prompt
                        } else {
                            format!("{}\n\n## 对话历史\n{}", system_prompt, history_text)
                        };

                        let mut cmd = tokio::process::Command::new(executable.as_str());
                        if !combined_prompt.is_empty() {
                            cmd.arg(soul_arg.as_str()).arg(&combined_prompt);
                        }
                        for arg in extra_args {
                            cmd.arg(arg);
                        }
                        cmd.arg(&content);
                        cmd.stdout(std::process::Stdio::piped());

                        if let Ok(mut child) = cmd.spawn() {
                            if let Some(stdout) = child.stdout.take() {
                                use tokio::io::AsyncBufReadExt;
                                let mut reader = tokio::io::BufReader::new(stdout).lines();
                                while let Ok(Some(line)) = reader.next_line().await {
                                    let delta = format!("{}\n", line);
                                    full_content.push_str(&delta);
                                    registry.publish(&session_id,
                                        crate::services::session_stream::SessionEvent::MessageDelta {
                                            message_id: message_id.clone(),
                                            delta,
                                        });
                                }
                            }
                            let _ = child.wait().await;
                        }
                    }
                    _ => {
                        full_content = "（SSH 协议暂不支持聊天模式）".to_string();
                    }
                }

                registry.publish(
                    &session_id,
                    crate::services::session_stream::SessionEvent::MessageDone {
                        message_id: message_id.clone(),
                        content: full_content.clone(),
                    },
                );

                let agent_msg = crate::models::SessionMessage {
                    id: message_id,
                    session_id: session_id.clone(),
                    kind: crate::models::MessageKind::Chat,
                    role: crate::models::MessageRole::Assistant,
                    author_id: Some(emp_id.clone()),
                    author_label: emp.display_name.clone(),
                    content: full_content,
                    mentions: vec![],
                    created_at: chrono::Utc::now(),
                };
                let _ = services::session::append_message(&session_id, agent_msg);
            }
        });
    }

    Ok(Json(json!({ "message_id": user_msg.id })))
}

pub async fn session_stream(
    Path(id): Path<String>,
) -> axum::response::sse::Sse<
    impl futures::stream::Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>,
> {
    let registry = crate::api::session_registry();
    let mut rx = registry.subscribe(&id);

    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    if let Ok(data) = serde_json::to_string(&event) {
                        yield Ok(axum::response::sse::Event::default().data(data));
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
            }
        }
    };

    axum::response::sse::Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new().interval(std::time::Duration::from_secs(15)),
    )
}

// ── Session Title & Participants ──

pub async fn update_session_title(
    Path(id): Path<String>,
    Json(req): Json<UpdateSessionTitleRequest>,
) -> Result<Json<Value>, StatusCode> {
    let session = services::session::update_title(&id, &req.title).map_err(map_not_found)?;
    Ok(Json(json!(session)))
}

pub async fn update_session_participants(
    Path(id): Path<String>,
    Json(req): Json<UpdateParticipantsRequest>,
) -> Result<Json<Value>, StatusCode> {
    let session = services::session::update_participants(&id, &req.add, &req.remove)
        .await
        .map_err(map_not_found)?;
    Ok(Json(json!(session)))
}

// ── Proposal Handlers ──

pub async fn list_proposals(Path(session_id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let proposals =
        services::proposal::list(&session_id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "proposals": proposals })))
}

pub async fn create_proposal(
    Path(session_id): Path<String>,
    Json(req): Json<CreateProposalRequest>,
) -> Result<Json<Value>, StatusCode> {
    let proposal = services::proposal::create(
        &session_id,
        &req.title,
        &req.description,
        &req.assigned_employee_id,
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let registry = crate::api::session_registry();
    let content = serde_json::to_string(&proposal).unwrap_or_default();
    registry.publish(
        &session_id,
        crate::services::session_stream::SessionEvent::MessageCreated {
            message_id: proposal.id.clone(),
            author_label: "System".to_string(),
            author_id: None,
            kind: "proposal".into(),
            role: "user".into(),
            content,
            mentions: vec![],
            created_at: proposal.created_at.to_rfc3339(),
        },
    );

    let _ = services::session::append_message(
        &session_id,
        crate::models::SessionMessage {
            id: proposal.id.clone(),
            session_id: session_id.clone(),
            kind: crate::models::MessageKind::Proposal,
            role: crate::models::MessageRole::User,
            author_id: None,
            author_label: "System".to_string(),
            content: serde_json::to_string(&proposal).unwrap_or_default(),
            mentions: vec![],
            created_at: proposal.created_at,
        },
    );

    Ok(Json(json!(proposal)))
}

pub async fn confirm_proposal(
    Path((session_id, proposal_id)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    let proposal = services::proposal::get(&session_id, &proposal_id).map_err(map_not_found)?;

    if proposal.status != crate::models::ProposalStatus::Pending {
        return Err(StatusCode::BAD_REQUEST);
    }

    services::proposal::update_status(
        &session_id,
        &proposal_id,
        crate::models::ProposalStatus::Executing,
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let registry = crate::api::session_registry();

    let sid = session_id.clone();
    let pid = proposal_id.clone();
    let reg = registry.clone();
    let task_content = proposal.description.clone();
    let emp_id = proposal.assigned_employee_id.clone();

    tokio::spawn(async move {
        let emp = match services::employee::get(&emp_id).await {
            Ok(e) => e,
            Err(_) => return,
        };
        let message_id = uuid::Uuid::new_v4().to_string();
        let binding = {
            let bindings = match emp.bindings.as_ref() {
                Some(b) => b,
                None => {
                    tracing::warn!("Employee {} has no bindings - this is a legacy path that needs migration to source_id", emp_id);
                    reg.publish(
                        &sid,
                        crate::services::session_stream::SessionEvent::MessageDone {
                            message_id: message_id.clone(),
                            content: format!(
                                "（员工 {} 尚未配置 bindings，请联系管理员）",
                                emp.display_name
                            ),
                        },
                    );
                    return;
                }
            };
            match bindings
                .iter()
                .find(|b| b.is_primary)
                .or_else(|| bindings.first())
            {
                Some(b) => b.clone(),
                None => {
                    tracing::warn!("Employee {} has no primary binding - this is a legacy path that needs migration to source_id", emp_id);
                    reg.publish(
                        &sid,
                        crate::services::session_stream::SessionEvent::MessageDone {
                            message_id: message_id.clone(),
                            content: format!(
                                "（员工 {} 尚未配置有效的 binding，请联系管理员）",
                                emp.display_name
                            ),
                        },
                    );
                    return;
                }
            }
        };
        let soul_files = services::employee::read_soul_files(&emp_id).unwrap_or_default();
        let system_prompt = services::employee_dispatch::build_system_prompt(&soul_files);

        reg.publish(
            &sid,
            crate::services::session_stream::SessionEvent::MessageCreated {
                message_id: message_id.clone(),
                author_label: emp.display_name.clone(),
                author_id: Some(emp_id.clone()),
                kind: "chat".into(),
                role: "assistant".into(),
                content: String::new(),
                mentions: vec![],
                created_at: chrono::Utc::now().to_rfc3339(),
            },
        );

        let mut full_content = String::new();

        match &binding.protocol {
            crate::models::AgentProtocol::OpenAiCompatible {
                endpoint,
                api_key,
                model,
                ..
            } => {
                let mut messages_payload = vec![];
                if !system_prompt.is_empty() {
                    messages_payload
                        .push(serde_json::json!({"role": "system", "content": system_prompt}));
                }
                messages_payload.push(serde_json::json!({"role": "user", "content": task_content}));

                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(300))
                    .danger_accept_invalid_certs(true)
                    .build()
                    .unwrap();

                let base = endpoint.trim_end_matches('/');
                let mut req_builder = client.post(format!("{}/v1/chat/completions", base))
                    .json(&serde_json::json!({"model": model, "messages": messages_payload, "stream": true}));
                if let Some(key) = api_key {
                    req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
                }

                if let Ok(resp) = req_builder.send().await {
                    use futures::StreamExt;
                    let mut stream = resp.bytes_stream();
                    let mut done = false;
                    while !done {
                        match stream.next().await {
                            Some(Ok(chunk)) => {
                                let text = String::from_utf8_lossy(&chunk);
                                for line in text.lines() {
                                    if let Some(data) = line.strip_prefix("data: ") {
                                        if data == "[DONE]" {
                                            done = true;
                                            break;
                                        }
                                        if let Ok(json) =
                                            serde_json::from_str::<serde_json::Value>(data)
                                        {
                                            if let Some(delta) = json
                                                .get("choices")
                                                .and_then(|c| c.get(0))
                                                .and_then(|c| c.get("delta"))
                                                .and_then(|d| d.get("content"))
                                                .and_then(|c| c.as_str())
                                            {
                                                full_content.push_str(delta);
                                                reg.publish(&sid, crate::services::session_stream::SessionEvent::MessageDelta {
                                                    message_id: message_id.clone(),
                                                    delta: delta.to_string(),
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            _ => break,
                        }
                    }
                }
            }
            crate::models::AgentProtocol::LocalProcess {
                executable,
                soul_arg,
                extra_args,
            } => {
                let mut cmd = tokio::process::Command::new(executable.as_str());
                if !system_prompt.is_empty() {
                    cmd.arg(soul_arg.as_str()).arg(&system_prompt);
                }
                for arg in extra_args {
                    cmd.arg(arg);
                }
                cmd.arg(&task_content);
                cmd.stdout(std::process::Stdio::piped());

                if let Ok(mut child) = cmd.spawn() {
                    if let Some(stdout) = child.stdout.take() {
                        use tokio::io::AsyncBufReadExt;
                        let mut reader = tokio::io::BufReader::new(stdout).lines();
                        while let Ok(Some(line)) = reader.next_line().await {
                            let delta = format!("{}\n", line);
                            full_content.push_str(&delta);
                            reg.publish(
                                &sid,
                                crate::services::session_stream::SessionEvent::MessageDelta {
                                    message_id: message_id.clone(),
                                    delta,
                                },
                            );
                        }
                    }
                    let _ = child.wait().await;
                }
            }
            _ => {
                full_content = "（SSH 协议暂不支持）".to_string();
            }
        }

        reg.publish(
            &sid,
            crate::services::session_stream::SessionEvent::MessageDone {
                message_id: message_id.clone(),
                content: full_content.clone(),
            },
        );

        let agent_msg = crate::models::SessionMessage {
            id: message_id,
            session_id: sid.clone(),
            kind: crate::models::MessageKind::Chat,
            role: crate::models::MessageRole::Assistant,
            author_id: Some(emp_id.clone()),
            author_label: emp.display_name.clone(),
            content: full_content,
            mentions: vec![],
            created_at: chrono::Utc::now(),
        };
        let _ = services::session::append_message(&sid, agent_msg);

        let _ =
            services::proposal::update_status(&sid, &pid, crate::models::ProposalStatus::Reviewing);

        reg.publish(
            &sid,
            crate::services::session_stream::SessionEvent::ProposalUpdated {
                proposal_id: pid.clone(),
                status: "reviewing".to_string(),
            },
        );
    });

    Ok(Json(json!({ "ok": true })))
}

pub async fn cancel_proposal(
    Path((session_id, proposal_id)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    services::proposal::update_status(
        &session_id,
        &proposal_id,
        crate::models::ProposalStatus::Cancelled,
    )
    .map_err(map_not_found)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn done_proposal(
    Path((session_id, proposal_id)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    services::proposal::update_status(
        &session_id,
        &proposal_id,
        crate::models::ProposalStatus::Done,
    )
    .map_err(map_not_found)?;
    let registry = crate::api::session_registry();
    registry.publish(
        &session_id,
        crate::services::session_stream::SessionEvent::ProposalUpdated {
            proposal_id: proposal_id.clone(),
            status: "done".to_string(),
        },
    );
    Ok(Json(json!({ "ok": true })))
}

// 请求 review：@mention 一个 reviewer agent，让它评审执行结果
pub async fn review_proposal(
    Path((session_id, proposal_id)): Path<(String, String)>,
    Json(req): Json<ReviewProposalRequest>,
) -> Result<Json<Value>, StatusCode> {
    let proposal = services::proposal::get(&session_id, &proposal_id).map_err(map_not_found)?;

    if proposal.status != crate::models::ProposalStatus::Reviewing {
        return Err(StatusCode::BAD_REQUEST);
    }

    let registry = crate::api::session_registry();
    let sid = session_id.clone();
    let reviewer_id = req.reviewer_employee_id.clone();
    let reg = registry.clone();
    let task_desc = proposal.description.clone();

    tokio::spawn(async move {
        let emp = match services::employee::get(&reviewer_id).await {
            Ok(e) => e,
            Err(_) => return,
        };
        let message_id = uuid::Uuid::new_v4().to_string();
        let binding = {
            let bindings = match emp.bindings.as_ref() {
                Some(b) => b,
                None => {
                    tracing::warn!("Reviewer {} has no bindings - this is a legacy path that needs migration to source_id", reviewer_id);
                    reg.publish(
                        &sid,
                        crate::services::session_stream::SessionEvent::MessageDone {
                            message_id: message_id.clone(),
                            content: format!(
                                "（评审员 {} 尚未配置 bindings，请联系管理员）",
                                emp.display_name
                            ),
                        },
                    );
                    return;
                }
            };
            match bindings
                .iter()
                .find(|b| b.is_primary)
                .or_else(|| bindings.first())
            {
                Some(b) => b.clone(),
                None => {
                    tracing::warn!("Reviewer {} has no primary binding - this is a legacy path that needs migration to source_id", reviewer_id);
                    reg.publish(
                        &sid,
                        crate::services::session_stream::SessionEvent::MessageDone {
                            message_id: message_id.clone(),
                            content: format!(
                                "（评审员 {} 尚未配置有效的 binding，请联系管理员）",
                                emp.display_name
                            ),
                        },
                    );
                    return;
                }
            }
        };
        let soul_files = services::employee::read_soul_files(&reviewer_id).unwrap_or_default();
        let system_prompt = services::employee_dispatch::build_system_prompt(&soul_files);

        let history = services::session::list_messages(&sid).unwrap_or_default();
        let execution_result = history
            .iter()
            .filter(|m| {
                m.role == crate::models::MessageRole::Assistant
                    && m.kind == crate::models::MessageKind::Chat
            })
            .last()
            .map(|m| m.content.as_str())
            .unwrap_or("（无执行结果）");

        let review_prompt = format!(
            "请对以下任务的执行结果进行 review，指出问题并给出改进建议。\n\n## 原始任务\n{}\n\n## 执行结果\n{}",
            task_desc, execution_result
        );

        reg.publish(
            &sid,
            crate::services::session_stream::SessionEvent::MessageCreated {
                message_id: message_id.clone(),
                author_label: emp.display_name.clone(),
                author_id: Some(reviewer_id.clone()),
                kind: "chat".into(),
                role: "assistant".into(),
                content: String::new(),
                mentions: vec![],
                created_at: chrono::Utc::now().to_rfc3339(),
            },
        );

        let mut full_content = String::new();

        match &binding.protocol {
            crate::models::AgentProtocol::OpenAiCompatible {
                endpoint,
                api_key,
                model,
                ..
            } => {
                let mut messages_payload = vec![];
                if !system_prompt.is_empty() {
                    messages_payload
                        .push(serde_json::json!({"role": "system", "content": system_prompt}));
                }
                messages_payload
                    .push(serde_json::json!({"role": "user", "content": review_prompt}));

                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(300))
                    .danger_accept_invalid_certs(true)
                    .build()
                    .unwrap();

                let base = endpoint.trim_end_matches('/');
                let mut req_builder = client.post(format!("{}/v1/chat/completions", base))
                    .json(&serde_json::json!({"model": model, "messages": messages_payload, "stream": true}));
                if let Some(key) = api_key {
                    req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
                }

                if let Ok(resp) = req_builder.send().await {
                    use futures::StreamExt;
                    let mut stream = resp.bytes_stream();
                    let mut done = false;
                    while !done {
                        match stream.next().await {
                            Some(Ok(chunk)) => {
                                let text = String::from_utf8_lossy(&chunk);
                                for line in text.lines() {
                                    if let Some(data) = line.strip_prefix("data: ") {
                                        if data == "[DONE]" {
                                            done = true;
                                            break;
                                        }
                                        if let Ok(json) =
                                            serde_json::from_str::<serde_json::Value>(data)
                                        {
                                            if let Some(delta) = json
                                                .get("choices")
                                                .and_then(|c| c.get(0))
                                                .and_then(|c| c.get("delta"))
                                                .and_then(|d| d.get("content"))
                                                .and_then(|c| c.as_str())
                                            {
                                                full_content.push_str(delta);
                                                reg.publish(&sid, crate::services::session_stream::SessionEvent::MessageDelta {
                                                    message_id: message_id.clone(),
                                                    delta: delta.to_string(),
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            _ => break,
                        }
                    }
                }
            }
            crate::models::AgentProtocol::LocalProcess {
                executable,
                soul_arg,
                extra_args,
            } => {
                let mut cmd = tokio::process::Command::new(executable.as_str());
                if !system_prompt.is_empty() {
                    cmd.arg(soul_arg.as_str()).arg(&system_prompt);
                }
                for arg in extra_args {
                    cmd.arg(arg);
                }
                cmd.arg(&review_prompt);
                cmd.stdout(std::process::Stdio::piped());

                if let Ok(mut child) = cmd.spawn() {
                    if let Some(stdout) = child.stdout.take() {
                        use tokio::io::AsyncBufReadExt;
                        let mut reader = tokio::io::BufReader::new(stdout).lines();
                        while let Ok(Some(line)) = reader.next_line().await {
                            let delta = format!("{}\n", line);
                            full_content.push_str(&delta);
                            reg.publish(
                                &sid,
                                crate::services::session_stream::SessionEvent::MessageDelta {
                                    message_id: message_id.clone(),
                                    delta,
                                },
                            );
                        }
                    }
                    let _ = child.wait().await;
                }
            }
            _ => {
                full_content = "（SSH 暂不支持）".to_string();
            }
        }

        reg.publish(
            &sid,
            crate::services::session_stream::SessionEvent::MessageDone {
                message_id: message_id.clone(),
                content: full_content.clone(),
            },
        );

        let agent_msg = crate::models::SessionMessage {
            id: message_id,
            session_id: sid.clone(),
            kind: crate::models::MessageKind::Chat,
            role: crate::models::MessageRole::Assistant,
            author_id: Some(reviewer_id.clone()),
            author_label: emp.display_name.clone(),
            content: full_content,
            mentions: vec![],
            created_at: chrono::Utc::now(),
        };
        let _ = services::session::append_message(&sid, agent_msg);
    });

    Ok(Json(json!({ "ok": true })))
}

// 重新执行：proposal 从 reviewing 回到 pending，用新 description 重跑
pub async fn revise_proposal(
    Path((session_id, proposal_id)): Path<(String, String)>,
    Json(req): Json<ReviseProposalRequest>,
) -> Result<Json<Value>, StatusCode> {
    let proposal = services::proposal::get(&session_id, &proposal_id).map_err(map_not_found)?;

    if proposal.status != crate::models::ProposalStatus::Reviewing {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(new_desc) = &req.description {
        services::proposal::update_description(&session_id, &proposal_id, new_desc)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    services::proposal::update_status(
        &session_id,
        &proposal_id,
        crate::models::ProposalStatus::Pending,
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let registry = crate::api::session_registry();
    registry.publish(
        &session_id,
        crate::services::session_stream::SessionEvent::ProposalUpdated {
            proposal_id: proposal_id.clone(),
            status: "pending".to_string(),
        },
    );

    Ok(Json(json!({ "ok": true })))
}

// 跨会话聚合所有 proposals
pub async fn list_all_proposals() -> Result<Json<Value>, StatusCode> {
    let sessions = services::session::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut all_proposals = vec![];
    for session in &sessions {
        let mut proposals = services::proposal::list(&session.id).unwrap_or_default();
        for p in proposals.drain(..) {
            let mut val = serde_json::to_value(&p).unwrap_or_default();
            val["session_title"] = serde_json::Value::String(session.title.clone());
            all_proposals.push(val);
        }
    }

    all_proposals.sort_by(|a, b| {
        b.get("created_at")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .cmp(a.get("created_at").and_then(|v| v.as_str()).unwrap_or(""))
    });

    Ok(Json(json!({ "proposals": all_proposals })))
}
