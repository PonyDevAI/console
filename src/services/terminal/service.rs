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
use super::backend::TerminalBackend;
use super::backends::{SshConnection, SshTmuxBackend, SshScreenBackend, SshPtyBackend};
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
            // Only sync persistent local sessions. Remote sessions require SSH
            // connection resolution from the desktop shell layer.
            if meta.persistence == "persistent" && meta.target_type == "local" {
                if let Some(backend_name) = &meta.backend_session_name {
                    let kind = BackendKind::from_str(&meta.backend)
                        .unwrap_or(BackendKind::Tmux);
                    if let Some(backend) = self.registry.find_backend(kind) {
                        let status = match backend.sync_status(backend_name) {
                            Ok(s) => s,
                            Err(e) => {
                                tracing::warn!(session_id = %meta.id, "Failed to sync {} status, preserving: {}", kind.as_str(), e);
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
            if meta.persistence == "persistent" && meta.target_type == "local" {
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
            if meta.persistence == "persistent" && meta.target_type == "local" {
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
        let id = Uuid::new_v4().to_string();

        let mut meta = if req.target_type == "server" {
            // Remote target: use SSH-backed backends
            self.create_remote_session(&id, &req)?
        } else {
            // Local target: use local backends
            let backend = self.registry.resolve_backend(req.backend.as_deref())?;
            backend.create_session(
                &id,
                req.cwd.as_deref(),
                req.shell.as_deref(),
                req.cols,
                req.rows,
            )?
        };

        // Override title if provided
        if let Some(title) = &req.title {
            meta.title = title.clone();
        }

        // Apply target metadata from request — service-level truth wins over backend defaults
        meta.target_type = req.target_type.clone();
        meta.target_id = req.target_id.clone();
        meta.target_label = req.target_label.clone();

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
            target_type = %meta.target_type,
            target_label = %meta.target_label,
            "Created terminal session"
        );

        Ok(CreateSessionResponse { session: meta })
    }

    /// Create a remote terminal session via SSH.
    /// Backend priority: tmux -> screen -> pty (all SSH-backed).
    fn create_remote_session(&self, id: &str, req: &CreateSessionRequest) -> Result<TerminalSessionMeta> {
        let ssh_host = req.ssh_host.as_ref()
            .ok_or_else(|| anyhow::anyhow!("SSH host required for server target"))?;
        let ssh_username = req.ssh_username.as_ref()
            .ok_or_else(|| anyhow::anyhow!("SSH username required for server target"))?;

        let conn = SshConnection {
            host: ssh_host.clone(),
            port: req.ssh_port,
            username: ssh_username.clone(),
            identity_file: req.ssh_identity_file.clone(),
        };

        if let Some(explicit) = req.backend.as_deref() {
            return match explicit {
                "tmux" => SshTmuxBackend::new(conn).create_session(
                    id,
                    req.cwd.as_deref(),
                    req.shell.as_deref(),
                    req.cols,
                    req.rows,
                ),
                "screen" => SshScreenBackend::new(conn).create_session(
                    id,
                    req.cwd.as_deref(),
                    req.shell.as_deref(),
                    req.cols,
                    req.rows,
                ),
                "pty" => SshPtyBackend::new(conn).create_session(
                    id,
                    req.cwd.as_deref(),
                    req.shell.as_deref(),
                    req.cols,
                    req.rows,
                ),
                other => Err(anyhow::anyhow!("unsupported remote backend '{}'", other)),
            };
        }

        // Try SSH backends in priority order: tmux -> screen -> pty
        let ssh_tmux = SshTmuxBackend::new(conn.clone());
        if ssh_tmux.is_available() {
            match ssh_tmux.create_session(
                id,
                req.cwd.as_deref(),
                req.shell.as_deref(),
                req.cols,
                req.rows,
            ) {
                Ok(meta) => return Ok(meta),
                Err(err) => {
                    tracing::warn!(session_id = %id, "Remote tmux unavailable or failed, falling back: {}", err);
                }
            }
        }

        let ssh_screen = SshScreenBackend::new(conn.clone());
        if ssh_screen.is_available() {
            match ssh_screen.create_session(
                id,
                req.cwd.as_deref(),
                req.shell.as_deref(),
                req.cols,
                req.rows,
            ) {
                Ok(meta) => return Ok(meta),
                Err(err) => {
                    tracing::warn!(session_id = %id, "Remote screen unavailable or failed, falling back: {}", err);
                }
            }
        }

        let ssh_pty = SshPtyBackend::new(conn);
        ssh_pty.create_session(
            id,
            req.cwd.as_deref(),
            req.shell.as_deref(),
            req.cols,
            req.rows,
        )
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

    pub fn terminate_session_with_ssh(&self, id: &str, conn: SshConnection) -> Result<()> {
        tracing::info!(session_id = %id, "Terminating remote session");

        let meta = {
            let sessions = self.sessions.lock().unwrap();
            sessions.get(id).cloned().ok_or_else(|| anyhow::anyhow!("Session not found"))?
        };

        if meta.target_type != "server" {
            return self.terminate_session(id);
        }

        if meta.persistence == "ephemeral" {
            let close_fn = {
                let mut bridges = self.active_bridges.lock().unwrap();
                bridges.remove(id)
            };

            if let Some(close_fn) = close_fn {
                close_fn()?;
            }
        } else if let Some(backend_name) = &meta.backend_session_name {
            match meta.backend.as_str() {
                "tmux" => SshTmuxBackend::new(conn).terminate_session(backend_name)?,
                "screen" => SshScreenBackend::new(conn).terminate_session(backend_name)?,
                "pty" => SshPtyBackend::new(conn).terminate_session(backend_name)?,
                other => return Err(anyhow::anyhow!("unsupported remote backend '{}'", other)),
            }
        }

        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.remove(id);
            self.save_state(&sessions)?;
        }

        Ok(())
    }

    pub fn spawn_attach_bridge(&self, id: &str, cols: u16, rows: u16) -> Result<AttachBridgeComponents> {
        self.spawn_attach_bridge_with_ssh(id, cols, rows, None)
    }

    pub fn spawn_attach_bridge_with_ssh(
        &self,
        id: &str,
        cols: u16,
        rows: u16,
        ssh_conn: Option<SshConnection>,
    ) -> Result<AttachBridgeComponents> {
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

        // For remote sessions, use SSH-backed backend
        if meta.target_type == "server" {
            if let Some(conn) = ssh_conn {
                return self.spawn_remote_attach_bridge(&meta, conn, cols, rows);
            }
            return Err(anyhow::anyhow!("SSH connection info required for remote session"));
        }

        // Local session: use registry backend
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

    /// Spawn attach bridge for a remote (SSH) session.
    fn spawn_remote_attach_bridge(
        &self,
        meta: &TerminalSessionMeta,
        conn: SshConnection,
        cols: u16,
        rows: u16,
    ) -> Result<AttachBridgeComponents> {
        let backend = match meta.backend.as_str() {
            "tmux" => Box::new(SshTmuxBackend::new(conn)) as Box<dyn crate::services::terminal::backend::TerminalBackend>,
            "screen" => Box::new(SshScreenBackend::new(conn)) as Box<dyn crate::services::terminal::backend::TerminalBackend>,
            _ => Box::new(SshPtyBackend::new(conn)) as Box<dyn crate::services::terminal::backend::TerminalBackend>,
        };

        let session_name = meta.backend_session_name.as_deref().unwrap_or(&meta.id);
        let cwd = meta.cwd.as_str();
        let shell = meta.shell.as_str();

        backend.spawn_attach_bridge(session_name, Some(cwd), Some(shell), cols, rows)
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
