use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Runtime target - which CLI to use
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeTarget {
    Codex,
    Claude,
    Auto,
}

/// Role in a conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeRole {
    System,
    User,
    Assistant,
}

/// A message in the runtime context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeMessage {
    pub role: RuntimeRole,
    pub content: String,
}

/// Attachment to be included in the request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeAttachment {
    pub name: String,
    pub path: String,
}

/// Request to run the agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeRequest {
    pub request_id: String,
    pub thread_id: Option<String>,
    pub message_id: Option<String>,
    pub target: RuntimeTarget,
    pub model: String,
    pub workspace: Option<String>,
    pub reasoning_effort: Option<String>,
    pub permission_mode: Option<String>,
    pub messages: Vec<RuntimeMessage>,
    pub attachments: Vec<RuntimeAttachment>,
    pub stream: bool,
    pub metadata: serde_json::Value,
}

impl RuntimeRequest {
    pub fn new(
        thread_id: Option<String>,
        message_id: Option<String>,
        target: RuntimeTarget,
        model: String,
        messages: Vec<RuntimeMessage>,
    ) -> Self {
        Self {
            request_id: format!(
                "req_{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
            ),
            thread_id,
            message_id,
            target,
            model,
            workspace: None,
            reasoning_effort: None,
            permission_mode: None,
            messages,
            attachments: vec![],
            stream: true,
            metadata: serde_json::Value::Null,
        }
    }
}

/// Status of a runtime run
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeRunStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// A runtime run instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeRun {
    pub id: String,
    pub request_id: String,
    pub thread_id: Option<String>,
    pub message_id: Option<String>,
    pub adapter: String,
    pub model: String,
    pub workspace: Option<String>,
    pub status: RuntimeRunStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub output: Option<String>,
}

impl RuntimeRun {
    pub fn new(request: &RuntimeRequest, adapter: String) -> Self {
        Self {
            id: format!(
                "run_{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
            ),
            request_id: request.request_id.clone(),
            thread_id: request.thread_id.clone(),
            message_id: request.message_id.clone(),
            adapter,
            model: request.model.clone(),
            workspace: request.workspace.clone(),
            status: RuntimeRunStatus::Pending,
            started_at: Utc::now(),
            completed_at: None,
            error: None,
            output: None,
        }
    }
}

/// Events emitted during a runtime run
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum RuntimeEvent {
    RunStarted { run_id: String },
    TextDelta { run_id: String, text: String },
    Status { run_id: String, message: String },
    RunCompleted { run_id: String, output: String },
    RunFailed { run_id: String, error: String },
    RunCancelled { run_id: String },
}

/// Events emitted for thread streaming
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ThreadEvent {
    MessageCreated {
        message_id: String,
        role: String,
        content: String,
        created_at: String,
    },
    MessageDelta {
        message_id: String,
        delta: String,
    },
    MessageDone {
        message_id: String,
        content: String,
    },
    MessageError {
        message_id: String,
        error: String,
    },
    RunStarted {
        run_id: String,
    },
    RunCompleted {
        run_id: String,
    },
    RunFailed {
        run_id: String,
        error: String,
    },
    RunCancelled {
        run_id: String,
    },
}

/// Capabilities of a runtime adapter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeCapabilities {
    pub supports_streaming: bool,
    pub supports_session: bool,
    pub supports_workspace: bool,
    pub supports_tools: bool,
    pub supports_images: bool,
    pub supports_json_mode: bool,
}

impl Default for RuntimeCapabilities {
    fn default() -> Self {
        Self {
            supports_streaming: true,
            supports_session: false,
            supports_workspace: true,
            supports_tools: false,
            supports_images: false,
            supports_json_mode: false,
        }
    }
}
