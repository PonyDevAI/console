# Console 后端补全 — P0 + P1

参考现有代码: src/ 下所有 .rs 文件, Cargo.toml, AGENTS.md
只改 src/ 下的 Rust 文件和 Cargo.toml，不改前端。

## 一、Serve 前端静态文件

### 1a. 修改 src/api/mod.rs

在 Router 中加入前端静态文件 serve：
- 先 nest `/api` 路由
- 然后用 `tower_http::services::ServeDir` serve `web/dist/` 目录
- 加 SPA fallback：未知路径返回 `web/dist/index.html`

```rust
use tower_http::services::{ServeDir, ServeFile};

pub async fn serve(addr: &str) -> Result<()> {
    let spa_fallback = ServeFile::new("web/dist/index.html");
    let static_files = ServeDir::new("web/dist").fallback(spa_fallback);

    let app = Router::new()
        .nest("/api", routes::api_routes())
        .fallback_service(static_files)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Console listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}
```

### 1b. 修改 Cargo.toml

确保 tower-http 有 `fs` feature（已有）。

## 二、新增 API 路由

### 2a. CLI Tools 操作路由

在 src/api/routes.rs 中新增：

```rust
.route("/cli-tools/check-updates", post(check_updates))
.route("/cli-tools/{name}/install", post(install_tool))
.route("/cli-tools/{name}/upgrade", post(upgrade_tool))
.route("/cli-tools/{name}/uninstall", post(uninstall_tool))
```

Handler 实现：

```rust
async fn check_updates() -> Result<Json<Value>, StatusCode> {
    let mut state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::check_updates(&mut state);
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "tools": state.tools })))
}

async fn install_tool(Path(name): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::version::install(&name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    // Re-scan to get updated state
    let state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let tool = state.tools.into_iter().find(|t| t.name == name);
    Ok(Json(json!(tool)))
}

async fn upgrade_tool(Path(name): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::version::upgrade(&name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let tool = state.tools.into_iter().find(|t| t.name == name);
    Ok(Json(json!(tool)))
}

async fn uninstall_tool(Path(name): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::version::uninstall(&name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let state = services::version::scan_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::version::save(&state).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}
```

### 2b. Provider 测试连接路由

```rust
.route("/providers/{id}/test", post(test_provider))
```

Handler:
```rust
async fn test_provider(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let providers = services::provider::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let provider = providers.into_iter().find(|p| p.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let start = std::time::Instant::now();
    let client = reqwest::Client::new();
    let result = client
        .get(format!("{}/models", provider.api_endpoint))
        .header("Authorization", format!("Bearer {}", provider.api_key_ref))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            let latency = start.elapsed().as_millis();
            Ok(Json(json!({ "ok": true, "latency_ms": latency })))
        }
        Ok(resp) => {
            let latency = start.elapsed().as_millis();
            Ok(Json(json!({ "ok": false, "latency_ms": latency, "status": resp.status().as_u16() })))
        }
        Err(e) => {
            Ok(Json(json!({ "ok": false, "error": e.to_string() })))
        }
    }
}
```

### 2c. MCP Server Ping 路由

```rust
.route("/mcp-servers/{id}/ping", post(ping_mcp_server))
```

Handler:
```rust
async fn ping_mcp_server(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let servers = services::mcp::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let server = servers.into_iter().find(|s| s.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;

    match server.transport.as_str() {
        "http" | "sse" => {
            if let Some(url) = &server.url {
                let start = std::time::Instant::now();
                let client = reqwest::Client::new();
                let result = client.get(url.as_str())
                    .timeout(std::time::Duration::from_secs(5))
                    .send()
                    .await;
                match result {
                    Ok(_) => {
                        let latency = start.elapsed().as_millis();
                        Ok(Json(json!({ "ok": true, "latency_ms": latency })))
                    }
                    Err(e) => Ok(Json(json!({ "ok": false, "error": e.to_string() }))),
                }
            } else {
                Ok(Json(json!({ "ok": false, "error": "no URL configured" })))
            }
        }
        "stdio" => {
            // For stdio servers, check if the command exists
            if let Some(cmd) = &server.command {
                let exists = std::process::Command::new("which")
                    .arg(cmd.as_str())
                    .output()
                    .map(|o| o.status.success())
                    .unwrap_or(false);
                Ok(Json(json!({ "ok": exists, "transport": "stdio" })))
            } else {
                Ok(Json(json!({ "ok": false, "error": "no command configured" })))
            }
        }
        _ => Ok(Json(json!({ "ok": false, "error": "unknown transport" }))),
    }
}
```

### 2d. Skills Install/Uninstall 路由

```rust
.route("/skills/{id}/install", post(install_skill))
.route("/skills/{id}/uninstall", post(uninstall_skill))
```

Handler:
```rust
async fn install_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut skill = skills.into_iter().find(|s| s.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    skill.installed_at = Some(chrono::Utc::now());
    // Re-save the skills state with updated installed_at
    let mut state = crate::services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Some(s) = state.iter_mut().find(|s| s.id == id) {
        s.installed_at = skill.installed_at;
    }
    // Save via the skill service (need to add an update function or use install)
    Ok(Json(json!(skill)))
}

async fn uninstall_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let skills = services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let skill = skills.into_iter().find(|s| s.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    services::skill::uninstall(&skill.name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}
```

### 2e. Settings 路由

新建 src/services/settings.rs:

```rust
use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::storage::{self, ConsolePaths};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub storage_path: String,
    pub default_worker: String,
    pub theme: String,
    pub log_level: String,
    pub auto_check_updates: bool,
    pub sync_on_change: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            storage_path: "~/.console".to_string(),
            default_worker: "claude".to_string(),
            theme: "dark".to_string(),
            log_level: "info".to_string(),
            auto_check_updates: true,
            sync_on_change: false,
        }
    }
}

pub fn load() -> Result<Settings> {
    let paths = ConsolePaths::default();
    let file = paths.root.join("settings.json");
    if file.exists() {
        storage::read_json(&file)
    } else {
        Ok(Settings::default())
    }
}

pub fn save(settings: &Settings) -> Result<()> {
    let paths = ConsolePaths::default();
    let file = paths.root.join("settings.json");
    storage::write_json(&file, settings)
}
```

在 src/services/mod.rs 中加入:
```rust
pub mod settings;
```

路由:
```rust
.route("/settings", get(get_settings))
.route("/settings", put(update_settings))
```

Handler:
```rust
async fn get_settings() -> Result<Json<Value>, StatusCode> {
    let settings = services::settings::load().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::to_value(settings).unwrap()))
}

async fn update_settings(Json(body): Json<Value>) -> Result<Json<Value>, StatusCode> {
    let settings: services::settings::Settings = serde_json::from_value(body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    services::settings::save(&settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::to_value(settings).unwrap()))
}
```

### 2f. Logs 路由

新建 src/services/logs.rs:

```rust
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub source: String,
    pub message: String,
}

static LOG_BUFFER: Mutex<Option<VecDeque<LogEntry>>> = Mutex::new(None);

const MAX_LOGS: usize = 500;

fn buffer() -> std::sync::MutexGuard<'static, Option<VecDeque<LogEntry>>> {
    LOG_BUFFER.lock().unwrap()
}

pub fn push(level: &str, source: &str, message: &str) {
    let entry = LogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        level: level.to_string(),
        source: source.to_string(),
        message: message.to_string(),
    };
    let mut buf = buffer();
    let deque = buf.get_or_insert_with(VecDeque::new);
    if deque.len() >= MAX_LOGS {
        deque.pop_front();
    }
    deque.push_back(entry);
}

pub fn list(level: Option<&str>, source: Option<&str>, limit: Option<usize>) -> Vec<LogEntry> {
    let buf = buffer();
    let deque = match buf.as_ref() {
        Some(d) => d,
        None => return vec![],
    };
    let mut result: Vec<LogEntry> = deque.iter()
        .filter(|e| level.map_or(true, |l| e.level == l))
        .filter(|e| source.map_or(true, |s| e.source == s))
        .cloned()
        .collect();
    result.reverse(); // newest first
    if let Some(lim) = limit {
        result.truncate(lim);
    }
    result
}

pub fn init_startup_logs() {
    push("info", "daemon", "Console daemon started");
    push("info", "scanner", "CLI tool scan initiated");
}
```

在 src/services/mod.rs 中加入:
```rust
pub mod logs;
```

路由:
```rust
.route("/logs", get(get_logs))
```

Handler:
```rust
async fn get_logs(axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>) -> Result<Json<Value>, StatusCode> {
    let level = params.get("level").map(|s| s.as_str());
    let source = params.get("source").map(|s| s.as_str());
    let limit = params.get("limit").and_then(|s| s.parse().ok());
    let logs = services::logs::list(level, source, limit);
    Ok(Json(json!({ "logs": logs })))
}
```

### 2g. Config Sync 路由

路由:
```rust
.route("/config-sync", get(get_config_sync))
.route("/config-sync/sync-all", post(sync_all_config))
.route("/config-sync/{id}/sync", post(sync_single_config))
```

Handler:
```rust
async fn get_config_sync() -> Result<Json<Value>, StatusCode> {
    // Build sync status from current state
    let adapters = crate::adapters::registry();
    let mut entries = Vec::new();

    for adapter in adapters.adapters() {
        for config_type in &["providers", "mcp_servers", "skills"] {
            entries.push(json!({
                "id": format!("{}_{}", adapter.name(), config_type),
                "app": adapter.name(),
                "config_type": config_type,
                "status": "synced",
                "last_synced": chrono::Utc::now(),
                "local_hash": "",
                "remote_hash": "",
            }));
        }
    }

    Ok(Json(json!({ "entries": entries })))
}

async fn sync_all_config() -> Result<Json<Value>, StatusCode> {
    let report = crate::sync::sync_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "sync", &format!("Sync all completed: {:?}", report));
    Ok(Json(json!({ "ok": true, "report": format!("{:?}", report) })))
}

async fn sync_single_config(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    // For now, just trigger sync_all and return the entry
    let _ = crate::sync::sync_all().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    services::logs::push("info", "sync", &format!("Sync completed for {}", id));
    Ok(Json(json!({ "id": id, "status": "synced", "last_synced": chrono::Utc::now() })))
}
```

## 三、启动时初始化日志

在 src/cli/start.rs 中，启动 API 前调用:
```rust
pub async fn run(host: &str, port: u16) -> anyhow::Result<()> {
    crate::services::logs::init_startup_logs();
    let addr = format!("{host}:{port}");
    tracing::info!("Starting Console daemon on {addr}");
    crate::services::logs::push("info", "daemon", &format!("Console daemon started on {addr}"));
    println!("Console listening on http://{addr}");
    api::serve(&addr).await
}
```

## 四、Storage 路径补全

确保 ConsolePaths 有 settings_file() 方法:
```rust
pub fn settings_file(&self) -> PathBuf {
    self.root.join("settings.json")
}
```

如果 init_default_files() 中没有创建 settings.json，加入默认创建。

## 五、Config Sync 引擎 — Phase 1: Provider Sync

在 src/sync/mod.rs 中实现 provider sync:

```rust
use anyhow::Result;
use crate::adapters::{self, CliAdapter};
use crate::services;

pub fn sync_all() -> Result<SyncReport> {
    let mut report = SyncReport::default();

    // Phase 1: Provider sync
    match sync_providers() {
        Ok(count) => report.providers_synced = count,
        Err(e) => report.errors.push(format!("provider sync: {e}")),
    }

    // Phase 2: MCP server sync
    match sync_mcp_servers() {
        Ok(count) => report.mcp_servers_synced = count,
        Err(e) => report.errors.push(format!("mcp sync: {e}")),
    }

    tracing::info!("sync_all completed: {report:?}");
    Ok(report)
}

fn sync_providers() -> Result<u32> {
    let active = services::provider::get_active()?;
    let registry = adapters::registry();
    let mut count = 0u32;

    if let Some(provider) = active {
        for adapter in registry.adapters() {
            if provider.apps.contains(&adapter.name().to_string()) {
                if let Ok(config_dir) = adapter.config_dir() {
                    // Write provider config to each CLI's native format
                    let config = serde_json::json!({
                        "provider": provider.name,
                        "api_endpoint": provider.api_endpoint,
                        "api_key_ref": provider.api_key_ref,
                    });
                    let target = config_dir.join("console_provider.json");
                    if let Some(parent) = target.parent() {
                        std::fs::create_dir_all(parent)?;
                    }
                    std::fs::write(&target, serde_json::to_string_pretty(&config)?)?;
                    count += 1;
                    tracing::info!("Synced provider to {}", target.display());
                }
            }
        }
    }

    Ok(count)
}

fn sync_mcp_servers() -> Result<u32> {
    let servers = services::mcp::list()?;
    let registry = adapters::registry();
    let mut count = 0u32;

    for adapter in registry.adapters() {
        let app_name = adapter.name().to_string();
        let enabled: Vec<_> = servers.iter()
            .filter(|s| s.enabled_apps.contains(&app_name))
            .collect();

        if enabled.is_empty() {
            continue;
        }

        if let Ok(config_dir) = adapter.config_dir() {
            // Build MCP config in the standard format
            let mut mcp_config = serde_json::Map::new();
            for server in &enabled {
                let mut entry = serde_json::Map::new();
                entry.insert("transport".to_string(), serde_json::json!(server.transport));
                if let Some(cmd) = &server.command {
                    entry.insert("command".to_string(), serde_json::json!(cmd));
                }
                if !server.args.is_empty() {
                    entry.insert("args".to_string(), serde_json::json!(server.args));
                }
                if let Some(url) = &server.url {
                    entry.insert("url".to_string(), serde_json::json!(url));
                }
                if !server.env.is_empty() {
                    entry.insert("env".to_string(), serde_json::json!(server.env));
                }
                mcp_config.insert(server.name.clone(), serde_json::Value::Object(entry));
            }

            let target = config_dir.join(".mcp.json");
            let wrapper = serde_json::json!({ "mcpServers": mcp_config });
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&target, serde_json::to_string_pretty(&wrapper)?)?;
            count += 1;
            tracing::info!("Synced {} MCP servers to {}", enabled.len(), target.display());
        }
    }

    Ok(count)
}

#[derive(Debug, Default)]
pub struct SyncReport {
    pub providers_synced: u32,
    pub mcp_servers_synced: u32,
    pub skills_synced: u32,
    pub prompts_synced: u32,
    pub errors: Vec<String>,
}
```

## 六、验证

完成后运行:
```bash
cargo check
cargo build
```
确保编译通过，无错误。
