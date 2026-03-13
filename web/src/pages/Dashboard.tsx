import { useEffect, useMemo, useState } from "react";
import { getHealth, getMcpServers, getProviders } from "../api";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import useCliTools from "../hooks/useCliTools";

export default function Dashboard() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [providersCount, setProvidersCount] = useState(0);
  const [activeProviderName, setActiveProviderName] = useState<string>("None");
  const [mcpCount, setMcpCount] = useState(0);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const { tools, loading, scanning, error, scan } = useCliTools();

  useEffect(() => {
    let mounted = true;

    getHealth()
      .then(() => mounted && setStatus("online"))
      .catch(() => mounted && setStatus("offline"));

    Promise.all([getProviders(), getMcpServers()])
      .then(([providersData, mcpData]) => {
        if (!mounted) return;
        const providers = providersData.providers ?? [];
        setProvidersCount(providers.length);
        setActiveProviderName(providers.find((provider) => provider.active)?.name ?? "None");
        setMcpCount((mcpData.servers ?? []).length);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setMetaError(err instanceof Error ? err.message : "Failed to load dashboard stats");
      })
      .finally(() => {
        if (!mounted) return;
        setMetaLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const installedCount = useMemo(() => tools.filter((tool) => tool.installed).length, [tools]);

  if (loading || metaLoading) {
    return <Spinner />;
  }

  return (
    <div>
      <PageHeader title="Dashboard">
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
      {metaError ? <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{metaError}</div> : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-zinc-500">CLI Tools</div>
          <div className="mt-1 text-2xl font-semibold">
            {installedCount}/{tools.length}
          </div>
          <div className="text-xs text-zinc-400">Installed / Total</div>
        </Card>

        <Card>
          <div className="text-sm text-zinc-500">Providers</div>
          <div className="mt-1 text-2xl font-semibold">{providersCount}</div>
          <div className="truncate text-xs text-zinc-400" title={activeProviderName}>
            Active: {activeProviderName}
          </div>
        </Card>

        <Card>
          <div className="text-sm text-zinc-500">MCP Servers</div>
          <div className="mt-1 text-2xl font-semibold">{mcpCount}</div>
          <div className="text-xs text-zinc-400">Configured servers</div>
        </Card>

        <Card>
          <div className="text-sm text-zinc-500">Service Health</div>
          <div className="mt-2">
            <StatusBadge
              label={status === "online" ? "Healthy" : status === "offline" ? "Unavailable" : "Checking"}
              variant={status === "online" ? "success" : status === "offline" ? "danger" : "warning"}
            />
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 text-sm font-medium text-zinc-700">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={scan}
            className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700"
          >
            Scan CLI Tools
          </button>
          <button
            disabled
            title="Coming in Phase 1"
            className="rounded bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add Provider
          </button>
          <button
            disabled
            title="Coming in Phase 1"
            className="rounded bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add MCP Server
          </button>
        </div>
      </Card>

      {tools.length === 0 ? <EmptyState message="No CLI tools detected." /> : null}
    </div>
  );
}
