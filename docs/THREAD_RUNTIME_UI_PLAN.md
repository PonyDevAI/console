# Thread Runtime UI Plan

本方案定义 Console 中“新线程 / 线程聊天工作区”的完整落地方式。

核心原则：

- **Agent Runtime 是底层公共执行内核**
- **Thread API 是面向 Web UI 的聊天产品包装层**
- **Web UI 新线程页是 Runtime 的第一个调用方**
- **后续远程调用 / OpenAI-compatible API 复用同一个 Runtime Core**
- **不复用现有系统任务队列作为 Runtime 队列**

---

## 1. 目标

实现一个接近 macOS Codex 的线程工作区：

- 顶部只显示当前线程标题
- 中间是消息流
- 底部是固定输入工作台
- 输入工作台承载运行参数与当前上下文
- 后端通过独立的 Agent Runtime 执行 codex / claude CLI

首期支持：

- 选择目录（workspace）
- 选择运行时模型（如 `codex/gpt-5.4`、`claude/sonnet-4.6`）
- 选择推理等级
- 选择权限模式
- 显示当前 git 分支
- 发送消息
- 流式返回
- 停止运行
- 可恢复线程历史

---

## 2. 架构边界

### 2.1 Agent Runtime

Agent Runtime 是执行平面的公共内核，负责：

- 路由到 codex / claude runtime adapter
- 启动本地 CLI 运行
- 管理 run 生命周期
- 管理流式事件
- 处理 cancel / timeout
- 屏蔽 CLI 差异

Agent Runtime **不关心页面结构**、**不关心线程标题**、**不关心聊天产品 UI 语义**。

### 2.2 Thread API

Thread API 是 Web UI 使用的业务包装层，负责：

- 线程 CRUD
- 消息持久化
- 将 thread 配置转换为 RuntimeRequest
- 将 RuntimeEvent 映射为 ThreadEvent
- 推送线程 SSE

Thread API **不直接调用 CLI**。

### 2.3 Web UI

Web UI 只负责：

- 呈现线程工作区
- 编辑消息
- 选择运行参数
- 监听流式输出

Web UI **不直接调用 runtime adapter**。

---

## 3. 总体结构

```text
Web UI Thread Chat
        |
        v
Thread API
        |
        v
Agent Runtime Core
        |
   +----+----+
   |         |
   v         v
Codex RT   Claude RT
Adapter    Adapter
   |         |
   v         v
codex CLI  claude CLI
```

未来扩展：

```text
OpenAI-Compatible API ---> Agent Runtime Core
Remote API -------------> Agent Runtime Core
```

---

## 4. 页面结构

页面采用三段式结构。

### 4.1 顶部栏

顶部只显示：

- 当前线程标题

可选增强：

- 双击编辑标题
- 标题为空时显示“新线程”

**顶部不放：**

- 模型选择
- 目录选择
- stop 按钮
- 权限模式
- Git 分支

这些都属于输入工作区上下文，应放到底部。

### 4.2 中间消息区

中间区域负责显示：

- 空状态欢迎区
- 历史消息
- assistant 流式消息
- 失败/取消状态提示

空状态时：

- 不显示顶部复杂控制栏
- 中间保持宽阔留白

有消息后：

- 上方变为完整消息流
- 输入区依旧固定在底部

### 4.3 底部固定输入工作台

底部是本方案的核心区域，采用 **两层结构**。

#### 第一层：输入主体卡片

从左到右：

1. 添加文件按钮
2. 多行输入框
3. 模型选择器
4. 推理等级选择器
5. 语音按钮（首期可占位）
6. 发送按钮
7. 运行中时显示停止按钮

#### 第二层：上下文状态栏

从左到右：

1. 目录 / workspace
2. 权限模式
3. Git 分支
4. 运行状态

---

## 5. 输入工作台的详细语义

### 5.1 添加文件

用途：

- 给当前消息附加文件
- 首期可只支持本地文件路径附件

表现：

- 左侧 `+` 按钮
- 选中文件后显示 attachment chip

### 5.2 输入框

要求：

- 多行自适应高度
- `Enter` 发送
- `Shift+Enter` 换行
- 运行中默认不可重复发送

### 5.3 模型选择器

选择的不是单纯 provider model，而是 **Runtime Profile**。

例如：

- `Codex · GPT-5.4`
- `Claude · Sonnet 4.6`

字段本质：

- adapter
- model

### 5.4 推理等级

建议首期支持：

- 低
- 中
- 高

或在底层映射为：

- low
- medium
- high

默认值建议：

- `medium`

### 5.5 语音按钮

首期可以只做 UI 占位，不接真实语音输入。

### 5.6 发送 / 停止

空闲状态：

- 显示发送按钮

运行中：

- 发送按钮替换为停止按钮

### 5.7 目录 / Workspace

左下角显示当前工作目录。

建议展示：

- 图标
- 当前 workspace 名称

例如：

- `本地 · console`
- 或直接 `console`

点击可切换 workspace。

### 5.8 权限模式

权限模式与 git 分支必须分开。

建议首期权限模式：

- 默认权限
- 只读
- 工作区写入
- 完全访问

内部枚举建议：

- `default`
- `read_only`
- `workspace_write`
- `full_access`

### 5.9 Git 分支

右下角显示当前 workspace 的 git branch。

例如：

- `main`
- `feature/runtime-ui`

它是 **工作区上下文展示**，不是权限。

### 5.10 运行状态

状态展示可简单处理：

- idle
- running
- cancelled
- failed

右下角可显示 spinner / 状态点。

---

## 6. 信息架构结论

最终页面结构如下：

```text
[顶部]
线程标题

[中间]
消息流 / 空状态

[底部固定工作台]
┌──────────────────────────────────────────────┐
│ [+] 输入内容……          [模型] [推理等级] [语音] [发送/停止] │
└──────────────────────────────────────────────┘
  [目录] [权限模式]                    [分支] [状态]
```

该结构比把模型/目录放在顶部更合理，因为这些信息是“本次输入的运行上下文”。

---

## 7. Runtime 设计

### 7.1 Runtime 独立，不复用系统 task queue

现有系统 `task_queue` 属于管理平面，服务于：

- CLI 安装
- 升级
- 卸载
- 配置同步
- 备份等系统任务

Runtime 需要独立的运行态管理结构，不应复用现有 task queue。

### 7.2 Runtime 自有对象

建议新增：

- `RuntimeRequest`
- `RuntimeRun`
- `RuntimeRunStatus`
- `RuntimeEvent`
- `RuntimeManager`
- `RuntimeAdapter`

### 7.3 Runtime 目录结构

```text
src/runtime/
  mod.rs
  models.rs
  errors.rs
  registry.rs
  gateway.rs
  manager.rs
  stream.rs
  adapters/
    mod.rs
    codex.rs
    claude.rs
```

---

## 8. Runtime 数据模型

### 8.1 RuntimeTarget

```rust
pub enum RuntimeTarget {
    Codex,
    Claude,
    Auto,
}
```

### 8.2 RuntimeRequest

```rust
pub struct RuntimeRequest {
    pub request_id: String,
    pub thread_id: Option<String>,
    pub target: RuntimeTarget,
    pub model: String,
    pub workspace: Option<String>,
    pub reasoning_effort: Option<String>,
    pub permission_mode: Option<String>,
    pub messages: Vec<RuntimeMessage>,
    pub attachments: Vec<RuntimeAttachment>,
    pub stream: bool,
    pub metadata: serde_json::Value,
}
```

### 8.3 RuntimeMessage

```rust
pub struct RuntimeMessage {
    pub role: RuntimeRole,
    pub content: String,
}
```

### 8.4 RuntimeAttachment

```rust
pub struct RuntimeAttachment {
    pub name: String,
    pub path: String,
}
```

### 8.5 RuntimeRun

```rust
pub struct RuntimeRun {
    pub id: String,
    pub thread_id: Option<String>,
    pub adapter: String,
    pub model: String,
    pub workspace: Option<String>,
    pub status: RuntimeRunStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}
```

### 8.6 RuntimeEvent

```rust
pub enum RuntimeEvent {
    RunStarted { run_id: String },
    TextDelta { run_id: String, text: String },
    Status { run_id: String, message: String },
    RunCompleted { run_id: String, output: String },
    RunFailed { run_id: String, error: String },
    RunCancelled { run_id: String },
}
```

---

## 9. Runtime Manager

Runtime Manager 负责：

- 创建 run
- 保存 active run
- 保存 run 状态
- 注册取消句柄
- 广播 runtime events
- 查询 run
- 清理旧 run

建议结构：

```rust
pub struct RuntimeManager {
    runs: RwLock<HashMap<String, RuntimeRun>>,
    run_channels: RwLock<HashMap<String, broadcast::Sender<RuntimeEvent>>>,
    thread_channels: RwLock<HashMap<String, broadcast::Sender<RuntimeEvent>>>,
    cancel_registry: RwLock<HashMap<String, oneshot::Sender<()>>>,
}
```

---

## 10. Runtime Adapter

每个 CLI 一个 runtime adapter。

### 10.1 CodexRuntimeAdapter

负责：

- 将 RuntimeRequest 转换为 codex CLI 调用
- 传 workspace
- 传 model
- 传 reasoning effort
- 传 permission mode
- 将 stdout/stderr 归一化为 RuntimeEvent

### 10.2 ClaudeRuntimeAdapter

职责与 CodexRuntimeAdapter 对称。

### 10.3 注意

`src/adapters/` 继续负责管理平面的安装/配置同步；
`src/runtime/adapters/` 只负责执行。

两者不能混合。

---

## 11. Thread 设计

Thread 是面向 Web UI 的产品对象，不等于 Runtime。

### 11.1 Thread 数据模型

```rust
pub struct Thread {
    pub id: String,
    pub title: String,
    pub workspace: String,
    pub runtime: ThreadRuntimeProfile,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### 11.2 ThreadRuntimeProfile

```rust
pub struct ThreadRuntimeProfile {
    pub adapter: String,
    pub model: String,
    pub reasoning_effort: String,
    pub permission_mode: String,
}
```

### 11.3 ThreadMessage

```rust
pub struct ThreadMessage {
    pub id: String,
    pub thread_id: String,
    pub role: String,
    pub content: String,
    pub status: Option<String>,
    pub attachments: Vec<ThreadAttachment>,
    pub created_at: DateTime<Utc>,
}
```

### 11.4 ThreadAttachment

```rust
pub struct ThreadAttachment {
    pub name: String,
    pub path: String,
}
```

### 11.5 ThreadRunRef

```rust
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
```

---

## 12. Thread 存储结构

建议新增：

```text
~/.console/
  threads/
    meta.json
    <thread_id>/
      thread.json
      messages.json
      runs.json
```

不要混入当前多人协作 session 目录。

原因：

- 当前 session 更偏协作/参与者语义
- thread chat 是单工作区、单运行时、单消息流语义

---

## 13. Thread Service

建议新增：

```text
src/services/thread.rs
```

职责：

- create_thread
- list_threads
- get_thread
- delete_thread
- list_messages
- append_user_message
- create_assistant_placeholder
- append_assistant_delta
- mark_assistant_done
- mark_assistant_error
- start_thread_run

其中 `start_thread_run` 的内部流程：

1. 读取 thread
2. 追加 user message
3. 创建 assistant 占位消息
4. 组装 RuntimeRequest
5. 调用 Runtime Gateway
6. 监听 RuntimeEvent
7. 更新消息内容并广播 ThreadEvent

---

## 14. Thread Event / SSE

建议 thread 自己有事件模型。

```rust
pub enum ThreadEvent {
    MessageCreated { ... },
    MessageDelta { ... },
    MessageDone { ... },
    MessageError { ... },
    RunStarted { ... },
    RunCompleted { ... },
    RunFailed { ... },
    RunCancelled { ... },
}
```

接口：

- `GET /api/threads/:id/stream`

不要复用 `/api/tasks/stream`。

---

## 15. API 设计

### 15.1 给 Web UI 的 Thread API

#### 创建线程

`POST /api/threads`

请求：

```json
{
  "title": "新线程",
  "workspace": "/Users/luoxiang/workspace/bull/console",
  "runtime": {
    "adapter": "codex",
    "model": "gpt-5.4",
    "reasoning_effort": "medium",
    "permission_mode": "default"
  }
}
```

#### 列出线程

`GET /api/threads`

#### 获取线程

`GET /api/threads/:id`

#### 获取消息

`GET /api/threads/:id/messages`

#### 发送消息

`POST /api/threads/:id/messages`

请求：

```json
{
  "content": "帮我分析这个页面怎么做",
  "attachments": [
    {
      "name": "image.png",
      "path": "/absolute/path/image.png"
    }
  ],
  "stream": true
}
```

响应：

```json
{
  "thread_id": "thread_xxx",
  "run_id": "run_xxx",
  "assistant_message_id": "msg_xxx"
}
```

#### 线程流

`GET /api/threads/:id/stream`

#### 取消运行

`POST /api/threads/:id/runs/:run_id/cancel`

#### 更新线程标题

`PATCH /api/threads/:id/title`

#### 更新运行配置（可选）

`PATCH /api/threads/:id/runtime`

---

## 16. 前端组件设计

建议新增或重构以下组件：

### 16.1 页面级

- `pages/NewThreadPage.tsx`
- `pages/ProjectThreadPage.tsx`

### 16.2 线程工作区组件

- `components/thread/ThreadHeader.tsx`
- `components/thread/ThreadMessageList.tsx`
- `components/thread/ThreadComposer.tsx`
- `components/thread/ThreadRuntimeBar.tsx`
- `components/thread/WorkspacePicker.tsx`
- `components/thread/RuntimeProfilePicker.tsx`
- `components/thread/ReasoningPicker.tsx`
- `components/thread/PermissionModePicker.tsx`
- `components/thread/AttachmentChips.tsx`

---

## 17. 前端状态模型

建议定义：

```ts
type RuntimeOption = {
  id: string;
  label: string;
  adapter: "codex" | "claude";
  model: string;
};
```

```ts
type ThreadRuntimeConfig = {
  adapter: "codex" | "claude";
  model: string;
  reasoningEffort: "low" | "medium" | "high";
  permissionMode: "default" | "read_only" | "workspace_write" | "full_access";
  workspacePath: string;
  gitBranch?: string | null;
};
```

页面 state：

- `threadId`
- `title`
- `messages`
- `workspace`
- `runtimeOption`
- `reasoningEffort`
- `permissionMode`
- `gitBranch`
- `attachments`
- `activeRunId`
- `isSubmitting`

---

## 18. 前端交互流程

### 18.1 首次发送

1. 用户选择目录
2. 用户选择模型
3. 用户选择推理等级
4. 用户选择权限模式
5. 若无 threadId，先创建 thread
6. 打开 thread SSE
7. 发送消息

### 18.2 后续发送

1. 直接调用 `POST /api/threads/:id/messages`
2. 通过 SSE 接收 delta

### 18.3 停止

1. 调用 `POST /api/threads/:id/runs/:run_id/cancel`

### 18.4 切换 workspace

建议首期限制：

- 新线程可自由切换目录
- 已有消息后切换目录需提示确认

原因：

- 目录变化会改变线程运行上下文

---

## 19. Runtime Profiles

首期建议先写死：

```ts
[
  {
    id: "codex-gpt54",
    label: "Codex · GPT-5.4",
    adapter: "codex",
    model: "gpt-5.4"
  },
  {
    id: "claude-sonnet46",
    label: "Claude · Sonnet 4.6",
    adapter: "claude",
    model: "sonnet-4.6"
  }
]
```

后续再改成后端返回：

- `GET /api/runtime/profiles`

---

## 20. Git 分支处理

目录选定后：

- 前端或后端检测当前 git branch
- UI 只做展示

首期建议：

- 后端提供一个简单 workspace inspect 能力
- 返回：
  - `path`
  - `display_name`
  - `git_branch`

分支是上下文显示，不是权限配置。

---

## 21. 权限模式映射

UI 层：

- 默认权限
- 只读
- 工作区写入
- 完全访问

Runtime 层：

- 需要映射到 codex / claude 各自支持的执行模式

MVP 阶段可先：

- 先存储枚举值
- adapter 内做 best-effort 映射

如果某 adapter 暂不支持某权限模式：

- 回退到默认权限
- 并在日志中记录

---

## 22. 非目标

首期不做：

- 复杂多人协作线程
- proposal / employee dispatch 复用
- 完整 tool call 标准化
- 语音真实接入
- 完整 OpenAI-compatible API
- 分布式运行时

---

## 23. 实施顺序

### Phase 1：Runtime 内核

- 新建 runtime 模块
- 定义 RuntimeRequest / RuntimeRun / RuntimeEvent
- 建 RuntimeManager
- 建 Codex / Claude runtime adapter skeleton

### Phase 2：Thread 后端

- 新建 thread 存储结构
- 新建 thread service
- 新增 threads API
- 新增 thread stream
- 新增 cancel run API

### Phase 3：UI 接入

- 重构 NewThreadPage
- 新增底部固定输入工作台
- 接入 thread API
- 接入 SSE
- 接入 stop

### Phase 4：增强

- thread list
- workspace inspect
- runtime profile API
- ProjectThreadPage 对接真实线程

---

## 24. 最终结论

本方案的最终结构是：

- 顶部只保留线程标题
- 所有运行控制收敛到底部输入工作台
- Runtime 独立成执行平面核心
- Thread API 作为 Web UI 包装层
- 现有系统 task queue 不作为 Runtime 队列使用
- 后续远程 API 与 OpenAI-compatible API 复用同一个 Runtime Core

这是当前 Console 最稳妥、最符合现有架构原则的落地方式。
