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
      label: "健康状态",
      value: connected ? "1" : "0",
      icon: Activity,
      color: "text-[var(--success)]",
    },
    {
      label: "CLI 工具",
      value: `${installedTools}/${tools.length}`,
      icon: ArrowUpCircle,
      color: "text-[var(--accent)]",
      href: "/versions",
    },
    {
      label: "供应商",
      value: `${providersCount}`,
      icon: Cpu,
      color: "text-[var(--info)]",
      href: "/providers",
    },
    {
      label: "MCP 服务器",
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
      <PageHeader title="仪表盘" description="AI 编程工具总览" />
      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <StatGrid stats={stats} />

      <div className="space-y-2">
        {updateNeeded.length > 0 ? (
          <Callout variant="warning" title="注意">
            {updateNeeded.length} 个工具有可用更新：{updateNeeded.map((tool) => tool.display_name).join(", ")}。
          </Callout>
        ) : null}
        {mcpFailures.length > 0 ? (
          <Callout variant="danger" title="注意">
            {mcpFailures[0].message}
          </Callout>
        ) : null}
      </div>

      <Card header="最近活动">
        {recentLogs.length === 0 ? (
          <EmptyState message="暂无最近活动。" />
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
        <Card header="CLI 工具">
          {tools.length === 0 ? (
            <EmptyState message="未检测到 CLI 工具。" />
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
                    label={tool.installed ? "已安装" : "未安装"}
                    variant={tool.installed ? "success" : "muted"}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card header="快捷操作">
          <div className="space-y-2">
            <Button onClick={scan} disabled={scanning} className="w-full justify-start">
              {scanning ? "扫描中..." : "扫描工具"}
            </Button>
            <Link to="/providers" className="block">
              <Button variant="secondary" className="w-full justify-start">
                管理供应商
              </Button>
            </Link>
            <Link to="/mcp" className="block">
              <Button variant="secondary" className="w-full justify-start">
                管理 MCP 服务器
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
