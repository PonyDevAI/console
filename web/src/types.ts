// ── CLI Tool ──
export type CliTool = {
  name: string;
  display_name: string;
  installed: boolean;
  local_version: string | null;
  remote_version: string | null;
  path: string | null;
  last_checked: string | null;
};

// ── Provider ──
export type Provider = {
  id: string;
  name: string;
  api_endpoint: string;
  api_key_ref: string;
  active: boolean;
  apps: string[];
  created_at: string;
  modified_at: string;
};

export type CreateProviderInput = {
  name: string;
  api_endpoint: string;
  api_key_ref: string;
  apps: string[];
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
