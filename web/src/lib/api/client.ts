import type { HealthResponse, RunCreateResponse, WorkerResponse, WorkspaceListResponse } from "../types";

async function parseJSON<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchHealth() {
  return parseJSON<HealthResponse>(await fetch("/api/health"));
}

export async function fetchWorkspaces() {
  return parseJSON<WorkspaceListResponse>(await fetch("/api/workspaces"));
}

export async function fetchWorkers() {
  return parseJSON<WorkerResponse>(await fetch("/api/workers"));
}

export async function createRun(payload: { repoPath: string; workerId: string; prompt: string }) {
  return parseJSON<RunCreateResponse>(
    await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}
