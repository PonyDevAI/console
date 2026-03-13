export type HealthResponse = { ok: boolean };

export type Workspace = {
  id: string;
  name: string;
  repo: { path: string };
  createdAt: string;
  modifiedAt: string;
};

export type WorkspaceListResponse = {
  workspaces: Workspace[];
};

export type Worker = {
  name: string;
  command: string;
  available: boolean;
  path?: string;
};

export type WorkerResponse = {
  scannedAt?: string;
  workers: Worker[];
};

export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export type Run = {
  id: string;
  repoPath: string;
  workerId: string;
  prompt: string;
  status: RunStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  error?: string;
};

export type RunCreateResponse = {
  run: Run;
  streamPath: string;
};

export type RunEvent = {
  type: "state" | "output";
  runId: string;
  status?: RunStatus;
  stream?: "stdout" | "stderr";
  message?: string;
  exitCode?: number;
  timestamp: string;
};

export type OutputLine = {
  stream: "stdout" | "stderr" | "state";
  message: string;
  timestamp: string;
};
