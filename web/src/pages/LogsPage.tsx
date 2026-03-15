import { useEffect, useMemo, useState } from "react";
import { getLogs } from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import { Select } from "../components/FormFields";
import LogViewer from "../components/LogViewer";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import { toast } from "../components/Toast";
import type { LogEntry } from "../types";

export default function LogsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");

  useEffect(() => {
    setLoading(true);
    getLogs({
      level: level === "all" ? undefined : level,
      source: source === "all" ? undefined : source,
    })
      .then((data) => setLogs(data.logs ?? []))
      .catch((err: unknown) => {
        toast(err instanceof Error ? err.message : "获取日志失败", "error");
      })
      .finally(() => setLoading(false));
  }, [level, source]);

  const count = useMemo(() => logs.length, [logs.length]);

  return (
    <div className="space-y-4">
      <PageHeader title="日志" description="系统运行与同步日志" />

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_220px_auto]">
          <Select label="级别" value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="all">全部</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </Select>
          <Select label="来源" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">全部</option>
            <option value="daemon">daemon</option>
            <option value="scanner">scanner</option>
            <option value="version">version</option>
            <option value="provider">provider</option>
            <option value="mcp">mcp</option>
            <option value="sync">sync</option>
            <option value="api">api</option>
          </Select>
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={() => {
                setLevel("all");
                setSource("all");
              }}
            >
              清除筛选
            </Button>
          </div>
        </div>
      </Card>

      {loading ? <Spinner /> : <LogViewer logs={logs} autoScroll />}

      <div className="text-xs text-[var(--muted)]">日志总数：{count}</div>
    </div>
  );
}
