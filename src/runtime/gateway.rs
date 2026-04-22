use crate::runtime::errors::{Result, RuntimeError};
use crate::runtime::manager::RuntimeManager;
use crate::runtime::models::{RuntimeEvent, RuntimeRequest, RuntimeRun, RuntimeTarget};
use crate::runtime::registry::RuntimeRegistry;
use std::sync::Arc;

/// Gateway for runtime execution
pub struct RuntimeGateway {
    registry: RuntimeRegistry,
    manager: Arc<RuntimeManager>,
}

impl RuntimeGateway {
    pub fn new(registry: RuntimeRegistry, manager: Arc<RuntimeManager>) -> Self {
        Self { registry, manager }
    }

    /// Start a runtime request
    pub async fn start_run(&self, request: RuntimeRequest) -> Result<RuntimeRun> {
        // Resolve target to adapter
        let adapter_name = self.resolve_adapter(&request.target, &request.model)?;
        let adapter = self
            .registry
            .find(&adapter_name)
            .ok_or_else(|| RuntimeError::AdapterNotFound(adapter_name.clone()))?;

        // Create run record - this generates the ONE TRUE run_id
        let mut run = RuntimeRun::new(&request, adapter_name.clone());
        run.status = crate::runtime::models::RuntimeRunStatus::Running;

        self.manager.register_run(run.clone()).await;

        // Start the actual run - pass the SAME run_id to adapter
        let run_id = run.id.clone();
        let thread_id = request.thread_id.clone();
        let manager = self.manager.clone();

        tokio::spawn(async move {
            match adapter.start_run(request, run_id.clone()).await {
                Ok(handle) => {
                    manager
                        .register_cancel_handle(run_id.clone(), handle.cancel_handle)
                        .await;

                    let mut event_rx = handle.event_rx;
                    let mut _accumulated_output = String::new();

                    while let Some(event) = event_rx.recv().await {
                        // Broadcast runtime event
                        manager.broadcast_to_run(&run_id, event.clone()).await;

                        // Broadcast raw runtime event to thread channel
                        // ThreadService will handle the bridge to ThreadEvent
                        if let Some(ref tid) = thread_id {
                            manager.broadcast_to_thread(tid, event.clone()).await;
                        }

                        match &event {
                            RuntimeEvent::TextDelta { text, .. } => {
                                _accumulated_output.push_str(text);
                            }
                            RuntimeEvent::RunCompleted { output, .. } => {
                                manager.update_run_output(&run_id, output.clone()).await;
                                manager
                                    .update_run_status(
                                        &run_id,
                                        crate::runtime::models::RuntimeRunStatus::Completed,
                                    )
                                    .await;
                                break;
                            }
                            RuntimeEvent::RunFailed { error, .. } => {
                                manager.update_run_error(&run_id, error.clone()).await;
                                break;
                            }
                            RuntimeEvent::RunCancelled { .. } => {
                                manager
                                    .update_run_status(
                                        &run_id,
                                        crate::runtime::models::RuntimeRunStatus::Cancelled,
                                    )
                                    .await;
                                break;
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    manager.update_run_error(&run_id, e.to_string()).await;
                }
            }
        });

        Ok(run)
    }

    /// Cancel a run
    pub async fn cancel_run(&self, run_id: &str) -> Result<()> {
        self.manager.cancel_run(run_id).await
    }

    /// Get run by ID
    pub async fn get_run(&self, run_id: &str) -> Option<RuntimeRun> {
        self.manager.get_run(run_id).await
    }

    /// Get runs for a thread
    pub async fn get_thread_runs(&self, thread_id: &str) -> Vec<RuntimeRun> {
        self.manager.get_thread_runs(thread_id).await
    }

    /// Subscribe to run events
    pub async fn subscribe_run(&self, run_id: &str) -> broadcast::Receiver<RuntimeEvent> {
        self.manager.create_run_channel(run_id).await
    }

    /// Subscribe to thread events
    pub async fn subscribe_thread(&self, thread_id: &str) -> broadcast::Receiver<RuntimeEvent> {
        self.manager.create_thread_channel(thread_id).await
    }

    /// Resolve adapter from target and model
    fn resolve_adapter(&self, target: &RuntimeTarget, model: &str) -> Result<String> {
        match target {
            RuntimeTarget::Codex => Ok("codex".to_string()),
            RuntimeTarget::Claude => Ok("claude".to_string()),
            RuntimeTarget::Auto => {
                // Simple auto-routing based on model name
                if model.contains("gpt") || model.contains("codex") {
                    Ok("codex".to_string())
                } else if model.contains("claude") || model.contains("sonnet") {
                    Ok("claude".to_string())
                } else {
                    // Default to codex
                    Ok("codex".to_string())
                }
            }
        }
    }
}

// Re-export broadcast for external use
pub use tokio::sync::broadcast;
