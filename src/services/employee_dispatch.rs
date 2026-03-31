use anyhow::Result;
use crate::models::{AgentProtocol, SoulFiles};

pub struct DispatchResult {
    pub output: String,
    pub exit_code: i32,
}

pub fn build_system_prompt(soul: &SoulFiles) -> String {
    let mut parts = Vec::new();
    if !soul.soul.trim().is_empty() {
        parts.push(soul.soul.clone());
    }
    if !soul.skills.trim().is_empty() {
        parts.push(format!("## 技能\n{}", soul.skills));
    }
    if !soul.rules.trim().is_empty() {
        parts.push(format!("## 规则\n{}", soul.rules));
    }
    parts.join("\n\n")
}

pub async fn dispatch_local_process(
    executable: &str,
    soul_arg: &str,
    extra_args: &[String],
    system_prompt: &str,
    task: &str,
    cwd: Option<&str>,
) -> Result<DispatchResult> {
    let mut cmd = tokio::process::Command::new(executable);

    if !system_prompt.is_empty() {
        cmd.arg(soul_arg).arg(system_prompt);
    }

    for arg in extra_args {
        cmd.arg(arg);
    }

    cmd.arg(task);

    if let Some(workdir) = cwd {
        cmd.current_dir(workdir);
    }

    let output = cmd.output().await?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);
    
    Ok(DispatchResult {
        output: if stderr.is_empty() { stdout } else { format!("{}\n---stderr---\n{}", stdout, stderr) },
        exit_code,
    })
}

pub async fn dispatch_openai_compatible(
    endpoint: &str,
    api_key: Option<&str>,
    model: &str,
    stream: bool,
    system_prompt: &str,
    task: &str,
) -> Result<DispatchResult> {
    let client = reqwest::Client::new();
    
    let base = endpoint.trim_end_matches('/');
    let url = format!("{}/v1/chat/completions", base);
    
    let mut req_body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task}
        ],
        "stream": stream
    });
    
    if !stream {
        req_body["stream"] = serde_json::json!(false);
    }
    
    let mut request = client.post(&url).json(&req_body);
    
    if let Some(key) = api_key {
        request = request.header("Authorization", format!("Bearer {}", key));
    }
    
    let response = request.send().await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("OpenAI API error: {} - {}", status, body);
    }
    
    if stream {
        let text = response.text().await?;
        let mut output = String::new();
        
        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    break;
                }
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = json
                        .get("choices")
                        .and_then(|c| c.as_array())
                        .and_then(|a| a.first())
                        .and_then(|c| c.get("delta"))
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        output.push_str(content);
                    }
                }
            }
        }
        
        Ok(DispatchResult {
            output,
            exit_code: 0,
        })
    } else {
        let json: serde_json::Value = response.json().await?;
        
        let output = json
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|a| a.first())
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .unwrap_or("")
            .to_string();
        
        Ok(DispatchResult {
            output,
            exit_code: 0,
        })
    }
}

pub async fn dispatch_ssh_exec(
    host: &str,
    port: u16,
    user: &str,
    key_path: &str,
    executable: &str,
    soul_arg: &str,
    system_prompt: &str,
    task: &str,
) -> Result<DispatchResult> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let soul_b64 = STANDARD.encode(system_prompt.as_bytes());
    let task_b64 = STANDARD.encode(task.as_bytes());

    let remote_cmd = format!(
        r#"CONSOLE_SOUL=$(printf '%s' '{soul}' | base64 -d) CONSOLE_TASK=$(printf '%s' '{task}' | base64 -d) {exe} {arg} "$CONSOLE_SOUL" "$CONSOLE_TASK""#,
        soul = soul_b64,
        task = task_b64,
        exe = executable,
        arg = soul_arg,
    );

    let mut cmd = tokio::process::Command::new("ssh");
    cmd.arg("-i")
        .arg(key_path)
        .arg("-p")
        .arg(port.to_string())
        .arg("-o").arg("StrictHostKeyChecking=accept-new")
        .arg("-o").arg("BatchMode=yes")
        .arg(format!("{}@{}", user, host))
        .arg(&remote_cmd);

    let output = cmd.output().await?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);
    
    Ok(DispatchResult {
        output: if stderr.is_empty() { stdout } else { format!("{}\n---stderr---\n{}", stdout, stderr) },
        exit_code,
    })
}

pub async fn dispatch(
    protocol: &AgentProtocol,
    soul: &SoulFiles,
    task: &str,
    cwd: Option<&str>,
) -> Result<DispatchResult> {
    let system_prompt = build_system_prompt(soul);
    
    match protocol {
        AgentProtocol::LocalProcess {
            executable,
            soul_arg,
            extra_args,
        } => {
            if let Some(workdir) = cwd {
                write_soul_to_cwd(executable, &system_prompt, workdir);
            }
            dispatch_local_process(
                executable,
                soul_arg,
                extra_args,
                &system_prompt,
                task,
                cwd,
            )
            .await
        }
        AgentProtocol::OpenAiCompatible {
            endpoint,
            api_key,
            model,
            stream,
        } => {
            dispatch_openai_compatible(
                endpoint,
                api_key.as_deref(),
                model,
                *stream,
                &system_prompt,
                task,
            )
            .await
        }
        AgentProtocol::SshExec {
            host,
            port,
            user,
            key_path,
            executable,
            soul_arg,
        } => {
            dispatch_ssh_exec(
                host,
                *port,
                user,
                key_path,
                executable,
                soul_arg,
                &system_prompt,
                task,
            )
            .await
        }
    }
}

fn write_soul_to_cwd(executable: &str, system_prompt: &str, cwd: &str) {
    use std::fs;
    use std::path::Path;

    let filename = match executable {
        "claude" => Some("CLAUDE.md"),
        "codex"  => Some("CODEX.md"),
        "opencode" => Some("OPENCODE.md"),
        "gemini" => Some("GEMINI.md"),
        _ => None,
    };

    if let Some(fname) = filename {
        let path = Path::new(cwd).join(fname);
        if !path.exists() {
            let content = format!(
                "<!-- Generated by Console AI Employee. Do not edit manually. -->\n\n{}",
                system_prompt
            );
            let _ = fs::write(&path, content);
        }
    }
}
