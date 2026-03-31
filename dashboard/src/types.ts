// ── CLI Tool ──
export type CliTool = {
  name: string;
  display_name: string;
  installed: boolean;
  local_version: string | null;
  remote_version: string | null;
  path: string | null;
  last_checked: string | null;
  auto_install: boolean;
  supports_model_config: boolean;
  install_url: string | null;
};

// ── Provider ──
export type Provider = {
  id: string;
  name: string;
  api_endpoint: string;
  api_key_ref: string;
  active: boolean;
  apps: string[];
  models: string[];
  created_at: string;
  modified_at: string;
};

export type CreateProviderInput = {
  name: string;
  api_endpoint: string;
  api_key_ref: string;
  apps: string[];
  models: string[];
};

export type ModelAssignment = {
  app: string;
  provider_id: string;
  model: string;
  updated_at: string;
};

export type SwitchMode = "switch" | "additive";

// ── MCP Server ──
export type McpServer = {
  id: string;
  name: string;
  transport: "stdio" | "http" | "sse";
  command: string | null;
  args: string[];
  url: string | null;
  env: Record<string, string>;
  enabled_apps: string[];
};

export type CreateMcpServerInput = {
  name: string;
  transport: "stdio" | "http" | "sse";
  command?: string;
  args: string[];
  url?: string;
  env: Record<string, string>;
  enabled_apps: string[];
};

// ── Skill ──
export type Skill = {
  id: string;
  name: string;
  description: string;
  source: string;
  source_url: string | null;
  apps: string[];
  installed_at: string | null;
  version: string | null;
};

export type SkillRepo = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_synced: string | null;
};

export type SkillManifest = {
  name: string;
  description: string;
  source_url: string;
  version: string | null;
  tags: string[];
};

// ── Settings ──
export type Settings = {
  storage_path: string;
  default_worker: string;
  theme: "dark" | "light" | "system";
  log_level: "debug" | "info" | "warn" | "error";
  auto_check_updates: boolean;
  sync_on_change: boolean;
};

// ── Logs ──
export type LogEntry = {
  id: string;
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  message: string;
};

// ── Config Sync ──
export type ConfigSyncEntry = {
  id: string;
  app: string;
  config_type: "providers" | "mcp_servers" | "skills" | "rules";
  status: "synced" | "pending" | "conflict" | "error";
  last_synced: string | null;
  local_hash: string;
  remote_hash: string;
};

// ── Task Queue ──
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type Task = {
  id: string;
  action: string;
  target: string;
  status: TaskStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
};

// ── Remote Agent ──
export type RemoteAgent = {
  id: string;
  name: string;
  display_name: string;
  endpoint: string;
  api_key?: string | null;
  status: 'online' | 'offline' | 'unknown';
  version?: string | null;
  latency_ms?: number | null;
  last_ping?: string | null;
  created_at: string;
  tags: string[];
};

export interface OpenClawDetail {
  assistant_name: string;
  assistant_avatar: string;
  assistant_agent_id: string;
  server_version: string;
  base_path: string;
}

export interface RemoteAgentDetail extends RemoteAgent {
  detail: OpenClawDetail | null;
}

// ── AI Employee ──

export type AgentProtocol =
  | { type: "local_process"; executable: string; soul_arg: string; extra_args: string[] }
  | { type: "open_ai_compatible"; endpoint: string; api_key?: string | null; model: string; stream: boolean }
  | { type: "ssh_exec"; host: string; port: number; user: string; key_path: string; executable: string; soul_arg: string };

export type AgentBinding = {
  id: string;
  label: string;
  is_primary: boolean;
  protocol: AgentProtocol;
};

export type Employee = {
  id: string;
  name: string;
  display_name: string;
  role: string;
  avatar_color: string;
  bindings: AgentBinding[];
  created_at: string;
  updated_at: string;
  last_dispatched_at?: string;
  dispatch_count?: number;
  dispatch_success_count?: number;
};

export type SoulFiles = {
  soul: string;
  skills: string;
  rules: string;
};

export type WorkerInfo = {
  id: string;
  display_name: string;
};

export type CreateEmployeeRequest = {
  name: string;
  display_name: string;
  role: string;
  avatar_color: string;
};

export type UpdateEmployeeRequest = {
  display_name?: string;
  role?: string;
  avatar_color?: string;
};

export type AgentBindingRequest = {
  label: string;
  is_primary: boolean;
  protocol: AgentProtocol;
};

export type UpdateBindingRequest = {
  label?: string;
  is_primary?: boolean;
  protocol?: AgentProtocol;
};

export type DispatchRequest = {
  task: string;
  cwd?: string;
  binding_id?: string;
};

export type DispatchResponse = {
  task_id: string;
};

export type DispatchRecord = {
  id: string;
  task: string;
  binding_label: string;
  status: "completed" | "failed";
  output: string;
  exit_code: number;
  started_at: string;
  completed_at: string;
};

export type DispatchHistory = {
  records: DispatchRecord[];
};

// ── Prompt Preset ──
export interface PromptPreset {
  id: string;
  name: string;
  content: string;
  active: boolean;
  apps: string[];
  created_at: string;
  modified_at: string;
}

// ── Backup ──
export interface BackupMeta {
  id: string;
  label: string;
  created_at: string;
  size_bytes: number;
}
