import type { CliTool, CreateMcpServerInput, CreateProviderInput, McpServer, Provider, Skill, SkillRepo, SwitchMode, SkillManifest } from "../types";
import { mockConfigSync, mockLogs, mockMcpServers, mockProviders, mockSettings, mockSkillRepos, mockSkills, mockSwitchModes, mockTools } from "./data";
import type { ConfigSyncEntry, LogEntry, Settings } from "./data";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

let tools = [...mockTools];
let providers = [...mockProviders];
let switchModes = { ...mockSwitchModes };
let mcpServers = [...mockMcpServers];
let skills = [...mockSkills];
let skillRepos = [...mockSkillRepos];
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
  getSwitchModes: async () => {
    await delay();
    return { modes: { ...switchModes } };
  },
  setSwitchMode: async (app: string, mode: SwitchMode) => {
    await delay();
    switchModes = { ...switchModes, [app]: mode };
    return { ok: true as const };
  },
  exportProviders: async () => {
    await delay();
    return { providers, switch_modes: switchModes } as Record<string, unknown>;
  },
  importProviders: async (data: string) => {
    await delay();
    const parsed = JSON.parse(data) as { providers?: Provider[] };
    const incoming = parsed.providers ?? [];
    const imported: Provider[] = [];
    for (const p of incoming) {
      if (!providers.some((existing) => existing.name === p.name)) {
        providers.push(p);
        imported.push(p);
      }
    }
    return { imported };
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
    providers = providers.map((p) => ({ ...p, active: p.id === id, modified_at: new Date().toISOString() }));
    return { ok: true as const };
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
  pingMcpServer: async (id: string) => {
    await delay(800);
    const server = mcpServers.find((s) => s.id === id);
    if (!server) return { ok: false as const, error: "服务器不存在" };
    if (server.transport === "stdio") {
      const ok = Math.random() > 0.2;
      return ok
        ? { ok: true as const, transport: "stdio" as const }
        : { ok: false as const, error: "命令不存在" };
    }
    const ok = Math.random() > 0.3;
    return ok
      ? { ok: true as const, latency_ms: Math.floor(Math.random() * 300) + 20 }
      : { ok: false as const, error: "连接超时" };
  },
  importMcpFromApp: async (app: string) => {
    await delay(600);
    const imported: McpServer[] = [{
      id: `m${Date.now()}`,
      name: `${app}-imported`,
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
      url: null,
      env: {},
      enabled_apps: [app],
    }];
    mcpServers = [...mcpServers, ...imported];
    return { imported };
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
    return { ok: true as const };
  },
  updateSkill: async (id: string, input: { apps: string[] }) => {
    await delay();
    skills = skills.map((skill) => (skill.id === id ? { ...skill, apps: input.apps } : skill));
    return skills.find((skill) => skill.id === id) as Skill;
  },
  syncSkill: async (_id: string) => {
    await delay(500);
    return { ok: true as const, synced_count: 2 };
  },
  getSkillRepos: async () => {
    await delay();
    return { repos: [...skillRepos] };
  },
  addSkillRepo: async (name: string, url: string) => {
    await delay();
    const repo: SkillRepo = {
      id: `r${Date.now()}`,
      name,
      url,
      enabled: true,
      last_synced: null,
    };
    skillRepos = [...skillRepos, repo];
    return repo;
  },
  removeSkillRepo: async (id: string) => {
    await delay();
    skillRepos = skillRepos.filter((repo) => repo.id !== id);
    return { ok: true as const };
  },
  toggleSkillRepo: async (id: string, enabled: boolean) => {
    await delay();
    skillRepos = skillRepos.map((repo) => (repo.id === id ? { ...repo, enabled } : repo));
    return { ok: true as const };
  },
  fetchSkillRepo: async (id: string) => {
    await delay(800);
    const mockSkills: SkillManifest[] = [
      {
        name: "代码审查助手",
        description: "自动进行代码审查并提供改进建议",
        source_url: "https://github.com/example/skills/blob/main/code-review/SKILL.md",
        version: "1.0.0",
        tags: ["代码质量", "审查"],
      },
      {
        name: "测试生成器",
        description: "根据代码自动生成单元测试",
        source_url: "https://github.com/example/skills/blob/main/test-gen/SKILL.md",
        version: "2.1.0",
        tags: ["测试", "自动化"],
      },
      {
        name: "文档编写助手",
        description: "帮助编写和维护项目文档",
        source_url: "https://github.com/example/skills/blob/main/doc-writer/SKILL.md",
        version: "1.5.0",
        tags: ["文档", "写作"],
      },
    ];
    return { skills: mockSkills };
  },
  getSkillRepoCache: async (id: string) => {
    await delay(200);
    const mockSkills: SkillManifest[] = [
      {
        name: "代码审查助手",
        description: "自动进行代码审查并提供改进建议",
        source_url: "https://github.com/example/skills/blob/main/code-review/SKILL.md",
        version: "1.0.0",
        tags: ["代码质量", "审查"],
      },
      {
        name: "测试生成器",
        description: "根据代码自动生成单元测试",
        source_url: "https://github.com/example/skills/blob/main/test-gen/SKILL.md",
        version: "2.1.0",
        tags: ["测试", "自动化"],
      },
    ];
    return { skills: mockSkills };
  },
  installSkillFromUrl: async (name: string, source_url: string, apps: string[]) => {
    await delay(1500);
    const skill: Skill = {
      id: `s${Date.now()}`,
      name,
      description: "从 URL 安装的 skill",
      source: "github",
      source_url,
      apps,
      installed_at: new Date().toISOString(),
      version: null,
    };
    skills.push(skill);
    return skill;
  },
  installSkillFromZip: async (_file: File) => {
    await delay(2000);
    const installed: Skill[] = [
      {
        id: `s${Date.now()}`,
        name: "zip-installed-skill",
        description: "从 ZIP 安装的 skill",
        source: "zip",
        source_url: null,
        apps: [],
        installed_at: new Date().toISOString(),
        version: null,
      },
    ];
    skills.push(...installed);
    return { installed };
  },
  importSkillsFromApp: async (app: string) => {
    await delay(600);
    const imported: Skill[] = [{
      id: `s${Date.now()}`,
      name: `${app}-imported-skill`,
      description: `从 ${app} 导入的技能`,
      source: "local",
      source_url: null,
      apps: [app],
      installed_at: new Date().toISOString(),
      version: null,
    }];
    skills.push(...imported);
    return { imported };
  },

  getSettings: async () => {
    await delay();
    return { ...settings };
  },
  updateSettings: async (input: Settings) => {
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
