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

const TMUX_PREFIX: &str = "console-";

pub struct TmuxBackend;

impl TmuxBackend {
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

    fn session_name(id: &str) -> String {
        format!("{}{}", TMUX_PREFIX, id)
    }

    fn has_session(name: &str) -> Result<bool> {
        let output = std::process::Command::new("tmux")
            .args(["has-session", "-t", name])
            .output()
            .context("Failed to check tmux session")?;
        Ok(output.status.success())
    }
}

impl TerminalBackend for TmuxBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Tmux
    }

    fn persistence(&self) -> Persistence {
        Persistence::Persistent
    }

    fn is_available(&self) -> bool {
        std::process::Command::new("which")
            .arg("tmux")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn create_session(
        &self,
        id: &str,
        cwd: Option<&str>,
        shell: Option<&str>,
        cols: u16,
        rows: u16,
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

        let mut cmd = std::process::Command::new("tmux");
        cmd.args(["new-session", "-d", "-s", &backend_name]);
        cmd.arg("-c").arg(&cwd_path);
        cmd.arg(&shell_path);
        Self::configure_shell_env_for_process(&mut cmd);

        let shell_name = shell_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        match shell_name {
            "zsh" | "bash" => {
                cmd.arg("-l").arg("-i");
            }
            _ => {
                cmd.arg("-i");
            }
        }

        tracing::info!(
            session_id = %id,
            backend_name = %backend_name,
            shell_path = %shell_path.display(),
            cwd = %cwd_path.display(),
            "Creating tmux session"
        );

        let output = cmd.output().context("Failed to create tmux session")?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("tmux new-session failed: {}", stderr);
        }

        // Resize to initial size
        let resize_output = std::process::Command::new("tmux")
            .args([
                "resize-window",
                "-t",
                &backend_name,
                "-x",
                &cols.to_string(),
                "-y",
                &rows.to_string(),
            ])
            .output();
        if let Ok(o) = resize_output {
            if !o.status.success() {
                tracing::warn!(session_id = %id, "Initial tmux resize failed");
            }
        }

        // Disable status line for cleaner terminal display
        let status_output = std::process::Command::new("tmux")
            .args(["set-option", "-t", &backend_name, "status", "off"])
            .output();
        if let Ok(o) = status_output {
            if !o.status.success() {
                tracing::warn!(session_id = %id, "Failed to disable tmux status line");
            }
        }

        Ok(TerminalSessionMeta {
            id: id.to_string(),
            title: format!("Terminal {}", cwd_path.display()),
            cwd: cwd_path.to_string_lossy().to_string(),
            shell: shell_path.to_string_lossy().to_string(),
            backend: "tmux".to_string(),
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
        tracing::info!(session_name = %session_name, "Killing tmux session");
        let output = std::process::Command::new("tmux")
            .args(["kill-session", "-t", session_name])
            .output()
            .context("Failed to kill tmux session")?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("tmux kill-session failed: {}", stderr);
        }
        Ok(())
    }

    fn resize_session(&self, session_name: &str, cols: u16, rows: u16) -> Result<()> {
        let output = std::process::Command::new("tmux")
            .args([
                "resize-window",
                "-t",
                session_name,
                "-x",
                &cols.to_string(),
                "-y",
                &rows.to_string(),
            ])
            .output()
            .context("Failed to resize tmux session")?;

        if !output.status.success() {
            tracing::warn!(session_name = %session_name, "tmux resize-window failed");
        }
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
        // First check if tmux session exists
        if !Self::has_session(session_name)? {
            anyhow::bail!("tmux session '{}' does not exist", session_name);
        }

        // Resize tmux session to match client size before attach
        let _ = std::process::Command::new("tmux")
            .args([
                "resize-window",
                "-t",
                session_name,
                "-x",
                &cols.to_string(),
                "-y",
                &rows.to_string(),
            ])
            .output();

        tracing::info!(session_name = %session_name, cols = cols, rows = rows, "Spawning tmux attach bridge with PTY");

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

        let mut cmd = CommandBuilder::new("tmux");
        cmd.args(["attach-session", "-t", session_name]);
        Self::configure_shell_env_for_pty(&mut cmd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| anyhow::anyhow!("Failed to spawn tmux attach-session: {}", e))?;

        let reader = pair
            .master
            .try_clone_reader()
            .context("Failed to clone PTY reader")?;
        let writer = pair
            .master
            .take_writer()
            .context("Failed to take PTY writer")?;

        let pty_master = Arc::new(Mutex::new(pair.master));
        let session_name_for_resize = session_name.to_string();
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
                let _ = std::process::Command::new("tmux")
                    .args([
                        "resize-window",
                        "-t",
                        &session_name_for_resize,
                        "-x",
                        &cols.to_string(),
                        "-y",
                        &rows.to_string(),
                    ])
                    .output();
                Ok(())
            }
        });

        let child = Arc::new(Mutex::new(Some(child)));
        let close_fn: Arc<dyn Fn() -> Result<()> + Send + Sync> = Arc::new({
            let child = child.clone();
            move || {
                tracing::info!("Closing tmux attach bridge PTY");
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

impl Default for TmuxBackend {
    fn default() -> Self {
        Self::new()
    }
}
