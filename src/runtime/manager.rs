use crate::runtime::errors::{Result, RuntimeError};
use crate::runtime::models::{RuntimeEvent, RuntimeRun, RuntimeRunStatus};
use std::collections::HashMap;
use tokio::sync::{broadcast, RwLock};

/// Manages active runtime runs
pub struct RuntimeManager {
    runs: RwLock<HashMap<String, RuntimeRun>>,
    run_channels: RwLock<HashMap<String, broadcast::Sender<RuntimeEvent>>>,
    thread_channels: RwLock<HashMap<String, broadcast::Sender<RuntimeEvent>>>,
    thread_event_channels: RwLock<HashMap<String, broadcast::Sender<crate::runtime::ThreadEvent>>>,
    cancel_handles: RwLock<HashMap<String, crate::runtime::registry::CancelHandle>>,
    // Track active bridges to prevent duplicates
    active_bridges: RwLock<HashMap<String, bool>>,
}

impl RuntimeManager {
    pub fn new() -> Self {
        Self {
            runs: RwLock::new(HashMap::new()),
            run_channels: RwLock::new(HashMap::new()),
            thread_channels: RwLock::new(HashMap::new()),
            thread_event_channels: RwLock::new(HashMap::new()),
            cancel_handles: RwLock::new(HashMap::new()),
            active_bridges: RwLock::new(HashMap::new()),
        }
    }

    /// Check if a bridge is active for a thread
    pub async fn is_bridge_active(&self, thread_id: &str) -> bool {
        let bridges = self.active_bridges.read().await;
        bridges.contains_key(thread_id)
    }

    /// Mark a bridge as active for a thread (returns true if newly marked)
    pub async fn mark_bridge_active(&self, thread_id: &str) -> bool {
        let mut bridges = self.active_bridges.write().await;
        if bridges.contains_key(thread_id) {
            return false;
        }
        bridges.insert(thread_id.to_string(), true);
        true
    }

    /// Unmark a bridge as active for a thread
    pub async fn unmark_bridge_active(&self, thread_id: &str) {
        let mut bridges = self.active_bridges.write().await;
        bridges.remove(thread_id);
    }

    /// Get or create a broadcast channel for a run (get-or-create pattern)
    pub async fn get_or_create_run_channel(
        &self,
        run_id: &str,
    ) -> broadcast::Receiver<RuntimeEvent> {
        // First check if channel exists with read lock
        {
            let channels = self.run_channels.read().await;
            if let Some(tx) = channels.get(run_id) {
                return tx.subscribe();
            }
        }

        // Channel doesn't exist, create it with write lock
        let (tx, rx) = broadcast::channel(100);
        let mut channels = self.run_channels.write().await;

        // Double-check in case another task created it while we were waiting
        if let Some(existing_tx) = channels.get(run_id) {
            return existing_tx.subscribe();
        }

        channels.insert(run_id.to_string(), tx);
        rx
    }

    /// Get or create a broadcast channel for a thread (RuntimeEvent)
    pub async fn get_or_create_thread_channel(
        &self,
        thread_id: &str,
    ) -> broadcast::Receiver<RuntimeEvent> {
        // First check with read lock
        {
            let channels = self.thread_channels.read().await;
            if let Some(tx) = channels.get(thread_id) {
                return tx.subscribe();
            }
        }

        // Create new channel
        let (tx, rx) = broadcast::channel(100);
        let mut channels = self.thread_channels.write().await;

        // Double-check
        if let Some(existing_tx) = channels.get(thread_id) {
            return existing_tx.subscribe();
        }

        channels.insert(thread_id.to_string(), tx);
        rx
    }

    /// Get or create a broadcast channel for a thread (ThreadEvent)
    pub async fn get_or_create_thread_event_channel(
        &self,
        thread_id: &str,
    ) -> broadcast::Receiver<crate::runtime::ThreadEvent> {
        // First check with read lock
        {
            let channels = self.thread_event_channels.read().await;
            if let Some(tx) = channels.get(thread_id) {
                return tx.subscribe();
            }
        }

        // Create new channel
        let (tx, rx) = broadcast::channel(100);
        let mut channels = self.thread_event_channels.write().await;

        // Double-check
        if let Some(existing_tx) = channels.get(thread_id) {
            return existing_tx.subscribe();
        }

        channels.insert(thread_id.to_string(), tx);
        rx
    }

    /// Deprecated: Use get_or_create_run_channel instead
    pub async fn create_run_channel(&self, run_id: &str) -> broadcast::Receiver<RuntimeEvent> {
        self.get_or_create_run_channel(run_id).await
    }

    /// Deprecated: Use get_or_create_thread_channel instead
    pub async fn create_thread_channel(
        &self,
        thread_id: &str,
    ) -> broadcast::Receiver<RuntimeEvent> {
        self.get_or_create_thread_channel(thread_id).await
    }

    /// Deprecated: Use get_or_create_thread_event_channel instead
    pub async fn create_thread_event_channel(
        &self,
        thread_id: &str,
    ) -> broadcast::Receiver<crate::runtime::ThreadEvent> {
        self.get_or_create_thread_event_channel(thread_id).await
    }

    /// Register a new run
    pub async fn register_run(&self, run: RuntimeRun) {
        let mut runs = self.runs.write().await;
        runs.insert(run.id.clone(), run);
    }

    /// Get a run by ID
    pub async fn get_run(&self, run_id: &str) -> Option<RuntimeRun> {
        let runs = self.runs.read().await;
        runs.get(run_id).cloned()
    }

    /// Update run status
    pub async fn update_run_status(&self, run_id: &str, status: RuntimeRunStatus) {
        let mut runs = self.runs.write().await;
        if let Some(run) = runs.get_mut(run_id) {
            run.status = status.clone();
            if matches!(
                status,
                RuntimeRunStatus::Completed
                    | RuntimeRunStatus::Failed
                    | RuntimeRunStatus::Cancelled
            ) {
                run.completed_at = Some(chrono::Utc::now());
            }
        }
    }

    /// Update run error
    pub async fn update_run_error(&self, run_id: &str, error: String) {
        let mut runs = self.runs.write().await;
        if let Some(run) = runs.get_mut(run_id) {
            run.error = Some(error);
            run.status = RuntimeRunStatus::Failed;
            run.completed_at = Some(chrono::Utc::now());
        }
    }

    /// Update run output
    pub async fn update_run_output(&self, run_id: &str, output: String) {
        let mut runs = self.runs.write().await;
        if let Some(run) = runs.get_mut(run_id) {
            run.output = Some(output);
        }
    }

    /// Register a cancel handle for a run
    pub async fn register_cancel_handle(
        &self,
        run_id: String,
        handle: crate::runtime::registry::CancelHandle,
    ) {
        let mut handles = self.cancel_handles.write().await;
        handles.insert(run_id, handle);
    }

    /// Cancel a run
    pub async fn cancel_run(&self, run_id: &str) -> Result<()> {
        let mut handles = self.cancel_handles.write().await;
        if let Some(handle) = handles.remove(run_id) {
            handle.cancel().await?;
            self.update_run_status(run_id, RuntimeRunStatus::Cancelled)
                .await;
            Ok(())
        } else {
            Err(RuntimeError::InternalError("No cancel handle found".into()))
        }
    }

    /// Get sender for a run channel
    async fn get_run_sender(&self, run_id: &str) -> Option<broadcast::Sender<RuntimeEvent>> {
        let channels = self.run_channels.read().await;
        channels.get(run_id).cloned()
    }

    /// Get sender for a thread channel (RuntimeEvent)
    async fn get_thread_sender(&self, thread_id: &str) -> Option<broadcast::Sender<RuntimeEvent>> {
        let channels = self.thread_channels.read().await;
        channels.get(thread_id).cloned()
    }

    /// Get sender for a thread event channel (ThreadEvent)
    async fn get_thread_event_sender(
        &self,
        thread_id: &str,
    ) -> Option<broadcast::Sender<crate::runtime::ThreadEvent>> {
        let channels = self.thread_event_channels.read().await;
        channels.get(thread_id).cloned()
    }

    /// Broadcast event to run subscribers
    pub async fn broadcast_to_run(&self, run_id: &str, event: RuntimeEvent) {
        if let Some(tx) = self.get_run_sender(run_id).await {
            let _ = tx.send(event);
        }
    }

    /// Broadcast event to thread subscribers (RuntimeEvent)
    pub async fn broadcast_to_thread(&self, thread_id: &str, event: RuntimeEvent) {
        if let Some(tx) = self.get_thread_sender(thread_id).await {
            let _ = tx.send(event);
        }
    }

    /// Broadcast event to thread subscribers (ThreadEvent)
    pub async fn broadcast_to_thread_event(
        &self,
        thread_id: &str,
        event: crate::runtime::ThreadEvent,
    ) {
        if let Some(tx) = self.get_thread_event_sender(thread_id).await {
            let _ = tx.send(event);
        }
    }

    /// Clean up finished runs
    pub async fn cleanup_finished(&self) {
        let mut runs = self.runs.write().await;
        let mut channels = self.run_channels.write().await;
        let mut handles = self.cancel_handles.write().await;

        let finished: Vec<String> = runs
            .iter()
            .filter(|(_, run)| {
                matches!(
                    run.status,
                    RuntimeRunStatus::Completed
                        | RuntimeRunStatus::Failed
                        | RuntimeRunStatus::Cancelled
                )
            })
            .map(|(id, _)| id.clone())
            .collect();

        for id in finished {
            runs.remove(&id);
            channels.remove(&id);
            handles.remove(&id);
        }
    }

    /// Get all runs for a thread
    pub async fn get_thread_runs(&self, thread_id: &str) -> Vec<RuntimeRun> {
        let runs = self.runs.read().await;
        runs.values()
            .filter(|run| run.thread_id.as_deref() == Some(thread_id))
            .cloned()
            .collect()
    }
}

impl Default for RuntimeManager {
    fn default() -> Self {
        Self::new()
    }
}
