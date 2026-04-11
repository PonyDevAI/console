// ── CLI Tool ──
export type AgentSourceType = "local_cli" | "openai_compatible" | "remote_agent" | "remote_open_claw_ws";

export type AgentSource = {
  id: string;
  name: string;
  display_name: string;
  source_type: AgentSourceType;
  managed_by_console: boolean;
  executable?: string;
  endpoint?: string;
  api_key?: string;
  origin?: string;
  supported_models: string[];
  default_model?: string;
  healthy: boolean;
  installed: boolean;
  local_version?: string;
  remote_version?: string;
  path?: string;
  supports_auto_install: boolean;
  install_url?: string;
  supports_model_config: boolean;
  last_checked_at?: string;
};

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
  source_type?: 'remote_agent' | 'openclaw_ws';
  origin?: string;
};

// ── Agent ──
export type AgentStatus = 'unknown' | 'offline' | 'online' | 'busy';

export type AgentType = 'local_cli' | 'remote_agent';

export type Agent = {
  id: string;
  source_id: string;
  name: string;
  display_name: string;
  agent_type: AgentType;
  status: AgentStatus;
  supported_models: string[];
  default_model?: string;
};

export type EmployeeStatus = 'unknown' | 'offline' | 'online' | 'busy';

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
  agent_id?: string;
  model?: string;
  status: EmployeeStatus;
  avatar_color: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_dispatched_at?: string;
  dispatch_count?: number;
  dispatch_success_count?: number;
  /** @deprecated Use agent_id instead - bindings are a legacy concept */
  bindings?: AgentBinding[];
  /** @deprecated Use agent_id instead */
  role?: string;
  /** @deprecated Use agent_id instead */
  employee_type?: "local" | "remote";
  /** @deprecated Use agent_id instead */
  source_id?: string;
  /** @deprecated Use agent_id instead */
  remote_agent_name?: string;
};

export type SoulFiles = {
  soul: string;
  skills: string;
  rules: string;
};

export type PersonaFiles = {
  identity: string;
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
  display_name?: string;
  agent_id: string;
  model?: string;
  avatar_color?: string;
  tags?: string[];
  role?: string;
  employee_type?: "local" | "remote";
  source_id?: string;
  remote_agent_name?: string;
};

export type UpdateEmployeeRequest = {
  display_name?: string;
  agent_id?: string;
  model?: string;
  avatar_color?: string;
  tags?: string[];
  role?: string;
  source_id?: string;
  remote_agent_name?: string;
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

// ── Session / Chat ──

export interface SessionParticipant {
  employee_id: string;
  display_name: string;
  avatar_color: string;
}

export interface Session {
  id: string;
  title: string;
  participants: SessionParticipant[];
  created_at: string;
  updated_at: string;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  kind: "chat" | "system" | "proposal";
  role: "user" | "assistant";
  author_id?: string;
  author_label: string;
  content: string;
  mentions: string[];
  created_at: string;
}

export type ProposalStatus = "pending" | "executing" | "reviewing" | "revising" | "done" | "cancelled";

export interface TaskProposal {
  id: string;
  session_id: string;
  title: string;
  description: string;
  assigned_employee_id: string;
  status: ProposalStatus;
  dispatch_task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalWithSession extends TaskProposal {
  session_title: string;
}

export type SessionEvent =
  | { type: "message_created"; message_id: string; author_label: string; author_id?: string; kind: string; role: string; content: string; mentions: string[]; created_at: string }
  | { type: "message_delta"; message_id: string; delta: string }
  | { type: "message_done"; message_id: string; content: string }
  | { type: "message_error"; message_id: string; error: string }
  | { type: "proposal_updated"; proposal_id: string; status: string };

// ── Thread & Agent Runtime ──

export type Thread = {
  id: string;
  title: string;
  workspace: string;
  runtime: ThreadRuntimeProfile;
  created_at: string;
  updated_at: string;
};

export type ThreadRuntimeProfile = {
  adapter: string;
  model: string;
  reasoning_effort: string;
  permission_mode: string;
};

export type ThreadAttachment = {
  name: string;
  path: string;
};

export type ThreadMessage = {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  status?: string;
  error?: string;
  attachments: ThreadAttachment[];
  created_at: string;
  run_id?: string;
};

export type ThreadRunRef = {
  id: string;
  thread_id: string;
  assistant_message_id: string;
  status: string;
  adapter: string;
  model: string;
  started_at: string;
  completed_at?: string;
};

export type RuntimeOption = {
  id: string;
  label: string;
  adapter: "codex" | "claude";
  model: string;
};

export type ThreadRuntimeConfig = {
  adapter: "codex" | "claude";
  model: string;
  reasoningEffort: "low" | "medium" | "high";
  permissionMode: "default" | "read_only" | "workspace_write" | "full_access";
  workspacePath: string;
  gitBranch?: string | null;
};

export type WorkspaceInspectResult = {
  path: string;
  display_name: string;
  git_branch: string | null;
  is_git_repo: boolean;
};

export type RuntimeEvent =
  | { type: "run_started"; run_id: string }
  | { type: "message_delta"; run_id: string; text: string }
  | { type: "run_status"; run_id: string; message: string }
  | { type: "run_completed"; run_id: string; output: string }
  | { type: "run_failed"; run_id: string; error: string }
  | { type: "run_cancelled"; run_id: string };

export type ThreadEvent =
  | { type: "message_created"; message_id: string; role: string; content: string; created_at: string }
  | { type: "message_delta"; message_id: string; delta: string }
  | { type: "message_done"; message_id: string; content: string }
  | { type: "message_error"; message_id: string; error: string }
  | { type: "run_started"; run_id: string }
  | { type: "run_completed"; run_id: string }
  | { type: "run_failed"; run_id: string; error: string }
  | { type: "run_cancelled"; run_id: string };

// ── Terminal ──
export type CreateTerminalSessionRequest =
  | { type: "local"; cols: number; rows: number; cwd?: string; shell?: string }
  | { type: "ssh"; host: string; port: number; user: string; key_path: string; cols: number; rows: number };

export type CreateTerminalSessionResponse = {
  session_id: string;
};

export type TerminalClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "close" };

export type TerminalServerMessage =
  | { type: "output"; data: string }
  | { type: "exit"; code: number | null }
  | { type: "error"; message: string };

export type TerminalConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
