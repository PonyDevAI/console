use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BackendKind {
    Tmux,
    Zellij,
    Screen,
    Pty,
    Auto,
}

impl BackendKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            BackendKind::Tmux => "tmux",
            BackendKind::Zellij => "zellij",
            BackendKind::Screen => "screen",
            BackendKind::Pty => "pty",
            BackendKind::Auto => "auto",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "tmux" => Some(BackendKind::Tmux),
            "zellij" => Some(BackendKind::Zellij),
            "screen" => Some(BackendKind::Screen),
            "pty" => Some(BackendKind::Pty),
            "auto" => Some(BackendKind::Auto),
            _ => None,
        }
    }
}

impl std::fmt::Display for BackendKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Persistence {
    Persistent,
    Ephemeral,
}

impl Persistence {
    pub fn as_str(&self) -> &'static str {
        match self {
            Persistence::Persistent => "persistent",
            Persistence::Ephemeral => "ephemeral",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionMeta {
    pub id: String,
    pub title: String,
    pub cwd: String,
    pub shell: String,
    pub backend: String,
    pub persistence: String,
    pub backend_session_name: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionsState {
    pub sessions: Vec<TerminalSessionMeta>,
}

impl Default for TerminalSessionsState {
    fn default() -> Self {
        Self { sessions: vec![] }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub title: Option<String>,
    pub cwd: Option<String>,
    pub shell: Option<String>,
    #[serde(default)]
    pub backend: Option<String>,
    #[serde(default = "default_cols")]
    pub cols: u16,
    #[serde(default = "default_rows")]
    pub rows: u16,
}

fn default_cols() -> u16 { 80 }
fn default_rows() -> u16 { 24 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub session: TerminalSessionMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionListResponse {
    pub sessions: Vec<TerminalSessionMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendInfo {
    pub kind: String,
    pub persistence: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendsResponse {
    pub available: Vec<BackendInfo>,
    pub default_backend: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "input")]
    Input { data: String },
    #[serde(rename = "resize")]
    Resize { cols: u16, rows: u16 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "output")]
    Output { data: String, encoding: String },
    #[serde(rename = "exit")]
    Exit { code: Option<i32> },
    #[serde(rename = "error")]
    Error { message: String },
}

pub struct AttachBridgeComponents {
    pub reader: Box<dyn std::io::Read + Send>,
    pub writer: Box<dyn std::io::Write + Send>,
    pub resize_fn: std::sync::Arc<dyn Fn(u16, u16) -> Result<()> + Send + Sync>,
    pub close_fn: std::sync::Arc<dyn Fn() -> Result<()> + Send + Sync>,
}

/// Stored close_fn for active ephemeral sessions
pub type CloseFn = std::sync::Arc<dyn Fn() -> Result<()> + Send + Sync>;
