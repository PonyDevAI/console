# Console 后端修复 — 4 个问题

只改 src/ 下的 Rust 文件，不改前端。

## 一、修复 install_skill handler（routes.rs）

当前 `install_skill` 读了两次 list 且没有持久化。改为：

```rust
async fn install_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::skill::install_by_id(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let skills = services::skill::list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let skill = skills.into_iter().find(|s| s.id == id).ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(serde_json::to_value(skill).unwrap()))
}
```

在 src/services/skill.rs 中新增 `install_by_id` 和 `uninstall_by_id` 函数：

```rust
/// Mark a skill as installed by ID and persist.
pub fn install_by_id(id: &str) -> Result<()> {
    let paths = ConsolePaths::default();
    let file = paths.skills_file();
    let mut skills: Vec<Skill> = if file.exists() {
        storage::read_json(&file)?
    } else {
        vec![]
    };
    if let Some(skill) = skills.iter_mut().find(|s| s.id == id) {
        skill.installed_at = Some(chrono::Utc::now());
    } else {
        anyhow::bail!("skill not found: {id}");
    }
    storage::write_json(&file, &skills)?;
    Ok(())
}

/// Mark a skill as uninstalled by ID and persist.
pub fn uninstall_by_id(id: &str) -> Result<()> {
    let paths = ConsolePaths::default();
    let file = paths.skills_file();
    let mut skills: Vec<Skill> = if file.exists() {
        storage::read_json(&file)?
    } else {
        vec![]
    };
    if let Some(skill) = skills.iter_mut().find(|s| s.id == id) {
        skill.installed_at = None;
    } else {
        anyhow::bail!("skill not found: {id}");
    }
    storage::write_json(&file, &skills)?;
    Ok(())
}
```

同时更新 `uninstall_skill` handler 使用 `uninstall_by_id`：
```rust
async fn uninstall_skill(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    services::skill::uninstall_by_id(&id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "ok": true })))
}
```

确保 skill.rs 中有正确的 imports（ConsolePaths, storage, chrono 等）。

## 二、test_provider 加注释说明 api_key_ref 用法

在 `test_provider` handler 中加注释：
```rust
// NOTE: api_key_ref is currently used directly as the API key.
// TODO: Phase 2 — resolve key references (e.g. env var names, keychain refs)
```

这个暂时不改逻辑，只加 TODO 注释。

## 三、消除 compiler warnings

### 3a. 给未使用的公共函数加 #[allow(dead_code)]

在以下位置加 `#[allow(dead_code)]`：
- src/services/prompt.rs 的 `deactivate_all` 函数
- src/adapters/mod.rs 的 `config_file` trait 方法（不能加 allow，改为在 trait 上加 `#[allow(unused)]`，或者在某处调用它）
- src/storage/mod.rs 的 `workspaces_file` 方法
- src/sync/mod.rs 的 `skills_synced` 和 `prompts_synced` 字段

对于 trait 方法 `config_file`，最好的做法是在 sync 引擎中实际使用它（已经在用 `config_dir`，`config_file` 留着后续用），加 `#[allow(dead_code)]` 注释。

对于 SyncReport 的未使用字段，加 `#[allow(dead_code)]` 在 struct 上。

## 四、验证

完成后运行:
```bash
cargo check 2>&1 | grep -c warning
```
目标: 0 warnings（或尽可能少）。

然后运行:
```bash
cargo build
```
确保编译通过。
