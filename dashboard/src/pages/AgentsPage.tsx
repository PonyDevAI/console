import React, { useCallback, useEffect, useState } from "react";
import {
  checkRemoteVersion,
  getCliTools,
  installTool,
  scanCliTools,
  uninstallTool,
  upgradeTool,
  getRemoteAgents,
  addRemoteAgent,
  updateRemoteAgent,
  deleteRemoteAgent,
  pingRemoteAgent,
  pingAllRemoteAgents,
  getRemoteAgentDetail,
} from "../api";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toast";
import type { CliTool, OpenClawDetail, RemoteAgent, RemoteAgentDetail, Task } from "../types";
import { cn } from "../lib/utils";
import { useTaskStream } from "../hooks/useTask";

type ActionType = "install" | "upgrade" | "uninstall";

type PendingAction = {
  type: "uninstall";
  tool: CliTool;
};

type TabId = "local" | "openclaw";

interface RemoteAgentForm {
  name: string;
  display_name: string;
  endpoint: string;
  api_key: string;
  tags: string;
}

export default function AgentsPage() {
  const [tools, setTools] = useState<CliTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState<string | null>(null); // 正在检测的工具名
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("local");
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const [remoteAgents, setRemoteAgents] = useState<RemoteAgent[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<RemoteAgent | null>(null);
  const [pinging, setPinging] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<RemoteAgentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { tasks, getTaskForTarget } = useTaskStream();

  // 单个工具检测远程版本
  const onCheckSingle = async (toolName: string) => {
    setChecking(toolName);
    try {
      const result = await checkRemoteVersion(toolName);
      setTools(prev =>
        prev.map(t =>
          t.name === result.name
            ? { ...t, remote_version: result.remote_version ?? "-" }
            : t
        )
      );
    } catch {
      setTools(prev =>
        prev.map(t =>
          t.name === toolName && !t.remote_version
            ? { ...t, remote_version: "-" }
            : t
        )
      );
    } finally {
      setChecking(null);
    }
  };

  // 首次加载：读缓存（瞬间）→ 后台 scan 安装状态（不查远程版本）
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. 先读缓存，瞬间显示（包含上次保存的 remote_version）
      const cached = await getCliTools();
      const cachedTools = cached.tools ?? [];
      if (cachedTools.length > 0) {
        setTools(cachedTools);
        setLoading(false);
        // 2. 后台 scan 刷新安装状态，保留缓存的 remote_version
        scanCliTools().then(data => {
          const freshTools = data.tools ?? [];
          if (freshTools.length > 0) {
            setTools(prev =>
              freshTools.map(ft => {
                const cached = prev.find(p => p.name === ft.name);
                return { ...ft, remote_version: cached?.remote_version ?? ft.remote_version };
              })
            );
          }
        }).catch(() => {});
      } else {
        // 无缓存，等 scan 完成
        const data = await scanCliTools();
        setTools(data.tools ?? []);
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载 CLI 工具失败");
      setLoading(false);
    }
  }, []);

  // 静默刷新：任务完成后刷新安装状态，保留 remote_version
  const silentReload = useCallback(async () => {
    try {
      const data = await scanCliTools();
      const freshTools = data.tools ?? [];
      setTools(prev =>
        freshTools.map(ft => {
          const cached = prev.find(p => p.name === ft.name);
          return { ...ft, remote_version: cached?.remote_version ?? ft.remote_version };
        })
      );
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    tasks.forEach((task) => {
      const key = `${task.action}-${task.target}`;
      if (task.status === 'completed' && !completedTasks.has(key)) {
        setCompletedTasks(prev => new Set(prev).add(key));
        toast(`${formatAction(task.action)} ${task.target} 完成`, "success");
        void silentReload();
      }
      if (task.status === 'failed' && !completedTasks.has(key)) {
        setCompletedTasks(prev => new Set(prev).add(key));
        toast(`${formatAction(task.action)} ${task.target} 失败：${task.message ?? '未知错误'}`, "error");
      }
    });
  }, [tasks, completedTasks, silentReload]);

  const loadRemoteAgents = useCallback(async () => {
    setRemoteLoading(true);
    try {
      const data = await getRemoteAgents();
      setRemoteAgents(data.agents ?? []);
      const pinged = await pingAllRemoteAgents();
      setRemoteAgents(pinged.agents ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "加载 OpenClaw 失败", "error");
    } finally {
      setRemoteLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRemoteAgents();
  }, [loadRemoteAgents]);

  // 刷新：只 scan 安装状态，保留已有的 remote_version
  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await scanCliTools();
      const freshTools = data.tools ?? [];
      setTools(prev =>
        freshTools.map(ft => {
          const cached = prev.find(p => p.name === ft.name);
          return { ...ft, remote_version: cached?.remote_version ?? ft.remote_version };
        })
      );
      toast("刷新完成", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setRefreshing(false);
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

  const handleAddRemoteAgent = async (formData: RemoteAgentForm) => {
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      await addRemoteAgent({
        name: formData.name,
        display_name: formData.display_name,
        endpoint: formData.endpoint,
        api_key: formData.api_key || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      toast("OpenClaw 添加成功", "success");
      setShowAddDialog(false);
      void loadRemoteAgents();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "添加失败", "error");
    }
  };

  const handleUpdateRemoteAgent = async (id: string, formData: RemoteAgentForm) => {
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      await updateRemoteAgent(id, {
        display_name: formData.display_name,
        endpoint: formData.endpoint,
        api_key: formData.api_key || undefined,
        tags,
      });
      toast("OpenClaw 更新成功", "success");
      setEditingAgent(null);
      void loadRemoteAgents();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "更新失败", "error");
    }
  };

  const handleDeleteRemoteAgent = async (id: string) => {
    try {
      await deleteRemoteAgent(id);
      toast("OpenClaw 已删除", "success");
      void loadRemoteAgents();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
    }
  };

  const handlePingAgent = async (id: string) => {
    setPinging(id);
    try {
      const agent = await pingRemoteAgent(id);
      toast(`${agent.display_name} 状态：${agent.status}`, agent.status === 'online' ? "success" : "error");
      void loadRemoteAgents();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "检测失败", "error");
    } finally {
      setPinging(null);
    }
  };

  const onToggleDetail = async (agent: RemoteAgent) => {
    if (expandedAgent === agent.id) {
      setExpandedAgent(null);
      setAgentDetail(null);
      return;
    }
    setExpandedAgent(agent.id);
    setDetailLoading(true);
    try {
      const detail = await getRemoteAgentDetail(agent.id);
      setAgentDetail(detail);
    } catch {
      toast("获取详情失败", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getLatencyColor = (latencyMs: number | null | undefined) => {
    if (latencyMs == null) return 'text-[var(--muted)]';
    if (latencyMs < 200) return 'text-green-500';
    if (latencyMs <= 500) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="h-5 w-5 text-[var(--accent)]" />
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Agent 管理" description="管理本地和远程 AI Agent" />

      <div className="border-b border-[var(--border)]">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => setActiveTab("local")}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-0 py-2 text-sm transition-colors cursor-pointer",
              activeTab === "local"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            本地 Agent
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("openclaw")}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-0 py-2 text-sm transition-colors cursor-pointer",
              activeTab === "openclaw"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            OpenClaw
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
              {refreshing ? "刷新中..." : "刷新"}
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
                    // Extract bare version number (e.g. "codex-cli 0.115.0" → "0.115.0")
                    const normalizeVersion = (v: string | null) =>
                      v?.match(/\d+\.\d+[\w.-]*/)?.[0] ?? v;
                    const localVer = normalizeVersion(tool.local_version);
                    const remoteVer = normalizeVersion(tool.remote_version);
                    const hasUpdate =
                      tool.installed &&
                      localVer &&
                      remoteVer &&
                      tool.remote_version !== "-" &&
                      localVer !== remoteVer;

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
                        <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                          {checking === tool.name ? <Spinner className="h-3 w-3 text-[var(--accent)]" /> : (tool.remote_version ?? "-")}
                        </td>
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
                                {/* 未安装 → 安装 */}
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
                                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium bg-[var(--bg-accent)] text-[var(--fg)] hover:opacity-80 transition-opacity cursor-pointer"
                                  >
                                    前往下载 ↗
                                  </a>
                                ) : null}
                                {/* 已安装 + 有新版本 → 升级 */}
                                {tool.installed && hasUpdate && tool.auto_install ? (
                                  <Button size="sm" onClick={() => void onDirectAction('upgrade', tool.name)}>
                                    升级
                                  </Button>
                                ) : null}
                                {/* 已安装 → 检测（查远程版本） */}
                                {tool.installed ? (
                                  <Button size="sm" variant="secondary" onClick={() => void onCheckSingle(tool.name)} disabled={checking === tool.name}>
                                    {checking === tool.name ? "检测中..." : "检测"}
                                  </Button>
                                ) : null}
                                {/* 已安装 → 卸载 */}
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

      {activeTab === "openclaw" && (
        <>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => void loadRemoteAgents()} disabled={remoteLoading}>
              {remoteLoading ? "刷新中..." : "刷新"}
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              添加 OpenClaw
            </Button>
          </div>

          {remoteAgents.length === 0 ? (
            <EmptyState message="暂无 OpenClaw 实例，点击添加" />
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-accent)] text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left">名称</th>
                    <th className="px-4 py-3 text-left">Endpoint</th>
                    <th className="px-4 py-3 text-left">状态</th>
                    <th className="px-4 py-3 text-left">延迟</th>
                    <th className="px-4 py-3 text-left">版本</th>
                    <th className="px-4 py-3 text-left">最后检测</th>
                    <th className="px-4 py-3 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {remoteAgents.map((agent) => {
                    const isExpanded = expandedAgent === agent.id;
                    return (
                      <React.Fragment key={agent.id}>
                        <tr
                          key={agent.id}
                          className={cn(
                            "border-b border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer",
                            isExpanded && "bg-[var(--bg-hover)]",
                          )}
                          onClick={() => void onToggleDetail(agent)}
                        >
                          <td className="px-4 py-3 text-sm text-[var(--text)]">
                            <div className="font-medium">{agent.display_name}</div>
                            {agent.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {agent.tags.map((tag, i) => (
                                  <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-[var(--bg-accent)] rounded text-[var(--muted)]">
                                    {tag}
                                    <button
                                      type="button"
                                      className="ml-0.5 hover:text-[var(--text)] transition-colors cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newTags = agent.tags.filter((_, idx) => idx !== i);
                                        void updateRemoteAgent(agent.id, { tags: newTags }).then(() => void loadRemoteAgents());
                                      }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{agent.endpoint}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                              <span className="text-[var(--muted)] capitalize">{agent.status}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-3 font-mono text-xs ${getLatencyColor(agent.latency_ms)}`}>
                            {agent.latency_ms != null ? `${agent.latency_ms}ms` : '-'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{agent.version ?? "-"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                            {agent.last_ping ? formatTimeAgo(agent.last_ping) : "-"}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={pinging === agent.id}
                                onClick={() => void handlePingAgent(agent.id)}
                              >
                                {pinging === agent.id ? "检测中..." : "检测"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingAgent(agent)}
                              >
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleDeleteRemoteAgent(agent.id)}
                              >
                                删除
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="px-4 py-4 border-b border-[var(--border)]">
                              {detailLoading ? (
                                <div className="flex justify-center py-6">
                                  <Spinner className="h-5 w-5 text-[var(--accent)]" />
                                </div>
                              ) : (
                                <div className="bg-[var(--bg-accent)] rounded-md p-4 border-t border-[var(--border)]">
                                  <div className="grid grid-cols-2 gap-6">
                                    <div>
                                      <h4 className="text-sm font-semibold text-[var(--text)] mb-3">基础信息</h4>
                                      <div className="space-y-2">
                                        <div>
                                          <div className="text-xs text-[var(--muted)]">Endpoint</div>
                                          <div className="text-sm text-[var(--text)] font-mono">{agentDetail?.endpoint}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-[var(--muted)]">状态</div>
                                          <div className="text-sm text-[var(--text)] flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${getStatusColor(agentDetail?.status || 'unknown')}`} />
                                            <span className="capitalize">{agentDetail?.status}</span>
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-[var(--muted)]">版本</div>
                                          <div className="text-sm text-[var(--text)] font-mono">{agentDetail?.version ?? "-"}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-[var(--muted)]">延迟</div>
                                          <div className={`text-sm font-mono ${getLatencyColor(agentDetail?.latency_ms)}`}>
                                            {agentDetail?.latency_ms != null ? `${agentDetail.latency_ms}ms` : '-'}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-[var(--muted)]">最后检测</div>
                                          <div className="text-sm text-[var(--text)]">
                                            {agentDetail?.last_ping ? formatTimeAgo(agentDetail.last_ping) : '-'}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-[var(--muted)]">标签</div>
                                          <div className="text-sm text-[var(--text)] flex gap-1 mt-1">
                                            {agentDetail?.tags && agentDetail.tags.length > 0 ? (
                                              agentDetail.tags.map((tag, i) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-hover)] rounded">
                                                  {tag}
                                                </span>
                                              ))
                                            ) : (
                                              <span className="text-[var(--muted)]">-</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-semibold text-[var(--text)] mb-3">Agent 信息</h4>
                                      {agentDetail?.detail ? (
                                        <div className="space-y-2">
                                          <div>
                                            <div className="text-xs text-[var(--muted)]">名称</div>
                                            <div className="text-sm text-[var(--text)]">{agentDetail.detail.assistant_name}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs text-[var(--muted)]">头像</div>
                                            <div className="text-sm text-[var(--text)]">{agentDetail.detail.assistant_avatar}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs text-[var(--muted)]">Agent ID</div>
                                            <div className="text-sm text-[var(--text)] font-mono">{agentDetail.detail.assistant_agent_id}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs text-[var(--muted)]">服务端版本</div>
                                            <div className="text-sm text-[var(--text)] font-mono">{agentDetail.detail.server_version}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs text-[var(--muted)]">Base Path</div>
                                            <div className="text-sm text-[var(--text)] font-mono">{agentDetail.detail.base_path || '-'}</div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-sm text-[var(--muted)]">无法获取详细信息</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={`卸载 ${pending?.tool.display_name ?? ""}`}
        message={`请确认对 ${pending?.tool.display_name ?? "此工具"} 执行卸载操作。`}
        confirmLabel="卸载"
        variant="danger"
        onCancel={() => setPending(null)}
        onConfirm={() => void onConfirmAction()}
      />

      {showAddDialog && (
        <RemoteAgentDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSubmit={handleAddRemoteAgent}
        />
      )}

      {editingAgent && (
        <RemoteAgentDialog
          open={Boolean(editingAgent)}
          onClose={() => setEditingAgent(null)}
          onSubmit={(data) => void handleUpdateRemoteAgent(editingAgent.id, data)}
          initialData={{
            name: editingAgent.name,
            display_name: editingAgent.display_name,
            endpoint: editingAgent.endpoint,
            api_key: editingAgent.api_key ?? "",
            tags: editingAgent.tags.join(", "),
          }}
        />
      )}
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

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}天前`;
  if (diffHours > 0) return `${diffHours}小时前`;
  if (diffMins > 0) return `${diffMins}分钟前`;
  return "刚刚";
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

interface RemoteAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RemoteAgentForm) => void;
  initialData?: RemoteAgentForm;
}

function RemoteAgentDialog({ open, onClose, onSubmit, initialData }: RemoteAgentDialogProps) {
  const [formData, setFormData] = useState<RemoteAgentForm>({
    name: "",
    display_name: "",
    endpoint: "",
    api_key: "",
    tags: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.display_name || !formData.endpoint) {
      toast("请填写必填字段", "error");
      return;
    }
    onSubmit(formData);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--card)] rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--text)]">
            {initialData ? "编辑 OpenClaw" : "添加 OpenClaw"}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              名称 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="如：openclaw"
              disabled={!!initialData}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              显示名称 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="如：OpenClaw"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              Endpoint URL <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="url"
              value={formData.endpoint}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="如：https://openclaw.example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              API Key <span className="text-xs text-[var(--muted)]">(可选)</span>
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="API 密钥"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              标签 <span className="text-xs text-[var(--muted)]">(可选，逗号分隔)</span>
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="如：ai, assistant, remote"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">
              {initialData ? "保存" : "添加"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
