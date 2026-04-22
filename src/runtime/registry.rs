use crate::runtime::errors::Result;
use crate::runtime::models::{RuntimeCapabilities, RuntimeEvent, RuntimeRequest};
use tokio::sync::mpsc;

/// Handle for a running runtime instance
pub struct RunHandle {
    pub run_id: String,
    pub event_rx: mpsc::Receiver<RuntimeEvent>,
    pub cancel_handle: CancelHandle,
}

/// Handle to cancel a running runtime
pub struct CancelHandle {
    cancel_tx: mpsc::Sender<()>,
}

impl CancelHandle {
    pub fn new(cancel_tx: mpsc::Sender<()>) -> Self {
        Self { cancel_tx }
    }

    pub async fn cancel(self) -> Result<()> {
        self.cancel_tx.send(()).await.map_err(|_| {
            crate::runtime::errors::RuntimeError::InternalError(
                "Failed to send cancel signal".into(),
            )
        })?;
        Ok(())
    }
}

/// Trait for runtime adapters - executes CLI tools
#[async_trait::async_trait]
pub trait RuntimeAdapter: Send + Sync {
    /// Internal name (e.g. "codex", "claude")
    fn name(&self) -> &str;

    /// Human-readable name
    fn display_name(&self) -> &str;

    /// Capabilities of this adapter
    fn capabilities(&self) -> RuntimeCapabilities;

    /// Start a new run
    async fn start_run(&self, request: RuntimeRequest, run_id: String) -> Result<RunHandle>;

    /// Cancel a running run
    async fn cancel_run(&self, run_id: &str) -> Result<()>;
}

/// Registry for runtime adapters
pub struct RuntimeRegistry {
    adapters: Vec<std::sync::Arc<dyn RuntimeAdapter>>,
}

impl RuntimeRegistry {
    pub fn new() -> Self {
        Self { adapters: vec![] }
    }

    pub fn register(&mut self, adapter: std::sync::Arc<dyn RuntimeAdapter>) {
        self.adapters.push(adapter);
    }

    pub fn find(&self, name: &str) -> Option<std::sync::Arc<dyn RuntimeAdapter>> {
        self.adapters.iter().find(|a| a.name() == name).cloned()
    }

    pub fn adapters(&self) -> &[std::sync::Arc<dyn RuntimeAdapter>] {
        &self.adapters
    }
}

impl Default for RuntimeRegistry {
    fn default() -> Self {
        Self::new()
    }
}
