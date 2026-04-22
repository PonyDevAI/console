use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::env;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::services::terminal::backend::TerminalBackend;
use crate::services::terminal::models::{
    AttachBridgeComponents, BackendKind, Persistence, TerminalSessionMeta,
};
use chrono::Utc;

const SCREEN_PREFIX: &str = "console-";

pub struct ScreenBackend;

impl ScreenBackend {
    pub fn new() -> Self {
        Self
    }

    fn configure_shell_env_for_process(cmd: &mut std::process::Command) {
        cmd.env("SHELL_SESSIONS_DISABLE", "1");
        cmd.env("TERM_PROGRAM", "CloudCode");
        cmd.env_remove("TERM_SESSION_ID");
        cmd.env_remove("TERM_PROGRAM_VERSION");
    }

    fn configure_shell_env_for_pty(cmd: &mut CommandBuilder) {
        cmd.env("SHELL_SESSIONS_DISABLE", "1");
        cmd.env("TERM_PROGRAM", "CloudCode");
        cmd.env_remove("TERM_SESSION_ID");
        cmd.env_remove("TERM_PROGRAM_VERSION");
    }

    fn resize_window(session_name: &str, cols: u16, rows: u16) {
        let output = std::process::Command::new("screen")
            .args([
                "-S",
                session_name,
                "-X",
                "width",
                "-w",
                &cols.to_string(),
                &rows.to_string(),
            ])
            .output();

        if let Ok(o) = output {
            if !o.status.success() {
                tracing::warn!(
                    session_name = %session_name,
                    cols = cols,
                    rows = rows,
                    "screen width -w resize failed"
                );
            }
        }
    }

    fn session_name(id: &str) -> String {
        format!("{}{}", SCREEN_PREFIX, id)
    }

    fn has_session(name: &str) -> Result<bool> {
        let output = std::process::Command::new("screen")
            .args(["-ls"])
            .output()
            .context("Failed to list screen sessions")?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Screen session format: <pid>.<name> (Detached/Attached)
        Ok(stdout.contains(&format!(".{}", name)))
    }
}

impl TerminalBackend for ScreenBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Screen
    }

    fn persistence(&self) -> Persistence {
        Persistence::Persistent
    }

    fn is_available(&self) -> bool {
        std::process::Command::new("which")
            .arg("screen")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn create_session(
        &self,
        id: &str,
        cwd: Option<&str>,
        shell: Option<&str>,
        _cols: u16,
        _rows: u16,
    ) -> Result<TerminalSessionMeta> {
        let shell_path = shell
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
            .context("No available shell found")?;

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

        let backend_name = Self::session_name(id);
        let now = Utc::now();

        tracing::info!(
            session_id = %id,
            backend_name = %backend_name,
            shell_path = %shell_path.display(),
            cwd = %cwd_path.display(),
            "Creating screen session"
        );

        // Create screen session
        // Note: screen -c is for config file, not cwd. Use shell's cwd instead.
        // Set TERM to a shorter value to avoid "$TERM too long" error
        let mut cmd = std::process::Command::new("screen");
        cmd.args(["-dmS", &backend_name]);
        cmd.current_dir(&cwd_path);
        cmd.env("TERM", "screen-256color");
        Self::configure_shell_env_for_process(&mut cmd);

        let shell_name = shell_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        match shell_name {
            "zsh" | "bash" => {
                cmd.arg(&shell_path).arg("-l").arg("-i");
            }
            _ => {
                cmd.arg(&shell_path);
            }
        }

        let output = cmd.output().context("Failed to create screen session")?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("screen create failed: {}", stderr);
        }

        Ok(TerminalSessionMeta {
            id: id.to_string(),
            title: format!("Terminal {}", cwd_path.display()),
            cwd: cwd_path.to_string_lossy().to_string(),
            shell: shell_path.to_string_lossy().to_string(),
            backend: "screen".to_string(),
            persistence: "persistent".to_string(),
            backend_session_name: Some(backend_name.clone()),
            status: "running".to_string(),
            created_at: now,
            updated_at: now,
            target_type: "local".to_string(),
            target_id: None,
            target_label: "Local".to_string(),
        })
    }

    fn terminate_session(&self, session_name: &str) -> Result<()> {
        tracing::info!(session_name = %session_name, "Killing screen session");
        let output = std::process::Command::new("screen")
            .args(["-S", session_name, "-X", "quit"])
            .output()
            .context("Failed to kill screen session")?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("screen quit failed: {}", stderr);
        }
        Ok(())
    }

    fn resize_session(&self, session_name: &str, cols: u16, rows: u16) -> Result<()> {
        tracing::debug!(
            session_name = %session_name,
            cols = cols,
            rows = rows,
            "screen resize handled by active attach PTY only"
        );
        Ok(())
    }

    fn sync_status(&self, session_name: &str) -> Result<String> {
        if Self::has_session(session_name)? {
            Ok("running".to_string())
        } else {
            Ok("exited".to_string())
        }
    }

    fn spawn_attach_bridge(
        &self,
        session_name: &str,
        _cwd: Option<&str>,
        _shell: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<AttachBridgeComponents> {
        if !Self::has_session(session_name)? {
            anyhow::bail!("screen session '{}' does not exist", session_name);
        }

        tracing::info!(session_name = %session_name, cols = cols, rows = rows, "Spawning screen attach bridge with PTY");
        Self::resize_window(session_name, cols, rows);

        let pty_system = NativePtySystem::default();
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .context("Failed to open PTY for attach bridge")?;

        let mut cmd = CommandBuilder::new("screen");
        // -d -r: Detach if attached, then resume
        cmd.args(["-d", "-r", session_name]);
        cmd.env("TERM", "screen-256color");
        Self::configure_shell_env_for_pty(&mut cmd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| anyhow::anyhow!("Failed to spawn screen attach: {}", e))?;

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
                {
                    let guard = pty_master.lock().unwrap();
                    guard.resize(size)?;
                }
                Ok(())
            }
        });

        let child = Arc::new(Mutex::new(Some(child)));
        let close_fn: Arc<dyn Fn() -> Result<()> + Send + Sync> = Arc::new({
            let child = child.clone();
            move || {
                tracing::info!("Closing screen attach bridge PTY");
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

impl Default for ScreenBackend {
    fn default() -> Self {
        Self::new()
    }
}
