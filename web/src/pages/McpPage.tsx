import { useEffect, useState } from "react";
import { getMcpServers } from "../api";
import AppBadgeList from "../components/AppBadgeList";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import type { McpServer } from "../types";

export default function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMcpServers()
      .then((data) => setServers(data.servers ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load MCP servers");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="MCP Servers">
        <button
          disabled
          title="Coming soon"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sync All
        </button>
        <button
          disabled
          title="Coming soon"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add Server
        </button>
      </PageHeader>

      {error ? <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {servers.length === 0 ? (
        <EmptyState message="No MCP servers configured." />
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <div key={server.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{server.name}</span>
                    <StatusBadge label={server.transport} variant="purple" />
                  </div>
                  {server.command ? (
                    <p className="mt-1 font-mono text-sm text-zinc-500">
                      {server.command} {server.args.join(" ")}
                    </p>
                  ) : null}
                  {server.url ? <p className="mt-1 font-mono text-sm text-zinc-500">{server.url}</p> : null}
                  <AppBadgeList apps={server.enabled_apps} />
                </div>
                <div className="flex gap-2">
                  <button disabled title="Coming soon" className="rounded bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60">Edit</button>
                  <button disabled title="Coming soon" className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-60">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
