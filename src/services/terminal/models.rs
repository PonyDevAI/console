use anyhow::Result;
pub use cloudcode_contracts::terminal::{
    BackendInfo, BackendsResponse, ClientMessage, CreateSessionRequest, CreateSessionResponse,
    ServerMessage, TerminalSessionListResponse, TerminalSessionMeta,
};
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
pub struct TerminalSessionsState {
    pub sessions: Vec<TerminalSessionMeta>,
}

impl Default for TerminalSessionsState {
    fn default() -> Self {
        Self { sessions: vec![] }
    }
}

pub struct AttachBridgeComponents {
    pub reader: Box<dyn std::io::Read + Send>,
    pub writer: Box<dyn std::io::Write + Send>,
    pub resize_fn: std::sync::Arc<dyn Fn(u16, u16) -> Result<()> + Send + Sync>,
    pub close_fn: std::sync::Arc<dyn Fn() -> Result<()> + Send + Sync>,
}

/// Stored close_fn for active ephemeral sessions
pub type CloseFn = std::sync::Arc<dyn Fn() -> Result<()> + Send + Sync>;
