# Desktop / Server Split Blueprint

## Goal

为 CloudCode 从“Rust backend + Web”演进到“独立 server + 独立 desktop”提供第一版可执行蓝图。

这份文档解决四件事：

1. server 和 desktop 的职责边界
2. Cargo workspace 的目标结构
3. `cloudcode-contracts` 的首批接口模块
4. 当前 `src/` 文件如何迁移到新目录

---

## 1. Core Decision

### 1.1 独立进程，复用底层 crate

桌面端 Rust 和服务端 Rust 应当是两个独立应用：

- `apps/server`：HTTP / SSE / WebSocket / CLI entrypoint
- `apps/desktop/src-tauri`：桌面窗口、系统桥接、Tauri commands

它们共享：

- `crates/cloudcode-core`
- `crates/cloudcode-contracts`
- `crates/cloudcode-adapters`
- `crates/cloudcode-storage`
- `crates/cloudcode-sync`
- `crates/cloudcode-runtime`

它们不共享：

- `main.rs`
- axum route 层
- Tauri command 层
- UI

### 1.2 Web 与 Desktop 的关系

当前阶段：

- `apps/web` 独立 UI
- `apps/desktop` 独立 UI
- 只共享协议、领域状态、命名和验证规则

后续如果稳定，再抽设计 token 或 UI 库。

---

## 2. Target Repo Layout

```text
CloudCode/
  apps/
    server/
      src/
        main.rs
        api/
        cli/
        transport/
    web/
      src/
      package.json
      tsconfig.json
      vite.config.ts
    desktop/
      src/
      package.json
      tsconfig.json
      vite.config.ts
      src-tauri/
        Cargo.toml
        src/
          main.rs
          commands/
          state/
          bridge/
  crates/
    cloudcode-core/
      src/
        lib.rs
        domain/
        usecases/
        errors.rs
    cloudcode-contracts/
      src/
        lib.rs
        common.rs
        agent_sources.rs
        providers.rs
        mcp.rs
        skills.rs
        prompts.rs
        employees.rs
        remote_agents.rs
        sessions.rs
        threads.rs
        terminal.rs
    cloudcode-adapters/
      src/
        lib.rs
        claude.rs
        codex.rs
        cursor.rs
        gemini.rs
        opencode.rs
        openclaw.rs
    cloudcode-storage/
      src/
        lib.rs
        paths.rs
        state/
        repositories/
    cloudcode-sync/
      src/
        lib.rs
        provider_sync.rs
        mcp_sync.rs
        skill_sync.rs
        prompt_sync.rs
    cloudcode-runtime/
      src/
        lib.rs
        gateway/
        terminal/
        threads/
        sessions/
  packages/
    web-sdk/
    desktop-sdk/
  docs/
  scripts/
  Cargo.toml
  pnpm-workspace.yaml
```

---

## 3. Cargo Workspace Draft

## 3.1 Root `Cargo.toml`

建议从单 crate 切成 workspace：

```toml
[workspace]
members = [
  "apps/server",
  "apps/desktop/src-tauri",
  "crates/cloudcode-core",
  "crates/cloudcode-contracts",
  "crates/cloudcode-adapters",
  "crates/cloudcode-storage",
  "crates/cloudcode-sync",
  "crates/cloudcode-runtime",
]
resolver = "2"

[workspace.package]
edition = "2021"
version = "0.1.0"
license = "MIT"

[workspace.dependencies]
anyhow = "1"
async-stream = "0.3"
async-trait = "0.1"
axum = { version = "0.7", features = ["multipart", "ws"] }
base64 = "0.22"
chrono = { version = "0.4", features = ["serde"] }
clap = { version = "4", features = ["derive"] }
dirs = "5"
futures = "0.3"
futures-util = "0.3"
http-body-util = "0.1"
hyper = "1"
portable-pty = "0.8"
rand = "0.8"
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls", "stream"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = { version = "0.21", features = ["connect", "handshake", "stream"] }
toml = "0.8"
tower-http = { version = "0.5", features = ["cors", "fs"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
url = "2"
uuid = { version = "1", features = ["v4"] }
zip = { version = "2", default-features = false, features = ["deflate"] }
```

## 3.2 `apps/server/Cargo.toml`

```toml
[package]
name = "cloudcode-server"
version.workspace = true
edition.workspace = true

[[bin]]
name = "cloudcode-server"
path = "src/main.rs"

[dependencies]
anyhow.workspace = true
axum.workspace = true
clap.workspace = true
tokio.workspace = true
tower-http.workspace = true
tracing.workspace = true
tracing-subscriber.workspace = true

cloudcode-core = { path = "../../crates/cloudcode-core" }
cloudcode-contracts = { path = "../../crates/cloudcode-contracts" }
cloudcode-adapters = { path = "../../crates/cloudcode-adapters" }
cloudcode-storage = { path = "../../crates/cloudcode-storage" }
cloudcode-sync = { path = "../../crates/cloudcode-sync" }
cloudcode-runtime = { path = "../../crates/cloudcode-runtime" }
```

## 3.3 `crates/cloudcode-contracts/Cargo.toml`

```toml
[package]
name = "cloudcode-contracts"
version.workspace = true
edition.workspace = true

[dependencies]
chrono.workspace = true
serde.workspace = true
serde_json.workspace = true
url.workspace = true
uuid.workspace = true
```

---

## 4. Contracts-First Split

## 4.1 Why contracts first

当前最大耦合点不是 adapter，也不是 runtime，而是：

- `src/models/mod.rs` 同时混着 domain / state / request DTO
- `src/api/routes.rs`、`src/api/threads.rs`、`src/api/terminal.rs` 在路由文件里就地定义 request struct

这会导致：

- server 改协议时，desktop 无法稳定复用
- desktop 如果直接接 core，也没有清晰 DTO 边界
- Web 和 desktop 很容易各自定义一套字段

因此第一步必须先抽 `cloudcode-contracts`。

## 4.2 `cloudcode-contracts` 初始模块

```rust
// crates/cloudcode-contracts/src/lib.rs
pub mod common;
pub mod agent_sources;
pub mod providers;
pub mod mcp;
pub mod skills;
pub mod prompts;
pub mod employees;
pub mod remote_agents;
pub mod sessions;
pub mod threads;
pub mod terminal;
```

### `common.rs`

放共享枚举和基础结构：

- `SwitchMode`
- `AgentStatus`
- `EmployeeStatus`
- `RemoteAgentStatus`
- `ProposalStatus`
- 统一错误响应结构

### `agent_sources.rs`

首批定义：

- `AgentSourceDto`
- `AgentSourcesResponse`
- `CreateAgentSourceRequest`
- `UpdateAgentSourceRequest`
- `AgentSourceModelsResponse`
- `SetDefaultModelRequest`

当前来源：

- `src/models/mod.rs` 中 `AgentSource`
- `src/api/routes.rs` 中 `CreateSourceRequest`
- `src/api/routes.rs` 中 `UpdateSourceRequest`

### `providers.rs`

首批定义：

- `ProviderDto`
- `ProvidersResponse`
- `CreateProviderRequest`
- `UpdateProviderRequest`
- `ImportProvidersRequest`
- `SetSwitchModeRequest`
- `SetModelAssignmentRequest`

当前来源：

- `src/models/mod.rs` 中 `Provider`
- `src/models/mod.rs` 中 `CreateProviderRequest`
- `src/api/routes.rs` 中 `ImportProvidersRequest`
- `src/api/routes.rs` 中 `SetSwitchModeRequest`
- `src/api/routes.rs` 中 `SetModelAssignmentRequest`

### `mcp.rs`

首批定义：

- `McpServerDto`
- `McpServersResponse`
- `CreateMcpServerRequest`
- `UpdateMcpServerRequest`

当前来源：

- `src/models/mod.rs` 中 `McpServer`
- `src/models/mod.rs` 中 `CreateMcpServerRequest`

### `skills.rs`

首批定义：

- `SkillDto`
- `SkillsResponse`
- `SkillRepoDto`
- `AddSkillRepoRequest`
- `ToggleSkillRepoRequest`
- `UpdateSkillRequest`
- `InstallFromUrlRequest`

当前来源：

- `src/models/mod.rs` 中 `Skill`
- `src/models/mod.rs` 中 `SkillRepo`
- `src/api/routes.rs` 中 `AddSkillRepoRequest`
- `src/api/routes.rs` 中 `ToggleSkillRepoRequest`
- `src/api/routes.rs` 中 `UpdateSkillRequest`
- `src/api/routes.rs` 中 `InstallFromUrlRequest`

### `remote_agents.rs`

首批定义：

- `RemoteAgentDto`
- `RemoteAgentsResponse`
- `CreateRemoteAgentRequest`
- `UpdateRemoteAgentRequest`

当前来源：

- `src/models/mod.rs` 中 remote agent 相关定义

### `employees.rs`

首批定义：

- `EmployeeDto`
- `EmployeesResponse`
- `PersonaFilesDto`
- `SoulFilesDto`
- `CreateEmployeeRequest`
- `UpdateEmployeeRequest`
- `UpdateBindingRequest`

当前来源：

- `src/models/mod.rs` 中 employee 相关定义

### `sessions.rs`

首批定义：

- `SessionDto`
- `SessionMessageDto`
- `CreateSessionRequest`
- `PostMessageRequest`
- `UpdateSessionTitleRequest`
- `UpdateParticipantsRequest`
- `CreateProposalRequest`

当前来源：

- `src/models/mod.rs` 中 session / proposal request

### `threads.rs`

首批定义：

- `CreateThreadRequest`
- `ThreadRuntimeConfig`
- `SendMessageRequest`
- `UpdateThreadTitleRequest`
- `SendMessageResponse`
- `WorkspaceInspectResult`

当前来源：

- `src/api/threads.rs`

### `terminal.rs`

首批定义：

- `CreateTerminalSessionRequest`
- `TerminalSessionMetaDto`
- `BackendsResponse`
- `TerminalWsQuery`

当前来源：

- `src/services/terminal/*`
- `src/api/terminal.rs`

---

## 5. Current File Migration Map

## 5.1 Entry Layer

### Move to `apps/server`

- `src/main.rs`
- `src/api/mod.rs`
- `src/api/routes.rs`
- `src/api/sse.rs`
- `src/api/threads.rs`
- `src/api/terminal.rs`
- `src/cli/*`

### Keep server-only responsibilities

- axum route registration
- HTTP extraction / response handling
- SSE / WebSocket transport
- CLI startup commands

Server layer should stop owning:

- business DTO definitions
- domain entity definitions
- file storage logic
- adapter execution details

## 5.2 Contracts Layer

### Move first

From `src/models/mod.rs`:

- `CreateProviderRequest`
- `CreateMcpServerRequest`
- `CreateRemoteAgentRequest`
- `UpdateRemoteAgentRequest`
- `CreateEmployeeRequest`
- `UpdateEmployeeRequest`
- `UpdateBindingRequest`
- `CreateSessionRequest`
- `PostMessageRequest`
- `UpdateSessionTitleRequest`
- `CreateProposalRequest`
- `UpdateParticipantsRequest`
- shared enums such as `SwitchMode`, `ProposalStatus`, `RemoteAgentStatus`

From route files:

- `CreateSourceRequest`
- `UpdateSourceRequest`
- `UpdateSkillRequest`
- `SetSwitchModeRequest`
- `ImportProvidersRequest`
- `AddSkillRepoRequest`
- `ToggleSkillRepoRequest`
- `SetModelAssignmentRequest`
- `InstallFromUrlRequest`
- `CreateThreadRequest`
- `ThreadRuntimeConfig`
- `SendMessageRequest`
- `UpdateTitleRequest`
- `TerminalWsQuery`

## 5.3 Core Layer

### Move to `crates/cloudcode-core`

From `src/services/`:

- `provider.rs`
- `mcp.rs`
- `prompt.rs`
- `settings.rs`
- `backup.rs`
- `employee.rs`
- `remote_agent.rs`
- `agent_source.rs` 的业务规则部分
- `version.rs` 的非 CLI 依赖逻辑

### Core should own

- usecases
- domain validation
- orchestration between repositories/adapters
- stable business rules

## 5.4 Adapters Layer

### Move to `crates/cloudcode-adapters`

- `src/adapters/*`

### Likely split further

- `config_adapters/`
- `runtime_adapters/` if later needed

## 5.5 Storage Layer

### Move to `crates/cloudcode-storage`

- `src/storage/mod.rs`
- `src/services/session.rs`
- `src/services/proposal.rs`
- `src/services/logs.rs`
- `src/services/model_assignment.rs`
- any `*State` file persistence logic

Storage should own:

- `CloudCodePaths`
- JSON/TOML file repositories
- backup snapshot reads/writes
- persistent local state containers

## 5.6 Sync Layer

### Move to `crates/cloudcode-sync`

- `src/sync/mod.rs`
- `src/services/skill_sync.rs`

Later include:

- provider sync
- MCP sync
- prompt sync

## 5.7 Runtime Layer

### Move to `crates/cloudcode-runtime`

- `src/runtime/*`
- `src/services/thread.rs`
- `src/services/terminal/*`
- `src/services/session_stream.rs`
- `src/services/task_queue.rs`
- parts of `src/services/employee_dispatch.rs`

Runtime should own:

- thread lifecycle
- run lifecycle
- streaming bridge
- terminal session orchestration
- runtime adapter registry

---

## 6. `models/mod.rs` Split Table

| Current item | New home | Reason |
|---|---|---|
| `CliTool`, `CliToolsState` | `cloudcode-contracts` + `cloudcode-storage` | DTO + persisted state split |
| `AgentSource`, `AgentSourcesState` | `cloudcode-core/domain` + `cloudcode-storage` | entity + stored collection |
| `Provider`, `ProvidersState` | `cloudcode-core/domain` + `cloudcode-storage` | entity + stored collection |
| `CreateProviderRequest` | `cloudcode-contracts/providers.rs` | API DTO |
| `ModelAssignment`, `ModelAssignmentsState` | `cloudcode-core/domain` + `cloudcode-storage` | business state |
| `McpServer`, `McpServersState` | `cloudcode-core/domain` + `cloudcode-storage` | entity + stored collection |
| `CreateMcpServerRequest` | `cloudcode-contracts/mcp.rs` | API DTO |
| `Skill`, `SkillsState` | `cloudcode-core/domain` + `cloudcode-storage` | entity + stored collection |
| `SkillRepo`, `SkillReposState` | `cloudcode-core/domain` + `cloudcode-storage` | entity + stored collection |
| `SkillManifest`, `SkillRepoIndex` | `cloudcode-contracts/skills.rs` or `cloudcode-core/domain` | external repo contract |
| `PromptPreset`, `PromptsState` | `cloudcode-core/domain` + `cloudcode-storage` | entity + stored collection |
| `CloudCodeConfig`, `ServerConfig` | `cloudcode-storage` | local config model |
| `InstalledInfo` | `cloudcode-adapters` | adapter output |
| `AgentStatus`, `EmployeeStatus`, `RemoteAgentStatus`, `ProposalStatus` | `cloudcode-contracts/common.rs` | shared status vocabulary |
| `Agent`, `AgentsState` | `cloudcode-core/domain` + `cloudcode-storage` | domain + stored collection |
| `RemoteAgent`, `RemoteAgentsState` | `cloudcode-core/domain` + `cloudcode-storage` | domain + stored collection |
| `CreateRemoteAgentRequest`, `UpdateRemoteAgentRequest` | `cloudcode-contracts/remote_agents.rs` | API DTO |
| `Employee`, `EmployeesState` | `cloudcode-core/domain` + `cloudcode-storage` | domain + stored collection |
| `SoulFiles`, `PersonaFiles` | `cloudcode-contracts/employees.rs` | cross-surface DTO |
| `AgentBinding`, `AgentProtocol` | `cloudcode-core/domain` | employee execution model |
| `CreateEmployeeRequest`, `UpdateEmployeeRequest`, `UpdateBindingRequest` | `cloudcode-contracts/employees.rs` | API DTO |
| `DispatchRecord`, `DispatchHistory` | `cloudcode-runtime` + `cloudcode-storage` | runtime output/history |
| `BackupMeta`, `BackupSnapshot` | `cloudcode-storage` | persistence concern |
| `SessionMessage`, `SessionParticipant`, `Session`, `SessionMeta` | `cloudcode-core/domain` + `cloudcode-storage` | chat/session domain |
| `CreateSessionRequest`, `PostMessageRequest`, `UpdateSessionTitleRequest` | `cloudcode-contracts/sessions.rs` | API DTO |
| `TaskProposal`, `ProposalsState` | `cloudcode-core/domain` + `cloudcode-storage` | domain + stored collection |
| `CreateProposalRequest`, `UpdateParticipantsRequest` | `cloudcode-contracts/sessions.rs` | API DTO |

---

## 7. Desktop First Build Order

## Phase 1: Stop protocol drift

1. create `cloudcode-contracts`
2. move request/response structs out of route files
3. stop adding new DTOs to `src/api/*.rs`

## Phase 2: Make server thin

1. move axum-only code into `apps/server`
2. move business logic into `cloudcode-core`
3. move file persistence into `cloudcode-storage`

## Phase 3: Prepare desktop shell

1. scaffold `apps/desktop`
2. scaffold `apps/desktop/src-tauri`
3. expose first Tauri commands by directly calling `core + storage + adapters`

Suggested first commands:

- `list_agent_sources`
- `scan_agent_sources`
- `list_providers`
- `list_mcp_servers`
- `sync_all_config`
- `list_terminal_backends`

## Phase 4: Leave web and desktop UI separate

- `apps/web` keeps using HTTP client
- `apps/desktop` uses Tauri commands
- both depend on the same contract vocabulary

---

## 8. Immediate Rules For New Code

Until the repo is fully migrated, new code should follow these rules:

1. Do not add new request structs inside `src/api/routes.rs`.
2. Do not add new request structs inside `src/api/threads.rs` or `src/api/terminal.rs`.
3. Add new shared enums and DTOs to the planned contracts surface first.
4. Do not put desktop-specific logic into the server route layer.
5. Do not make desktop depend on axum routes as a primary abstraction.

These rules keep the migration path intact while the old layout still exists.
