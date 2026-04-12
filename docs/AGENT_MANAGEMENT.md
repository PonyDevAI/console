# Agent Management

Agent 管理是 CloudCode 对**本地 CLI 工具**的统一管理中心。

## 概念定义

### Agent Source

Agent Source 是执行能力的来源。本轮实现中，Agent Source 对应本地已安装的 CLI 工具。

```typescript
type AgentSource = {
  id: string;                    // 唯一标识，如 "claude", "codex"
  name: string;                  // 内部名称
  display_name: string;           // 显示名称
  source_type: "local_cli";      // 类型：本地 CLI
  managed_by_console: boolean;   // 是否由 Console 管理
  installed: boolean;             // 是否已安装
  local_version?: string;        // 本地版本
  remote_version?: string;        // 远程最新版本
  path?: string;                  // 安装路径
  supports_auto_install: boolean; // 支持自动安装
  supports_model_config: boolean; // 支持模型配置
  default_model?: string;        // 默认模型
  supported_models: string[];     // 支持的模型列表
  healthy: boolean;               // 健康状态
  last_checked_at?: string;      // 最后检测时间
};
```

## 支持的工具

本轮支持以下本地 CLI Agent Source：

| 工具 | 显示名称 | 支持自动安装 | 支持模型配置 |
|------|----------|--------------|--------------|
| Claude CLI | Claude | ✅ | ✅ |
| Codex CLI | Codex | ✅ | ✅ |
| Gemini CLI | Gemini | ✅ | ❌ |
| Cursor CLI | Cursor | ❌ | ❌ |
| OpenCode CLI | OpenCode | ✅ | ✅ |

## 存储结构

Agent Source 状态存储在 `~/.console/state/agent_sources.json`。

## 模型配置

### 模型选择规则

当员工使用某个 Agent Source 时，最终执行模型遵循以下优先级：

```
employee.model > agent_source.default_model > runtime_builtin_default
```

### 当前模型展示

Agent 管理页面展示每个工具的：
- **当前模型**：从工具原生配置文件读取
- **默认模型**：工具的默认模型
- **支持模型**：工具支持的所有模型列表

如果工具不支持模型配置或未设置模型，显示"不支持"或"未设置"。

## API 接口

### 查询接口

```
GET /api/agent-sources
```
返回所有 Agent Source 列表。

```
GET /api/agent-sources/:id
```
返回单个 Agent Source 详情。

```
GET /api/agent-sources/:id/models
```
返回模型的详细信息：
```json
{
  "source_id": "claude",
  "current_model": "sonnet-4.6",
  "default_model": "sonnet-4.6",
  "supported_models": ["sonnet-4.6", "opus-4.1"]
}
```

### 动作接口

| 操作 | 接口 | 说明 |
|------|------|------|
| 全量扫描 | `POST /api/agent-sources/scan` | 检测所有工具的安装状态 |
| 检查更新 | `POST /api/agent-sources/check-updates` | 检查所有工具的最新版本 |
| 单个扫描 | `POST /api/agent-sources/:id/scan` | 扫描单个工具 |
| 安装 | `POST /api/agent-sources/:id/install` | 安装工具 |
| 升级 | `POST /api/agent-sources/:id/upgrade` | 升级工具 |
| 卸载 | `POST /api/agent-sources/:id/uninstall` | 卸载工具 |
| 检查更新 | `POST /api/agent-sources/:id/check-update` | 检查单个工具最新版本 |
| 健康测试 | `POST /api/agent-sources/:id/test` | 测试工具可用性 |
| 设置默认模型 | `PUT /api/agent-sources/:id/default-model` | 设置默认模型 |

## 前端页面

设置菜单 → Agent 管理

### 页面展示

- **工具名称**：如 Claude CLI
- **状态**：已安装 / 未安装 / 异常
- **版本**：当前版本 / 最新版本
- **路径**：安装路径（可复制）
- **当前模型**：已配置的模型或"未设置"
- **操作按钮**：安装 / 升级 / 卸载

### 页面动作

- **全量扫描**：检测所有已安装的工具
- **全量检测更新**：检查所有工具的远程版本
- **行级操作**：针对单个工具的安装/升级/卸载
