import type { CliTool, Provider, McpServer, Skill, CreateProviderInput, CreateMcpServerInput } from "./types";

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

// Health
export const getHealth = () => get<{ status: string }>("/health");

// CLI Tools
export const getCliTools = () => get<{ tools: CliTool[] }>("/cli-tools");
export const scanCliTools = () => post<{ tools: CliTool[] }>("/cli-tools/scan");

// Providers
export const getProviders = () => get<{ providers: Provider[] }>("/providers");
export const createProvider = (p: CreateProviderInput) => post<Provider>("/providers", p);

// MCP Servers
export const getMcpServers = () => get<{ servers: McpServer[] }>("/mcp-servers");
export const createMcpServer = (s: CreateMcpServerInput) => post<McpServer>("/mcp-servers", s);

// Skills
export const getSkills = () => get<{ skills: Skill[] }>("/skills");
