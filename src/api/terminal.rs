use axum::{
    extract::{Path, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use std::sync::Arc;

use crate::services::terminal::{
    ClientMessage, CreateSessionRequest, ServerMessage, TerminalService,
};

#[derive(Clone)]
pub struct TerminalApiState {
    pub terminal_service: Arc<TerminalService>,
}

pub fn router() -> Router<TerminalApiState> {
    Router::new()
        .route("/sessions", post(create_session))
        .route("/sessions/:id/ws", get(terminal_ws))
        .route("/sessions/:id", delete(close_session))
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum CreateSessionPayload {
    Local {
        #[serde(default = "default_cols")]
        cols: u16,
        #[serde(default = "default_rows")]
        rows: u16,
        cwd: Option<String>,
        shell: Option<String>,
    },
    Ssh {
        host: String,
        #[serde(default = "default_port")]
        port: u16,
        user: String,
        key_path: String,
        #[serde(default = "default_cols")]
        cols: u16,
        #[serde(default = "default_rows")]
        rows: u16,
    },
}

fn default_cols() -> u16 { 80 }
fn default_rows() -> u16 { 24 }
fn default_port() -> u16 { 22 }

async fn create_session(
    State(state): State<TerminalApiState>,
    Json(payload): Json<CreateSessionPayload>,
) -> impl IntoResponse {
    let req = match payload {
        CreateSessionPayload::Local { cols, rows, cwd, shell } => {
            let cols = if cols == 0 { 80 } else { cols };
            let rows = if rows == 0 { 24 } else { rows };
            CreateSessionRequest::local(cols, rows, cwd, shell)
        }
        CreateSessionPayload::Ssh { host, port, user, key_path, cols, rows } => {
            let host = host.trim();
            let user = user.trim();
            let key_path = key_path.trim();

            if host.is_empty() {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "Host cannot be empty" })),
                );
            }
            if user.is_empty() {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "User cannot be empty" })),
                );
            }
            if key_path.is_empty() {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "Key path cannot be empty" })),
                );
            }

            let port = if port == 0 { 22 } else { port };
            let cols = if cols == 0 { 80 } else { cols };
            let rows = if rows == 0 { 24 } else { rows };

            CreateSessionRequest::ssh(
                host.to_string(),
                port,
                user.to_string(),
                key_path.to_string(),
                cols,
                rows,
            )
        }
    };

    match state.terminal_service.create_session(req) {
        Ok(resp) => (StatusCode::OK, Json(serde_json::to_value(resp).unwrap())),
        Err(e) => {
            tracing::error!("Failed to create terminal session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

async fn close_session(
    State(state): State<TerminalApiState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let _ = state.terminal_service.close_session(&session_id);
    Json(serde_json::json!({ "ok": true }))
}

async fn terminal_ws(
    ws: WebSocketUpgrade,
    State(state): State<TerminalApiState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, session_id))
}

async fn handle_socket(mut socket: WebSocket, state: TerminalApiState, session_id: String) {
    let session_handle = match state.terminal_service.try_attach_session(&session_id) {
        Ok(handle) => handle,
        Err(msg) => {
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&ServerMessage::Error { message: msg })
                        .unwrap(),
                ))
                .await;
            return;
        }
    };

    let mut rx = session_handle.tx.subscribe();
    let (mut sender, mut receiver) = socket.split();
    let state_clone = state.clone();
    let session_id_clone = session_id.clone();

    tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(text) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(text)).await.is_err() {
                    break;
                }
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match client_msg {
                        ClientMessage::Input { data } => {
                            let _ = state_clone.terminal_service.write_to_session(&session_id_clone, &data);
                        }
                        ClientMessage::Resize { cols, rows } => {
                            let _ = state_clone.terminal_service.resize_session(&session_id_clone, cols, rows);
                        }
                        ClientMessage::Close => {
                            let _ = state_clone.terminal_service.close_session(&session_id_clone);
                            break;
                        }
                    }
                }
            }
            Message::Close(_) => {
                let _ = state.terminal_service.close_session(&session_id);
                break;
            }
            _ => {}
        }
    }
    
    let _ = state.terminal_service.close_session(&session_id);
}
