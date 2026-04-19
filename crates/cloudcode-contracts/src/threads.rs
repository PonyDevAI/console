use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadRuntimeProfile {
    pub adapter: String,
    pub model: String,
    pub reasoning_effort: String,
    pub permission_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadAttachment {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateThreadRequest {
    pub title: String,
    pub workspace: String,
    pub runtime: ThreadRuntimeProfile,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SendMessageRequest {
    pub content: String,
    #[serde(default)]
    pub attachments: Vec<ThreadAttachment>,
    #[serde(default)]
    pub _stream: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpdateThreadTitleRequest {
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInspectResult {
    pub path: String,
    pub display_name: String,
    pub git_branch: Option<String>,
    pub is_git_repo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadMessageDto {
    pub id: String,
    pub thread_id: String,
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    pub attachments: Vec<ThreadAttachment>,
    pub created_at: DateTime<Utc>,
    pub run_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageResponse {
    pub thread_id: String,
    pub run_id: String,
    pub user_message: ThreadMessageDto,
    pub assistant_message: ThreadMessageDto,
}
