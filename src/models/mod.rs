use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ── CLI Tool ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliTool {
    pub name: String,
    pub display_name: String,
    pub installed: bool,
    pub local_version: Option<String>,
    pub remote_version: Option<String>,
    pub path: Option<PathBuf>,
    pub last_checked: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliToolsState {
    pub tools: Vec<CliTool>,
}

// ── Provider ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub api_endpoint: String,
    pub api_key_ref: String,
    pub active: bool,
    pub apps: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
}

/// Provider switching mode per CLI tool.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwitchMode {
    /// Only one provider active at a time.
    Switch,
    /// All providers coexist in config.
    Additive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvidersState {
    pub providers: Vec<Provider>,
    #[serde(default = "default_switch_modes")]
    pub switch_modes: std::collections::HashMap<String, SwitchMode>,
}

fn default_switch_modes() -> std::collections::HashMap<String, SwitchMode> {
    std::collections::HashMap::new()
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProviderRequest {
    pub name: String,
    pub api_endpoint: String,
    pub api_key_ref: String,
    pub apps: Vec<String>,
}

// ── MCP Server ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub transport: McpTransport,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub url: Option<String>,
    pub env: std::collections::HashMap<String, String>,
    pub enabled_apps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum McpTransport {
    Stdio,
    Http,
    Sse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServersState {
    pub servers: Vec<McpServer>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateMcpServerRequest {
    pub name: String,
    pub transport: McpTransport,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub url: Option<String>,
    pub env: std::collections::HashMap<String, String>,
    pub enabled_apps: Vec<String>,
}

// ── Skill ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    #[serde(default, deserialize_with = "null_string_as_default")]
    pub name: String,
    #[serde(default, deserialize_with = "null_string_as_default")]
    pub description: String,
    #[serde(default, deserialize_with = "null_string_as_default")]
    pub source: String,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default, alias = "enabled_apps")]
    pub apps: Vec<String>,
    pub installed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsState {
    pub skills: Vec<Skill>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRepo {
    pub id: String,
    pub name: String,
    pub url: String,
    pub enabled: bool,
    pub last_synced: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillReposState {
    pub repos: Vec<SkillRepo>,
}

// ── Prompt ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptPreset {
    pub id: String,
    pub name: String,
    pub content: String,
    pub active: bool,
    pub apps: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptsState {
    pub prompts: Vec<PromptPreset>,
}

// ── Config ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleConfig {
    pub version: String,
    pub server: ServerConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub address: String,
}

impl Default for ConsoleConfig {
    fn default() -> Self {
        Self {
            version: "0.1.0".to_string(),
            server: ServerConfig {
                address: "127.0.0.1:8080".to_string(),
            },
        }
    }
}

// ── Adapter types ──

#[derive(Debug, Clone)]
pub struct InstalledInfo {
    pub version: String,
    pub path: PathBuf,
}

fn null_string_as_default<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<String>::deserialize(deserializer)?;
    Ok(value.unwrap_or_default())
}
