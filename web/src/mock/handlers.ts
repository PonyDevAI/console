import type { CliTool, CreateMcpServerInput, CreateProviderInput, McpServer, Provider, Skill } from "../types";
import { mockConfigSync, mockLogs, mockMcpServers, mockProviders, mockSettings, mockSkills, mockTools } from "./data";
import type { ConfigSyncEntry, LogEntry, Settings } from "./data";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

let tools = [...mockTools];
let providers = [...mockProviders];
let mcpServers = [...mockMcpServers];
let skills = [...mockSkills];
let settings = { ...mockSettings };
let logs = [...mockLogs];
let configSync = [...mockConfigSync];

export const mockApi = {
  getHealth: async () => {
    await delay(100);
    return { status: "ok" as const };
  },

  getCliTools: async () => {
    await delay();
    return { tools: [...tools] };
  },
  scanCliTools: async () => {
    await delay(800);
    tools = tools.map((tool) => ({ ...tool, last_checked: new Date().toISOString() }));
    return { tools: [...tools] };
  },
  installTool: async (name: string) => {
    await delay(1500);
    tools = tools.map((tool) =>
      tool.name === name
        ? { ...tool, installed: true, local_version: tool.remote_version, path: `/usr/local/bin/${name}` }
        : tool,
    );
    return tools.find((tool) => tool.name === name) as CliTool;
  },
  upgradeTool: async (name: string) => {
    await delay(1500);
    tools = tools.map((tool) =>
      tool.name === name ? { ...tool, local_version: tool.remote_version } : tool,
    );
    return tools.find((tool) => tool.name === name) as CliTool;
  },
  uninstallTool: async (name: string) => {
    await delay(1000);
    tools = tools.map((tool) =>
      tool.name === name ? { ...tool, installed: false, local_version: null, path: null } : tool,
    );
    return { ok: true as const };
  },
  checkUpdates: async () => {
    await delay(1200);
    return { tools: [...tools] };
  },

  getProviders: async () => {
    await delay();
    return { providers: [...providers] };
  },
  createProvider: async (input: CreateProviderInput) => {
    await delay();
    const provider: Provider = {
      ...input,
      id: `p${Date.now()}`,
      active: false,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    };
    providers.push(provider);
    return provider;
  },
  updateProvider: async (id: string, input: Partial<Provider>) => {
    await delay();
    providers = providers.map((provider) =>
      provider.id === id ? { ...provider, ...input, modified_at: new Date().toISOString() } : provider,
    );
    return providers.find((provider) => provider.id === id) as Provider;
  },
  deleteProvider: async (id: string) => {
    await delay();
    providers = providers.filter((provider) => provider.id !== id);
    return { ok: true as const };
  },
  activateProvider: async (id: string) => {
    await delay();
    providers = providers.map((provider) =>
      provider.id === id
        ? { ...provider, active: true, modified_at: new Date().toISOString() }
        : provider,
    );
    return providers.find((provider) => provider.id === id) as Provider;
  },
  deactivateProvider: async (id: string) => {
    await delay();
    providers = providers.map((provider) =>
      provider.id === id
        ? { ...provider, active: false, modified_at: new Date().toISOString() }
        : provider,
    );
    return providers.find((provider) => provider.id === id) as Provider;
  },
  testProvider: async (_id: string) => {
    await delay(1000);
    return {
      ok: Math.random() > 0.2,
      latency_ms: Math.floor(Math.random() * 500) + 50,
    };
  },

  getMcpServers: async () => {
    await delay();
    return { servers: [...mcpServers] };
  },
  createMcpServer: async (input: CreateMcpServerInput) => {
    await delay();
    const server: McpServer = {
      ...input,
      id: `m${Date.now()}`,
      command: input.command ?? null,
      url: input.url ?? null,
    };
    mcpServers.push(server);
    return server;
  },
  updateMcpServer: async (id: string, input: Partial<McpServer>) => {
    await delay();
    mcpServers = mcpServers.map((server) => (server.id === id ? { ...server, ...input } : server));
    return mcpServers.find((server) => server.id === id) as McpServer;
  },
  deleteMcpServer: async (id: string) => {
    await delay();
    mcpServers = mcpServers.filter((server) => server.id !== id);
    return { ok: true as const };
  },
  pingMcpServer: async (_id: string) => {
    await delay(800);
    return {
      ok: Math.random() > 0.3,
      latency_ms: Math.floor(Math.random() * 300) + 20,
    };
  },

  getSkills: async () => {
    await delay();
    return { skills: [...skills] };
  },
  installSkill: async (id: string) => {
    await delay(1500);
    skills = skills.map((skill) =>
      skill.id === id ? { ...skill, installed_at: new Date().toISOString() } : skill,
    );
    return skills.find((skill) => skill.id === id) as Skill;
  },
  uninstallSkill: async (id: string) => {
    await delay(1000);
    skills = skills.map((skill) => (skill.id === id ? { ...skill, installed_at: null } : skill));
    return skills.find((skill) => skill.id === id) as Skill;
  },

  getSettings: async () => {
    await delay();
    return { ...settings };
  },
  updateSettings: async (input: Partial<Settings>) => {
    await delay();
    settings = { ...settings, ...input };
    return { ...settings };
  },

  getLogs: async (params?: { level?: string; source?: string; limit?: number }) => {
    await delay();
    let result = [...logs] as LogEntry[];
    if (params?.level) result = result.filter((entry) => entry.level === params.level);
    if (params?.source) result = result.filter((entry) => entry.source === params.source);
    if (params?.limit) result = result.slice(0, params.limit);
    return { logs: result };
  },

  getConfigSync: async () => {
    await delay();
    return { entries: [...configSync] };
  },
  syncConfig: async (id: string) => {
    await delay(1500);
    configSync = configSync.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            status: "synced" as const,
            last_synced: new Date().toISOString(),
            remote_hash: entry.local_hash,
          }
        : entry,
    );
    return configSync.find((entry) => entry.id === id) as ConfigSyncEntry;
  },
  syncAll: async () => {
    await delay(3000);
    configSync = configSync.map((entry) => ({
      ...entry,
      status: "synced" as const,
      last_synced: new Date().toISOString(),
      remote_hash: entry.local_hash,
    }));
    return { entries: [...configSync] };
  },
};
