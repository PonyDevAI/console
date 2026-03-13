import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

type HealthResponse = {
  ok: boolean;
};

type Workspace = {
  id: string;
  name: string;
  repoPath: string;
  createdAt: string;
  modifiedAt: string;
};

type WorkspaceListResponse = {
  workspaces: Workspace[];
};

type Worker = {
  name: string;
  command: string;
  available: boolean;
  path?: string;
};

type WorkerResponse = {
  scannedAt?: string;
  workers: Worker[];
};

type RunStatus = "queued" | "running" | "succeeded" | "failed";

type Run = {
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

type RunCreateResponse = {
  run: Run;
  streamPath: string;
};

type RunEvent = {
  type: "state" | "output";
  runId: string;
  status?: RunStatus;
  stream?: "stdout" | "stderr";
  message?: string;
  exitCode?: number;
  timestamp: string;
};

type OutputLine = {
  stream: "stdout" | "stderr" | "state";
  message: string;
  timestamp: string;
};

const defaultWorkerId = "codex";

export default function App() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workerLoading, setWorkerLoading] = useState(true);

  const [repoPath, setRepoPath] = useState("");
  const [workerId, setWorkerId] = useState(defaultWorkerId);
  const [prompt, setPrompt] = useState("");

  const [run, setRun] = useState<Run | null>(null);
  const [runOutput, setRunOutput] = useState<OutputLine[]>([]);
  const [runError, setRunError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("health request failed");
        }
        return response.json() as Promise<HealthResponse>;
      })
      .then((data) => setStatus(data.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));

    fetch("/api/workspaces")
      .then((response) => {
        if (!response.ok) {
          throw new Error("workspace request failed");
        }
        return response.json() as Promise<WorkspaceListResponse>;
      })
      .then((data) => {
        const list = data.workspaces ?? [];
        setWorkspaces(list);
        if (list.length > 0) {
          setRepoPath((current) => current || list[0].repoPath);
        }
      })
      .catch(() => setWorkspaces([]))
      .finally(() => setWorkspaceLoading(false));

    fetch("/api/workers")
      .then((response) => {
        if (!response.ok) {
          throw new Error("worker request failed");
        }
        return response.json() as Promise<WorkerResponse>;
      })
      .then((data) => {
        const list = data.workers ?? [];
        setWorkers(list);
        const firstAvailable = list.find((item) => item.available)?.name;
        if (firstAvailable) {
          setWorkerId(firstAvailable);
        }
      })
      .catch(() => setWorkers([]))
      .finally(() => setWorkerLoading(false));
  }, []);

  const availableWorkers = useMemo(() => workers.filter((item) => item.available), [workers]);

  useEffect(() => {
    if (!run) {
      return;
    }

    const eventSource = new EventSource(`/api/runs/${run.id}/stream`);
    eventSource.onmessage = (message) => {
      const event = JSON.parse(message.data) as RunEvent;
      if (event.type === "state") {
        if (event.status) {
          const nextStatus = event.status;
          setRun((current) =>
            current && current.id === run.id && nextStatus ? { ...current, status: nextStatus } : current,
          );
          setRunOutput((current) => [
            ...current,
            { stream: "state", message: `Run state -> ${event.status}`, timestamp: event.timestamp },
          ]);
        }
        if (event.exitCode !== undefined) {
          setRun((current) => (current && current.id === run.id ? { ...current, exitCode: event.exitCode } : current));
        }
        if (event.message) {
          setRun((current) => (current && current.id === run.id ? { ...current, error: event.message } : current));
          setRunOutput((current) => [
            ...current,
            { stream: "state", message: `Run error: ${event.message}`, timestamp: event.timestamp },
          ]);
        }
      }

      if (event.type === "output") {
        setRunOutput((current) => [
          ...current,
          {
            stream: event.stream ?? "stdout",
            message: event.message ?? "",
            timestamp: event.timestamp,
          },
        ]);
      }

      if (event.status === "succeeded" || event.status === "failed") {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [run?.id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRunError("");
    setIsSubmitting(true);
    setRunOutput([]);
    setRun(null);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath,
          workerId,
          prompt,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "run creation failed");
      }

      const payload = (await response.json()) as RunCreateResponse;
      setRun(payload.run);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "run creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1>Console</h1>
        <p>Backend status: {status}</p>
      </header>

      <section style={styles.grid}>
        <Panel title="Workspaces">
          {workspaceLoading ? (
            <EmptyState>Loading workspaces...</EmptyState>
          ) : workspaces.length === 0 ? (
            <EmptyState>No workspaces yet. Add one from the backend API.</EmptyState>
          ) : (
            <ul style={styles.list}>
              {workspaces.map((workspace) => (
                <li key={workspace.id} style={styles.item}>
                  <strong>{workspace.name}</strong>
                  <code style={styles.code}>{workspace.repoPath}</code>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Workers">
          {workerLoading ? (
            <EmptyState>Loading workers...</EmptyState>
          ) : workers.length === 0 ? (
            <EmptyState>No workers found. Run a worker scan to populate this list.</EmptyState>
          ) : (
            <ul style={styles.list}>
              {workers.map((worker) => (
                <li key={worker.name} style={styles.item}>
                  <strong>{worker.name}</strong> — {worker.available ? "available" : "missing"}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Run prompt">
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Workspace repo quick-select
              <select
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                style={styles.select}
                disabled={workspaces.length === 0}
              >
                {workspaces.length === 0 ? (
                  <option value="">No workspaces available</option>
                ) : (
                  workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.repoPath}>
                      {workspace.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label style={styles.label}>
              Repo path (manual override)
              <input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} style={styles.input} required />
            </label>

            <label style={styles.label}>
              Worker
              <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} style={styles.select} required>
                {availableWorkers.length === 0 ? (
                  <option value="">No available workers</option>
                ) : (
                  availableWorkers.map((worker) => (
                    <option key={worker.name} value={worker.name}>
                      {worker.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label style={styles.label}>
              Prompt
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={styles.textarea} required />
            </label>

            <button type="submit" style={styles.button} disabled={isSubmitting || availableWorkers.length === 0}>
              {isSubmitting ? "Starting run..." : "Run"}
            </button>

            {runError && <p style={styles.error}>Run error: {runError}</p>}
          </form>
        </Panel>

        <Panel title="Run output (SSE)">
          {run ? (
            <>
              <p style={styles.meta}>
                Run {run.id} — <strong>{run.status}</strong>
                {run.exitCode !== undefined ? ` (exit ${run.exitCode})` : ""}
              </p>
              {run.error ? <p style={styles.error}>Error: {run.error}</p> : null}
            </>
          ) : (
            <EmptyState>No run started in this browser session.</EmptyState>
          )}

          <div style={styles.outputPanel}>
            {runOutput.length === 0 ? (
              <EmptyState>No streamed output yet.</EmptyState>
            ) : (
              runOutput.map((line, index) => (
                <p key={`${line.timestamp}-${index}`} style={line.stream === "stderr" ? styles.stderrLine : styles.outputLine}>
                  <span style={styles.dim}>{line.timestamp}</span> [{line.stream}] {line.message}
                </p>
              ))
            )}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p style={styles.empty}>{children}</p>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article style={styles.panel}>
      <h2 style={styles.panelTitle}>{title}</h2>
      {children}
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    fontFamily: "Inter, system-ui, sans-serif",
    margin: "0 auto",
    maxWidth: 1100,
    padding: 24,
  },
  header: {
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  },
  panel: {
    border: "1px solid #d4d4d8",
    borderRadius: 8,
    minHeight: 120,
    padding: 12,
  },
  panelTitle: {
    fontSize: 16,
    margin: "0 0 8px",
  },
  empty: {
    color: "#52525b",
    margin: 0,
  },
  list: {
    display: "grid",
    gap: 8,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  item: {
    border: "1px solid #e4e4e7",
    borderRadius: 6,
    display: "grid",
    gap: 4,
    padding: 8,
  },
  code: {
    background: "#f4f4f5",
    borderRadius: 4,
    display: "inline-block",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    padding: "2px 4px",
  },
  form: {
    display: "grid",
    gap: 10,
  },
  label: {
    display: "grid",
    fontSize: 14,
    gap: 4,
  },
  input: {
    border: "1px solid #d4d4d8",
    borderRadius: 6,
    padding: 8,
  },
  select: {
    border: "1px solid #d4d4d8",
    borderRadius: 6,
    padding: 8,
  },
  textarea: {
    border: "1px solid #d4d4d8",
    borderRadius: 6,
    minHeight: 100,
    padding: 8,
  },
  button: {
    background: "#18181b",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    padding: "10px 12px",
  },
  error: {
    color: "#b91c1c",
    margin: 0,
  },
  meta: {
    marginTop: 0,
  },
  outputPanel: {
    background: "#09090b",
    borderRadius: 6,
    color: "#f4f4f5",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    marginTop: 8,
    maxHeight: 280,
    overflow: "auto",
    padding: 8,
  },
  outputLine: {
    margin: "0 0 4px",
    whiteSpace: "pre-wrap",
  },
  stderrLine: {
    color: "#fca5a5",
    margin: "0 0 4px",
    whiteSpace: "pre-wrap",
  },
  dim: {
    color: "#a1a1aa",
  },
};
