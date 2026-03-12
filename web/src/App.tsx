import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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

export default function App() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workerLoading, setWorkerLoading] = useState(true);

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
      .then((data) => setWorkspaces(data.workspaces ?? []))
      .catch(() => setWorkspaces([]))
      .finally(() => setWorkspaceLoading(false));

    fetch("/api/workers")
      .then((response) => {
        if (!response.ok) {
          throw new Error("worker request failed");
        }
        return response.json() as Promise<WorkerResponse>;
      })
      .then((data) => setWorkers(data.workers ?? []))
      .catch(() => setWorkers([]))
      .finally(() => setWorkerLoading(false));
  }, []);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1>Console (Phase 0)</h1>
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

        <Panel title="Repo Selection Area">
          <EmptyState>Repository picker placeholder</EmptyState>
        </Panel>
        <Panel title="Chat Input Area">
          <EmptyState>Prompt input placeholder</EmptyState>
        </Panel>
        <Panel title="Output Panel Area">
          <EmptyState>Streaming output placeholder</EmptyState>
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
    maxWidth: 1000,
    padding: 24,
  },
  header: {
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
};
