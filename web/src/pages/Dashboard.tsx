import { useEffect, useState } from "react";
import { getHealth } from "../api";
import AppBadgeList from "../components/AppBadgeList";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useCliTools from "../hooks/useCliTools";

export default function Dashboard() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const { tools, loading, scanning, error, scan } = useCliTools();

  useEffect(() => {
    getHealth()
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
      >
        <StatusBadge
          label={status}
          variant={status === "online" ? "success" : status === "offline" ? "danger" : "warning"}
        />
        <button
          onClick={scan}
          disabled={scanning}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {scanning ? "Scanning..." : "Scan CLI Tools"}
        </button>
      </PageHeader>

      {error ? <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {tools.length === 0 ? (
        <EmptyState message="No CLI tools detected. Click Scan CLI Tools." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => (
            <div key={tool.name} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold">{tool.display_name}</span>
                <StatusBadge label={tool.installed ? "Installed" : "Not installed"} variant={tool.installed ? "success" : "muted"} />
              </div>
              <p className="text-sm text-zinc-500">Version: {tool.local_version ?? "-"}</p>
              <p className="truncate text-xs text-zinc-400">{tool.path ?? "-"}</p>
              <AppBadgeList apps={[tool.name]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
