use axum::{
    extract::Path,
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::{json, Value};

use crate::models::{CreateMcpServerRequest, CreateProviderRequest, McpServer, Provider};
use crate::services;

pub fn api_routes() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/cli-tools", get(list_cli_tools))
        .route("/cli-tools/scan", post(scan_cli_tools))
        .route("/providers", get(list_providers))
        .route("/providers", post(create_provider))
        .route("/providers/{id}", put(update_provider))
        .route("/providers/{id}", delete(delete_provider))
        .route("/providers/{id}/activate", post(activate_provider))
        .route("/mcp-servers", get(list_mcp_servers))
        .route("/mcp-servers", post(create_mcp_server))
        .route("/mcp-servers/{id}", put(update_mcp_server))
        .route("/mcp-servers/{id}", delete(delete_mcp_server))
        .route("/skills", get(list_skills))
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

async fn list_skills() -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "skills": skills })))
}

fn map_not_found(err: anyhow::Error) -> StatusCode {
    if err.to_string().contains("not found") {
        StatusCode::NOT_FOUND
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}
