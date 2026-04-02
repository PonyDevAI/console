use crate::runtime::{RuntimeEvent, RuntimeMessage, RuntimeRequest, RuntimeRole, RuntimeTarget};
use crate::storage::{read_json, write_json, ConsolePaths};
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Thread runtime configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadRuntimeProfile {
    pub adapter: String,
    pub model: String,
    pub reasoning_effort: String,
    pub permission_mode: String,
}

/// Thread metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thread {
    pub id: String,
    pub title: String,
    pub workspace: String,
    pub runtime: ThreadRuntimeProfile,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Attachment in a thread message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadAttachment {
    pub name: String,
    pub path: String,
}

/// Message in a thread
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadMessage {
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

/// Run reference in a thread
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadRunRef {
    pub id: String,
    pub thread_id: String,
    pub assistant_message_id: String,
    pub status: String,
    pub adapter: String,
    pub model: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

pub struct ThreadService {
    storage: ConsolePaths,
    runtime_manager: Option<Arc<crate::runtime::RuntimeManager>>,
}

impl ThreadService {
    pub fn new() -> Self {
        Self {
            storage: ConsolePaths::default(),
            runtime_manager: None,
        }
    }

    pub fn with_runtime_manager(runtime_manager: Arc<crate::runtime::RuntimeManager>) -> Self {
        Self {
            storage: ConsolePaths::default(),
            runtime_manager: Some(runtime_manager),
        }
    }

    /// Ensure a thread event bridge is running for the given thread ID (prevents duplicates)
    pub async fn ensure_thread_bridge(&self, thread_id: &str) {
        if let Some(runtime_manager) = &self.runtime_manager {
            // Try to mark bridge as active - if returns false, bridge already exists
            if !runtime_manager.mark_bridge_active(thread_id).await {
                return;
            }

            let thread_service = self.clone();
            let thread_id = thread_id.to_string();
            let runtime_manager = runtime_manager.clone();

            tokio::spawn(async move {
                let mut runtime_rx = runtime_manager.get_or_create_thread_channel(&thread_id).await;

                loop {
                    match runtime_rx.recv().await {
                        Ok(runtime_event) => {
                            if let Some(thread_event) = thread_service.handle_runtime_event(&thread_id, &runtime_event) {
                                runtime_manager.broadcast_to_thread_event(&thread_id, thread_event).await;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            runtime_manager.unmark_bridge_active(&thread_id).await;
                            break;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    }
                }
            });
        }
    }

    /// Create a new thread
    pub fn create_thread(
        &self,
        title: String,
        workspace: String,
        runtime: ThreadRuntimeProfile,
    ) -> Result<Thread> {
        let thread_id = format!(
            "thread_{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        let now = Utc::now();

        let thread = Thread {
            id: thread_id.clone(),
            title,
            workspace,
            runtime,
            created_at: now,
            updated_at: now,
        };

        let thread_dir = self.storage.thread_dir(&thread_id);
        std::fs::create_dir_all(&thread_dir)?;

        write_json(&self.storage.thread_info_file(&thread_id), &thread)?;
        write_json(
            &self.storage.thread_messages_file(&thread_id),
            &Vec::<ThreadMessage>::new(),
        )?;
        write_json(
            &self.storage.thread_runs_file(&thread_id),
            &Vec::<ThreadRunRef>::new(),
        )?;

        Ok(thread)
    }

    /// Get thread by ID
    pub fn get_thread(&self, thread_id: &str) -> Result<Option<Thread>> {
        let path = self.storage.thread_info_file(thread_id);
        if !path.exists() {
            return Ok(None);
        }
        let thread: Thread = read_json(&path)?;
        Ok(Some(thread))
    }

    /// List all threads
    pub fn list_threads(&self) -> Result<Vec<Thread>> {
        let threads_dir = self.storage.threads_dir();
        if !threads_dir.exists() {
            return Ok(vec![]);
        }

        let mut threads = vec![];
        for entry in std::fs::read_dir(&threads_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let thread_id = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if let Ok(Some(thread)) = self.get_thread(thread_id) {
                    threads.push(thread);
                }
            }
        }

        threads.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(threads)
    }

    /// Delete thread
    pub fn delete_thread(&self, thread_id: &str) -> Result<()> {
        let thread_dir = self.storage.thread_dir(thread_id);
        if thread_dir.exists() {
            std::fs::remove_dir_all(&thread_dir)?;
        }
        Ok(())
    }

    /// Update thread title
    pub fn update_thread_title(&self, thread_id: &str, title: String) -> Result<Thread> {
        let mut thread = self
            .get_thread(thread_id)?
            .ok_or_else(|| anyhow::anyhow!("Thread not found"))?;

        thread.title = title;
        thread.updated_at = Utc::now();

        write_json(&self.storage.thread_info_file(thread_id), &thread)?;
        Ok(thread)
    }

    /// Get all messages for a thread
    pub fn list_messages(&self, thread_id: &str) -> Result<Vec<ThreadMessage>> {
        let path = self.storage.thread_messages_file(thread_id);
        if !path.exists() {
            return Ok(vec![]);
        }
        let messages: Vec<ThreadMessage> = read_json(&path)?;
        Ok(messages)
    }

    /// Append a user message
    pub fn append_user_message(
        &self,
        thread_id: &str,
        content: String,
        attachments: Vec<ThreadAttachment>,
    ) -> Result<ThreadMessage> {
        let mut messages = self.list_messages(thread_id)?;

        let message = ThreadMessage {
            id: format!(
                "msg_{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
            ),
            thread_id: thread_id.to_string(),
            role: "user".to_string(),
            content,
            status: None,
            error: None,
            attachments,
            created_at: Utc::now(),
            run_id: None,
        };

        messages.push(message.clone());
        write_json(&self.storage.thread_messages_file(thread_id), &messages)?;

        Ok(message)
    }

    /// Create an assistant placeholder message
    pub fn create_assistant_placeholder(
        &self,
        thread_id: &str,
        run_id: String,
    ) -> Result<ThreadMessage> {
        let mut messages = self.list_messages(thread_id)?;

        let message = ThreadMessage {
            id: format!(
                "msg_{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
            ),
            thread_id: thread_id.to_string(),
            role: "assistant".to_string(),
            content: String::new(),
            status: Some("running".to_string()),
            error: None,
            attachments: vec![],
            created_at: Utc::now(),
            run_id: Some(run_id),
        };

        messages.push(message.clone());
        write_json(&self.storage.thread_messages_file(thread_id), &messages)?;

        Ok(message)
    }

    /// Append delta to assistant message
    pub fn append_assistant_delta(
        &self,
        thread_id: &str,
        message_id: &str,
        delta: String,
    ) -> Result<String> {
        let mut messages = self.list_messages(thread_id)?;

        let message = messages
            .iter_mut()
            .find(|m| m.id == message_id)
            .ok_or_else(|| anyhow::anyhow!("Message not found"))?;

        message.content.push_str(&delta);
        let content = message.content.clone();

        write_json(&self.storage.thread_messages_file(thread_id), &messages)?;
        Ok(content)
    }

    /// Mark assistant message as done
    pub fn mark_assistant_done(&self, thread_id: &str, message_id: &str) -> Result<()> {
        let mut messages = self.list_messages(thread_id)?;

        let message = messages
            .iter_mut()
            .find(|m| m.id == message_id)
            .ok_or_else(|| anyhow::anyhow!("Message not found"))?;

        message.status = Some("done".to_string());
        message.error = None;

        write_json(&self.storage.thread_messages_file(thread_id), &messages)?;
        Ok(())
    }

    /// Mark assistant message as cancelled
    pub fn mark_assistant_cancelled(&self, thread_id: &str, message_id: &str) -> Result<()> {
        let mut messages = self.list_messages(thread_id)?;

        let message = messages
            .iter_mut()
            .find(|m| m.id == message_id)
            .ok_or_else(|| anyhow::anyhow!("Message not found"))?;

        message.status = Some("cancelled".to_string());
        message.error = None;

        write_json(&self.storage.thread_messages_file(thread_id), &messages)?;
        Ok(())
    }

    /// Mark assistant message as error
    pub fn mark_assistant_error(
        &self,
        thread_id: &str,
        message_id: &str,
        error: String,
    ) -> Result<()> {
        let mut messages = self.list_messages(thread_id)?;

        let message = messages
            .iter_mut()
            .find(|m| m.id == message_id)
            .ok_or_else(|| anyhow::anyhow!("Message not found"))?;

        message.status = Some("error".to_string());
        message.error = Some(error);

        write_json(&self.storage.thread_messages_file(thread_id), &messages)?;
        Ok(())
    }

    /// Build a runtime request from thread and message
    pub fn build_runtime_request(
        &self,
        thread: &Thread,
        messages: &[ThreadMessage],
        message_id: Option<String>,
    ) -> RuntimeRequest {
        let runtime_messages: Vec<RuntimeMessage> = messages
            .iter()
            .map(|m| RuntimeMessage {
                role: match m.role.as_str() {
                    "user" => RuntimeRole::User,
                    "assistant" => RuntimeRole::Assistant,
                    _ => RuntimeRole::User,
                },
                content: m.content.clone(),
            })
            .collect();

        let mut request = RuntimeRequest::new(
            Some(thread.id.clone()),
            message_id,
            match thread.runtime.adapter.as_str() {
                "codex" => RuntimeTarget::Codex,
                "claude" => RuntimeTarget::Claude,
                _ => RuntimeTarget::Auto,
            },
            thread.runtime.model.clone(),
            runtime_messages,
        );

        request.workspace = Some(thread.workspace.clone());
        request.reasoning_effort = Some(thread.runtime.reasoning_effort.clone());
        request.permission_mode = Some(thread.runtime.permission_mode.clone());
        request.metadata = serde_json::json!({
            "thread_id": thread.id,
            "workspace": thread.workspace,
        });

        request
    }

    /// Find assistant message by run_id
    pub fn find_message_by_run_id(&self, thread_id: &str, run_id: &str) -> Option<ThreadMessage> {
        let messages = self.list_messages(thread_id).ok()?;
        messages
            .into_iter()
            .find(|m| m.run_id.as_deref() == Some(run_id))
    }

    /// Handle runtime event and update thread message
    pub fn handle_runtime_event(
        &self,
        thread_id: &str,
        runtime_event: &RuntimeEvent,
    ) -> Option<crate::runtime::ThreadEvent> {
        match runtime_event {
            RuntimeEvent::RunStarted { run_id } => {
                Some(crate::runtime::ThreadEvent::RunStarted {
                    run_id: run_id.clone(),
                })
            }
            RuntimeEvent::TextDelta { run_id, text } => {
                if let Some(message) = self.find_message_by_run_id(thread_id, run_id) {
                    let _ = self.append_assistant_delta(thread_id, &message.id, text.clone());
                    return Some(crate::runtime::ThreadEvent::MessageDelta {
                        message_id: message.id.clone(),
                        delta: text.clone(),
                    });
                }
                None
            }
            RuntimeEvent::RunCompleted { run_id, .. } => {
                if let Some(message) = self.find_message_by_run_id(thread_id, run_id) {
                    let _ = self.mark_assistant_done(thread_id, &message.id);
                    return Some(crate::runtime::ThreadEvent::MessageDone {
                        message_id: message.id.clone(),
                        content: message.content.clone(),
                    });
                }
                None
            }
            RuntimeEvent::RunFailed { run_id, error } => {
                if let Some(message) = self.find_message_by_run_id(thread_id, run_id) {
                    let _ = self.mark_assistant_error(thread_id, &message.id, error.clone());
                    return Some(crate::runtime::ThreadEvent::MessageError {
                        message_id: message.id.clone(),
                        error: error.clone(),
                    });
                }
                None
            }
            RuntimeEvent::RunCancelled { run_id } => {
                if let Some(message) = self.find_message_by_run_id(thread_id, run_id) {
                    let _ = self.mark_assistant_cancelled(thread_id, &message.id);
                    return Some(crate::runtime::ThreadEvent::RunCancelled {
                        run_id: run_id.clone(),
                    });
                }
                None
            }
            RuntimeEvent::Status { .. } => None,
        }
    }
}

impl Default for ThreadService {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for ThreadService {
    fn clone(&self) -> Self {
        Self {
            storage: self.storage.clone(),
            runtime_manager: self.runtime_manager.clone(),
        }
    }
}
