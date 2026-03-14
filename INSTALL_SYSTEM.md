# Console 安装/更新/卸载系统实现任务

## 背景

Console 是一个 Rust (axum) + Vite React 前端的本地 AI CLI 管理平台。当前只能通过 `cargo build` 源码编译运行。需要实现完整的安装/更新/卸载系统，让用户可以通过一行命令安装，并支持自更新和干净卸载。

## 目标

实现三个部分：
1. `install.sh` — 独立 bash 安装脚本（install / upgrade / uninstall）
2. Rust CLI 子命令 — `console upgrade` 和 `console uninstall`
3. API 端点 — `/api/system/version` 和 `/api/system/check-update`
4. GitHub Actions CI — 交叉编译 + 自动发布 Release

## 约定

- GitHub 仓库地址占位符：`OWNER/console`（脚本中用变量，方便替换）
- 二进制名：`console`
- 安装目录：`~/.console/bin/console`
- 前端静态文件：`~/.console/web/`（安装时从 tarball 解压）
- Release tarball 命名：`console-{version}-{os}-{arch}.tar.gz`
- 版本号从 `Cargo.toml` 的 `version` 字段读取，编译时通过 `env!("CARGO_PKG_VERSION")` 注入

---

## 第一部分：install.sh

在项目根目录创建 `install.sh`，要求：

### 用法

```
install.sh [install|upgrade|uninstall] [OPTIONS]
```

默认动作是 `install`（即 `curl ... | bash` 等同于 install）。

### install 子命令

1. 检测 OS（darwin/linux）和 ARCH（x86_64→amd64, aarch64/arm64→arm64）
2. 如果指定了 `--version VERSION`，使用该版本；否则调 GitHub API 获取最新 release tag
3. 拼接下载 URL：`https://github.com/OWNER/console/releases/download/{tag}/console-{tag}-{os}-{arch}.tar.gz`
4. 用 `curl` 下载到临时目录，用 `tar` 解压
5. 创建 `~/.console/bin/` 目录
6. 将 `console` 二进制移动到 `~/.console/bin/console`，`chmod +x`
7. 如果 tarball 中包含 `web/` 目录，将其移动到 `~/.console/web/`
8. 检测当前 shell（zsh/bash/fish），如果 `~/.console/bin` 不在 PATH 中，追加 `export PATH="$HOME/.console/bin:$PATH"` 到对应 rc 文件（`.zshrc` / `.bashrc` / `.config/fish/config.fish`）
9. 运行 `~/.console/bin/console init`（初始化配置目录）
10. 打印成功信息，提示用户 `source` rc 文件或重开终端

### upgrade 子命令

1. 检查 `~/.console/bin/console` 是否存在，不存在则提示先 install
2. 获取当前版本：`~/.console/bin/console --version`
3. 获取最新版本（同 install 逻辑）
4. 如果版本相同，打印 "already up to date" 并退出
5. 执行与 install 相同的下载+替换流程
6. 打印升级成功信息（旧版本 → 新版本）

### uninstall 子命令

1. 如果传了 `--purge`，删除整个 `~/.console/` 目录
2. 否则只删除 `~/.console/bin/` 和 `~/.console/web/`（保留配置和数据）
3. 从 shell rc 文件中移除 PATH 行
4. 打印卸载完成信息

### 脚本要求

- `set -euo pipefail`
- 所有输出带颜色前缀（`[console]`）
- 支持 `CONSOLE_INSTALL_DIR` 环境变量覆盖安装目录（默认 `~/.console`）
- 支持 `--yes` / `-y` 跳过确认提示
- 下载失败时给出清晰错误信息

---

## 第二部分：Rust CLI 子命令

### 2.1 在 Cargo.toml 添加编译时版本注入

在 `Cargo.toml` 的 `[package]` 下确认已有 `version = "0.1.0"`（已有）。

### 2.2 修改 src/main.rs

在 `#[derive(Parser)]` 的 `Cli` struct 上添加 `#[command(version)]`，这样 `console --version` 会输出版本号。

### 2.3 修改 src/cli/mod.rs

添加两个新子命令：

```rust
/// Self-upgrade Console to the latest version
Upgrade {
    /// Target version (default: latest)
    #[arg(long)]
    version: Option<String>,
    /// Only check, don't actually upgrade
    #[arg(long)]
    dry_run: bool,
},
/// Uninstall Console
Uninstall {
    /// Remove all data including config (default: keep config)
    #[arg(long)]
    purge: bool,
    /// Skip confirmation prompt
    #[arg(long, short)]
    yes: bool,
},
```

在 `execute()` 的 match 中添加对应分支，调用新模块。

### 2.4 创建 src/cli/upgrade.rs

实现 `pub async fn run(version: Option<String>, dry_run: bool) -> anyhow::Result<()>`：

1. 定义常量 `GITHUB_REPO = "OWNER/console"`
2. 获取当前版本：`env!("CARGO_PKG_VERSION")`
3. 用 reqwest 调 `https://api.github.com/repos/{REPO}/releases/latest`，解析出 `tag_name`
4. 比较版本，如果相同打印 "Already up to date (v{current})" 并返回
5. 如果 `dry_run`，打印 "Update available: v{current} → v{latest}" 并返回
6. 检测 OS 和 ARCH（`std::env::consts::OS`, `std::env::consts::ARCH`）
7. 映射：os=macos→darwin, linux→linux；arch=x86_64→amd64, aarch64→arm64
8. 拼接下载 URL，用 reqwest 下载 tarball 到临时文件
9. 解压 tarball（用 `std::process::Command` 调 `tar`）
10. 替换当前二进制：`std::env::current_exe()` 获取路径，先备份为 `.old`，再移动新文件过去
11. 如果 tarball 中有 `web/` 目录，替换 `~/.console/web/`
12. 打印 "Upgraded: v{old} → v{new}"

注意：reqwest 请求 GitHub API 时需要设置 `User-Agent` header。

### 2.5 创建 src/cli/uninstall.rs

实现 `pub async fn run(purge: bool, yes: bool) -> anyhow::Result<()>`：

1. 如果 `!yes`，打印确认提示，读取 stdin，非 "y"/"yes" 则退出
2. 获取二进制路径 `std::env::current_exe()`
3. 获取 `~/.console/` 路径
4. 如果 `purge`：删除整个 `~/.console/` 目录
5. 否则：只删除 `~/.console/bin/` 和 `~/.console/web/`
6. 提示用户手动从 shell rc 文件中移除 PATH 行（CLI 不应自动修改 rc 文件，避免误操作）
7. 打印卸载完成信息

---

## 第三部分：API 端点

### 3.1 修改 src/api/routes.rs

在 `api_routes()` 中添加：

```rust
.route("/system/version", get(system_version))
.route("/system/check-update", get(system_check_update))
```

### 3.2 实现 system_version handler

```rust
async fn system_version() -> Json<Value> {
    Json(json!({
        "version": env!("CARGO_PKG_VERSION"),
        "name": env!("CARGO_PKG_NAME"),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    }))
}
```

### 3.3 实现 system_check_update handler

```rust
async fn system_check_update() -> Result<Json<Value>, StatusCode> {
    let current = env!("CARGO_PKG_VERSION");
    // 调 GitHub API 获取最新版本（复用 upgrade.rs 中的逻辑）
    // 返回 { current, latest, update_available: bool }
}
```

为了复用逻辑，在 `src/services/` 下创建 `src/services/self_update.rs`：
- `pub fn current_version() -> &'static str` — 返回 `env!("CARGO_PKG_VERSION")`
- `pub async fn check_latest() -> anyhow::Result<String>` — 调 GitHub API 返回最新版本 tag
- `pub fn update_available(current: &str, latest: &str) -> bool` — 简单字符串比较（去掉 `v` 前缀后比较）

`src/cli/upgrade.rs` 和 `src/api/routes.rs` 都调用这个 service。

在 `src/services/mod.rs` 中添加 `pub mod self_update;`。

---

## 第四部分：GitHub Actions CI

### 4.1 创建 .github/workflows/release.yml

触发条件：push tag `v*`（如 `v0.1.0`）

Job 矩阵：

```yaml
strategy:
  matrix:
    include:
      - target: x86_64-unknown-linux-musl
        os: ubuntu-latest
        artifact_name: console-linux-amd64
      - target: aarch64-unknown-linux-musl
        os: ubuntu-latest
        artifact_name: console-linux-arm64
      - target: x86_64-apple-darwin
        os: macos-latest
        artifact_name: console-darwin-amd64
      - target: aarch64-apple-darwin
        os: macos-latest
        artifact_name: console-darwin-arm64
```

每个 job 的步骤：

1. `actions/checkout@v4`
2. 安装 Rust toolchain + 对应 target
3. Linux musl 交叉编译：安装 `musl-tools`，aarch64 用 `cross`
4. `cargo build --release --target ${{ matrix.target }}`
5. 安装 Node.js 20 + pnpm
6. `cd web && pnpm install && pnpm build`
7. 打包：创建临时目录，放入 `console` 二进制 + `web/dist/`，打成 `console-{tag}-{os}-{arch}.tar.gz`
8. 上传 artifact

最后一个 job `release`（depends on build）：
1. 下载所有 artifact
2. 用 `softprops/action-gh-release@v2` 创建 GitHub Release，附带所有 tarball

### 4.2 创建 .github/workflows/ci.yml

触发条件：push 到 main、PR 到 main

步骤：
1. `cargo check`
2. `cargo test`（如果有测试）
3. `cargo clippy -- -D warnings`
4. `cd web && pnpm install && pnpm exec tsc --noEmit`

---

## 第五部分：修改 Makefile

在现有 Makefile 中添加：

```makefile
install: build ## Install to ~/.console/bin/
	@mkdir -p ~/.console/bin ~/.console/web
	@cp target/release/console ~/.console/bin/console
	@cp -r web/dist/ ~/.console/web/
	@echo "Installed to ~/.console/bin/console"
	@echo "Add to PATH: export PATH=\"\$$HOME/.console/bin:\$$PATH\""

uninstall: ## Remove ~/.console/bin/ and ~/.console/web/
	@rm -rf ~/.console/bin ~/.console/web
	@echo "Uninstalled. Config preserved at ~/.console/"
```

---

## 第六部分：修改前端静态文件服务路径

当前 `src/api/mod.rs` 中 `ServeDir::new("web/dist")` 是相对路径，只在项目目录下运行才有效。安装后二进制在 `~/.console/bin/`，需要改为：

1. 优先使用 `~/.console/web/dist/`（安装模式）
2. 回退到 `./web/dist/`（开发模式）

修改 `src/api/mod.rs` 的 `serve()` 函数：

```rust
pub async fn serve(addr: &str) -> Result<()> {
    let paths = crate::storage::ConsolePaths::default();
    let web_dir = paths.root.join("web");

    // Prefer installed web dir, fallback to local dev dir
    let dist_dir = if web_dir.join("dist").exists() {
        web_dir.join("dist")
    } else {
        std::path::PathBuf::from("web/dist")
    };

    let spa_fallback = ServeFile::new(dist_dir.join("index.html"));
    let static_files = ServeDir::new(&dist_dir).fallback(spa_fallback);

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

---

## 实现顺序

1. `src/services/self_update.rs` — 版本检查服务
2. `src/cli/upgrade.rs` — upgrade 子命令
3. `src/cli/uninstall.rs` — uninstall 子命令
4. 修改 `src/cli/mod.rs` — 注册新子命令
5. 修改 `src/main.rs` — 添加 `#[command(version)]`
6. 修改 `src/services/mod.rs` — 注册 self_update 模块
7. 修改 `src/api/routes.rs` — 添加 system API
8. 修改 `src/api/mod.rs` — 智能 web 目录查找
9. 修改 `Makefile` — 添加 install/uninstall target
10. 创建 `install.sh` — 安装脚本
11. 创建 `.github/workflows/release.yml` — CI 发布
12. 创建 `.github/workflows/ci.yml` — CI 检查

## 编码规范

- 遵循项目现有风格：`anyhow::Result`、`tracing` 日志、`serde_json::json!` 宏
- 保持文件职责单一
- 不引入新的重量级依赖
- `install.sh` 使用 `set -euo pipefail`，兼容 bash 3.2+（macOS 默认）
- GitHub Actions 使用最新稳定版 action

## 验证

完成后运行：
1. `cargo check` — 编译通过
2. `cargo build --release` — release 构建成功
3. `./target/release/console --version` — 输出版本号
4. `bash install.sh install --help` — 脚本帮助信息正常
