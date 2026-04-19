#[tokio::main]
async fn main() -> anyhow::Result<()> {
    cloudcode::run_cli().await
}
