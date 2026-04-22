use anyhow::{Context, Result};
use std::env;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use crate::services::terminal::backend::TerminalBackend;
use crate::services::terminal::models::{
    AttachBridgeComponents, BackendKind, Persistence, TerminalSessionMeta,
};
use chrono::Utc;

const REMOTE_PREFIX: &str = "console-remote-";

/// SSH connection info for remote terminal backends.
#[derive(Clone)]
pub struct SshConnection {
    pub host: String,
    pub port: u16,
    pub username: String,
    /// Path to private key file, or None for password/keychain auth
    pub identity_file: Option<String>,
}

impl SshConnection {
    fn ssh_target(&self) -> String {
        format!("{}@{}", self.username, self.host)
    }

    fn ssh_base_args(&self) -> Vec<String> {
        let mut args = vec![
            "-o".to_string(),
            "LogLevel=ERROR".to_string(),
            "-o".to_string(),
            "StrictHostKeyChecking=accept-new".to_string(),
            "-p".to_string(),
            self.port.to_string(),
        ];
        if let Some(key) = &self.identity_file {
            args.push("-i".to_string());
            args.push(key.clone());
        }
        args.push(self.ssh_target());
        args
    }
}

// ── Stdio wrappers for AttachBridgeComponents ──

use std::io::{Read, Result as IoResult, Write};

struct ChildStdoutReader(std::process::ChildStdout);

impl ChildStdoutReader {
    fn new(s: std::process::ChildStdout) -> Self {
        Self(s)
    }
}

impl Read for ChildStdoutReader {
    fn read(&mut self, buf: &mut [u8]) -> IoResult<usize> {
        self.0.read(buf)
    }
}

struct ChildStdinWriter(std::process::ChildStdin);

impl ChildStdinWriter {
    fn new(s: std::process::ChildStdin) -> Self {
        Self(s)
    }
}

impl Write for ChildStdinWriter {
    fn write(&mut self, buf: &[u8]) -> IoResult<usize> {
        self.0.write(buf)
    }

    fn flush(&mut self) -> IoResult<()> {
        self.0.flush()
    }
}

// ── SshTmuxBackend ──

pub struct SshTmuxBackend {
    conn: SshConnection,
}

impl SshTmuxBackend {
    pub fn new(conn: SshConnection) -> Self {
        Self { conn }
    }

    fn session_name(id: &str) -> String {
        format!("{}{}", REMOTE_PREFIX, id)
    }

    fn remote_cmd(&self, cmd: &str) -> std::process::Command {
        let mut c = std::process::Command::new("ssh");
        c.args(self.conn.ssh_base_args()).arg(cmd);
        c
    }
}

impl TerminalBackend for SshTmuxBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Tmux
    }

    fn persistence(&self) -> Persistence {
        Persistence::Persistent
    }

    fn is_available(&self) -> bool {
        std::process::Command::new("which")
            .arg("ssh")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn create_session(
        &self,
        id: &str,
        _cwd: Option<&str>,
        shell: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<TerminalSessionMeta> {
        let backend_name = Self::session_name(id);
        let shell_path = shell
            .map(PathBuf::from)
            .or_else(|| env::var("SHELL").ok().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from("/bin/bash"));

        let tmux_cmd = format!(
            "tmux new-session -d -s {} -x {} -y {} {}",
            backend_name,
            cols,
            rows,
            shell_path.display()
        );

        let output = self
            .remote_cmd(&tmux_cmd)
            .output()
            .context("Failed to create remote tmux session")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Remote tmux session creation failed: {}", stderr);
        }

        let now = Utc::now();

        Ok(TerminalSessionMeta {
            id: id.to_string(),
            title: format!("Remote: {}", self.conn.host),
            cwd: "/".to_string(),
            shell: shell_path.to_string_lossy().to_string(),
            backend: "tmux".to_string(),
            persistence: "persistent".to_string(),
            backend_session_name: Some(backend_name),
            status: "running".to_string(),
            created_at: now,
            updated_at: now,
            target_type: "server".to_string(),
            target_id: None,
            target_label: self.conn.host.clone(),
        })
    }

    fn terminate_session(&self, session_name: &str) -> Result<()> {
        let output = self
            .remote_cmd(&format!("tmux kill-session -t {}", session_name))
            .output()
            .context("Failed to kill remote tmux session")?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Remote tmux kill failed: {}", stderr);
        }
        Ok(())
    }

    fn resize_session(&self, session_name: &str, cols: u16, rows: u16) -> Result<()> {
        let _ = self
            .remote_cmd(&format!(
                "tmux resize-window -t {} -x {} -y {}",
                session_name, cols, rows
            ))
            .output();
        Ok(())
    }

    fn sync_status(&self, session_name: &str) -> Result<String> {
        let output = self
            .remote_cmd(&format!("tmux has-session -t {}", session_name))
            .output()
            .context("Failed to check remote tmux session")?;
        if output.status.success() {
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
        _cols: u16,
        _rows: u16,
    ) -> Result<AttachBridgeComponents> {
        let status = self.sync_status(session_name)?;
        if status != "running" {
            anyhow::bail!("Remote tmux session '{}' is not running", session_name);
        }

        let mut ssh_args = self.conn.ssh_base_args();
        ssh_args.push("-t".to_string());
        ssh_args.push(format!("tmux attach-session -t {}", session_name));

        let mut child = std::process::Command::new("ssh")
            .args(&ssh_args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .context("Failed to spawn SSH tmux attach")?;

        let stdin = child.stdin.take().context("Failed to take stdin")?;
        let stdout = child.stdout.take().context("Failed to take stdout")?;
        let child = Arc::new(Mutex::new(child));

        let session_name_clone = session_name.to_string();
        let conn_clone = self.conn.clone();
        let identity_file = self.conn.identity_file.clone();

        Ok(AttachBridgeComponents {
            reader: Box::new(ChildStdoutReader::new(stdout)),
            writer: Box::new(ChildStdinWriter::new(stdin)),
            resize_fn: Arc::new(move |c, r| {
                let mut cmd = std::process::Command::new("ssh");
                cmd.args(conn_clone.ssh_base_args()).arg(format!(
                    "tmux resize-window -t {} -x {} -y {}",
                    session_name_clone, c, r
                ));
                let _ = cmd.output();
                Ok(())
            }),
            close_fn: Arc::new(move || {
                let mut c = child.lock().unwrap();
                let _ = c.kill();
                let _ = c.wait();
                if let Some(path) = &identity_file {
                    let _ = std::fs::remove_file(path);
                }
                Ok(())
            }),
        })
    }
}

// ── SshScreenBackend ──

pub struct SshScreenBackend {
    conn: SshConnection,
}

impl SshScreenBackend {
    pub fn new(conn: SshConnection) -> Self {
        Self { conn }
    }

    fn session_name(id: &str) -> String {
        format!("{}{}", REMOTE_PREFIX, id)
    }

    fn remote_cmd(&self, cmd: &str) -> std::process::Command {
        let mut c = std::process::Command::new("ssh");
        c.args(self.conn.ssh_base_args()).arg(cmd);
        c
    }
}

impl TerminalBackend for SshScreenBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Screen
    }

    fn persistence(&self) -> Persistence {
        Persistence::Persistent
    }

    fn is_available(&self) -> bool {
        std::process::Command::new("which")
            .arg("ssh")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn create_session(
        &self,
        id: &str,
        _cwd: Option<&str>,
        shell: Option<&str>,
        _cols: u16,
        _rows: u16,
    ) -> Result<TerminalSessionMeta> {
        let backend_name = Self::session_name(id);
        let shell_path = shell
            .map(PathBuf::from)
            .or_else(|| env::var("SHELL").ok().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from("/bin/bash"));

        let screen_cmd = format!("screen -dmS {} {}", backend_name, shell_path.display());

        let output = self
            .remote_cmd(&screen_cmd)
            .output()
            .context("Failed to create remote screen session")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Remote screen session creation failed: {}", stderr);
        }

        let now = Utc::now();

        Ok(TerminalSessionMeta {
            id: id.to_string(),
            title: format!("Remote: {}", self.conn.host),
            cwd: "/".to_string(),
            shell: shell_path.to_string_lossy().to_string(),
            backend: "screen".to_string(),
            persistence: "persistent".to_string(),
            backend_session_name: Some(backend_name),
            status: "running".to_string(),
            created_at: now,
            updated_at: now,
            target_type: "server".to_string(),
            target_id: None,
            target_label: self.conn.host.clone(),
        })
    }

    fn terminate_session(&self, session_name: &str) -> Result<()> {
        let output = self
            .remote_cmd(&format!("screen -S {} -X quit", session_name))
            .output()
            .context("Failed to kill remote screen session")?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Remote screen kill failed: {}", stderr);
        }
        Ok(())
    }

    fn resize_session(&self, _session_name: &str, _cols: u16, _rows: u16) -> Result<()> {
        Ok(())
    }

    fn sync_status(&self, session_name: &str) -> Result<String> {
        let output = self
            .remote_cmd("screen -ls")
            .output()
            .context("Failed to check remote screen sessions")?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains(session_name)
            && (stdout.contains("(Attached)") || stdout.contains("(Detached)"))
        {
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
        _cols: u16,
        _rows: u16,
    ) -> Result<AttachBridgeComponents> {
        let status = self.sync_status(session_name)?;
        if status != "running" {
            anyhow::bail!("Remote screen session '{}' is not running", session_name);
        }

        let mut ssh_args = self.conn.ssh_base_args();
        ssh_args.push("-t".to_string());
        ssh_args.push(format!("screen -d -r {}", session_name));

        let mut child = std::process::Command::new("ssh")
            .args(&ssh_args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .context("Failed to spawn SSH screen attach")?;

        let stdin = child.stdin.take().context("Failed to take stdin")?;
        let stdout = child.stdout.take().context("Failed to take stdout")?;
        let child = Arc::new(Mutex::new(child));

        let identity_file = self.conn.identity_file.clone();

        Ok(AttachBridgeComponents {
            reader: Box::new(ChildStdoutReader::new(stdout)),
            writer: Box::new(ChildStdinWriter::new(stdin)),
            resize_fn: Arc::new(move |_, _| Ok(())),
            close_fn: Arc::new(move || {
                let mut c = child.lock().unwrap();
                let _ = c.kill();
                let _ = c.wait();
                if let Some(path) = &identity_file {
                    let _ = std::fs::remove_file(path);
                }
                Ok(())
            }),
        })
    }
}

// ── SshPtyBackend ──

pub struct SshPtyBackend {
    conn: SshConnection,
}

impl SshPtyBackend {
    pub fn new(conn: SshConnection) -> Self {
        Self { conn }
    }
}

impl TerminalBackend for SshPtyBackend {
    fn kind(&self) -> BackendKind {
        BackendKind::Pty
    }

    fn persistence(&self) -> Persistence {
        Persistence::Ephemeral
    }

    fn is_available(&self) -> bool {
        std::process::Command::new("which")
            .arg("ssh")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    fn create_session(
        &self,
        id: &str,
        _cwd: Option<&str>,
        shell: Option<&str>,
        _cols: u16,
        _rows: u16,
    ) -> Result<TerminalSessionMeta> {
        let shell_path = shell
            .map(PathBuf::from)
            .or_else(|| env::var("SHELL").ok().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from("/bin/bash"));

        let now = Utc::now();

        Ok(TerminalSessionMeta {
            id: id.to_string(),
            title: format!("Remote: {}", self.conn.host),
            cwd: "/".to_string(),
            shell: shell_path.to_string_lossy().to_string(),
            backend: "pty".to_string(),
            persistence: "ephemeral".to_string(),
            backend_session_name: None,
            status: "pending".to_string(),
            created_at: now,
            updated_at: now,
            target_type: "server".to_string(),
            target_id: None,
            target_label: self.conn.host.clone(),
        })
    }

    fn terminate_session(&self, _session_name: &str) -> Result<()> {
        Ok(())
    }

    fn resize_session(&self, _session_name: &str, _cols: u16, _rows: u16) -> Result<()> {
        Ok(())
    }

    fn sync_status(&self, _session_name: &str) -> Result<String> {
        Ok("running".to_string())
    }

    fn spawn_attach_bridge(
        &self,
        _session_name: &str,
        _cwd: Option<&str>,
        shell: Option<&str>,
        _cols: u16,
        _rows: u16,
    ) -> Result<AttachBridgeComponents> {
        let shell_path = shell
            .map(PathBuf::from)
            .or_else(|| env::var("SHELL").ok().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from("/bin/bash"));

        let mut ssh_args = self.conn.ssh_base_args();
        ssh_args.push("-t".to_string());
        ssh_args.push(shell_path.to_string_lossy().to_string());

        let mut child = std::process::Command::new("ssh")
            .args(&ssh_args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .context("Failed to spawn SSH shell")?;

        let stdin = child.stdin.take().context("Failed to take stdin")?;
        let stdout = child.stdout.take().context("Failed to take stdout")?;
        let child = Arc::new(Mutex::new(child));

        let identity_file = self.conn.identity_file.clone();

        Ok(AttachBridgeComponents {
            reader: Box::new(ChildStdoutReader::new(stdout)),
            writer: Box::new(ChildStdinWriter::new(stdin)),
            resize_fn: Arc::new(move |_, _| Ok(())),
            close_fn: Arc::new(move || {
                let mut c = child.lock().unwrap();
                let _ = c.kill();
                let _ = c.wait();
                if let Some(path) = &identity_file {
                    let _ = std::fs::remove_file(path);
                }
                Ok(())
            }),
        })
    }
}
