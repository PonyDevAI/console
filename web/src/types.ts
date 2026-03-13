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
  description: string | null;
  source: string | null;
  enabled_apps: string[];
  installed_at: string | null;
};
