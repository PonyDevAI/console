use anyhow::Result;

use crate::services::terminal::backend::TerminalBackend;
use crate::services::terminal::models::{
    AttachBridgeComponents, BackendKind, Persistence, TerminalSessionMeta,
};

pub struct ZellijBackend;

impl ZellijBackend {
    pub fn new() -> Self {
        Self
    }
}

impl TerminalBackend for ZellijBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Zellij
    }

    fn persistence(&self) -> Persistence {
        Persistence::Persistent
    }

    fn is_available(&self) -> bool {
        false // Not implemented yet
    }

    fn create_session(
        &self,
        _id: &str,
        _cwd: Option<&str>,
        _shell: Option<&str>,
        _cols: u16,
        _rows: u16,
    ) -> Result<TerminalSessionMeta> {
        anyhow::bail!("zellij backend is not yet implemented")
    }

    fn terminate_session(&self, _session_name: &str) -> Result<()> {
        anyhow::bail!("zellij backend is not yet implemented")
    }

    fn resize_session(&self, _session_name: &str, _cols: u16, _rows: u16) -> Result<()> {
        anyhow::bail!("zellij backend is not yet implemented")
    }

    fn sync_status(&self, _session_name: &str) -> Result<String> {
        anyhow::bail!("zellij backend is not yet implemented")
    }

    fn spawn_attach_bridge(
        &self,
        _session_name: &str,
        _cwd: Option<&str>,
        _shell: Option<&str>,
        _cols: u16,
        _rows: u16,
    ) -> Result<AttachBridgeComponents> {
        anyhow::bail!("zellij backend is not yet implemented")
    }
}

impl Default for ZellijBackend {
    fn default() -> Self {
        Self::new()
    }
}
