# OpenClaw 接入修正任务（主路径打通）

目标：修正当前 OpenClaw 接入实现中的主路径偏差，把它从“骨架已接入”收敛为“真正可用的 OpenClaw Source 接入”。

本轮只修 blocker，不扩功能。

---

# 当前 blocker 结论

当前实现存在 4 个必须修复的问题：

1. `openclaw::test_source()` 错误地走了 HTTP `/health`，没有走 WS challenge/connect
2. `POST /api/agent-sources/:id/test` 仍走旧 `agent_source::test_source()` 主路径，没有真正接入 OpenClaw test 结果
3. `agent_source::list_agent_sources()` 仍然主要基于旧 `remote_agent` 数据模型，没有把 OpenClaw 作为真正的 Source 主模型
4. 前端 Agent 管理页仍然沿用旧 `remoteAgents` CRUD，不是“OpenClaw 作为 Source”的管理方式

本轮目标就是把这 4 个问题修掉。

---

# Milestone 1：修正 `openclaw::test_source()`

## 问题
当前 `src/services/openclaw.rs` 中的 `test_source()` 走的是：
- HTTP `GET {endpoint}/health`

这不符合已验证的 OpenClaw 接入方式。真正有效的数据面是：
- WS connect
- `connect.challenge`
- `connect`
- `health`

并且：
- `version`
- `default_agent_id`
要从 connect hello payload 中拿，而不是 HTTP health。

## 修改要求
彻底重写 `test_source()`，必须走：
1. `connect_and_handshake()`
2. 获取 hello payload
3. 发送 `health`
4. 返回：
   - `ok`
   - `version`
   - `default_agent_id`
   - `latency_ms`
   - `error`

## 具体要求
### version 读取优先级
- `hello.server.version`

### default_agent_id 读取优先级
- `hello.snapshot.defaultAgentId`
- 若没有，再试：`hello.sessionDefaults.defaultAgentId`

### health 结果
- 只要 WS connect + RPC health 成功，即视为 test ok
- 不要再使用 HTTP `/health` 作为 OpenClaw source test 主逻辑

## 修改文件
- `src/services/openclaw.rs`

## 验收
针对已验证实例：
- `test_source()` 返回 `ok=true`
- `version=2026.3.3`
- `default_agent_id=main`

---

# Milestone 2：修正 `/api/agent-sources/:id/test` 主路径

## 问题
当前 `src/api/routes.rs` 里 `test_agent_source()` 仍然只是：
- 调 `services::agent_source::test_source(&id)`
- 返回 `{ source_id, healthy }`

这没有真正把 OpenClaw 的详细结果暴露给前端。

## 修改要求
在 `test_agent_source()` 中显式读取 source，并按 `source_type` 分流：

### 对 `RemoteOpenClawWs`
调用：
- `services::openclaw::test_source(&source).await`

返回：
```json
{
  "ok": true,
  "type": "remote_openclaw_ws",
  "version": "2026.3.3",
  "default_agent_id": "main",
  "latency_ms": 123,
  "error": null
}
```

### 对其它 source
保留原有测试逻辑即可。

## 注意
不要让 OpenClaw test 再走旧 `agent_source::test_source(id)` 那条简化布尔路径。

## 修改文件
- `src/api/routes.rs`
- 如有需要：`src/services/agent_source.rs`

## 验收
前端点击测试 OpenClaw source 时，能拿到：
- version
- default_agent_id
- latency_ms

---

# Milestone 3：把 OpenClaw 真正纳入 Source 主模型

## 问题
当前 `src/services/agent_source.rs` 仍然主要是：
- 本地 CLI sources
- 旧 `remote_agent` 数据映射成 `AgentSourceType::RemoteAgent`

这意味着：
- OpenClaw 仍然是旧 RemoteAgent 体系的一层壳
- 不是新的 `RemoteOpenClawWs` source 主路径

## 修改目标
OpenClaw 应该作为真正的 `AgentSource` 被管理，而不是通过旧 `remote_agent` 间接映射。

## 推荐方案
### 方案要求
对 OpenClaw source 配置采用统一 `AgentSource` 存储。
也就是说：
- OpenClaw 配置属于 `agent_sources.json`
- 不再依赖旧 `remote_agent` 的主存储模型来承载 OpenClaw source

### 本轮最低改法
如果你不想大拆：
- 可以暂时保留旧 remote_agent 结构供兼容读取
- 但新建/编辑 OpenClaw 时，主写入必须进入 `AgentSource`
- `list_agent_sources()` 必须能稳定返回 `RemoteOpenClawWs` source

### 目标行为
`list_agent_sources()` 返回的 OpenClaw source 应该具备：
- `source_type = RemoteOpenClawWs`
- `endpoint`
- `api_key`
- `origin`
- `healthy`

而不是继续伪装成 `RemoteAgent`

## 修改文件
- `src/services/agent_source.rs`
- 如有需要：`src/models/mod.rs`
- 如有需要：与旧 remote_agent 兼容的迁移逻辑文件

## 验收
- Agent 管理页中的 OpenClaw 配置来自 `AgentSource`
- `list_agent_sources()` 可稳定列出 OpenClaw source
- 新增 OpenClaw source 后无需依赖旧 remote_agent 存储

---

# Milestone 4：前端 Agent 管理页从旧 RemoteAgent CRUD 切到 OpenClaw Source 模型

## 问题
当前前端：
- `useAgentSources.ts`
- `SettingsPage.tsx`

仍大量依赖旧接口：
- `getRemoteAgents`
- `addRemoteAgent`
- `updateRemoteAgent`
- `deleteRemoteAgent`
- `pingRemoteAgent`

这说明 UI 仍然在把 OpenClaw 当成“旧 RemoteAgent”，而不是“Source”。

## 修改目标
前端 Agent 管理页改成：
- 本地 CLI sources
- OpenClaw sources

也就是：
> OpenClaw 是一种 source 配置，不是一类单独的 remote agent CRUD 资源

## 修改要求
### 4.1 `useAgentSources.ts`
移除 OpenClaw 主流程对这些旧接口的依赖：
- `getRemoteAgents`
- `addRemoteAgent`
- `updateRemoteAgent`
- `deleteRemoteAgent`
- `pingRemoteAgent`
- `pingAllRemoteAgents`

改为：
- 统一通过 `getAgentSources()` 获取 source 列表
- 新增/更新 OpenClaw source 也走 source CRUD（若当前尚无 source CRUD，需要补）
- 测试走 `/agent-sources/:id/test`

### 4.2 `SettingsPage.tsx`
Agent 管理页中的 OpenClaw tab/section 不再展示旧 `remoteAgents` 资源，而是展示：
- `sources.filter(s => s.source_type === 'remote_openclaw_ws')`

### 4.3 “添加 OpenClaw” 的语义
应该变成：
- 添加 OpenClaw Source

表单字段：
- name
- display_name
- endpoint
- token（存入 api_key）
- origin

## 本轮允许的简化
如果目前还没有完整 source CRUD：
- 可以先补最小 CRUD，只覆盖 OpenClaw source
- 但不能继续把 OpenClaw 主路径建立在旧 remote_agent CRUD 上

## 修改文件
- `dashboard/src/hooks/useAgentSources.ts`
- `dashboard/src/pages/SettingsPage.tsx`
- `dashboard/src/api.ts`
- 如需要：后端 source CRUD 路由

## 验收
- OpenClaw 在 UI 中作为一种 Source 展示
- 添加/编辑/删除 OpenClaw 走 Source 语义
- 不再依赖旧 remoteAgents 主列表

---

# Milestone 5：统一 API 命名

## 问题
当前你新增的是：
- `/api/agent-sources/:id/openclaw-models`

而 task 定义的是：
- `/api/agent-sources/:id/models`

## 修改要求
统一为：
- `GET /api/agent-sources/:id/models`

对于 OpenClaw source：
- 返回 OpenClaw model 列表

对于本地 source：
- 仍可返回原本 CLI model config 信息
- 或保持当前已有 `/agent-sources/:id/models` 语义

### 重点
不要再保留 `openclaw-models` 这种分叉命名，避免把 OpenClaw 做成旁路 API。

## 修改文件
- `src/api/routes.rs`
- `dashboard/src/api.ts`
- 所有前端调用点

## 验收
前端拉 OpenClaw models 使用统一接口：
- `/api/agent-sources/:id/models`

---

# Milestone 6：保持员工管理绑定链路不变，但切到 Source 主路径

## 目标
员工绑定仍然是：
- `employee.agent_id`

但对于 OpenClaw：
- agent 列表来自 `GET /api/agent-sources/:id/agents`
- source 本身来自 `AgentSource`

### 本轮要求
员工管理页里选择 OpenClaw source 后：
- 能拿到 `main`
- 保存为 `<source_id>/main`

不需要本轮去做更多执行链路。

## 修改文件
- `dashboard/src/pages/SettingsPage.tsx`
- `dashboard/src/api.ts`

---

# 手工验证

## 场景 1：OpenClaw source test
1. 在 Agent 管理中新增一个 OpenClaw source
2. 填写：
   - endpoint = `http://100.69.109.88:11744`
   - token = 已提供 token
   - origin = `http://100.69.109.88:11744`
3. 点击测试

预期：
- 返回 ok=true
- version=`2026.3.3`
- default_agent_id=`main`
- latency_ms 有值

---

## 场景 2：OpenClaw source 列表
1. 刷新 Agent 管理页

预期：
- OpenClaw source 出现在 source 列表中
- 类型是 OpenClaw source，而不是旧 remote agent

---

## 场景 3：拉 OpenClaw agents
1. 调 `GET /api/agent-sources/:id/agents`

预期：
- 返回 `main`
- 映射为 `<source_id>/main`

---

## 场景 4：员工绑定 OpenClaw
1. 员工管理 -> 新建员工
2. 选 OpenClaw source
3. 下拉出现 `main`
4. 创建

预期：
- `employee.agent_id = <source_id>/main`

---

# 最终通过标准

本轮完成必须满足以下 4 条：

1. `openclaw::test_source()` 走 WS challenge/connect，而不是 HTTP health
2. `POST /api/agent-sources/:id/test` 对 OpenClaw 返回 version/default_agent_id/latency
3. OpenClaw 在系统中作为真正的 `AgentSource` 主模型存在
4. 前端 Agent 管理页不再用旧 remoteAgents CRUD 作为 OpenClaw 主路径

