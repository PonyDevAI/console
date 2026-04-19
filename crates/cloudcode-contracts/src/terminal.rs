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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TerminalWsQuery {
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}
