use anyhow::Result;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use super::models::{
    AttachBridgeComponents, BackendKind, CloseFn, CreateSessionRequest, CreateSessionResponse,
    TerminalSessionMeta, TerminalSessionListResponse, TerminalSessionsState,
};
use super::registry::BackendRegistry;
use crate::storage::{read_json, write_json, CloudCodePaths};

pub struct TerminalService {
    paths: CloudCodePaths,
    sessions: Arc<Mutex<HashMap<String, TerminalSessionMeta>>>,
    registry: BackendRegistry,
    /// Active close_fn for ephemeral sessions (pty)
    active_bridges: Arc<Mutex<HashMap<String, CloseFn>>>,
}

impl TerminalService {
    pub fn new() -> Self {
        let paths = CloudCodePaths::default();
        let registry = BackendRegistry::new();
        let service = Self {
            paths,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            registry,
            active_bridges: Arc::new(Mutex::new(HashMap::new())),
        };
        service.load_and_sync().ok();
        service
    }

    fn load_and_sync(&self) -> Result<()> {
        let state: TerminalSessionsState = if self.paths.terminal_sessions_file().exists() {
            read_json(&self.paths.terminal_sessions_file())?
        } else {
            TerminalSessionsState::default()
        };

        let mut sessions = self.sessions.lock().unwrap();
        for meta in state.sessions {
            // Only sync persistent sessions (tmux), skip ephemeral ones
            if meta.persistence == "persistent" && meta.backend == "tmux" {
                if let Some(backend_name) = &meta.backend_session_name {
                    let backend = self.registry.find_backend(BackendKind::Tmux);
                    if let Some(b) = backend {
                        let status = match b.sync_status(backend_name) {
                            Ok(s) => s,
                            Err(e) => {
                                tracing::warn!(session_id = %meta.id, "Failed to sync tmux status, preserving: {}", e);
                                meta.status.clone()
                            }
                        };
                        let mut updated = meta.clone();
                        updated.status = status;
                        sessions.insert(meta.id.clone(), updated);
                    }
                }
            }
            // Ephemeral sessions are not persisted across restarts
        }

        self.save_state(&sessions)?;
        Ok(())
    }

    fn save_state(&self, sessions: &HashMap<String, TerminalSessionMeta>) -> Result<()> {
        // Only save persistent sessions
        let persistent_sessions: Vec<TerminalSessionMeta> = sessions
            .values()
            .filter(|s| s.persistence == "persistent")
            .cloned()
            .collect();

        let state = TerminalSessionsState {
            sessions: persistent_sessions,
        };
        write_json(&self.paths.terminal_sessions_file(), &state)?;
        Ok(())
    }

    fn sync_session_status(&self, id: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(meta) = sessions.get_mut(id) {
            if meta.persistence == "persistent" {
                if let Some(backend_name) = &meta.backend_session_name {
                    let kind = BackendKind::from_str(&meta.backend)
                        .unwrap_or(BackendKind::Pty);
                    if let Some(backend) = self.registry.find_backend(kind) {
                        match backend.sync_status(backend_name) {
                            Ok(status) => {
                                meta.status = status;
                                meta.updated_at = Utc::now();
                                self.save_state(&sessions)?;
                            }
                            Err(e) => {
                                tracing::warn!(session_id = %id, "Failed to sync status: {}", e);
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn sync_all_statuses(&self) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        let mut has_changes = false;

        for meta in sessions.values_mut() {
            if meta.persistence == "persistent" {
                if let Some(backend_name) = &meta.backend_session_name {
                    let kind = BackendKind::from_str(&meta.backend)
                        .unwrap_or(BackendKind::Pty);
                    if let Some(backend) = self.registry.find_backend(kind) {
                        match backend.sync_status(backend_name) {
                            Ok(new_status) => {
                                if meta.status != new_status {
                                    meta.status = new_status;
                                    meta.updated_at = Utc::now();
                                    has_changes = true;
                                }
                            }
                            Err(e) => {
                                tracing::warn!(session_id = %meta.id, "Failed to sync status: {}", e);
                            }
                        }
                    }
                }
            }
        }

        if has_changes {
            self.save_state(&sessions)?;
        }
        Ok(())
    }

    pub fn get_backends(&self) -> Result<super::models::BackendsResponse> {
        Ok(self.registry.get_backends_response())
    }

    pub fn create_session(&self, req: CreateSessionRequest) -> Result<CreateSessionResponse> {
        let backend = self.registry.resolve_backend(req.backend.as_deref())?;

        let id = Uuid::new_v4().to_string();

        let mut meta = backend.create_session(
            &id,
            req.cwd.as_deref(),
            req.shell.as_deref(),
            req.cols,
            req.rows,
        )?;

        // Override title if provided
        if let Some(title) = &req.title {
            meta.title = title.clone();
        }

        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(id.clone(), meta.clone());
            
            // Only save persistent sessions
            if meta.persistence == "persistent" {
                self.save_state(&sessions)?;
            }
        }

        tracing::info!(
            session_id = %id,
            backend = %meta.backend,
            persistence = %meta.persistence,
            "Created terminal session"
        );

        Ok(CreateSessionResponse { session: meta })
    }

    pub fn list_sessions(&self) -> Result<TerminalSessionListResponse> {
        self.sync_all_statuses()?;
        let sessions = self.sessions.lock().unwrap();
        Ok(TerminalSessionListResponse {
            sessions: sessions.values().cloned().collect(),
        })
    }

    pub fn get_session(&self, id: &str) -> Result<TerminalSessionMeta> {
        self.sync_session_status(id)?;
        let sessions = self.sessions.lock().unwrap();
        sessions.get(id).cloned().ok_or_else(|| anyhow::anyhow!("Session not found"))
    }

    pub fn terminate_session(&self, id: &str) -> Result<()> {
        tracing::info!(session_id = %id, "Terminating session");

        let meta = {
            let sessions = self.sessions.lock().unwrap();
            sessions.get(id).cloned().ok_or_else(|| anyhow::anyhow!("Session not found"))?
        };

        if meta.persistence == "ephemeral" {
            let close_fn = {
                let mut bridges = self.active_bridges.lock().unwrap();
                bridges.remove(id)
            };

            if let Some(close_fn) = close_fn {
                tracing::info!(session_id = %id, "Closing active PTY bridge for ephemeral session");
                close_fn()?;
            }
        }

        if meta.persistence == "persistent" {
            if let Some(backend_name) = &meta.backend_session_name {
                let kind = BackendKind::from_str(&meta.backend)
                    .unwrap_or(BackendKind::Pty);
                if let Some(backend) = self.registry.find_backend(kind) {
                    backend.terminate_session(backend_name)?;
                }
            }
        }

        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.remove(id);
            self.save_state(&sessions)?;
        }

        tracing::info!(session_id = %id, backend = %meta.backend, "Session terminated");
        Ok(())
    }

    pub fn spawn_attach_bridge(&self, id: &str, cols: u16, rows: u16) -> Result<AttachBridgeComponents> {
        // First check if session exists
        let meta = {
            let sessions = self.sessions.lock().unwrap();
            sessions.get(id).cloned().ok_or_else(|| anyhow::anyhow!("Session '{}' not found", id))?
        };

        // Sync status for persistent sessions
        if meta.persistence == "persistent" {
            self.sync_session_status(id)?;
            // Re-fetch after sync
            let sessions = self.sessions.lock().unwrap();
            let updated_meta = sessions.get(id).cloned()
                .ok_or_else(|| anyhow::anyhow!("Session '{}' not found after sync", id))?;
            
            if updated_meta.status != "running" {
                return Err(anyhow::anyhow!("Session '{}' is not running (status: {})", id, updated_meta.status));
            }
        } else {
            // For ephemeral sessions, check if already running (single-attach)
            if meta.status == "running" {
                return Err(anyhow::anyhow!("Ephemeral session '{}' already has an active connection", id));
            }
        }

        let kind = BackendKind::from_str(&meta.backend)
            .unwrap_or(BackendKind::Pty);
        let backend = self.registry.find_backend(kind)
            .ok_or_else(|| anyhow::anyhow!("Backend '{}' not found", meta.backend))?;

        // For pty backend, backend_session_name is None, we pass id
        let session_name = meta.backend_session_name.as_deref().unwrap_or(id);

        // Pass cwd/shell from session meta to backend
        let cwd = meta.cwd.as_str();
        let shell = meta.shell.as_str();

        let components = backend.spawn_attach_bridge(session_name, Some(cwd), Some(shell), cols, rows)
            .map_err(|e| {
                // If attach fails, clean up ephemeral session
                if meta.persistence == "ephemeral" {
                    tracing::warn!(session_id = %id, "Attach failed for ephemeral session, cleaning up: {}", e);
                    let mut sessions = self.sessions.lock().unwrap();
                    sessions.remove(id);
                }
                e
            })?;

// For ephemeral sessions, store the close_fn and mark as running
        if meta.persistence == "ephemeral" {
            {
                let mut bridges = self.active_bridges.lock().unwrap();
                bridges.insert(id.to_string(), components.close_fn.clone());
            }
            {
                let mut sessions = self.sessions.lock().unwrap();
                if let Some(m) = sessions.get_mut(id) {
                    m.status = "running".to_string();
                    m.updated_at = Utc::now();
                }
            }
        }

        Ok(components)
    }

    /// Cleanup ephemeral session after attach bridge closes.
    /// Pty sessions are single-attach: disconnect ends the session.
    pub fn cleanup_ephemeral_session(&self, id: &str) -> Result<()> {
        let meta = {
            let sessions = self.sessions.lock().unwrap();
            sessions.get(id).cloned()
        };

        if let Some(meta) = meta {
            if meta.persistence == "ephemeral" {
                tracing::info!(session_id = %id, backend = %meta.backend, "Cleaning up ephemeral session (disconnect ends session)");
                
                let close_fn = {
                    let mut bridges = self.active_bridges.lock().unwrap();
                    bridges.remove(id)
                };

                if let Some(close_fn) = close_fn {
                    tracing::info!(session_id = %id, "Calling close_fn for ephemeral session");
                    close_fn()?;
                }
                
                {
                    let mut sessions = self.sessions.lock().unwrap();
                    sessions.remove(id);
                }
                
                tracing::info!(session_id = %id, "Ephemeral session removed");
            }
        }
        
        Ok(())
    }
}

impl Default for TerminalService {
    fn default() -> Self {
        Self::new()
    }
}
