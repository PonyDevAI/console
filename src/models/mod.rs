mod credential;
mod os_detection;
mod server;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub use credential::*;
pub use os_detection::*;
pub use server::*;

#[allow(unused_imports)]
pub use cloudcode_contracts::agent_sources::{
    CreateAgentSourceRequest, SetDefaultModelRequest, UpdateAgentSourceRequest,
};
#[allow(unused_imports)]
pub use cloudcode_contracts::common::SwitchMode;
#[allow(unused_imports)]
pub use cloudcode_contracts::employees::{
    CreateEmployeeRequest, PersonaFiles, SoulFiles, UpdateEmployeeRequest,
};
#[allow(unused_imports)]
pub use cloudcode_contracts::mcp::{CreateMcpServerRequest, McpTransport};
#[allow(unused_imports)]
pub use cloudcode_contracts::prompts::{CreatePromptRequest, UpdatePromptRequest};
#[allow(unused_imports)]
pub use cloudcode_contracts::providers::{
    CreateProviderRequest, ImportProvidersRequest, SetModelAssignmentRequest, SetSwitchModeRequest,
};
#[allow(unused_imports)]
pub use cloudcode_contracts::remote_agents::{CreateRemoteAgentRequest, UpdateRemoteAgentRequest};
#[allow(unused_imports)]
pub use cloudcode_contracts::sessions::{
    CreateProposalRequest, CreateSessionRequest, PostMessageRequest, UpdateParticipantsRequest,
    UpdateSessionTitleRequest,
};
#[allow(unused_imports)]
pub use cloudcode_contracts::skills::{
    AddSkillRepoRequest, InstallFromUrlRequest, ToggleSkillRepoRequest, UpdateSkillRequest,
};

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
    #[serde(default = "default_true")]
    pub auto_install: bool,
    #[serde(default)]
    pub supports_model_config: bool,
    pub install_url: Option<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliToolsState {
    pub tools: Vec<CliTool>,
}

// ── Agent Source ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentSourceType {
    LocalCli,
    OpenAiCompatible,
    RemoteAgent,
    RemoteOpenClawWs,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSource {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub source_type: AgentSourceType,
    #[serde(default)]
    pub managed_by_console: bool,
    pub executable: Option<String>,
    pub endpoint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    pub supported_models: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
    #[serde(default)]
    pub healthy: bool,
    #[serde(default)]
    pub installed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<PathBuf>,
    #[serde(default)]
    pub supports_auto_install: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_url: Option<String>,
    #[serde(default)]
    pub supports_model_config: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_checked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSourcesState {
    pub sources: Vec<AgentSource>,
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
    #[serde(default)]
    pub models: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelAssignment {
    pub app: String,
    pub provider_id: String,
    pub model: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelAssignmentsState {
    pub assignments: Vec<ModelAssignment>,
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
pub struct McpServersState {
    pub servers: Vec<McpServer>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillManifest {
    pub name: String,
    pub description: String,
    pub source_url: String,
    pub version: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRepoIndex {
    pub skills: Vec<SkillManifest>,
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
pub struct CloudCodeConfig {
    pub version: String,
    pub server: ServerConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub address: String,
}

impl Default for CloudCodeConfig {
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

// ── Agent Status ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Unknown,
    Offline,
    Online,
    Busy,
}

impl Default for AgentStatus {
    fn default() -> Self {
        AgentStatus::Unknown
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EmployeeStatus {
    Unknown,
    Offline,
    Online,
    Busy,
}

impl Default for EmployeeStatus {
    fn default() -> Self {
        EmployeeStatus::Unknown
    }
}

// ── Agent ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentType {
    LocalCli,
    RemoteAgent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub source_id: String,
    pub name: String,
    pub display_name: String,
    pub agent_type: AgentType,
    pub status: AgentStatus,
    pub supported_models: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
    #[serde(default)]
    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentsState {
    pub agents: Vec<Agent>,
}

// ── Remote Agent ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteAgent {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub status: RemoteAgentStatus,
    pub version: Option<String>,
    pub latency_ms: Option<u64>,
    pub last_ping: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub tags: Vec<String>,
    #[serde(default)]
    pub source_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RemoteAgentStatus {
    Online,
    Offline,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteAgentsState {
    pub agents: Vec<RemoteAgent>,
}

// ── AI Employee ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EmployeeType {
    Local,
    Remote,
}

impl Default for EmployeeType {
    fn default() -> Self {
        EmployeeType::Local
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Employee {
    pub id: String,
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub status: EmployeeStatus,
    pub avatar_color: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_dispatched_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub dispatch_count: u32,
    #[serde(default)]
    pub dispatch_success_count: u32,
    #[doc = "Legacy field - maintained for backward compatibility only"]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bindings: Option<Vec<AgentBinding>>,
    #[doc = "Legacy field - maintained for backward compatibility only"]
    #[serde(default)]
    pub role: Option<String>,
    #[doc = "Legacy field - maintained for backward compatibility only"]
    #[serde(default)]
    pub employee_type: Option<EmployeeType>,
    #[doc = "Legacy field - maintained for backward compatibility only"]
    #[serde(default)]
    pub source_id: Option<String>,
    #[doc = "Legacy field - maintained for backward compatibility only"]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_agent_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmployeesState {
    pub employees: Vec<Employee>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentBinding {
    pub id: String,
    pub label: String,
    pub is_primary: bool,
    pub protocol: AgentProtocol,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentProtocol {
    LocalProcess {
        executable: String,
        soul_arg: String,
        extra_args: Vec<String>,
    },
    OpenAiCompatible {
        endpoint: String,
        api_key: Option<String>,
        model: String,
        stream: bool,
    },
    SshExec {
        host: String,
        port: u16,
        user: String,
        key_path: String,
        executable: String,
        soul_arg: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBindingRequest {
    pub label: Option<String>,
    pub is_primary: Option<bool>,
    pub protocol: Option<AgentProtocol>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchRecord {
    pub id: String,
    pub task: String,
    pub binding_label: String,
    pub status: String,
    pub output: String,
    pub exit_code: i32,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DispatchHistory {
    pub records: Vec<DispatchRecord>,
}

// ── Backup ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMeta {
    pub id: String,
    pub label: String,
    pub created_at: DateTime<Utc>,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSnapshot {
    #[serde(flatten)]
    pub meta: BackupMeta,
    pub files: std::collections::HashMap<String, serde_json::Value>,
}

// ── Session / Chat ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MessageKind {
    Chat,
    System,
    Proposal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub id: String,
    pub session_id: String,
    pub kind: MessageKind,
    pub role: MessageRole,
    pub author_id: Option<String>,
    pub author_label: String,
    pub content: String,
    pub mentions: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionParticipant {
    pub employee_id: String,
    pub display_name: String,
    pub avatar_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub participants: Vec<SessionParticipant>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionMeta {
    pub sessions: Vec<Session>,
}

// ── Task Proposal ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProposalStatus {
    Pending,
    Executing,
    Reviewing,
    Revising,
    Done,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskProposal {
    pub id: String,
    pub session_id: String,
    pub title: String,
    pub description: String,
    pub assigned_employee_id: String,
    pub status: ProposalStatus,
    pub dispatch_task_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProposalsState {
    pub proposals: Vec<TaskProposal>,
}
