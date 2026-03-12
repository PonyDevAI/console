import { useEffect, useState, type CSSProperties } from "react";

type HealthResponse = {
  ok: boolean;
};

export default function App() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");

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
  }, []);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1>Console (Phase 0)</h1>
        <p>Backend status: {status}</p>
      </header>

      <section style={styles.grid}>
        <Panel title="Workspace Area">Workspace selector placeholder</Panel>
        <Panel title="Repo Selection Area">Repository selector placeholder</Panel>
        <Panel title="Worker Selection Area">Worker selector placeholder</Panel>
        <Panel title="Chat Input Area">Prompt input placeholder</Panel>
        <Panel title="Output Panel Area">Streaming output placeholder</Panel>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: string }) {
  return (
    <article style={styles.panel}>
      <h2 style={styles.panelTitle}>{title}</h2>
      <p>{children}</p>
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
};
