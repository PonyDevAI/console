use crate::runtime::{
    RuntimeAdapter, RuntimeCapabilities, RuntimeEvent, RuntimeRequest,
    CancelHandle, RunHandle,
    errors::{Result, RuntimeError},
};
use async_trait::async_trait;
use tokio::sync::mpsc;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Command, Child};

/// Runtime adapter for Claude CLI
pub struct ClaudeRuntimeAdapter;

impl ClaudeRuntimeAdapter {
    pub fn new() -> Self {
        Self
    }

    async fn spawn_claude_process(
        &self,
        request: &RuntimeRequest,
    ) -> Result<Child> {
        let mut cmd = Command::new("claude");
        
        if let Some(workspace) = &request.workspace {
            cmd.current_dir(workspace);
        }

        if request.model != "sonnet-4.6" && !request.model.is_empty() {
            cmd.arg("--model").arg(&request.model);
        }

        if let Some(last_user_msg) = request.messages.iter().rev().find(|m| matches!(m.role, crate::runtime::RuntimeRole::User)) {
            cmd.arg(&last_user_msg.content);
        }

        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());

        cmd.spawn().map_err(|e| {
            RuntimeError::ProcessFailed(format!("Failed to spawn claude: {}", e))
        })
    }
}

#[async_trait]
impl RuntimeAdapter for ClaudeRuntimeAdapter {
    fn name(&self) -> &str {
        "claude"
    }

    fn display_name(&self) -> &str {
        "Claude CLI"
    }

    fn capabilities(&self) -> RuntimeCapabilities {
        RuntimeCapabilities {
            supports_streaming: true,
            supports_session: false,
            supports_workspace: true,
            supports_tools: true,
            supports_images: false,
            supports_json_mode: false,
        }
    }

    async fn start_run(
        &self,
        request: RuntimeRequest,
        run_id: String,
    ) -> Result<RunHandle> {
        let (event_tx, event_rx) = mpsc::channel(100);
        let (cancel_tx, mut cancel_rx) = mpsc::channel::<()>(1);

        let mut child = self.spawn_claude_process(&request).await?;
        let stdout = child.stdout.take().ok_or_else(|| {
            RuntimeError::ProcessFailed("No stdout".into())
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            RuntimeError::ProcessFailed("No stderr".into())
        })?;
        
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let tx_clone = event_tx.clone();
        let run_id_for_handle = run_id.clone();

        tokio::spawn(async move {
            let mut accumulated = String::new();

            let _ = tx_clone
                .send(RuntimeEvent::RunStarted { run_id: run_id.clone() })
                .await;

            loop {
                tokio::select! {
                    Some(_) = cancel_rx.recv() => {
                        let _ = child.kill().await;
                        let _ = tx_clone.send(RuntimeEvent::RunCancelled { run_id: run_id.clone() }).await;
                        break;
                    }
                    line_result = stdout_reader.next_line() => {
                        match line_result {
                            Ok(Some(line)) => {
                                accumulated.push_str(&line);
                                accumulated.push('\n');
                                let _ = tx_clone
                                    .send(RuntimeEvent::TextDelta { run_id: run_id.clone(), text: line })
                                    .await;
                            }
                            Ok(None) => {
                                break;
                            }
                            Err(e) => {
                                let _ = tx_clone
                                    .send(RuntimeEvent::RunFailed { run_id: run_id.clone(), error: format!("Stdout error: {}", e) })
                                    .await;
                                break;
                            }
                        }
                    }
                    line_result = stderr_reader.next_line() => {
                        match line_result {
                            Ok(Some(line)) => {
                                let _ = tx_clone
                                    .send(RuntimeEvent::Status { run_id: run_id.clone(), message: line })
                                    .await;
                            }
                            Ok(None) => {}
                            Err(e) => {
                                let _ = tx_clone
                                    .send(RuntimeEvent::RunFailed { run_id: run_id.clone(), error: format!("Stderr error: {}", e) })
                                    .await;
                                break;
                            }
                        }
                    }
                }
            }

            match child.wait().await {
                Ok(status) if status.success() => {
                    let _ = tx_clone
                        .send(RuntimeEvent::RunCompleted { run_id: run_id.clone(), output: accumulated })
                        .await;
                }
                Ok(status) => {
                    let _ = tx_clone
                        .send(RuntimeEvent::RunFailed { run_id: run_id.clone(), error: format!("Process exited with code: {:?}", status.code()) })
                        .await;
                }
                Err(e) => {
                    let _ = tx_clone
                        .send(RuntimeEvent::RunFailed { run_id: run_id.clone(), error: format!("Process error: {}", e) })
                        .await;
                }
            }
        });

        Ok(RunHandle {
            run_id: run_id_for_handle,
            event_rx,
            cancel_handle: CancelHandle::new(cancel_tx),
        })
    }

    async fn cancel_run(&self, _run_id: &str) -> Result<()> {
        Ok(())
    }
}

impl Default for ClaudeRuntimeAdapter {
    fn default() -> Self {
        Self::new()
    }
}
