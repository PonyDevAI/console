mod init;
mod start;
mod doctor;
mod scan;

use clap::Subcommand;

#[derive(Subcommand)]
pub enum Command {
    /// Initialize ~/.console/ directory structure
    Init,
    /// Start the Console daemon (API server)
    Start {
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value_t = 8080)]
        port: u16,
    },
    /// Show daemon status and system info
    Status,
    /// Run diagnostic checks
    Doctor,
    /// Scan for installed CLI tools
    Scan,
    /// Sync Console config to CLI native config files
    Sync {
        /// Only sync a specific config type
        #[arg(long)]
        only: Option<String>,
    },
}

pub async fn execute(cmd: Command) -> anyhow::Result<()> {
    match cmd {
        Command::Init => init::run().await,
        Command::Start { host, port } => start::run(&host, port).await,
        Command::Status => {
            println!("Console status: not yet implemented");
            Ok(())
        }
        Command::Doctor => doctor::run().await,
        Command::Scan => scan::run().await,
        Command::Sync { only: _ } => {
            let report = crate::sync::sync_all()?;
            println!("Sync completed:");
            println!("  Providers synced: {}", report.providers_synced);
            println!("  MCP servers synced: {}", report.mcp_servers_synced);
            if !report.errors.is_empty() {
                println!("  Errors:");
                for err in &report.errors {
                    println!("    - {err}");
                }
            }
            Ok(())
        }
    }
}
