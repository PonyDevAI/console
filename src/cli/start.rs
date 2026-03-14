use crate::api;

pub async fn run(host: &str, port: u16) -> anyhow::Result<()> {
    crate::services::logs::init_startup_logs();
    let addr = format!("{host}:{port}");
    tracing::info!("Starting Console daemon on {addr}");
    crate::services::logs::push("info", "daemon", &format!("Console daemon started on {addr}"));
    println!("Console listening on http://{addr}");
    api::serve(&addr).await
}
