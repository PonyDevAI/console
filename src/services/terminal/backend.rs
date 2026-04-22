use super::models::{AttachBridgeComponents, BackendKind, Persistence, TerminalSessionMeta};
use anyhow::Result;

pub trait TerminalBackend: Send + Sync {
    fn kind(&self) -> BackendKind;
    fn persistence(&self) -> Persistence;
    fn is_available(&self) -> bool;

    fn create_session(
        &self,
        id: &str,
        cwd: Option<&str>,
        shell: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<TerminalSessionMeta>;

    fn terminate_session(&self, session_name: &str) -> Result<()>;

    fn resize_session(&self, session_name: &str, cols: u16, rows: u16) -> Result<()>;

    fn sync_status(&self, session_name: &str) -> Result<String>;

    fn spawn_attach_bridge(
        &self,
        session_name: &str,
        cwd: Option<&str>,
        shell: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<AttachBridgeComponents>;
}
