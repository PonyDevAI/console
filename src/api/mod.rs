mod routes;
mod sse;
mod threads;
mod terminal;

use anyhow::Result;
use axum::Router;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

use crate::services::task_queue::TaskQueue;
use crate::services::session_stream::SharedSessionRegistry;
use crate::runtime::{RuntimeGateway, RuntimeManager};
use crate::runtime::adapters::{codex::CodexRuntimeAdapter, claude::ClaudeRuntimeAdapter};
use crate::runtime::registry::RuntimeRegistry;

static SESSION_REGISTRY: OnceLock<SharedSessionRegistry> = OnceLock::new();

pub fn session_registry() -> &'static SharedSessionRegistry {
    SESSION_REGISTRY.get_or_init(|| crate::services::session_stream::new_registry())
}

fn build_runtime() -> (Arc<RuntimeGateway>, Arc<RuntimeManager>) {
    let mut registry = RuntimeRegistry::new();
    registry.register(std::sync::Arc::new(CodexRuntimeAdapter::new()));
    registry.register(std::sync::Arc::new(ClaudeRuntimeAdapter::new()));
    
    let manager = Arc::new(RuntimeManager::new());
    let gateway = Arc::new(RuntimeGateway::new(registry, manager.clone()));
    
    (gateway, manager)
}

pub async fn serve(addr: &str) -> Result<()> {
    let paths = crate::storage::ConsolePaths::default();
    let web_dir = paths.root.join("dashboard");
    let dist_dir = if web_dir.join("dist").exists() {
        web_dir.join("dist")
    } else {
        PathBuf::from("dashboard/dist")
    };

    tracing::info!("Serving dashboard from {}", dist_dir.display());

    let spa_fallback = ServeFile::new(dist_dir.join("index.html"));
    let static_files = ServeDir::new(&dist_dir).fallback(spa_fallback);

    let queue = TaskQueue::new();

    // Build runtime
    let (runtime_gateway, runtime_manager) = build_runtime();
    let thread_state = Arc::new(threads::ThreadState::new(
        runtime_gateway,
        runtime_manager.clone(),
    ));

    // Periodic cleanup of finished tasks (every 10 minutes, remove tasks older than 1 hour)
    {
        let q = queue.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(600));
            loop {
                interval.tick().await;
                q.cleanup(std::time::Duration::from_secs(3600));
            }
        });
    }

    let stateful_routes = Router::new()
        .route("/api/cli-tools/:name/install", axum::routing::post(routes::install_tool))
        .route("/api/cli-tools/:name/upgrade", axum::routing::post(routes::upgrade_tool))
        .route("/api/cli-tools/:name/uninstall", axum::routing::post(routes::uninstall_tool))
        .route("/api/tasks", axum::routing::get(routes::list_tasks))
        .route("/api/tasks/stream", axum::routing::get(sse::task_stream))
        .route("/api/tasks/:id", axum::routing::get(routes::get_task))
        .route("/api/employees/:id/dispatch", axum::routing::post(routes::dispatch_employee))
        .with_state(queue.clone());

    let stateless_routes = routes::api_routes();
    
    // Thread routes
    let thread_routes = threads::thread_routes(thread_state);

    // Terminal routes
    let terminal_state = terminal::TerminalApiState {
        terminal_service: Arc::new(crate::services::terminal::TerminalService::new()),
    };
    let terminal_routes = terminal::router().with_state(terminal_state);

    let app = Router::new()
        .merge(stateful_routes)
        .nest("/api", stateless_routes)
        .nest("/api", thread_routes)
        .nest("/api/terminal", terminal_routes)
        .route("/api/sessions", axum::routing::get(routes::list_sessions))
        .route("/api/sessions", axum::routing::post(routes::create_session))
        .route("/api/sessions/:id", axum::routing::get(routes::get_session))
        .route("/api/sessions/:id", axum::routing::delete(routes::delete_session))
        .route("/api/sessions/:id/messages", axum::routing::get(routes::list_session_messages))
        .route("/api/sessions/:id/messages", axum::routing::post(routes::post_session_message))
        .route("/api/sessions/:id/stream", axum::routing::get(routes::session_stream))
        .route("/api/sessions/:id/title", axum::routing::patch(routes::update_session_title))
        .route("/api/sessions/:id/participants", axum::routing::patch(routes::update_session_participants))
        .route("/api/sessions/:id/proposals", axum::routing::get(routes::list_proposals))
        .route("/api/sessions/:id/proposals", axum::routing::post(routes::create_proposal))
        .route("/api/sessions/:id/proposals/:pid/confirm", axum::routing::post(routes::confirm_proposal))
        .route("/api/sessions/:id/proposals/:pid/cancel", axum::routing::post(routes::cancel_proposal))
        .route("/api/sessions/:id/proposals/:pid/done", axum::routing::post(routes::done_proposal))
        .route("/api/sessions/:id/proposals/:pid/review", axum::routing::post(routes::review_proposal))
        .route("/api/sessions/:id/proposals/:pid/revise", axum::routing::post(routes::revise_proposal))
        .route("/api/proposals", axum::routing::get(routes::list_all_proposals))
        .fallback_service(static_files)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Console listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}
