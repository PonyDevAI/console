import type {
  CliTool,
  CreateMcpServerInput,
  CreateProviderInput,
  McpServer,
  Provider,
  Skill,
} from "./types";

const BASE = "/api";

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

export const getHealth = () => get<{ status: string }>("/health");

export const getCliTools = () => get<{ tools: CliTool[] }>("/cli-tools");
export const scanCliTools = () => post<{ tools: CliTool[] }>("/cli-tools/scan");

export const getProviders = () => get<{ providers: Provider[] }>("/providers");
export const createProvider = (p: CreateProviderInput) => post<Provider>("/providers", p);
export const updateProvider = (id: string, p: CreateProviderInput) => put<Provider>(`/providers/${id}`, p);
export const deleteProvider = (id: string) => del<{ ok: boolean }>(`/providers/${id}`);
export const activateProvider = (id: string) => post<{ ok: boolean }>(`/providers/${id}/activate`);

export const getMcpServers = () => get<{ servers: McpServer[] }>("/mcp-servers");
export const createMcpServer = (s: CreateMcpServerInput) => post<McpServer>("/mcp-servers", s);
export const updateMcpServer = (id: string, s: McpServer) => put<McpServer>(`/mcp-servers/${id}`, s);
export const deleteMcpServer = (id: string) => del<{ ok: boolean }>(`/mcp-servers/${id}`);

export const getSkills = () => get<{ skills: Skill[] }>("/skills");
