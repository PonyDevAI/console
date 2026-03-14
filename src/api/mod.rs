mod routes;

use anyhow::Result;
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

pub async fn serve(addr: &str) -> Result<()> {
    let spa_fallback = ServeFile::new("web/dist/index.html");
    let static_files = ServeDir::new("web/dist").fallback(spa_fallback);

    let app = Router::new()
        .nest("/api", routes::api_routes())
        .fallback_service(static_files)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Console listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}
