# AI 员工管理

AI 员工是 Console 中的**工作身份层**，不等于 CLI 工具本身。

## 概念定义

### 员工类型

#### 本地员工 (local employee)

由 Console 自己维护 persona 的员工：
- `IDENTITY.md` - 身份定义
- `SOUL.md` - 工作风格和特点
- `SKILLS.md` - 技能列表
- `RULES.md` - 工作规则

绑定一个本地 CLI Agent Source。

#### 远程员工 (remote employee)

代理远端 Agent 服务的员工：
- 不在本地维护 persona 文件
- 配置远程服务地址（通过 Agent Source）
- 配置远程 agent 名称 / id
- 将任务投递给远端指定 agent

## 员工模型

```typescript
type Employee = {
  id: string;
  name: string;                    // 内部名称，如 "ada"
  display_name: string;            // 显示名称，如 "Ada"
  role: string;                   // 角色，如 "coder"
  employee_type: "local" | "remote";  // 员工类型
  source_id: string;              // 绑定的 Agent Source ID
  remote_agent_name?: string;      // 远程员工使用的远端 agent 名称
  model?: string;                  // 员工级模型覆盖
  avatar_color: string;            // 头像颜色
  dispatch_count: number;          // 派发次数
  dispatch_success_count: number;   // 成功次数
  last_dispatched_at?: string;    // 最后派发时间
  created_at: string;
  updated_at: string;
};
```

### Persona 文件

仅本地员工需要维护 persona 文件：

```text
~/.console/employees/<employee_id>/
  identity.md    # 身份定义
  soul.md        # 工作风格
  skills.md      # 技能列表
  rules.md       # 工作规则
  history.json   # 派发历史
```

### 派发顺序

本地员工 dispatch 时，system prompt 拼装顺序：

```
IDENTITY
SOUL
SKILLS
RULES
```

## 模型选择规则

### 统一规则

每个员工都可以指定模型。最终执行模型优先级：

```
employee.model > agent_source.default_model > runtime_builtin_default
```

### 产品行为

- 员工已显式选择模型 → 使用员工模型
- 员工未配置模型 → 使用绑定 Agent Source 的默认模型
- Agent Source 也没有默认模型 → 使用 CLI / runtime 内置默认值

## 存储结构

员工状态存储在 `~/.console/state/employees.json`。

员工目录在 `~/.console/employees/<employee_id>/`。

## API 接口

### 员工 CRUD

```
GET /api/employees
```
返回所有员工列表。

```
POST /api/employees
```
创建员工：
```json
{
  "name": "ada",
  "display_name": "Ada",
  "role": "coder",
  "employee_type": "local",
  "source_id": "claude",
  "model": "opus-4.1",
  "avatar_color": "#7c3aed"
}
```

```
GET /api/employees/:id
```
获取员工详情。

```
PUT /api/employees/:id
```
更新员工信息。

```
DELETE /api/employees/:id
```
删除员工。

### Persona 文件

```
GET /api/employees/:id/soul-files
```
获取员工的 soul/skills/rules 文件（兼容旧接口）。

```
PUT /api/employees/:id/soul-files
```
更新 persona 文件：
```json
{
  "soul": "偏稳健，强调清晰边界...",
  "skills": "Rust, React, CLI adapters...",
  "rules": "不要越过 management plane / execution plane 边界..."
}
```

### 派发与测试

```
POST /api/employees/:id/dispatch
```
派发任务到员工。

```
GET /api/employees/:id/history
```
获取派发历史记录。

## 前端页面

设置菜单 → AI 员工

### 列表字段

- **员工名**：头像 + 显示名称
- **类型**：本地 / 远程 badge
- **角色**：如 coder, architect
- **绑定 Source**：Agent Source ID
- **模型**：显式指定或"默认"
- **派发统计**：次数 + 成功率

### 详情面板

#### 本地员工
- 基本信息（类型、Source、模型）
- Persona 编辑器（SOUL / SKILLS / RULES）
- 历史记录

#### 远程员工
- 基本信息（类型、Source、远端 agent 名称、模型）
- 历史记录

### 创建员工

- 填写名称、显示名称、角色
- 选择员工类型（本地/远程）
- 选择绑定的 Agent Source
- 远程员工额外填写远端 agent 名称
- 可选指定模型覆盖
- 选择头像颜色
