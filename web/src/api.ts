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
  Skill,
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
  return post<{ ok: boolean; latency_ms: number }>(`/providers/${id}/test`);
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
  return post<{ ok: boolean; latency_ms: number }>(`/mcp-servers/${id}/ping`);
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

export async function getSettings() {
  await ensureReady();
  if (useMock) return mockApi.getSettings();
  return get<Settings>("/settings");
}

export async function updateSettings(payload: Partial<Settings>) {
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
