use crate::api;

pub async fn run(host: &str, port: u16) -> anyhow::Result<()> {
    crate::services::logs::init_startup_logs();
    let addr = format!("{host}:{port}");
    tracing::info!("Starting CloudCode daemon on {addr}");
    crate::services::logs::push(
        "info",
        "daemon",
        &format!("CloudCode daemon started on {addr}"),
    );
    println!("CloudCode listening on http://{addr}");
    api::serve(&addr).await
}
