use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

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
    /// Target type: "local" or "server"
    #[serde(default = "default_target_local")]
    pub target_type: String,
    /// Server ID if target_type is "server", null for local
    #[serde(default)]
    pub target_id: Option<String>,
    /// Display name of the target (e.g. "Local" or server name)
    #[serde(default = "default_target_local")]
    pub target_label: String,
}

fn default_target_local() -> String {
    "local".to_string()
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
    /// Target type: "local" or "server"
    #[serde(default = "default_target_local")]
    pub target_type: String,
    /// Server ID if target_type is "server"
    #[serde(default)]
    pub target_id: Option<String>,
    /// Display name for the target
    #[serde(default = "default_target_local")]
    pub target_label: String,
    /// SSH host for remote targets
    #[serde(default)]
    pub ssh_host: Option<String>,
    /// SSH port for remote targets
    #[serde(default = "default_ssh_port")]
    pub ssh_port: u16,
    /// SSH username for remote targets
    #[serde(default)]
    pub ssh_username: Option<String>,
    /// Path to SSH identity file (private key) for remote targets
    #[serde(default)]
    pub ssh_identity_file: Option<String>,
}

fn default_ssh_port() -> u16 {
    22
}

fn default_cols() -> u16 {
    80
}
fn default_rows() -> u16 {
    24
}

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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TerminalWsQuery {
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}
