# Agent Runtime Gateway

CloudCode 增加一条新的执行平面能力：**Agent Runtime Gateway**。

它的目标不是直接暴露底层 CLI，而是：

- 对外提供 **OpenAI-compatible API**
- 对内统一接入不同本地 Agent CLI
- 将 Codex CLI、Claude CLI 这类执行器抽象为统一 runtime adapter

---

## 1. 背景

当前 CloudCode 已具备：

- CLI 版本管理
- Provider / Model 管理
- MCP Server 管理
- Skills 管理
- Prompt 管理
- Config Sync Engine

这些能力主要属于 **management plane**。

如果要支持“给其他 agent 或系统提供标准接口，然后内部实际调用 codex cli / claude cli”，就需要新增 **execution plane** 中的统一运行时层。

---

## 2. 目标

Agent Runtime Gateway 的核心目标：

1. 提供统一北向协议
   - 暴露 OpenAI-compatible API
   - 隐藏底层 CLI 差异

2. 提供统一南向执行抽象
   - 每个 CLI 通过 runtime adapter 接入
   - 核心逻辑不依赖具体 CLI

3. 支持 agent 类运行时特性
   - session
   - workspace
   - streaming
   - task lifecycle
   - timeout / cancel

4. 保持 CloudCode 现有架构原则
   - 管理平面 / 执行平面分离
   - 模块小且职责明确
   - 本地优先

---

## 3. 非目标

当前阶段不做：

- 分布式调度
- 多节点执行
- 队列优先的大规模编排
- 完整复刻 OpenAI 全部语义
- 精确 token 计费
- 复杂多 agent orchestration

---

## 4. 架构定位

新增 Agent Runtime 后，整体架构如下：

```text
Client / Other Agent
        |
        v
OpenAI-Compatible API
        |
        v
+---------------------------+
|   Agent Runtime Gateway   |
|---------------------------|
| Routing / Sessions        |
| Stream Normalization      |
| Task Lifecycle            |
+-----------+---------------+
            |
   +--------+--------+
   |                 |
   v                 v
Codex Runtime    Claude Runtime
Adapter          Adapter
   |                 |
   v                 v
codex CLI        claude CLI
```

这条链路属于 **execution plane**，应与现有 config sync、provider sync 等管理能力保持边界清晰。

---

## 5. 分层设计

### 5.1 Northbound API Layer

职责：

- 提供 OpenAI-compatible HTTP API
- 参数校验
- SSE 输出
- 将外部请求转换为统一 runtime request

首批建议支持：

- `GET /v1/models`
- `POST /v1/chat/completions`

后续可扩展：

- `POST /v1/responses`

### 5.2 Runtime Core Layer

职责：

- 定义统一运行时模型
- 路由到合适的 adapter
- 管理 session
- 管理 run/task 生命周期
- 标准化流式事件
- 统一错误模型

这是核心层，不允许在这里写 CLI 私有拼接逻辑。

### 5.3 Runtime Adapter Layer

职责：

- 将统一请求翻译为具体 CLI 的调用方式
- 启动本地进程
- 消费 stdout/stderr
- 解析并输出统一事件
- 处理取消、异常、退出码

初始 adapter：

- `CodexRuntimeAdapter`
- `ClaudeRuntimeAdapter`

### 5.4 Session Layer

职责：

- 维护本地 session 元数据
- 将外部请求绑定到本地执行上下文
- 保存 workspace、adapter、时间戳等基础信息

### 5.5 Stream / Task Layer

职责：

- 推送 SSE
- 复用或扩展现有 task queue
- 跟踪状态：pending / running / completed / failed / cancelled / timed_out

---

## 6. 核心抽象

### 6.1 RuntimeAdapter Trait

建议新增 runtime trait，与现有 config adapter 分离。

```rust
trait RuntimeAdapter: Send + Sync {
    fn name(&self) -> &str;
    fn display_name(&self) -> &str;
    fn capabilities(&self) -> RuntimeCapabilities;

    async fn start_run(
        &self,
        request: AgentRequest,
        context: RunContext,
    ) -> anyhow::Result<RunHandle>;

    async fn cancel_run(&self, run_id: &str) -> anyhow::Result<()>;
}
```

### 6.2 RuntimeCapabilities

```rust
struct RuntimeCapabilities {
    supports_streaming: bool,
    supports_session: bool,
    supports_workspace: bool,
    supports_tools: bool,
    supports_images: bool,
    supports_json_mode: bool,
}
```

### 6.3 AgentRequest

```rust
struct AgentRequest {
    request_id: String,
    model: String,
    target: TargetAgent,
    messages: Vec<AgentMessage>,
    stream: bool,
    session_id: Option<String>,
    workspace: Option<PathBuf>,
    metadata: serde_json::Value,
}
```

### 6.4 AgentMessage

```rust
enum Role {
    System,
    User,
    Assistant,
    Tool,
}

struct AgentMessage {
    role: Role,
    content: String,
}
```

### 6.5 RunEvent

```rust
enum RunEvent {
    Started,
    Delta { text: String },
    Status { message: String },
    ToolCall { name: String, payload: serde_json::Value },
    ToolResult { name: String, payload: serde_json::Value },
    Completed { output_text: String },
    Failed { code: String, message: String },
}
```

说明：

- 内部事件可以 richer
- 对外统一映射到 OpenAI-compatible 响应
- 初期 `ToolCall` / `ToolResult` 可先不强映射为标准 tool_calls

---

## 7. 路由模型

### 7.1 TargetAgent

```rust
enum TargetAgent {
    Codex,
    Claude,
    Auto,
}
```

### 7.2 路由规则

建议顺序：

1. 用户显式指定优先
2. `model` alias 映射到目标 agent
3. `auto` 根据请求特征路由
   - 代码修改 / 执行导向任务 -> Codex
   - 长文本理解 / 审阅 / 总结 -> Claude
4. 若目标 agent 不可用，回退到可用 agent
5. 若 workspace / 能力不满足，则拒绝或重新路由

### 7.3 Model Alias

建议对外使用 runtime alias，而不是直接暴露底层模型细节：

- `auto`
- `codex-cli`
- `claude-cli`

后续可扩展：

- `codex-cli/high`
- `claude-cli/sonnet`

---

## 8. Session 设计

### 8.1 原则

外部协议尽量保持 OpenAI 风格；
内部实现允许 session 化。

### 8.2 Session 模型

```rust
struct Session {
    id: String,
    adapter: String,
    workspace: Option<PathBuf>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    metadata: serde_json::Value,
}
```

### 8.3 Session 绑定

建议通过 `metadata.session_id` 绑定本地 session。

如果没有 session：

- 自动新建
- 在响应中返回 session_id

### 8.4 MVP 策略

Phase 1：

- 先支持伪无状态请求
- session_id 可选

Phase 2：

- 加入本地 session 持久化
- 支持恢复上下文
- 增加 session 清理策略

---

## 9. OpenAI-Compatible API 设计

### 9.1 `GET /v1/models`

返回可用 runtime models：

```json
{
  "object": "list",
  "data": [
    { "id": "auto", "object": "model" },
    { "id": "codex-cli", "object": "model" },
    { "id": "claude-cli", "object": "model" }
  ]
}
```

### 9.2 `POST /v1/chat/completions`

建议首批支持字段：

- `model`
- `messages`
- `stream`
- `metadata`
- `user`

兼容但可忽略：

- `temperature`
- `top_p`
- `presence_penalty`
- `frequency_penalty`

暂不承诺：

- `logprobs`
- 精确 `usage`
- 严格 `tool_calls`
- 严格 `response_format`

### 9.3 Streaming

对外：

- 使用 SSE
- 尽量兼容 OpenAI chunk 风格
- 最后输出 `[DONE]`

对内：

- CLI 输出先转成 `RunEvent`
- 再由 `RunEvent` 编码为 SSE chunk

---

## 10. 错误模型

建议统一错误码：

```rust
enum RuntimeErrorCode {
    InvalidRequest,
    AdapterNotFound,
    AdapterUnavailable,
    WorkspaceDenied,
    SessionNotFound,
    Timeout,
    Cancelled,
    ProcessFailed,
    StreamBroken,
    InternalError,
}
```

原则：

- 对外返回稳定错误码
- 不泄露底层命令细节
- 服务端日志保留 stderr / exit code / adapter 信息

---

## 11. 任务生命周期

建议 runtime run 与现有 task queue 对齐，但增加 runtime 语义：

- `pending`
- `running`
- `completed`
- `failed`
- `cancelled`
- `timed_out`

每个 run 建议记录：

- `run_id`
- `session_id`
- `adapter`
- `request_id`
- `started_at`
- `completed_at`
- `exit_code`
- `final_status`

---

## 12. 安全与隔离

必须明确：

### 12.1 Workspace 限制

- 仅允许白名单目录
- 避免任意路径执行

### 12.2 CLI 可用性检查

- adapter 启动前检查 CLI 是否安装、是否可运行

### 12.3 超时控制

- 单个 run 应有默认超时

### 12.4 并发限制

- 每 adapter 最大并发数
- 全局最大并发数

### 12.5 输出限制

- 限制输出体积
- 限制空闲流式连接时长

---

## 13. 存储建议

在 `~/.console/` 下新增或复用：

```text
~/.console/
  sessions/
    meta.json
    <session_id>/
      messages.json
      proposals.json
  logs/
    runtime.log
```

当前阶段继续坚持文件存储，不引入数据库。

---

## 14. 目录结构建议

```text
src/
  api/
    openai.rs
  runtime/
    mod.rs
    models.rs
    gateway.rs
    registry.rs
    session.rs
    stream.rs
    errors.rs
    adapters/
      mod.rs
      codex.rs
      claude.rs
```

---

## 15. 与现有架构的边界

现有 `src/adapters/` 应继续负责：

- 安装 / 升级 / 卸载
- 配置读写
- provider / MCP / skills / prompt sync

新增 `src/runtime/adapters/` 负责：

- 请求执行
- 进程生命周期
- 流式输出
- 会话执行

两者不应混合。

这是本设计中的关键架构边界。

---

## 16. 分阶段实施建议

### Phase 1：Runtime MVP

目标：

- 建立 runtime core 抽象
- 建立 runtime adapter trait
- 接入 codex / claude 两个 runtime adapter
- 提供 `GET /v1/models`
- 提供 `POST /v1/chat/completions`
- 先支持非流式

### Phase 2：Streaming + Session

目标：

- SSE streaming
- `session_id`
- cancel / timeout
- workspace 绑定

### Phase 3：增强能力

目标：

- richer tool event
- 更好的 auto routing
- 更完整 observability
- usage estimation
- `/v1/responses` 兼容

---

## 17. 关键设计决策

### ADR-A：OpenAI-compatible，而非 fully identical

原因：

- 底层是 agent CLI，不是纯 inference API

### ADR-B：Runtime Adapter 与 Config Adapter 分离

原因：

- 管理平面与执行平面职责不同

### ADR-C：内部统一事件流

原因：

- 不同 CLI 输出格式差异大，必须先归一化

### ADR-D：优先支持 `chat/completions`

原因：

- 接入生态更广
- MVP 实现成本更低

---

## 18. 结论

CloudCode 的标准做法应是：

1. 对外提供 OpenAI-compatible Agent Gateway
2. 内部建立统一 Agent Runtime 抽象
3. Codex CLI / Claude CLI 通过 runtime adapter 接入
4. 明确区分 management plane 与 execution plane
5. 先做 `chat/completions`，再逐步扩 streaming、session、responses

这能最大化复用 CloudCode 现有架构，同时保持未来可扩展性。
