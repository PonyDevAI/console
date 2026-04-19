use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::path::PathBuf;
use std::env;
use std::sync::{Arc, Mutex};

use crate::services::terminal::backend::TerminalBackend;
use crate::services::terminal::models::{AttachBridgeComponents, BackendKind, Persistence, TerminalSessionMeta};
use chrono::Utc;

pub struct PtyBackend;

impl PtyBackend {
    pub fn new() -> Self {
        Self
    }

    fn find_shell(shell: Option<&str>) -> Result<PathBuf> {
        shell
            .map(PathBuf::from)
            .or_else(|| env::var("SHELL").ok().map(PathBuf::from))
            .or_else(|| {
                let p = PathBuf::from("/bin/zsh");
                p.exists().then_some(p)
            })
            .or_else(|| {
                let p = PathBuf::from("/bin/bash");
                p.exists().then_some(p)
            })
            .or_else(|| {
                let p = PathBuf::from("/bin/sh");
                p.exists().then_some(p)
            })
            .context("No available shell found")
    }
}

impl TerminalBackend for PtyBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Pty
    }

    fn persistence(&self) -> Persistence {
        Persistence::Ephemeral
    }

    fn is_available(&self) -> bool {
        // Pty backend is always available as it's just a shell in PTY
        true
    }

    fn create_session(
        &self,
        id: &str,
        cwd: Option<&str>,
        shell: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<TerminalSessionMeta> {
        let shell_path = Self::find_shell(shell)?;
        let cwd_path = cwd
            .map(|s| {
                if s == "~" {
                    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
                } else if s.starts_with("~/") {
                    dirs::home_dir()
                        .map(|h| h.join(s.strip_prefix("~/").unwrap()))
                        .unwrap_or_else(|| PathBuf::from(s))
                } else {
                    PathBuf::from(s)
                }
            })
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

        let now = Utc::now();

        tracing::info!(
            session_id = %id,
            shell_path = %shell_path.display(),
            cwd = %cwd_path.display(),
            cols = cols,
            rows = rows,
            "Creating ephemeral pty session"
        );

        Ok(TerminalSessionMeta {
            id: id.to_string(),
            title: format!("Terminal {}", cwd_path.display()),
            cwd: cwd_path.to_string_lossy().to_string(),
            shell: shell_path.to_string_lossy().to_string(),
            backend: "pty".to_string(),
            persistence: "ephemeral".to_string(),
            backend_session_name: None, // No persistent backend session for pty
            status: "pending".to_string(), // Will become running when attach bridge is created
            created_at: now,
            updated_at: now,
        })
    }

    fn terminate_session(&self, _session_name: &str) -> Result<()> {
        // Pty sessions are ephemeral, terminate happens when attach bridge closes
        tracing::info!("Pty session termination (ephemeral, no persistent state)");
        Ok(())
    }

    fn resize_session(&self, _session_name: &str, _cols: u16, _rows: u16) -> Result<()> {
        // Pty resize happens through attach bridge resize_fn
        Ok(())
    }

    fn sync_status(&self, _session_name: &str) -> Result<String> {
        // Pty sessions have no persistent state to sync
        Ok("running".to_string())
    }

    fn spawn_attach_bridge(
        &self,
        _session_name: &str,
        cwd: Option<&str>,
        shell: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<AttachBridgeComponents> {
        // For pty backend, spawn_attach_bridge directly creates the shell PTY
        // Use provided cwd/shell, fallback to defaults
        let shell_path = Self::find_shell(shell)?;
        let cwd_path = cwd
            .map(|s| {
                if s == "~" {
                    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
                } else if s.starts_with("~/") {
                    dirs::home_dir()
                        .map(|h| h.join(s.strip_prefix("~/").unwrap()))
                        .unwrap_or_else(|| PathBuf::from(s))
                } else {
                    PathBuf::from(s)
                }
            })
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

        tracing::info!(
            cols = cols,
            rows = rows,
            shell = %shell_path.display(),
            cwd = %cwd_path.display(),
            "Spawning direct shell PTY for ephemeral session"
        );

        let pty_system = NativePtySystem::default();
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .context("Failed to open PTY for shell")?;

        let mut cmd = CommandBuilder::new(&shell_path);
        cmd.cwd(cwd_path);

        let child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn shell in PTY")?;

        let reader = pair
            .master
            .try_clone_reader()
            .context("Failed to clone PTY reader")?;
        let writer = pair
            .master
            .take_writer()
            .context("Failed to take PTY writer")?;

        let pty_master = Arc::new(Mutex::new(pair.master));
        let resize_fn: Arc<dyn Fn(u16, u16) -> Result<()> + Send + Sync> = Arc::new({
            let pty_master = pty_master.clone();
            move |cols: u16, rows: u16| {
                let size = PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                };
                let guard = pty_master.lock().unwrap();
                guard.resize(size)?;
                Ok(())
            }
        });

        let child = Arc::new(Mutex::new(Some(child)));
        let close_fn: Arc<dyn Fn() -> Result<()> + Send + Sync> = Arc::new({
            let child = child.clone();
            move || {
                tracing::info!("Closing ephemeral PTY");
                let mut child_guard = child.lock().unwrap();
                if let Some(mut c) = child_guard.take() {
                    let _ = c.kill();
                    let _ = c.wait();
                }
                Ok(())
            }
        });

        Ok(AttachBridgeComponents {
            reader,
            writer,
            resize_fn,
            close_fn,
        })
    }
}

impl Default for PtyBackend {
    fn default() -> Self {
        Self::new()
    }
}
