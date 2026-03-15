import { useCallback, useEffect, useState } from "react";
import {
  checkUpdates,
  getCliTools,
  installTool,
  scanCliTools,
  uninstallTool,
  upgradeTool,
} from "../api";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toast";
import type { CliTool } from "../types";

type ActionType = "install" | "upgrade" | "uninstall";

type PendingAction = {
  type: ActionType;
  tool: CliTool;
};

export default function VersionPage() {
  const [tools, setTools] = useState<CliTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCliTools();
      setTools(data.tools ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载 CLI 工具失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await scanCliTools();
      setTools(data.tools ?? []);
      toast("工具扫描完成", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "扫描工具失败");
    } finally {
      setRefreshing(false);
    }
  };

  const onCheckUpdates = async () => {
    setChecking(true);
    setError(null);
    try {
      const data = await checkUpdates();
      setTools(data.tools ?? []);
      toast("更新检查完成", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "检查更新失败");
    } finally {
      setChecking(false);
    }
  };

  const onConfirmAction = async () => {
    if (!pending) return;
    setSubmitting(true);
    setError(null);

    try {
      if (pending.type === "install") {
        await installTool(pending.tool.name);
        toast(`${pending.tool.display_name} 已安装`, "success");
      }
      if (pending.type === "upgrade") {
        await upgradeTool(pending.tool.name);
        toast(`${pending.tool.display_name} 已升级`, "success");
      }
      if (pending.type === "uninstall") {
        await uninstallTool(pending.tool.name);
        toast(`${pending.tool.display_name} 已卸载`, "success");
      }
      const latest = await getCliTools();
      setTools(latest.tools ?? []);
      setPending(null);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "操作失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-sm text-[var(--muted)]">加载中...</div>;

  return (
    <div className="space-y-4">
      <PageHeader title="版本管理" description="CLI 工具版本和安装状态">
        <Button variant="secondary" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? "扫描中..." : "刷新"}
        </Button>
        <Button onClick={() => void onCheckUpdates()} disabled={checking}>
          {checking ? "检查中..." : "检查更新"}
        </Button>
      </PageHeader>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {tools.length === 0 ? (
        <EmptyState message="未检测到 CLI 工具。" />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-accent)] text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left">工具</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">已安装版本</th>
                <th className="px-4 py-3 text-left">最新版本</th>
                <th className="px-4 py-3 text-left">路径</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const hasUpdate =
                  tool.installed &&
                  tool.local_version &&
                  tool.remote_version &&
                  tool.local_version !== tool.remote_version;

                return (
                  <tr key={tool.name} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-3 text-sm text-[var(--text)]">{tool.display_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={tool.installed ? "已安装" : "未安装"}
                        variant={tool.installed ? "success" : "muted"}
                      />
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-xs ${
                        hasUpdate ? "text-[var(--warning)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {tool.local_version ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{tool.remote_version ?? "-"}</td>
                    <td className="max-w-56 truncate px-4 py-3 font-mono text-xs text-[var(--muted)]">{tool.path ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {!tool.installed ? (
                          <Button size="sm" onClick={() => setPending({ type: "install", tool })}>
                            安装
                          </Button>
                        ) : null}
                        {tool.installed && hasUpdate ? (
                          <Button size="sm" onClick={() => setPending({ type: "upgrade", tool })}>
                            升级
                          </Button>
                        ) : null}
                        {tool.installed ? (
                          <Button size="sm" variant="ghost" onClick={() => setPending({ type: "uninstall", tool })}>
                            卸载
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={`${pending?.type === "install" ? "安装" : pending?.type === "upgrade" ? "升级" : pending?.type === "uninstall" ? "卸载" : "操作"} ${pending?.tool.display_name ?? ""}`}
        message={`请确认对 ${pending?.tool.display_name ?? "此工具"} 执行${pending?.type === "install" ? "安装" : pending?.type === "upgrade" ? "升级" : pending?.type === "uninstall" ? "卸载" : "操作"}。`}
        confirmLabel={pending?.type === "install" ? "安装" : pending?.type === "upgrade" ? "升级" : pending?.type === "uninstall" ? "卸载" : "确认"}
        variant={pending?.type === "uninstall" ? "danger" : "default"}
        loading={submitting}
        onCancel={() => setPending(null)}
        onConfirm={() => void onConfirmAction()}
      />
    </div>
  );
}
