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
import type { CliTool, Task } from "../types";
import { cn } from "../lib/utils";
import { useTaskStream } from "../hooks/useTask";

type ActionType = "install" | "upgrade" | "uninstall";

type PendingAction = {
  type: "uninstall";
  tool: CliTool;
};

type TabId = "local" | "remote";

export default function AgentsPage() {
  const [tools, setTools] = useState<CliTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("local");
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const { tasks, getTaskForTarget } = useTaskStream();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 首次加载使用 scan 实时检测，确保状态准确
      const data = await scanCliTools();
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

  // Auto-check remote versions on first load
  useEffect(() => {
    if (!loading && tools.length > 0 && tools.every(t => t.remote_version === null)) {
      void onCheckUpdates();
    }
  }, [loading, tools.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    tasks.forEach((task) => {
      const key = `${task.action}-${task.target}`;
      if (task.status === 'completed' && !completedTasks.has(key)) {
        setCompletedTasks(prev => new Set(prev).add(key));
        toast(`${formatAction(task.action)} ${task.target} 完成`, "success");
        void load();
      }
      if (task.status === 'failed' && !completedTasks.has(key)) {
        setCompletedTasks(prev => new Set(prev).add(key));
        toast(`${formatAction(task.action)} ${task.target} 失败：${task.message ?? '未知错误'}`, "error");
      }
    });
  }, [tasks, completedTasks, load]);

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

  const onDirectAction = async (action: 'install' | 'upgrade', toolName: string) => {
    setError(null);
    try {
      if (action === 'install') {
        await installTool(toolName);
      } else {
        await upgradeTool(toolName);
      }
      toast("任务已提交，后台执行中", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "操作失败", "error");
    }
  };

  const onConfirmAction = async () => {
    if (!pending) return;
    setError(null);

    try {
      await uninstallTool(pending.tool.name);
      toast("任务已提交，后台执行中", "success");
      setPending(null);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "操作失败", "error");
    }
  };

  if (loading) return <div className="text-sm text-[var(--muted)]">加载中...</div>;

  return (
    <div className="space-y-4">
      <PageHeader title="Agent 管理" description="管理本地和远程 AI Agent" />

      <div className="border-b border-[var(--border)]">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setActiveTab("local")}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-0 py-2 text-sm transition-colors",
              activeTab === "local"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            本地 Agent
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("remote")}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-0 py-2 text-sm transition-colors",
              activeTab === "remote"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            远程 Agent
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {activeTab === "local" && (
        <>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => void onRefresh()} disabled={refreshing}>
              {refreshing ? "扫描中..." : "刷新"}
            </Button>
            <Button onClick={() => void onCheckUpdates()} disabled={checking}>
              {checking ? "检查中..." : "检查更新"}
            </Button>
          </div>

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

                    const runningTask = getTaskForTarget(tool.name);

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
                        <td className="max-w-58 truncate px-4 py-3 font-mono text-xs text-[var(--muted)]">{tool.path ?? "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {runningTask ? (
                              <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
                                <Spinner />
                                {formatAction(runningTask.action)}中...
                              </span>
                            ) : (
                              <>
                                {!tool.installed && tool.auto_install ? (
                                  <Button size="sm" onClick={() => void onDirectAction('install', tool.name)}>
                                    安装
                                  </Button>
                                ) : null}
                                {!tool.installed && !tool.auto_install && tool.install_url ? (
                                  <a
                                    href={tool.install_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium bg-[var(--bg-accent)] text-[var(--fg)] hover:opacity-80 transition-opacity"
                                  >
                                    前往下载 ↗
                                  </a>
                                ) : null}
                                {tool.installed && hasUpdate && tool.auto_install ? (
                                  <Button size="sm" onClick={() => void onDirectAction('upgrade', tool.name)}>
                                    升级
                                  </Button>
                                ) : null}
                                {tool.installed && tool.auto_install ? (
                                  <Button size="sm" variant="ghost" onClick={() => setPending({ type: 'uninstall', tool })}>
                                    卸载
                                  </Button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "remote" && <EmptyState message="远程 Agent 管理即将推出，敬请期待。" />}

      <ConfirmDialog
        open={Boolean(pending)}
        title={`卸载 ${pending?.tool.display_name ?? ""}`}
        message={`请确认对 ${pending?.tool.display_name ?? "此工具"} 执行卸载操作。`}
        confirmLabel="卸载"
        variant="danger"
        onCancel={() => setPending(null)}
        onConfirm={() => void onConfirmAction()}
      />
    </div>
  );
}

function formatAction(action: string): string {
  switch (action) {
    case 'install':
      return '安装';
    case 'upgrade':
      return '升级';
    case 'uninstall':
      return '卸载';
    default:
      return action;
  }
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
