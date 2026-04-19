use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
use cloudcode_contracts::threads::{
    CreateThreadRequest, SendMessageResponse, SendMessageRequest, ThreadMessageDto,
    ThreadRuntimeProfile, UpdateThreadTitleRequest, WorkspaceInspectResult,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::runtime::{RuntimeGateway, RuntimeManager};
use crate::services::thread::ThreadService;
use crate::runtime::stream::{ThreadSseStream, sse_response};

/// Shared state for thread routes
pub struct ThreadState {
    pub thread_service: ThreadService,
    pub runtime_gateway: Arc<RuntimeGateway>,
    pub runtime_manager: Arc<RuntimeManager>,
}

impl ThreadState {
    pub fn new(
        runtime_gateway: Arc<RuntimeGateway>,
        runtime_manager: Arc<RuntimeManager>,
    ) -> Self {
        // Create ThreadService with RuntimeManager for event bridging
        let thread_service = ThreadService::with_runtime_manager(runtime_manager.clone());
        Self {
            thread_service,
            runtime_gateway,
            runtime_manager,
        }
    }
}

pub fn thread_routes(state: Arc<ThreadState>) -> Router {
    Router::new()
        .route("/threads", get(list_threads))
        .route("/threads", post(create_thread))
        .route("/threads/:id", get(get_thread))
        .route("/threads/:id", delete(delete_thread))
        .route("/threads/:id/title", patch(update_thread_title))
        .route("/threads/:id/messages", get(list_messages))
        .route("/threads/:id/messages", post(send_message))
        .route("/threads/:id/stream", get(thread_stream))
        .route("/threads/:id/runs/:run_id/cancel", post(cancel_run))
        .route("/workspaces/inspect", post(inspect_workspace))
        .with_state(state)
}

async fn list_threads(
    State(state): State<Arc<ThreadState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    let threads = state.thread_service.list_threads()
        .map_err(|e| {
            tracing::error!("Failed to list threads: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
        })?;
    
    Ok(Json(serde_json::json!({ "threads": threads })))
}

async fn create_thread(
    State(state): State<Arc<ThreadState>>,
    Json(req): Json<CreateThreadRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    let thread = state.thread_service.create_thread(
        req.title,
        req.workspace,
        ThreadRuntimeProfile {
            adapter: req.runtime.adapter,
            model: req.runtime.model,
            reasoning_effort: req.runtime.reasoning_effort,
            permission_mode: req.runtime.permission_mode,
        },
    )
    .map_err(|e| {
        tracing::error!("Failed to create thread: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
    })?;
    
    Ok(Json(serde_json::json!({ "thread": thread })))
}

async fn get_thread(
    State(state): State<Arc<ThreadState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    let thread = state.thread_service.get_thread(&id)
        .map_err(|e| {
            tracing::error!("Failed to get thread: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
        })?
        .ok_or((StatusCode::NOT_FOUND, "Thread not found"))?;
    
    Ok(Json(serde_json::json!({ "thread": thread })))
}

async fn delete_thread(
    State(state): State<Arc<ThreadState>>,
    Path(id): Path<String>,
) -> Result<(), (StatusCode, &'static str)> {
    state.thread_service.delete_thread(&id)
        .map_err(|e| {
            tracing::error!("Failed to delete thread: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
        })?;
    
    Ok(())
}

async fn update_thread_title(
    State(state): State<Arc<ThreadState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateThreadTitleRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    let thread = state.thread_service.update_thread_title(&id, req.title)
        .map_err(|e| {
            tracing::error!("Failed to update thread title: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
        })?;
    
    Ok(Json(serde_json::json!({ "thread": thread })))
}

async fn list_messages(
    State(state): State<Arc<ThreadState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    let messages = state.thread_service.list_messages(&id)
        .map_err(|e| {
            tracing::error!("Failed to list messages: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
        })?;
    
    Ok(Json(serde_json::json!({ "messages": messages })))
}

async fn send_message(
    State(state): State<Arc<ThreadState>>,
    Path(thread_id): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<SendMessageResponse>, (StatusCode, &'static str)> {
    let thread = state.thread_service.get_thread(&thread_id)
        .ok()
        .flatten()
        .ok_or((StatusCode::NOT_FOUND, "Thread not found"))?;
    
    // Step 1: Ensure thread bridge is running BEFORE doing anything else
    state.thread_service.ensure_thread_bridge(&thread_id).await;
    
    // Step 2: Append user message
    let user_message = state.thread_service.append_user_message(
        &thread_id,
        req.content.clone(),
        req.attachments,
    )
    .map_err(|e| {
        tracing::error!("Failed to append user message: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to append message")
    })?;
    
    // Step 3: Load messages for runtime request
    let messages = state.thread_service.list_messages(&thread_id)
        .map_err(|e| {
            tracing::error!("Failed to list messages: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list messages")
        })?;
    
    // Step 4: Build runtime request
    let runtime_request = state.thread_service.build_runtime_request(
        &thread,
        &messages,
        Some(user_message.id.clone()),
    );
    
    // Step 5: Start runtime
    let run = state.runtime_gateway.start_run(runtime_request)
        .await
        .map_err(|e| {
            tracing::error!("Failed to start runtime: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to start runtime")
        })?;
    
    // Step 6: Create assistant placeholder
    let assistant_message = state.thread_service.create_assistant_placeholder(
        &thread_id,
        run.id.clone(),
    )
    .map_err(|e| {
        tracing::error!("Failed to create assistant placeholder: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create message")
    })?;
    
    Ok(Json(SendMessageResponse {
        thread_id,
        run_id: run.id,
        user_message: ThreadMessageDto {
            id: user_message.id.clone(),
            thread_id: user_message.thread_id.clone(),
            role: user_message.role.clone(),
            content: user_message.content.clone(),
            status: user_message.status.clone(),
            error: user_message.error.clone(),
            attachments: user_message.attachments.clone(),
            created_at: user_message.created_at,
            run_id: user_message.run_id.clone(),
        },
        assistant_message: ThreadMessageDto {
            id: assistant_message.id.clone(),
            thread_id: assistant_message.thread_id.clone(),
            role: assistant_message.role.clone(),
            content: assistant_message.content.clone(),
            status: assistant_message.status.clone(),
            error: assistant_message.error.clone(),
            attachments: assistant_message.attachments.clone(),
            created_at: assistant_message.created_at,
            run_id: assistant_message.run_id.clone(),
        },
    }))
}

async fn thread_stream(
    State(state): State<Arc<ThreadState>>,
    Path(thread_id): Path<String>,
) -> impl axum::response::IntoResponse {
    // Ensure thread bridge is running for this thread
    state.thread_service.ensure_thread_bridge(&thread_id).await;
    
    // Get or create thread event channel and subscribe
    let thread_rx = state.runtime_manager.get_or_create_thread_event_channel(&thread_id).await;
    
    let stream = ThreadSseStream::new(thread_rx);
    sse_response(stream)
}

async fn cancel_run(
    State(state): State<Arc<ThreadState>>,
    Path((thread_id, run_id)): Path<(String, String)>,
) -> Result<(), (StatusCode, &'static str)> {
    state.runtime_gateway.cancel_run(&run_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to cancel run: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to cancel")
        })?;
    
    let messages = state.thread_service.list_messages(&thread_id)
        .unwrap_or_default();
    
    for msg in messages {
        if msg.run_id.as_deref() == Some(&run_id) {
            let _ = state.thread_service.mark_assistant_cancelled(&thread_id, &msg.id);
            break;
        }
    }
    
    Ok(())
}

async fn inspect_workspace(
    Json(req): Json<InspectWorkspaceRequest>,
) -> Result<Json<WorkspaceInspectResult>, (StatusCode, &'static str)> {
    let path = req.path;
    
    if !std::path::Path::new(&path).exists() {
        return Err((StatusCode::BAD_REQUEST, "Path does not exist"));
    }
    
    let display_name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&path)
        .to_string();
    
    let mut git_branch = None;
    let mut is_git_repo = false;
    
    if let Ok(output) = std::process::Command::new("git")
        .args(["-C", &path, "rev-parse", "--abbrev-ref", "HEAD"])
        .output()
    {
        if output.status.success() {
            is_git_repo = true;
            git_branch = Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
    }
    
    Ok(Json(WorkspaceInspectResult {
        path,
        display_name,
        git_branch,
        is_git_repo,
    }))
}

#[derive(Debug, Deserialize)]
pub struct InspectWorkspaceRequest {
    pub path: String,
}
