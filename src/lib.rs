pub mod cli;
pub mod api;
pub mod services;
pub mod adapters;
pub mod sync;
pub mod storage;
pub mod models;
pub mod runtime;

use clap::Parser;

#[derive(Parser)]
#[command(name = "cloudcode", about = "Local AI CLI unified management platform", version)]
pub struct Cli {
    #[command(subcommand)]
    command: cli::Command,
}

pub async fn run_cli() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "cloudcode=info".into()),
        )
        .init();

    let cli = Cli::parse();
    cli::execute(cli.command).await
}
