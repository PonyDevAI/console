import { mockApi } from "./mock/handlers";
import type {
  CliTool,
  ConfigSyncEntry,
  CreateMcpServerInput,
  CreateProviderInput,
  LogEntry,
  McpServer,
  ModelAssignment,
  Provider,
  RemoteAgent,
  RemoteAgentDetail,
  Settings,
  SkillRepo,
  Skill,
  SwitchMode,
  SkillManifest,
  Task,
  Employee,
  SoulFiles,
  WorkerInfo,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  AgentBindingRequest,
  UpdateBindingRequest,
  DispatchRequest,
  DispatchResponse,
  DispatchRecord,
  DispatchHistory,
  PromptPreset,
  BackupMeta,
  Session,
  SessionMessage,
  SessionEvent,
  TaskProposal,
  CreateTerminalSessionRequest,
  CreateTerminalSessionResponse,
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

export async function getSystemVersion() {
  await ensureReady();
  if (useMock) return { version: '0.1.0', name: 'console', os: 'darwin', arch: 'arm64' };
  return get<{ version: string; name: string; os: string; arch: string }>('/system/version');
}

export async function checkSystemUpdate() {
  await ensureReady();
  if (useMock) return { current: '0.1.0', latest: '0.1.0', update_available: false };
  return get<{ current: string; latest: string; update_available: boolean }>('/system/check-update');
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
  return post<{ task_id: string; status: string }>(`/cli-tools/${name}/install`);
}

export async function upgradeTool(name: string) {
  await ensureReady();
  if (useMock) return mockApi.upgradeTool(name);
  return post<{ task_id: string; status: string }>(`/cli-tools/${name}/upgrade`);
}

export async function uninstallTool(name: string) {
  await ensureReady();
  if (useMock) return mockApi.uninstallTool(name);
  return post<{ task_id: string; status: string }>(`/cli-tools/${name}/uninstall`);
}

export async function checkUpdates() {
  await ensureReady();
  if (useMock) return mockApi.checkUpdates();
  return post<{ tools: CliTool[] }>("/cli-tools/check-updates");
}

export async function checkRemoteVersion(name: string) {
  await ensureReady();
  if (useMock) return { name, remote_version: null as string | null };
  return get<{ name: string; remote_version: string | null }>(`/cli-tools/${name}/check-remote`);
}

export async function getTasks() {
  await ensureReady();
  if (useMock) return mockApi.getTasks();
  return get<{ tasks: Task[] }>('/tasks');
}

export async function getTask(id: string) {
  await ensureReady();
  if (useMock) return mockApi.getTask(id);
  return get<Task>(`/tasks/${id}`);
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

export async function fetchProviderModels(id: string) {
  await ensureReady();
  if (useMock) return { models: [] as string[] };
  return post<{ models: string[] }>(`/providers/${id}/fetch-models`);
}

export async function getModelAssignments() {
  await ensureReady();
  if (useMock) return { assignments: [] as ModelAssignment[] };
  return get<{ assignments: ModelAssignment[] }>("/model-assignments");
}

export async function setModelAssignment(app: string, providerId: string, model: string) {
  await ensureReady();
  if (useMock) {
    return {
      app,
      provider_id: providerId,
      model,
      updated_at: new Date().toISOString(),
    } satisfies ModelAssignment;
  }
  return put<ModelAssignment>(`/model-assignments/${app}`, {
    provider_id: providerId,
    model,
  });
}

export async function removeModelAssignment(app: string) {
  await ensureReady();
  if (useMock) return;
  await del<{ ok: boolean }>(`/model-assignments/${app}`);
}

export async function getCurrentModel(app: string) {
  await ensureReady();
  if (useMock) {
    return {
      assignment: null as ModelAssignment | null,
      current_model: null as string | null,
    };
  }
  return get<{ assignment: ModelAssignment | null; current_model: string | null }>(
    `/model-assignments/${app}/current`,
  );
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
  if (useMock) return mockApi.installSkillFromZip(file);
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

export async function getRemoteAgents() {
  await ensureReady();
  if (useMock) return { agents: [] as RemoteAgent[] };
  return get<{ agents: RemoteAgent[] }>("/remote-agents");
}

export async function addRemoteAgent(data: { name: string; display_name: string; endpoint: string; api_key?: string; tags?: string[] }) {
  await ensureReady();
  if (useMock) return {} as RemoteAgent;
  return post<RemoteAgent>("/remote-agents", data);
}

export async function updateRemoteAgent(id: string, data: { display_name?: string; endpoint?: string; api_key?: string; tags?: string[] }) {
  await ensureReady();
  if (useMock) return {} as RemoteAgent;
  return put<RemoteAgent>(`/remote-agents/${id}`, data);
}

export async function deleteRemoteAgent(id: string) {
  await ensureReady();
  if (useMock) return;
  return del(`/remote-agents/${id}`);
}

export async function pingRemoteAgent(id: string) {
  await ensureReady();
  if (useMock) return {} as RemoteAgent;
  return post<RemoteAgent>(`/remote-agents/${id}/ping`);
}

export async function pingAllRemoteAgents() {
  await ensureReady();
  if (useMock) return { agents: [] as RemoteAgent[] };
  return post<{ agents: RemoteAgent[] }>("/remote-agents/ping-all");
}

export async function getRemoteAgentDetail(id: string) {
  await ensureReady();
  if (useMock) return null as RemoteAgentDetail | null;
  return get<RemoteAgentDetail>(`/remote-agents/${id}/detail`);
}

// ── AI Employee ──

export async function getEmployees() {
  await ensureReady();
  if (useMock) return { employees: [] as Employee[] };
  return get<{ employees: Employee[] }>("/employees");
}

export async function createEmployee(data: CreateEmployeeRequest) {
  await ensureReady();
  if (useMock) return {} as Employee;
  return post<Employee>("/employees", data);
}

export async function getEmployee(id: string) {
  await ensureReady();
  if (useMock) return { employee: {} as Employee, soul_files: {} as SoulFiles };
  return get<{ employee: Employee; soul_files: SoulFiles }>(`/employees/${id}`);
}

export async function updateEmployee(id: string, data: UpdateEmployeeRequest) {
  await ensureReady();
  if (useMock) return {} as Employee;
  return put<Employee>(`/employees/${id}`, data);
}

export async function deleteEmployee(id: string) {
  await ensureReady();
  if (useMock) return;
  return del(`/employees/${id}`);
}

export async function getSoulFiles(id: string) {
  await ensureReady();
  if (useMock) return {} as SoulFiles;
  return get<SoulFiles>(`/employees/${id}/soul-files`);
}

export async function updateSoulFiles(id: string, data: Partial<SoulFiles>) {
  await ensureReady();
  if (useMock) return { ok: true };
  return put<{ ok: boolean }>(`/employees/${id}/soul-files`, data);
}

export async function addBinding(id: string, binding: AgentBindingRequest) {
  await ensureReady();
  if (useMock) return {} as Employee;
  return post<Employee>(`/employees/${id}/bindings`, binding);
}

export async function updateBinding(id: string, bid: string, data: UpdateBindingRequest) {
  await ensureReady();
  if (useMock) return {} as Employee;
  return put<Employee>(`/employees/${id}/bindings/${bid}`, data);
}

export async function deleteBinding(id: string, bid: string) {
  await ensureReady();
  if (useMock) return {} as Employee;
  return del<Employee>(`/employees/${id}/bindings/${bid}`);
}

export async function dispatchEmployee(id: string, data: DispatchRequest) {
  await ensureReady();
  if (useMock) return { task_id: "mock-task-id", output: "Mock dispatch output", exit_code: 0 } as DispatchResponse;
  return post<DispatchResponse>(`/employees/${id}/dispatch`, data);
}

export async function getRemoteWorkers(remoteAgentId: string) {
  await ensureReady();
  if (useMock) return { workers: [] as WorkerInfo[] };
  return get<{ workers: WorkerInfo[] }>(`/remote-agents/${remoteAgentId}/workers`);
}

export async function testEmployeeBinding(employeeId: string, bindingId: string) {
  await ensureReady();
  if (useMock) return { ok: true };
  return post<{ ok: boolean; latency_ms?: number; error?: string; type?: string }>(
    `/employees/${employeeId}/bindings/${bindingId}/test`,
    {}
  );
}

export async function getDispatchHistory(employeeId: string) {
  await ensureReady();
  if (useMock) return { records: [] } as DispatchHistory;
  return get<DispatchHistory>(`/employees/${employeeId}/history`);
}

export async function getPrompts() {
  await ensureReady();
  if (useMock) return { prompts: [] as PromptPreset[] };
  return get<{ prompts: PromptPreset[] }>('/prompts');
}

export async function createPrompt(data: { name: string; content: string; apps: string[] }) {
  await ensureReady();
  if (useMock) return {} as PromptPreset;
  return post<PromptPreset>('/prompts', data);
}

export async function updatePrompt(id: string, data: { name?: string; content?: string; apps?: string[] }) {
  await ensureReady();
  if (useMock) return {} as PromptPreset;
  return put<PromptPreset>(`/prompts/${id}`, data);
}

export async function deletePrompt(id: string) {
  await ensureReady();
  if (useMock) return;
  return del(`/prompts/${id}`);
}

export async function activatePrompt(id: string) {
  await ensureReady();
  if (useMock) return;
  return post(`/prompts/${id}/activate`, {});
}

export async function getBackups() {
  await ensureReady();
  if (useMock) return { backups: [] as BackupMeta[] };
  return get<{ backups: BackupMeta[] }>('/backups');
}

export async function createBackup(label?: string) {
  await ensureReady();
  if (useMock) return {} as BackupMeta;
  return post<BackupMeta>('/backups', { label });
}

export async function restoreBackup(id: string) {
  await ensureReady();
  if (useMock) return;
  return post(`/backups/${id}/restore`, {});
}

export async function deleteBackup(id: string) {
  await ensureReady();
  if (useMock) return;
  return del(`/backups/${id}`);
}

// ── Session / Chat ──

export async function getSessions() {
  await ensureReady();
  if (useMock) return { sessions: [] as Session[] };
  return get<{ sessions: Session[] }>('/sessions');
}

export async function createSession(data: { title: string; participant_ids: string[] }) {
  await ensureReady();
  if (useMock) return {} as Session;
  return post<Session>('/sessions', data);
}

export async function getSession(id: string) {
  await ensureReady();
  if (useMock) return { session: {} as Session, messages: [] as SessionMessage[] };
  return get<{ session: Session; messages: SessionMessage[] }>(`/sessions/${id}`);
}

export async function deleteSession(id: string) {
  await ensureReady();
  if (useMock) return;
  return del(`/sessions/${id}`);
}

export async function postSessionMessage(id: string, data: { content: string; mentions: string[] }) {
  await ensureReady();
  if (useMock) return { message_id: "mock" };
  return post<{ message_id: string }>(`/sessions/${id}/messages`, data);
}

export function openSessionStream(id: string, onEvent: (e: SessionEvent) => void): () => void {
  const url = `${getBaseUrl()}/api/sessions/${id}/stream`;
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data) as SessionEvent); } catch {}
  };
  return () => es.close();
}

export async function updateSessionTitle(id: string, title: string) {
  await ensureReady();
  if (useMock) return;
  return fetch(`${getBaseUrl()}/api/sessions/${id}/title`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function updateSessionParticipants(id: string, data: { add: string[]; remove: string[] }) {
  await ensureReady();
  if (useMock) return {} as Session;
  return fetch(`${getBaseUrl()}/api/sessions/${id}/participants`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());
}

export async function createProposal(sessionId: string, data: {
  title: string;
  description: string;
  assigned_employee_id: string;
}) {
  await ensureReady();
  if (useMock) return {} as TaskProposal;
  return post<TaskProposal>(`/sessions/${sessionId}/proposals`, data);
}

export async function confirmProposal(sessionId: string, proposalId: string) {
  await ensureReady();
  return post(`/sessions/${sessionId}/proposals/${proposalId}/confirm`, {});
}

export async function cancelProposal(sessionId: string, proposalId: string) {
  await ensureReady();
  return post(`/sessions/${sessionId}/proposals/${proposalId}/cancel`, {});
}

export async function doneProposal(sessionId: string, proposalId: string) {
  await ensureReady();
  return post(`/sessions/${sessionId}/proposals/${proposalId}/done`, {});
}

export async function reviewProposal(sessionId: string, proposalId: string, reviewerEmployeeId: string) {
  await ensureReady();
  return post(`/sessions/${sessionId}/proposals/${proposalId}/review`, {
    reviewer_employee_id: reviewerEmployeeId,
  });
}

export async function reviseProposal(sessionId: string, proposalId: string, description?: string) {
  await ensureReady();
  return post(`/sessions/${sessionId}/proposals/${proposalId}/revise`, { description });
}

export async function getAllProposals() {
  await ensureReady();
  if (useMock) return { proposals: [] };
  return get<{ proposals: (TaskProposal & { session_title: string })[] }>('/proposals');
}

function getBaseUrl() {
  return location.origin;
}

// ── Terminal ──
export async function createTerminalSession(data: CreateTerminalSessionRequest) {
  await ensureReady();
  if (useMock) return { session_id: "mock-session-id" };
  return post<CreateTerminalSessionResponse>("/terminal/sessions", data);
}

export async function createLocalTerminalSession(cols: number, rows: number, cwd?: string, shell?: string) {
  return createTerminalSession({ type: "local", cols, rows, cwd, shell });
}

export async function closeTerminalSession(sessionId: string) {
  await ensureReady();
  if (useMock) return { ok: true };
  return del<{ ok: boolean }>(`/terminal/sessions/${sessionId}`);
}

export function getTerminalWebSocketUrl(sessionId: string): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/terminal/sessions/${sessionId}/ws`;
}
