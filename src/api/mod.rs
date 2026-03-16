mod routes;

use anyhow::Result;
use axum::Router;
use std::path::PathBuf;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

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

    let app = Router::new()
        .nest("/api", routes::api_routes())
        .fallback_service(static_files)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Console listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}
