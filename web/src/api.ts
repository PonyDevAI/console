import { mockApi } from "./mock/handlers";
import type {
  CliTool,
  ConfigSyncEntry,
  CreateMcpServerInput,
  CreateProviderInput,
  LogEntry,
  McpServer,
  Provider,
  Settings,
  SkillRepo,
  Skill,
  SwitchMode,
  SkillManifest,
} from "./types";

const BASE = "/api";

let useMock = false;

async function detectBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

const backendReady = detectBackend().then((ok) => {
  useMock = !ok;
  return ok;
});

async function ensureReady() {
  await backendReady;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

export async function getHealth() {
  await ensureReady();
  if (useMock) return mockApi.getHealth();
  return get<{ status: string }>("/health");
}

export async function getCliTools() {
  await ensureReady();
  if (useMock) return mockApi.getCliTools();
  return get<{ tools: CliTool[] }>("/cli-tools");
}

export async function scanCliTools() {
  await ensureReady();
  if (useMock) return mockApi.scanCliTools();
  return post<{ tools: CliTool[] }>("/cli-tools/scan");
}

export async function installTool(name: string) {
  await ensureReady();
  if (useMock) return mockApi.installTool(name);
  return post<CliTool>(`/cli-tools/${name}/install`);
}

export async function upgradeTool(name: string) {
  await ensureReady();
  if (useMock) return mockApi.upgradeTool(name);
  return post<CliTool>(`/cli-tools/${name}/upgrade`);
}

export async function uninstallTool(name: string) {
  await ensureReady();
  if (useMock) return mockApi.uninstallTool(name);
  return post<{ ok: boolean }>(`/cli-tools/${name}/uninstall`);
}

export async function checkUpdates() {
  await ensureReady();
  if (useMock) return mockApi.checkUpdates();
  return post<{ tools: CliTool[] }>("/cli-tools/check-updates");
}

export async function getProviders() {
  await ensureReady();
  if (useMock) return mockApi.getProviders();
  return get<{ providers: Provider[] }>("/providers");
}

export async function getSwitchModes() {
  await ensureReady();
  if (useMock) return mockApi.getSwitchModes();
  return get<{ modes: Record<string, SwitchMode> }>("/providers/switch-modes");
}

export async function setSwitchMode(app: string, mode: SwitchMode) {
  await ensureReady();
  if (useMock) return mockApi.setSwitchMode(app, mode);
  return put<{ ok: boolean }>(`/providers/switch-modes/${app}`, { mode });
}

export async function exportProviders() {
  await ensureReady();
  if (useMock) return mockApi.exportProviders();
  return get<Record<string, unknown>>("/providers/export");
}

export async function importProviders(data: string) {
  await ensureReady();
  if (useMock) return mockApi.importProviders(data);
  return post<{ imported: Provider[] }>("/providers/import", { data });
}

export async function createProvider(payload: CreateProviderInput) {
  await ensureReady();
  if (useMock) return mockApi.createProvider(payload);
  return post<Provider>("/providers", payload);
}

export async function updateProvider(id: string, payload: CreateProviderInput) {
  await ensureReady();
  if (useMock) return mockApi.updateProvider(id, payload);
  return put<Provider>(`/providers/${id}`, payload);
}

export async function deleteProvider(id: string) {
  await ensureReady();
  if (useMock) return mockApi.deleteProvider(id);
  return del<{ ok: boolean }>(`/providers/${id}`);
}

export async function activateProvider(id: string) {
  await ensureReady();
  if (useMock) return mockApi.activateProvider(id);
  return post<{ ok: boolean }>(`/providers/${id}/activate`);
}

export async function testProvider(id: string) {
  await ensureReady();
  if (useMock) return mockApi.testProvider(id);
  return post<{ ok: boolean; latency_ms?: number; error?: string; status?: number }>(`/providers/${id}/test`);
}

export async function getMcpServers() {
  await ensureReady();
  if (useMock) return mockApi.getMcpServers();
  return get<{ servers: McpServer[] }>("/mcp-servers");
}

export async function createMcpServer(payload: CreateMcpServerInput) {
  await ensureReady();
  if (useMock) return mockApi.createMcpServer(payload);
  return post<McpServer>("/mcp-servers", payload);
}

export async function updateMcpServer(id: string, payload: McpServer) {
  await ensureReady();
  if (useMock) return mockApi.updateMcpServer(id, payload);
  return put<McpServer>(`/mcp-servers/${id}`, payload);
}

export async function deleteMcpServer(id: string) {
  await ensureReady();
  if (useMock) return mockApi.deleteMcpServer(id);
  return del<{ ok: boolean }>(`/mcp-servers/${id}`);
}

export async function pingMcpServer(id: string) {
  await ensureReady();
  if (useMock) return mockApi.pingMcpServer(id);
  return post<{ ok: boolean; latency_ms?: number; transport?: string; error?: string }>(`/mcp-servers/${id}/ping`);
}

export async function importMcpFromApp(app: string) {
  await ensureReady();
  if (useMock) return mockApi.importMcpFromApp(app);
  return post<{ imported: McpServer[] }>(`/mcp-servers/import-from/${app}`);
}

export async function getSkills() {
  await ensureReady();
  if (useMock) return mockApi.getSkills();
  return get<{ skills: Skill[] }>("/skills");
}

export async function installSkill(id: string) {
  await ensureReady();
  if (useMock) return mockApi.installSkill(id);
  return post<Skill>(`/skills/${id}/install`);
}

export async function uninstallSkill(id: string) {
  await ensureReady();
  if (useMock) return mockApi.uninstallSkill(id);
  return post<{ ok: boolean }>(`/skills/${id}/uninstall`);
}

export async function updateSkill(id: string, payload: { apps: string[] }) {
  await ensureReady();
  if (useMock) return mockApi.updateSkill(id, payload);
  return put<Skill>(`/skills/${id}`, payload);
}

export async function syncSkill(id: string) {
  await ensureReady();
  if (useMock) return mockApi.syncSkill(id);
  return post<{ ok: boolean; synced_count: number }>(`/skills/${id}/sync`);
}

export async function getSkillRepos() {
  await ensureReady();
  if (useMock) return mockApi.getSkillRepos();
  return get<{ repos: SkillRepo[] }>("/skill-repos");
}

export async function addSkillRepo(name: string, url: string) {
  await ensureReady();
  if (useMock) return mockApi.addSkillRepo(name, url);
  return post<SkillRepo>("/skill-repos", { name, url });
}

export async function removeSkillRepo(id: string) {
  await ensureReady();
  if (useMock) return mockApi.removeSkillRepo(id);
  return del<{ ok: boolean }>(`/skill-repos/${id}`);
}

export async function toggleSkillRepo(id: string, enabled: boolean) {
  await ensureReady();
  if (useMock) return mockApi.toggleSkillRepo(id, enabled);
  return post<{ ok: boolean }>(`/skill-repos/${id}/toggle`, { enabled });
}

export async function fetchSkillRepo(id: string) {
  await ensureReady();
  if (useMock) return mockApi.fetchSkillRepo(id);
  return post<{ skills: SkillManifest[] }>(`/skill-repos/${id}/fetch`);
}

export async function getSkillRepoCache(id: string) {
  await ensureReady();
  if (useMock) return mockApi.getSkillRepoCache(id);
  return get<{ skills: SkillManifest[] }>(`/skill-repos/${id}/cache`);
}

export async function installSkillFromUrl(name: string, source_url: string, apps: string[]) {
  await ensureReady();
  if (useMock) return mockApi.installSkillFromUrl(name, source_url, apps);
  return post<Skill>("/skills/install-url", { name, source_url, apps });
}

export async function installSkillFromZip(file: File) {
  await ensureReady();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(BASE + '/skills/install-zip', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('上传失败');
  return res.json() as Promise<{ installed: Skill[] }>;
}

export async function importSkillsFromApp(app: string) {
  await ensureReady();
  if (useMock) return mockApi.importSkillsFromApp(app);
  return post<{ imported: Skill[] }>(`/skills/import-from/${app}`);
}

export async function getSettings() {
  await ensureReady();
  if (useMock) return mockApi.getSettings();
  return get<Settings>("/settings");
}

export async function updateSettings(payload: Settings) {
  await ensureReady();
  if (useMock) return mockApi.updateSettings(payload);
  return put<Settings>("/settings", payload);
}

export async function getLogs(params?: { level?: string; source?: string; limit?: number }) {
  await ensureReady();
  if (useMock) return mockApi.getLogs(params);

  const qs = new URLSearchParams();
  if (params?.level) qs.set("level", params.level);
  if (params?.source) qs.set("source", params.source);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString();
  return get<{ logs: LogEntry[] }>(`/logs${suffix ? `?${suffix}` : ""}`);
}

export async function getConfigSync() {
  await ensureReady();
  if (useMock) return mockApi.getConfigSync();
  return get<{ entries: ConfigSyncEntry[] }>("/config-sync");
}

export async function syncConfig(id: string) {
  await ensureReady();
  if (useMock) return mockApi.syncConfig(id);
  return post<ConfigSyncEntry>(`/config-sync/${id}/sync`);
}

export async function syncAll() {
  await ensureReady();
  if (useMock) return mockApi.syncAll();
  return post<{ entries: ConfigSyncEntry[] }>("/config-sync/sync-all");
}
