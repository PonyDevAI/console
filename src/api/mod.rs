mod routes;

use anyhow::Result;
use axum::Router;
use tower_http::cors::CorsLayer;

pub async fn serve(addr: &str) -> Result<()> {
    let app = Router::new()
        .nest("/api", routes::api_routes())
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
