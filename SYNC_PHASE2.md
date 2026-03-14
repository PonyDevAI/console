# Config Sync Phase 2 — 各 CLI 原生配置格式

参考现有代码: src/adapters/*.rs, src/sync/mod.rs, src/services/*.rs, AGENTS.md
只改 src/ 下的 Rust 文件。

## 背景

当前 sync 引擎写的是通用格式（console_provider.json / .mcp.json），需要改为各 CLI 的原生配置格式。

各 CLI 的配置文件格式（通过实际文件调研）：

### Claude CLI (~/.claude/)
- MCP: `~/.claude/mcp_servers.json` 格式:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-xxx"],
      "env": { "KEY": "value" }
    }
  }
}
```
- Provider: Claude CLI 不支持自定义 provider（只用 Anthropic），跳过 provider sync

### Cursor (~/.cursor/)
- MCP: `~/.cursor/mcp.json` 格式:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-xxx"],
      "env": { "KEY": "value" }
    }
  }
}
```
- Provider: Cursor 通过 settings.json 管理，但 API key 通过 UI 设置，跳过 provider sync

### Codex CLI (~/.codex/)
- MCP: `~/.codex/mcp.json` 格式:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-xxx"],
      "env": { "KEY": "value" }
    }
  }
}
```
- Provider: `~/.codex/config.json` 格式:
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "apiKey": "sk-xxx"
}
```

### Gemini CLI (~/.gemini/)
- MCP: `~/.gemini/settings/mcp.json` 格式:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-xxx"]
    }
  }
}
```
- Provider: Gemini CLI 只用 Google API，跳过 provider sync

## 一、新增 Adapter trait 方法

在 src/adapters/mod.rs 的 CliAdapter trait 中新增：

```rust
    // ── Config sync ──

    /// Path to the MCP config file for this CLI.
    fn mcp_config_path(&self) -> Result<PathBuf>;

    /// Write MCP servers config in this CLI's native format.
    fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()>;

    /// Whether this CLI supports custom provider config.
    fn supports_provider_sync(&self) -> bool { false }

    /// Write provider config in this CLI's native format.
    fn write_provider_config(&self, _provider: &crate::models::Provider) -> Result<()> {
        Ok(()) // default no-op
    }

    /// Read current MCP config from this CLI's native file.
    fn read_mcp_config(&self) -> Result<serde_json::Value> {
        let path = self.mcp_config_path()?;
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Ok(serde_json::json!({ "mcpServers": {} }))
        }
    }
```

## 二、各 Adapter 实现

### 2a. Claude (src/adapters/claude.rs)

```rust
fn mcp_config_path(&self) -> Result<PathBuf> {
    Ok(self.config_dir()?.join("mcp_servers.json"))
}

fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()> {
    let mut mcp_servers = serde_json::Map::new();
    for server in servers {
        let mut entry = serde_json::Map::new();
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
        mcp_servers.insert(server.name.clone(), serde_json::Value::Object(entry));
    }
    let config = serde_json::json!({ "mcpServers": mcp_servers });
    let path = self.mcp_config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_string_pretty(&config)?)?;
    tracing::info!("Wrote Claude MCP config: {}", path.display());
    Ok(())
}

// Claude doesn't support custom providers
fn supports_provider_sync(&self) -> bool { false }
```

### 2b. Cursor (src/adapters/cursor.rs)

```rust
fn mcp_config_path(&self) -> Result<PathBuf> {
    Ok(self.config_dir()?.join("mcp.json"))
}

fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()> {
    let mut mcp_servers = serde_json::Map::new();
    for server in servers {
        let mut entry = serde_json::Map::new();
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
        mcp_servers.insert(server.name.clone(), serde_json::Value::Object(entry));
    }
    let config = serde_json::json!({ "mcpServers": mcp_servers });
    let path = self.mcp_config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_string_pretty(&config)?)?;
    tracing::info!("Wrote Cursor MCP config: {}", path.display());
    Ok(())
}

fn supports_provider_sync(&self) -> bool { false }
```

### 2c. Codex (src/adapters/codex.rs)

```rust
fn mcp_config_path(&self) -> Result<PathBuf> {
    Ok(self.config_dir()?.join("mcp.json"))
}

fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()> {
    let mut mcp_servers = serde_json::Map::new();
    for server in servers {
        let mut entry = serde_json::Map::new();
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
        mcp_servers.insert(server.name.clone(), serde_json::Value::Object(entry));
    }
    let config = serde_json::json!({ "mcpServers": mcp_servers });
    let path = self.mcp_config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_string_pretty(&config)?)?;
    tracing::info!("Wrote Codex MCP config: {}", path.display());
    Ok(())
}

fn supports_provider_sync(&self) -> bool { true }

fn write_provider_config(&self, provider: &crate::models::Provider) -> Result<()> {
    let config = serde_json::json!({
        "provider": provider.name.to_lowercase(),
        "apiKey": provider.api_key_ref,
    });
    let path = self.config_dir()?.join("config.json");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    // Read existing config and merge (don't overwrite other fields)
    let mut existing: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if let Some(obj) = existing.as_object_mut() {
        obj.insert("provider".to_string(), config["provider"].clone());
        obj.insert("apiKey".to_string(), config["apiKey"].clone());
    }
    std::fs::write(&path, serde_json::to_string_pretty(&existing)?)?;
    tracing::info!("Wrote Codex provider config: {}", path.display());
    Ok(())
}
```

### 2d. Gemini (src/adapters/gemini.rs)

```rust
fn mcp_config_path(&self) -> Result<PathBuf> {
    Ok(self.config_dir()?.join("settings").join("mcp.json"))
}

fn write_mcp_config(&self, servers: &[crate::models::McpServer]) -> Result<()> {
    let mut mcp_servers = serde_json::Map::new();
    for server in servers {
        let mut entry = serde_json::Map::new();
        if let Some(cmd) = &server.command {
            entry.insert("command".to_string(), serde_json::json!(cmd));
        }
        if !server.args.is_empty() {
            entry.insert("args".to_string(), serde_json::json!(server.args));
        }
        if let Some(url) = &server.url {
            entry.insert("url".to_string(), serde_json::json!(url));
        }
        // Gemini typically doesn't use env in MCP config, but include if present
        if !server.env.is_empty() {
            entry.insert("env".to_string(), serde_json::json!(server.env));
        }
        mcp_servers.insert(server.name.clone(), serde_json::Value::Object(entry));
    }
    let config = serde_json::json!({ "mcpServers": mcp_servers });
    let path = self.mcp_config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_string_pretty(&config)?)?;
    tracing::info!("Wrote Gemini MCP config: {}", path.display());
    Ok(())
}

fn supports_provider_sync(&self) -> bool { false }
```

## 三、重写 sync 引擎使用 adapter 方法

替换 src/sync/mod.rs 中的 `sync_providers` 和 `sync_mcp_servers`：

```rust
fn sync_providers() -> Result<u32> {
    let active = services::provider::get_active()?;
    let registry = adapters::registry();
    let mut count = 0u32;

    if let Some(provider) = active {
        for adapter in registry.adapters() {
            if !adapter.supports_provider_sync() {
                continue;
            }
            if !provider.apps.contains(&adapter.name().to_string()) {
                continue;
            }
            match adapter.write_provider_config(&provider) {
                Ok(()) => {
                    count += 1;
                    services::logs::push("info", "sync",
                        &format!("Synced provider '{}' to {}", provider.name, adapter.display_name()));
                }
                Err(e) => {
                    services::logs::push("error", "sync",
                        &format!("Failed to sync provider to {}: {e}", adapter.display_name()));
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
            .cloned()
            .collect();

        if enabled.is_empty() {
            continue;
        }

        match adapter.write_mcp_config(&enabled) {
            Ok(()) => {
                count += 1;
                services::logs::push("info", "sync",
                    &format!("Synced {} MCP servers to {}", enabled.len(), adapter.display_name()));
            }
            Err(e) => {
                services::logs::push("error", "sync",
                    &format!("Failed to sync MCP to {}: {e}", adapter.display_name()));
            }
        }
    }

    Ok(count)
}
```

## 四、新增 CLI 命令 `console sync`

在 src/cli/mod.rs 中新增 Sync 子命令：

```rust
Sync {
    /// Only sync a specific config type
    #[arg(long)]
    only: Option<String>,
},
```

在 execute 函数中处理：
```rust
Command::Sync { only: _ } => {
    let report = crate::sync::sync_all()?;
    println!("Sync completed:");
    println!("  Providers synced: {}", report.providers_synced);
    println!("  MCP servers synced: {}", report.mcp_servers_synced);
    if !report.errors.is_empty() {
        println!("  Errors:");
        for err in &report.errors {
            println!("    - {err}");
        }
    }
    Ok(())
}
```

## 五、验证

完成后运行:
```bash
cargo check
cargo build
```
确保零错误零警告。
