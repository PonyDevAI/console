# Task: Thread Runtime UI + Agent Runtime MVP

负责人：`@opencode`

目标：在 Console 中落地一套可执行的 **Thread Runtime UI + Agent Runtime MVP**，让新线程页具备接近 macOS Codex 的线程工作区体验，并通过独立的 Agent Runtime 调用本地 `codex` / `claude` CLI。

---

## 0. 必须先看

### 必读文档

- `/Users/luoxiang/workspace/bull/console/AGENTS.md`
- `/Users/luoxiang/workspace/bull/console/docs/AGENT_RUNTIME.md`
- `/Users/luoxiang/workspace/bull/console/docs/THREAD_RUNTIME_UI_PLAN.md`

### 必须遵守的架构边界

1. **Agent Runtime 独立于现有系统 task queue**
2. **现有 task queue 继续只服务管理平面系统任务**
3. **Thread API 是 Web UI 的包装层，不直接碰 CLI**
4. **Runtime Adapter 与现有 config adapter 分离**
5. **不要把 employee/proposal/session 体系硬复用到 thread chat MVP**

---

## 1. 本次要实现的最终效果

### 1.1 页面效果

新线程页 / 线程页必须改成以下结构：

#### 顶部

- 左侧仅显示当前线程标题
- 不放模型、目录、权限、分支、停止按钮

#### 中间

- 空状态欢迎区 / 聊天消息流

#### 底部固定输入工作台

输入主体卡片必须包含：

- 添加文件按钮
- 输入框
- 模型选择器
- 推理等级选择器
- 语音按钮（可占位）
- 发送按钮
- 运行中时显示停止按钮

输入卡片下方的上下文栏必须包含：

- 当前目录 / workspace
- 权限模式
- 当前 git 分支
- 运行状态

### 1.2 交互效果

- 首次发送前可选择目录、模型、推理等级、权限模式
- 首次发送时自动创建 thread
- 发送后调用后端 Thread API
- assistant 回复通过 SSE 流式更新
- 运行中可停止
- 重新打开线程时可恢复历史消息

---

## 2. 本次明确不要做错的点

1. **不要复用当前系统 `task_queue` 作为 Runtime 队列**
2. **不要把顶部做成控制条**
3. **不要把 git 分支和权限模式混成一个字段**
4. **不要让 Thread API 直接调用 CLI**
5. **不要把 `src/adapters/` 和 `src/runtime/adapters/` 混在一起**
6. **不要先做复杂多 agent / employee / proposal 复用**
7. **不要把页面继续停留在 mock 响应**

---

## 3. 后端任务

### 3.1 新建 Runtime 模块

创建目录：

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

要求：

- 定义 RuntimeRequest / RuntimeRun / RuntimeRunStatus / RuntimeEvent
- 定义 RuntimeTarget / RuntimeRole / RuntimeAttachment
- 定义 RuntimeAdapter trait
- 建立 RuntimeManager
- 建立 RuntimeGateway

### 3.2 RuntimeManager

要求：

- 管理 active runs
- 管理 run 状态
- 提供按 run / thread 的广播订阅
- 支持 cancel
- 支持清理结束 run

### 3.3 CodexRuntimeAdapter / ClaudeRuntimeAdapter

要求：

- 各自独立实现
- 可接收：
  - workspace
  - model
  - reasoning_effort
  - permission_mode
  - messages
  - attachments
- 先做 MVP：
  - 能真正启动 CLI
  - 能收集文本输出
  - 能转成 RuntimeEvent

说明：

- 首期允许 best-effort 输出解析
- 先打通“能跑、能流、能停”

### 3.4 新建 Thread Service

新增：

```text
src/services/thread.rs
```

要求：

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

### 3.5 新增 Thread 存储

使用文件存储，目录结构：

```text
~/.console/
  threads/
    meta.json
    <thread_id>/
      thread.json
      messages.json
      runs.json
```

需要扩展：

- `src/storage/mod.rs`

新增对应路径方法。

### 3.6 新增 Thread API

新增 Web UI 用接口：

- `POST /api/threads`
- `GET /api/threads`
- `GET /api/threads/:id`
- `DELETE /api/threads/:id`
- `GET /api/threads/:id/messages`
- `POST /api/threads/:id/messages`
- `GET /api/threads/:id/stream`
- `POST /api/threads/:id/runs/:run_id/cancel`
- `PATCH /api/threads/:id/title`

### 3.7 可选：Workspace Inspect API

建议新增：

- `POST /api/workspaces/inspect`

输入：

```json
{ "path": "/Users/luoxiang/workspace/bull/console" }
```

输出：

- path
- display_name
- git_branch
- is_git_repo

用于 UI 展示目录与分支。

---

## 4. 前端任务

### 4.1 页面重构

重点文件：

- `/Users/luoxiang/workspace/bull/console/dashboard/src/pages/NewThreadPage.tsx`
- `/Users/luoxiang/workspace/bull/console/dashboard/src/pages/ProjectThreadPage.tsx`

要求：

- 顶部只显示线程标题
- 底部固定输入工作台
- 输入工作台承载所有运行参数
- 中间消息区支持流式对话

### 4.2 组件拆分

建议新增：

```text
dashboard/src/components/thread/
  ThreadHeader.tsx
  ThreadMessageList.tsx
  ThreadComposer.tsx
  ThreadRuntimeBar.tsx
  WorkspacePicker.tsx
  RuntimeProfilePicker.tsx
  ReasoningPicker.tsx
  PermissionModePicker.tsx
  AttachmentChips.tsx
```

### 4.3 页面交互

要求：

- 首次发送前若没有 threadId，则先创建 thread
- 建立 SSE 连接
- 发送消息后出现 assistant 占位消息
- assistant 消息通过 delta 更新
- 运行中发送按钮变停止按钮

### 4.4 前端状态模型

至少要有：

- threadId
- title
- workspacePath
- runtimeOption
- reasoningEffort
- permissionMode
- gitBranch
- attachments
- activeRunId
- isSubmitting
- messages

### 4.5 Runtime Profiles

首期先写死：

- `Codex · GPT-5.4`
- `Claude · Sonnet 4.6`

后续再改 API 驱动。

### 4.6 输入工作台 UI 约束

必须做到：

- 顶部不再出现模型和目录
- 输入卡片固定在底部
- 卡片下方有上下文状态栏
- git branch 单独展示
- 权限模式单独展示
- 语音按钮可先占位

---

## 5. 数据模型要求

### 5.1 后端 Thread 模型

至少包含：

- Thread
- ThreadRuntimeProfile
- ThreadMessage
- ThreadAttachment
- ThreadRunRef

### 5.2 后端 Runtime 模型

至少包含：

- RuntimeRequest
- RuntimeMessage
- RuntimeAttachment
- RuntimeRun
- RuntimeRunStatus
- RuntimeEvent

### 5.3 前端类型

更新：

- `/Users/luoxiang/workspace/bull/console/dashboard/src/types.ts`

新增：

- Thread
- ThreadMessage
- ThreadRuntimeConfig
- RuntimeOption
- WorkspaceInspectResult

---

## 6. 流式与停止

### 6.1 流式

必须通过 SSE 实现：

- thread stream
- message delta
- message done
- run failed
- run cancelled

### 6.2 停止

必须支持：

- 前端点停止
- 后端找到对应 run
- RuntimeManager 调 cancel handle
- adapter 尽量终止子进程

---

## 7. 验收标准

### 7.1 后端

- 可以创建 thread
- 可以发送消息
- 可以真正触发 codex / claude runtime adapter
- 可以流式返回文本
- 可以停止 run
- thread 数据能持久化

### 7.2 前端

- 顶部只有标题
- 底部输入工作台布局正确
- 可选目录
- 可选模型
- 可选推理等级
- 可见权限模式
- 可见 git 分支
- 可发送
- 可流式显示
- 可停止

### 7.3 架构

- Runtime 独立于 task queue
- Runtime Adapter 与 config adapter 分离
- Thread API 不直接操作 CLI

---

## 8. 开发顺序

请按以下顺序执行，不要乱序：

### 第一阶段：后端 Runtime 内核

1. 建 `src/runtime/*`
2. 完成 Runtime 数据模型
3. 完成 RuntimeManager
4. 完成 RuntimeGateway
5. 完成 Codex / Claude adapter MVP

### 第二阶段：Thread 后端

6. 建 thread 存储路径
7. 建 `src/services/thread.rs`
8. 建 threads API
9. 建 thread SSE
10. 建 cancel API

### 第三阶段：前端线程工作区

11. 重构 `NewThreadPage.tsx`
12. 重构 `ProjectThreadPage.tsx`
13. 新增 thread 组件
14. 接入 threads API
15. 接入 SSE
16. 接入 stop

### 第四阶段：补充体验

17. workspace inspect / git branch 展示
18. attachment chips
19. 线程恢复与历史加载

---

## 9. 输出要求

完成后请提供：

1. 变更文件列表
2. 实现说明
3. 当前已实现范围
4. 未完成项 / 已知限制
5. 本地验证方式

不要只给 diff，不要只给泛泛总结。

---

## 10. 最终说明

本任务的目标不是“继续做 mock 聊天页”，而是：

> **把新线程页升级为一个真实的 Thread Runtime 工作区，底层由独立 Agent Runtime 驱动。**

这套结构后续还要服务：

- Project Thread Page
- Remote API
- OpenAI-compatible API

因此必须按文档分层实现，不要走捷径把逻辑揉在页面里。
