import { Activity, ArrowUpCircle, Cpu, Server } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getHealth, getLogs, getMcpServers, getProviders } from "../api";
import Button from "../components/Button";
import Callout from "../components/Callout";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import PageHeader from "../components/PageHeader";
import StatGrid from "../components/StatGrid";
import StatusBadge from "../components/StatusBadge";
import type { LogEntry } from "../types";
import useCliTools from "../hooks/useCliTools";

export default function Dashboard() {
  const { tools, loading, scanning, error, scan } = useCliTools();
  const [providersCount, setProvidersCount] = useState(0);
  const [mcpCount, setMcpCount] = useState(0);
  const [connected, setConnected] = useState(true);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([getHealth(), getProviders(), getMcpServers(), getLogs({ limit: 5 })])
      .then(([_, providersData, mcpData, logData]) => {
        if (!mounted) return;
        setConnected(true);
        setProvidersCount(providersData.providers?.length ?? 0);
        setMcpCount(mcpData.servers?.length ?? 0);
        setRecentLogs(logData.logs ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setConnected(false);
      })
      .finally(() => {
        if (!mounted) return;
        setMetaLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const installedTools = useMemo(() => tools.filter((tool) => tool.installed).length, [tools]);

  const stats = [
    {
      label: "Health",
      value: connected ? "1" : "0",
      icon: Activity,
      color: "text-[var(--success)]",
    },
    {
      label: "CLI Tools",
      value: `${installedTools}/${tools.length}`,
      icon: ArrowUpCircle,
      color: "text-[var(--accent)]",
      href: "/versions",
    },
    {
      label: "Providers",
      value: `${providersCount}`,
      icon: Cpu,
      color: "text-[var(--info)]",
      href: "/providers",
    },
    {
      label: "MCP Servers",
      value: `${mcpCount}`,
      icon: Server,
      color: "text-[var(--warning)]",
      href: "/mcp",
    },
  ];

  const updateNeeded = tools.filter(
    (tool) =>
      tool.installed &&
      tool.local_version &&
      tool.remote_version &&
      tool.local_version !== tool.remote_version,
  );
  const mcpFailures = recentLogs.filter((entry) => entry.level === "error" && entry.source === "mcp");

  if (loading || metaLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="概览" description="系统状态、入口点和快速操作。" />
      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <StatGrid stats={stats} />

      <div className="space-y-2">
        {updateNeeded.length > 0 ? (
          <Callout variant="warning" title="Attention">
            {updateNeeded.length} tool(s) have updates available: {updateNeeded.map((tool) => tool.display_name).join(", ")}.
          </Callout>
        ) : null}
        {mcpFailures.length > 0 ? (
          <Callout variant="danger" title="Attention">
            {mcpFailures[0].message}
          </Callout>
        ) : null}
      </div>

      <Card header="Recent Activity">
        {recentLogs.length === 0 ? (
          <EmptyState message="No recent activity." />
        ) : (
          <div className="space-y-2">
            {recentLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2"
              >
                <div className="min-w-0 flex-1 text-sm text-[var(--text)]">
                  <span className="mr-2 text-xs text-[var(--muted)]">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span className="truncate">{entry.message}</span>
                </div>
                <StatusBadge
                  label={entry.level.toUpperCase()}
                  variant={entry.level === "error" ? "danger" : entry.level === "warn" ? "warning" : "info"}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card header="CLI Tools">
          {tools.length === 0 ? (
            <EmptyState message="No CLI tools detected." />
          ) : (
            <div className="space-y-2">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2"
                >
                  <div>
                    <div className="text-sm text-[var(--text-strong)]">{tool.display_name}</div>
                    <div className="text-xs text-[var(--muted)]">v{tool.local_version ?? "-"}</div>
                  </div>
                  <StatusBadge
                    label={tool.installed ? "Installed" : "Missing"}
                    variant={tool.installed ? "success" : "muted"}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card header="Quick Actions">
          <div className="space-y-2">
            <Button onClick={scan} disabled={scanning} className="w-full justify-start">
              {scanning ? "Scanning..." : "Scan Tools"}
            </Button>
            <Link to="/providers" className="block">
              <Button variant="secondary" className="w-full justify-start">
                View Providers
              </Button>
            </Link>
            <Link to="/mcp" className="block">
              <Button variant="secondary" className="w-full justify-start">
                View MCP Servers
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
