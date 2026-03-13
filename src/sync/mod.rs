//! Config sync engine — translates Console's unified config into each CLI's native format.
//!
//! This module is the core integration layer. It reads Console state and writes
//! to each CLI tool's native config files via the adapter layer.

use anyhow::Result;

/// Sync all Console configuration to all managed CLI tools.
/// This is the main entry point called by `console sync` and the API.
pub fn sync_all() -> Result<SyncReport> {
    let mut report = SyncReport::default();

    // TODO: Phase 1 — implement provider sync
    // TODO: Phase 2 — implement MCP server sync
    // TODO: Phase 2 — implement skills sync
    // TODO: Phase 3 — implement prompt sync

    tracing::info!("sync_all completed: {report:?}");
    Ok(report)
}

#[derive(Debug, Default)]
pub struct SyncReport {
    pub providers_synced: u32,
    pub mcp_servers_synced: u32,
    pub skills_synced: u32,
    pub prompts_synced: u32,
    pub errors: Vec<String>,
}
