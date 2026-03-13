use crate::api;

pub async fn run(host: &str, port: u16) -> anyhow::Result<()> {
    let addr = format!("{host}:{port}");
    tracing::info!("Starting Console daemon on {addr}");
    println!("Console listening on http://{addr}");
    api::serve(&addr).await
}
