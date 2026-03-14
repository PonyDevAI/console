mod cli;
mod api;
mod services;
mod adapters;
mod sync;
mod storage;
mod models;

use clap::Parser;

#[derive(Parser)]
#[command(name = "console", about = "Local AI CLI unified management platform", version)]
struct Cli {
    #[command(subcommand)]
    command: cli::Command,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "console=info".into()),
        )
        .init();

    let cli = Cli::parse();
    cli::execute(cli.command).await
}
