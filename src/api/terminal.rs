use axum::extract::ws::{Message, WebSocket};
use axum::{
    extract::{Path, Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use cloudcode_contracts::terminal::{
    ClientMessage, CreateSessionRequest, ServerMessage, TerminalWsQuery,
};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;

use crate::services::terminal::TerminalService;

#[derive(Clone)]
pub struct TerminalApiState {
    pub terminal_service: Arc<TerminalService>,
}

pub fn router() -> Router<TerminalApiState> {
    Router::new()
        .route("/backends", get(list_backends))
        .route("/sessions", get(list_sessions))
        .route("/sessions", post(create_session))
        .route("/sessions/:id", get(get_session))
        .route("/sessions/:id/ws", get(terminal_ws))
        .route("/sessions/:id/terminate", post(terminate_session))
}

async fn list_backends(State(state): State<TerminalApiState>) -> impl IntoResponse {
    match state.terminal_service.get_backends() {
        Ok(resp) => (StatusCode::OK, Json(serde_json::to_value(resp).unwrap())),
        Err(e) => {
            tracing::error!("Failed to list backends: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

async fn list_sessions(State(state): State<TerminalApiState>) -> impl IntoResponse {
    match state.terminal_service.list_sessions() {
        Ok(resp) => (StatusCode::OK, Json(serde_json::to_value(resp).unwrap())),
        Err(e) => {
            tracing::error!("Failed to list sessions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

async fn create_session(
    State(state): State<TerminalApiState>,
    Json(payload): Json<CreateSessionRequest>,
) -> impl IntoResponse {
    match state.terminal_service.create_session(payload) {
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

async fn get_session(
    State(state): State<TerminalApiState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    match state.terminal_service.get_session(&session_id) {
        Ok(meta) => (StatusCode::OK, Json(serde_json::to_value(meta).unwrap())),
        Err(e) => {
            tracing::error!("Failed to get session: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

async fn terminate_session(
    State(state): State<TerminalApiState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    match state.terminal_service.terminate_session(&session_id) {
        Ok(()) => (StatusCode::OK, Json(serde_json::json!({ "ok": true }))),
        Err(e) => {
            tracing::error!("Failed to terminate session: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}

async fn terminal_ws(
    ws: WebSocketUpgrade,
    State(state): State<TerminalApiState>,
    Path(session_id): Path<String>,
    Query(query): Query<TerminalWsQuery>,
) -> impl IntoResponse {
    let cols = query.cols.unwrap_or(80);
    let rows = query.rows.unwrap_or(24);
    ws.on_upgrade(move |socket| handle_socket(socket, state, session_id, cols, rows))
}

async fn handle_socket(
    socket: WebSocket,
    state: TerminalApiState,
    session_id: String,
    cols: u16,
    rows: u16,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Get session meta to determine cleanup behavior
    let session_meta = state.terminal_service.get_session(&session_id);
    let is_ephemeral = session_meta
        .as_ref()
        .map(|m| m.persistence == "ephemeral")
        .unwrap_or(false);

    let components = match state
        .terminal_service
        .spawn_attach_bridge(&session_id, cols, rows)
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(session_id = %session_id, "Failed to spawn attach bridge: {}", e);

            // Cleanup ephemeral session if attach failed
            if is_ephemeral {
                tracing::info!(session_id = %session_id, "Cleaning up ephemeral session after attach failure");
                let _ = state
                    .terminal_service
                    .cleanup_ephemeral_session(&session_id);
            }

            let _ = ws_sender
                .send(Message::Text(
                    serde_json::to_string(&ServerMessage::Error {
                        message: e.to_string(),
                    })
                    .unwrap(),
                ))
                .await;
            return;
        }
    };

    tracing::info!(session_id = %session_id, cols = cols, rows = rows, persistence = ?session_meta.map(|m| m.persistence), "WebSocket connected to terminal session");

    let reader = Arc::new(tokio::sync::Mutex::new(components.reader));
    let writer = Arc::new(tokio::sync::Mutex::new(components.writer));
    let resize_fn = components.resize_fn;
    let close_fn = components.close_fn;

    let session_id_for_log = session_id.clone();
    let reader_for_read = reader.clone();
    let read_finished = Arc::new(tokio::sync::Notify::new());
    let read_finished_clone = read_finished.clone();

    let read_task = tokio::spawn(async move {
        loop {
            let read_result = tokio::task::spawn_blocking({
                let reader = reader_for_read.clone();
                move || {
                    let mut guard = reader.blocking_lock();
                    use std::io::Read;
                    let mut buf = [0u8; 8192];
                    guard.read(&mut buf).map(|n| (n, buf))
                }
            })
            .await;

            match read_result {
                Ok(Ok((n, buf))) => {
                    if n > 0 {
                        let data = BASE64.encode(&buf[..n]);
                        let msg = ServerMessage::Output {
                            data,
                            encoding: "base64".to_string(),
                        };
                        if ws_sender
                            .send(Message::Text(serde_json::to_string(&msg).unwrap()))
                            .await
                            .is_err()
                        {
                            tracing::info!(session_id = %session_id_for_log, "WebSocket send failed");
                            break;
                        }
                    } else {
                        tracing::info!(session_id = %session_id_for_log, "PTY EOF");
                        let _ = ws_sender
                            .send(Message::Text(
                                serde_json::to_string(&ServerMessage::Exit { code: None }).unwrap(),
                            ))
                            .await;
                        break;
                    }
                }
                Ok(Err(e)) => {
                    tracing::error!(session_id = %session_id_for_log, "PTY read error: {}", e);
                    break;
                }
                Err(e) => {
                    tracing::error!(session_id = %session_id_for_log, "Spawn blocking error: {}", e);
                    break;
                }
            }
        }
        read_finished_clone.notify_one();
    });

    let session_id_for_log2 = session_id.clone();
    let writer_for_write = writer.clone();
    let resize_for_write = resize_fn.clone();
    let write_finished = Arc::new(tokio::sync::Notify::new());
    let write_finished_clone = write_finished.clone();

    let write_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                        match client_msg {
                            ClientMessage::Input { data } => {
                                let write_result = tokio::task::spawn_blocking({
                                    let writer = writer_for_write.clone();
                                    let data_bytes = data.as_bytes().to_vec();
                                    move || {
                                        let mut guard = writer.blocking_lock();
                                        use std::io::Write;
                                        guard.write_all(&data_bytes)?;
                                        guard.flush()?;
                                        Ok::<(), anyhow::Error>(())
                                    }
                                })
                                .await;

                                match write_result {
                                    Ok(Ok(())) => {}
                                    Ok(Err(e)) => {
                                        // Broken pipe is normal when PTY child exits
                                        if e.to_string().contains("Broken pipe") {
                                            tracing::info!(session_id = %session_id_for_log2, "PTY write failed (pipe closed, session likely exited)");
                                        } else {
                                            tracing::error!(session_id = %session_id_for_log2, "PTY write error: {}", e);
                                        }
                                        break;
                                    }
                                    Err(e) => {
                                        tracing::error!(session_id = %session_id_for_log2, "Spawn blocking error: {}", e);
                                        break;
                                    }
                                }
                            }
                            ClientMessage::Resize { cols, rows } => {
                                let resize_fn = resize_for_write.clone();
                                let result =
                                    tokio::task::spawn_blocking(move || resize_fn(cols, rows))
                                        .await;
                                if let Ok(Err(e)) = result {
                                    tracing::warn!(session_id = %session_id_for_log2, "Resize failed: {}", e);
                                }
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    tracing::info!(session_id = %session_id_for_log2, "WebSocket closed by client");
                    break;
                }
                _ => {}
            }
        }
        write_finished_clone.notify_one();
    });

    // Wait for either task to finish, then abort the other
    tokio::select! {
        _ = read_finished.notified() => {
            tracing::info!(session_id = %session_id, "Read task finished first");
            write_task.abort();
        }
        _ = write_finished.notified() => {
            tracing::info!(session_id = %session_id, "Write task finished first");
            read_task.abort();
        }
    }

    tracing::info!(session_id = %session_id, "Closing attach bridge");
    let _ = tokio::task::spawn_blocking(move || close_fn()).await;
    tracing::info!(session_id = %session_id, "Attach bridge closed");

    // Cleanup ephemeral session (pty sessions: disconnect ends session)
    if is_ephemeral {
        tracing::info!(session_id = %session_id, "Cleaning up ephemeral session");
        let _ = state
            .terminal_service
            .cleanup_ephemeral_session(&session_id);
    }
}
