use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CreateSessionRequest {
    #[serde(rename = "local")]
    Local {
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        shell: Option<String>,
    },
    #[serde(rename = "ssh")]
    Ssh {
        host: String,
        port: u16,
        user: String,
        key_path: String,
        cols: u16,
        rows: u16,
    },
}

impl CreateSessionRequest {
    pub fn local(cols: u16, rows: u16, cwd: Option<String>, shell: Option<String>) -> Self {
        Self::Local {
            cols,
            rows,
            cwd,
            shell,
        }
    }

    pub fn ssh(
        host: String,
        port: u16,
        user: String,
        key_path: String,
        cols: u16,
        rows: u16,
    ) -> Self {
        Self::Ssh {
            host,
            port,
            user,
            key_path,
            cols,
            rows,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "input")]
    Input { data: String },
    #[serde(rename = "resize")]
    Resize { cols: u16, rows: u16 },
    #[serde(rename = "close")]
    Close,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "output")]
    Output { data: String },
    #[serde(rename = "exit")]
    Exit { code: Option<i32> },
    #[serde(rename = "error")]
    Error { message: String },
}

pub struct TerminalSession {
    pub tx: broadcast::Sender<ServerMessage>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub is_attached: bool,
    pub child: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>>,
}

pub struct TerminalService {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
    pty_system: NativePtySystem,
}

impl TerminalService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            pty_system: NativePtySystem::default(),
        }
    }

    pub fn create_session(&self, req: CreateSessionRequest) -> Result<CreateSessionResponse> {
        match req {
            CreateSessionRequest::Local {
                cols,
                rows,
                cwd,
                shell,
            } => self.create_local_session(cols, rows, cwd, shell),
            CreateSessionRequest::Ssh {
                host,
                port,
                user,
                key_path,
                cols,
                rows,
            } => self.create_ssh_session(host, port, user, key_path, cols, rows),
        }
    }

    fn create_local_session(
        &self,
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        shell: Option<String>,
    ) -> Result<CreateSessionResponse> {
        let session_id = Uuid::new_v4().to_string();
        let (tx, _rx) = broadcast::channel(100);

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = self
            .pty_system
            .openpty(size)
            .context("Failed to open PTY")?;

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
            .map(PathBuf::from)
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

        let mut cmd = CommandBuilder::new(&shell_path);
        cmd.cwd(&cwd_path);

        let shell_name = shell_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        match shell_name {
            "zsh" => {
                cmd.arg("-l");
                cmd.arg("-i");
            }
            "bash" => {
                cmd.arg("-l");
                cmd.arg("-i");
            }
            _ => {
                cmd.arg("-i");
            }
        }

        tracing::info!(
            session_id = %session_id,
            shell_path = %shell_path.display(),
            cwd = %cwd_path.display(),
            "Creating local terminal session"
        );

        let child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn local shell")?;

        self.spawn_session_io(session_id, pair.master, tx, child)
    }

    fn create_ssh_session(
        &self,
        host: String,
        port: u16,
        user: String,
        key_path: String,
        cols: u16,
        rows: u16,
    ) -> Result<CreateSessionResponse> {
        let session_id = Uuid::new_v4().to_string();
        let (tx, _rx) = broadcast::channel(100);

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = self
            .pty_system
            .openpty(size)
            .context("Failed to open PTY")?;

        let mut cmd = CommandBuilder::new("ssh");
        cmd.arg("-i");
        cmd.arg(&key_path);
        cmd.arg("-p");
        cmd.arg(port.to_string());
        cmd.arg("-o");
        cmd.arg("StrictHostKeyChecking=accept-new");
        cmd.arg("-o");
        cmd.arg("BatchMode=yes");
        cmd.arg(format!("{}@{}", user, host));

        let child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn SSH command")?;

        self.spawn_session_io(session_id, pair.master, tx, child)
    }

    fn spawn_session_io(
        &self,
        session_id: String,
        master: Box<dyn portable_pty::MasterPty + Send>,
        tx: broadcast::Sender<ServerMessage>,
        child: Box<dyn portable_pty::Child + Send + Sync>,
    ) -> Result<CreateSessionResponse> {
        let child = Arc::new(Mutex::new(Some(child)));
        let child_for_thread = child.clone();

        let mut reader = master.try_clone_reader()?;
        let writer = master.take_writer()?;
        let tx_clone = tx.clone();
        let session_id_clone = session_id.clone();
        let sessions_clone = self.sessions.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(n) if n > 0 => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = tx_clone.send(ServerMessage::Output { data });
                    }
                    Ok(_) => {
                        tracing::info!(session_id = %session_id_clone, "PTY reader EOF");
                        break;
                    }
                    Err(e) => {
                        tracing::error!(session_id = %session_id_clone, "Error reading from PTY: {}", e);
                        break;
                    }
                }
            }

            let code = {
                let mut child_guard = child_for_thread.lock().unwrap();
                if let Some(mut child) = child_guard.take() {
                    tracing::info!(session_id = %session_id_clone, "Child process exiting, waiting for status");
                    let exit_status = child.wait();
                    exit_status.ok().map(|s| {
                        let code = s.exit_code() as i32;
                        tracing::info!(session_id = %session_id_clone, exit_code = code, "Child process exited");
                        code
                    })
                } else {
                    tracing::warn!(session_id = %session_id_clone, "Child already taken");
                    None
                }
            };
            let _ = tx_clone.send(ServerMessage::Exit { code });
            let mut sessions = sessions_clone.lock().unwrap();
            sessions.remove(&session_id_clone);
            tracing::info!(session_id = %session_id_clone, "Session removed from registry");
        });

        let session = TerminalSession {
            tx,
            master,
            writer,
            is_attached: false,
            child,
        };

        self.sessions
            .lock()
            .unwrap()
            .insert(session_id.clone(), session);

        Ok(CreateSessionResponse { session_id })
    }

    pub fn try_attach_session(&self, session_id: &str) -> Result<TerminalSessionHandle, String> {
        tracing::info!(session_id = %session_id, "try_attach_session called");
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions.get_mut(session_id).ok_or_else(|| {
            tracing::warn!(session_id = %session_id, "Session not found for attachment");
            "Session not found".to_string()
        })?;

        if session.is_attached {
            tracing::warn!(session_id = %session_id, "Session already attached");
            return Err("Session already attached".to_string());
        }

        session.is_attached = true;
        tracing::info!(session_id = %session_id, "Session attached successfully");
        Ok(TerminalSessionHandle {
            tx: session.tx.clone(),
        })
    }

    pub fn write_to_session(&self, session_id: &str, data: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            session.writer.write_all(data.as_bytes())?;
            session.writer.flush()?;
        }
        Ok(())
    }

    pub fn resize_session(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            let size = PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            };
            session.master.resize(size)?;
        }
        Ok(())
    }

    pub fn close_session(&self, session_id: &str) -> Result<()> {
        tracing::info!(session_id = %session_id, "close_session called");
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.remove(session_id) {
            tracing::info!(session_id = %session_id, "Session found, killing child");
            let mut child_guard = session.child.lock().unwrap();
            if let Some(mut child) = child_guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        } else {
            tracing::warn!(session_id = %session_id, "Session not found");
        }
        Ok(())
    }
}

impl Default for TerminalService {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone)]
pub struct TerminalSessionHandle {
    pub tx: broadcast::Sender<ServerMessage>,
}
