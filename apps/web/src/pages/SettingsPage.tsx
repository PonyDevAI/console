import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { Box, Cloud, Server, Wrench, FileText, Repeat, ScrollText, Users, Bot, RefreshCw, Download, Trash2, Play, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import useAgentSources from "../hooks/useAgentSources";
import useEmployees from "../hooks/useEmployees";
import useAgents from "../hooks/useAgents";
import type { AgentSource, Agent, Employee, RemoteAgent } from "../types";

type SettingsSection = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const sections: SettingsSection[] = [
  { id: "agent-sources", label: "Agent 管理", icon: <Bot className="h-4 w-4" /> },
  { id: "employees", label: "员工管理", icon: <Users className="h-4 w-4" /> },
  { id: "providers", label: "Provider 管理", icon: <Cloud className="h-4 w-4" /> },
  { id: "mcp", label: "MCP Servers", icon: <Server className="h-4 w-4" /> },
  { id: "skills", label: "Skills", icon: <Wrench className="h-4 w-4" /> },
  { id: "prompts", label: "系统提示词", icon: <FileText className="h-4 w-4" /> },
  { id: "sync", label: "配置同步", icon: <Repeat className="h-4 w-4" /> },
  { id: "logs", label: "日志 / 调试", icon: <ScrollText className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("agent-sources");

  return (
    <div className="flex h-full overflow-hidden bg-[var(--bg-elevated)]">
      <div className="w-52 shrink-0 border-r border-gray-100 bg-gray-50/50 p-3">
        <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          设置
        </div>
        <nav className="space-y-0.5">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors",
                activeSection === section.id
                  ? "bg-white text-gray-900"
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900",
              )}
            >
              <span className={cn(activeSection === section.id ? "text-gray-900" : "text-gray-500")}>
                {section.icon}
              </span>
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {sections.find((s) => s.id === activeSection)?.label}
            </h1>
            <p className="mt-1 text-[13px] text-gray-500">
              管理 CloudCode 的{sections.find((s) => s.id === activeSection)?.label.toLowerCase()}配置
            </p>
          </div>

          <div className="space-y-4">
            {activeSection === "agent-sources" && <AgentSourcesSection />}
            {activeSection === "employees" && <EmployeesSection />}
            {activeSection === "providers" && <ProvidersSection />}
            {activeSection === "mcp" && <McpSection />}
            {activeSection === "skills" && <SkillsSection />}
            {activeSection === "prompts" && <PromptsSection />}
            {activeSection === "sync" && <SyncSection />}
            {activeSection === "logs" && <LogsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentSourcesSection() {
  const { sources, loading, scanning, error, scan, install, upgrade, uninstall, test, createSource, updateSource, deleteSource } = useAgentSources();
  const [activeTab, setActiveTab] = useState<"local" | "openclaw">("local");
  const [showOpenClawModal, setShowOpenClawModal] = useState(false);
  const [editingOpenClaw, setEditingOpenClaw] = useState<AgentSource | null>(null);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const localSources = sources.filter(s => s.source_type === "local_cli");
  const openClawSources = sources.filter(s => s.source_type === "remote_open_claw_ws");
  const filteredSources = activeTab === "local" ? localSources : openClawSources;

  useEffect(() => {
    if (activeTab === "local" && !loading) {
      scan();
    }
  }, [activeTab, loading]);

  const handlePing = async (id: string) => {
    setPingingId(id);
    try {
      await test(id);
      await scan();
    } finally {
      setPingingId(null);
    }
  };

  const handleEditOpenClaw = (source: AgentSource) => {
    setEditingOpenClaw(source);
    setShowOpenClawModal(true);
  };

  const handleDeleteOpenClaw = async (id: string) => {
    if (confirm("确定要删除这个 OpenClaw Source 吗？")) {
      await deleteSource(id);
      await scan();
    }
  };

  const handleOpenClawSubmit = async (data: {
    name: string;
    display_name: string;
    endpoint: string;
    api_key?: string;
    origin?: string;
    tags?: string[];
  }) => {
    if (editingOpenClaw) {
      await updateSource(editingOpenClaw.id, {
        display_name: data.display_name,
        endpoint: data.endpoint,
        api_key: data.api_key,
        origin: data.origin,
      });
    } else {
      await createSource({
        name: data.name || data.display_name.toLowerCase().replace(/\s+/g, "-"),
        display_name: data.display_name,
        source_type: 'remote_openclaw_ws',
        endpoint: data.endpoint,
        api_key: data.api_key,
        origin: data.origin,
      });
    }
    await scan();
    setShowOpenClawModal(false);
    setEditingOpenClaw(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-gray-500">加载中...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-gray-600">
          Agent Source 管理 - 展示本地 CLI 和远程 Agent 来源
        </div>
        <div className="flex gap-2">
          {activeTab === "local" && (
            <button
              onClick={() => scan()}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />
              {scanning ? "扫描中..." : "全量扫描"}
            </button>
          )}
          {activeTab === "openclaw" && (
            <button
              onClick={() => {
                setEditingOpenClaw(null);
                setShowOpenClawModal(true);
              }}
              className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-green-700"
            >
              <Download className="h-3.5 w-3.5" />
              添加 OpenClaw
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-gray-100">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("local")}
            className={cn(
              "border-b-2 py-3 text-[13px] font-medium",
              activeTab === "local"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            本地 Agent ({localSources.length})
          </button>
          <button
            onClick={() => setActiveTab("openclaw")}
            className={cn(
              "border-b-2 py-3 text-[13px] font-medium",
              activeTab === "openclaw"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            OpenClaw ({openClawSources.length})
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">名称</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">状态</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">版本</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">端点</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {activeTab === "local" ? (
              filteredSources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    未检测到本地 Agent。点击"全量扫描"检测已安装的工具。
                  </td>
                </tr>
              ) : (
                filteredSources.map((source) => (
                  <tr key={source.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{source.display_name}</div>
                      <div className="text-[11px] text-gray-500">{source.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge installed={source.installed} healthy={source.healthy} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">
                        {source.local_version || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[250px] truncate text-[12px] text-gray-500" title={source.path || ""}>
                        {source.path || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {!source.installed ? (
                          <button
                            onClick={() => install(source.id)}
                            disabled={!source.supports_auto_install}
                            className="rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            title={source.install_url || undefined}
                          >
                            安装
                          </button>
                        ) : (
                          <>
                            {source.remote_version && source.local_version !== source.remote_version && (
                              <button
                                onClick={() => upgrade(source.id)}
                                className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                              >
                                升级
                              </button>
                            )}
                            <button
                              onClick={() => uninstall(source.id)}
                              className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700"
                            >
                              卸载
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )
            ) : (
              filteredSources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    未配置 OpenClaw 远程 Agent。点击"添加 OpenClaw"配置。
                  </td>
                </tr>
              ) : (
                filteredSources.map((source) => (
                  <tr key={source.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{source.display_name}</div>
                      <div className="text-[11px] text-gray-500">{source.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge installed={source.installed} healthy={source.healthy} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">
                        {source.local_version || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[250px] truncate text-[12px] text-gray-500" title={source.endpoint || ""}>
                        {source.endpoint || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePing(source.id)}
                          disabled={pingingId === source.id}
                          className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {pingingId === source.id ? "刷新中..." : "刷新"}
                        </button>
                        <button
                          onClick={() => handleEditOpenClaw(source)}
                          className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteOpenClaw(source.id)}
                          className="rounded-md bg-red-100 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-200"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>

      {showOpenClawModal && (
        <OpenClawModal
          source={editingOpenClaw}
          onClose={() => {
            setShowOpenClawModal(false);
            setEditingOpenClaw(null);
          }}
          onSubmit={handleOpenClawSubmit}
        />
      )}
    </div>
  );
}

function SourceTypeBadge({ sourceType }: { sourceType: "local_cli" | "openai_compatible" | "remote_agent" }) {
  switch (sourceType) {
    case "local_cli":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
          本地 CLI
        </span>
      );
    case "openai_compatible":
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
          OpenAI 兼容
        </span>
      );
    case "remote_agent":
      return (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700">
          远程 Agent
        </span>
      );
  }
}

function StatusBadge({ installed, healthy }: { installed: boolean; healthy: boolean }) {
  if (!installed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
        <XCircle className="h-3 w-3" />
        未安装
      </span>
    );
  }
  if (healthy) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
        <CheckCircle className="h-3 w-3" />
        已安装
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
      <AlertCircle className="h-3 w-3" />
      异常
    </span>
  );
}

function RemoteAgentStatusBadge({ status }: { status: 'online' | 'offline' | 'unknown' }) {
  if (status === 'online') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
        <CheckCircle className="h-3 w-3" />
        已连接
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
        <XCircle className="h-3 w-3" />
        未连接
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
      <AlertCircle className="h-3 w-3" />
      未知
    </span>
  );
}

function EmployeeStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "online":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
          <CheckCircle className="h-3 w-3" />
          在线
        </span>
      );
    case "offline":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          <XCircle className="h-3 w-3" />
          离线
        </span>
      );
    case "busy":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
          <AlertCircle className="h-3 w-3" />
          工作中
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          未知
        </span>
      );
  }
}

function OpenClawModal({
  source,
  onClose,
  onSubmit,
}: {
  source: AgentSource | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    display_name: string;
    endpoint: string;
    api_key?: string;
    origin?: string;
    tags?: string[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState(source?.name || "");
  const [displayName, setDisplayName] = useState(source?.display_name || "");
  const [endpoint, setEndpoint] = useState(source?.endpoint || "");
  const [apiKey, setApiKey] = useState(source?.api_key || "");
  const [origin, setOrigin] = useState(source?.origin || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name: name || displayName.toLowerCase().replace(/\s+/g, "-"),
        display_name: displayName,
        endpoint,
        api_key: apiKey || undefined,
        origin: origin || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {source ? "编辑 OpenClaw Source" : "添加 OpenClaw Source"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-gray-700">显示名称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
              placeholder="e.g., PonyDev"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-gray-700">端点 URL</label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
              placeholder="e.g., http://100.69.109.88:11744"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-gray-700">Origin（可选）</label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
              placeholder="e.g., http://100.69.109.88:11744"
            />
            <p className="mt-1 text-[11px] text-gray-500">通常与端点 URL 相同</p>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-gray-700">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
              placeholder="Bearer Token"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !displayName || !endpoint}
              className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "保存中..." : source ? "保存" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmployeesSection() {
  const { employees, loading, error, create, update, remove, getPersonaFiles, updatePersonaFiles, getHistory, test } = useEmployees();
  const { agents, fetchAgents, fetchRemoteAgents } = useAgents();
  const { sources } = useAgentSources();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-gray-500">加载中...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  const getAgentDisplay = (agentId?: string) => {
    if (!agentId) return { displayName: "-", id: "" };
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return { displayName: agentId, id: agentId };
    return { displayName: agent.display_name, id: agent.id };
  };

  const getSourceDisplay = (agentId?: string) => {
    if (!agentId) return "-";
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return "-";
    return agent.source_id;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-gray-600">
          员工管理 - 配置本地员工和远程员工的工作身份
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700"
        >
          <Download className="h-3.5 w-3.5" />
          新建员工
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">员工</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">状态</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">绑定 Agent</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">来源</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">模型</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">派发统计</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  暂无员工。点击"新建员工"创建一个。
                </td>
              </tr>
            ) : (
              employees.map((employee) => {
                const agentInfo = getAgentDisplay(employee.agent_id);
                const sourceDisplay = getSourceDisplay(employee.agent_id);
                return (
                  <tr key={employee.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[12px] font-medium"
                          style={{ backgroundColor: employee.avatar_color || "#7c3aed" }}
                        >
                          {employee.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{employee.display_name}</div>
                          <div className="text-[11px] text-gray-500">{employee.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <EmployeeStatusBadge status={employee.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium text-gray-900">{agentInfo.displayName}</div>
                      <div className="text-[11px] text-gray-400">{agentInfo.id}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-600">
                      {sourceDisplay}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-600">
                      {employee.model || <span className="text-gray-400">默认</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] text-gray-500">
                        {employee.dispatch_count || 0} 次
                        {employee.dispatch_count !== undefined && employee.dispatch_count > 0 && (
                          <span className="ml-1 text-green-600">
                            ({Math.round((employee.dispatch_success_count || 0) / employee.dispatch_count * 100)}%)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedEmployee(employee)}
                          className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => remove(employee.id)}
                          className="rounded-md bg-red-100 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-200"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateEmployeeModal
          onClose={() => setShowCreateModal(false)}
          onCreate={create}
          agents={agents}
          sources={sources}
          fetchRemoteAgents={fetchRemoteAgents}
        />
      )}

      {selectedEmployee && (
        <EmployeeDetailPanel
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onUpdate={update}
          getPersonaFiles={getPersonaFiles}
          updatePersonaFiles={updatePersonaFiles}
          getHistory={getHistory}
          testEmployee={test}
          agents={agents}
          sources={sources}
          fetchRemoteAgents={fetchRemoteAgents}
        />
      )}
    </div>
  );
}

function CreateEmployeeModal({
  onClose,
  onCreate,
  agents,
  sources,
  fetchRemoteAgents,
}: {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    agent_id: string;
  }) => Promise<void>;
  agents: Agent[];
  sources: AgentSource[];
  fetchRemoteAgents: (sourceId: string) => Promise<Agent[]>;
}) {
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agentMode, setAgentMode] = useState<"local" | "remote">("local");
  const [selectedSource, setSelectedSource] = useState("");
  const [remoteAgents, setRemoteAgents] = useState<Agent[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  const localAgents = agents.filter(a => a.agent_type === "local_cli");
  const remoteSources = sources.filter(s => s.source_type === "remote_agent" || s.source_type === "remote_open_claw_ws");

  useEffect(() => {
    if (agentMode === "remote" && selectedSource) {
      setLoadingRemote(true);
      fetchRemoteAgents(selectedSource)
        .then(data => {
          setRemoteAgents(data || []);
          setLoadingRemote(false);
        })
        .catch(() => {
          setRemoteAgents([]);
          setLoadingRemote(false);
        });
    }
  }, [agentMode, selectedSource, fetchRemoteAgents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        name,
        agent_id: agentId,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">新建员工</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-gray-700">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
              placeholder="e.g., ada"
              required
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-2">绑定方式</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="agentMode"
                  value="local"
                  checked={agentMode === "local"}
                  onChange={() => {
                    setAgentMode("local");
                    setAgentId("");
                    setSelectedSource("");
                  }}
                  className="text-blue-600"
                />
                <span className="text-[13px] text-gray-700">本地 Agent</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="agentMode"
                  value="remote"
                  checked={agentMode === "remote"}
                  onChange={() => {
                    setAgentMode("remote");
                    setAgentId("");
                    setSelectedSource("");
                  }}
                  className="text-blue-600"
                />
                <span className="text-[13px] text-gray-700">OpenClaw 远程 Agent</span>
              </label>
            </div>
          </div>

          {agentMode === "local" ? (
            <div>
              <label className="block text-[12px] font-medium text-gray-700">选择本地 Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                required
              >
                <option value="">请选择本地 Agent</option>
                {localAgents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.display_name} ({agent.status})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[12px] font-medium text-gray-700">选择远程 Source</label>
                <select
                  value={selectedSource}
                  onChange={(e) => {
                    setSelectedSource(e.target.value);
                    setAgentId("");
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">请选择远程 Source</option>
                  {remoteSources.map(source => (
                    <option key={source.id} value={source.id}>
                      {source.display_name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedSource && (
                <div>
                  <label className="block text-[12px] font-medium text-gray-700">
                    选择远程 Agent {loadingRemote && "(加载中...)"}
                  </label>
                  <select
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                    required
                    disabled={loadingRemote}
                  >
                    <option value="">请选择远程 Agent</option>
                    {remoteAgents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-200"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !agentId}
              className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmployeeDetailPanel({
  employee,
  onClose,
  onUpdate,
  getPersonaFiles,
  updatePersonaFiles,
  getHistory,
  testEmployee,
  agents,
  sources,
  fetchRemoteAgents,
}: {
  employee: Employee;
  onClose: () => void;
  onUpdate: (id: string, data: {
    display_name?: string;
    agent_id?: string;
    model?: string;
    avatar_color?: string;
  }) => Promise<void>;
  getPersonaFiles: (id: string) => Promise<{ identity: string; soul: string; skills: string; rules: string }>;
  updatePersonaFiles: (id: string, data: { identity: string; soul: string; skills: string; rules: string }) => Promise<void>;
  getHistory: (id: string) => Promise<{ records: Array<{
    id: string;
    task: string;
    status: string;
    output: string;
    exit_code: number;
    started_at: string;
    completed_at: string;
  }> }>;
  testEmployee: (id: string) => Promise<{ ok: boolean; error?: string }>;
  agents: Agent[];
  sources: AgentSource[];
  fetchRemoteAgents: (sourceId: string) => Promise<Agent[]>;
}) {
  const [activeTab, setActiveTab] = useState<"basic" | "binding" | "persona" | "history">("basic");
  const [personaFiles, setPersonaFiles] = useState<{ identity: string; soul: string; skills: string; rules: string }>({
    identity: "",
    soul: "",
    skills: "",
    rules: "",
  });
  const [loadingPersonaFiles, setLoadingPersonaFiles] = useState(false);
  const [history, setHistory] = useState<{ records: Array<{
    id: string;
    task: string;
    status: string;
    output: string;
    exit_code: number;
    started_at: string;
    completed_at: string;
  }> }>({ records: [] });
  const [editingDisplayName, setEditingDisplayName] = useState(employee.display_name);
  const [editingModel, setEditingModel] = useState(employee.model || "");
  const [editingAvatarColor, setEditingAvatarColor] = useState(employee.avatar_color || "#7c3aed");
  const [editingAgentId, setEditingAgentId] = useState(employee.agent_id || "");
  const [agentMode, setAgentMode] = useState<"local" | "remote">("local");
  const [selectedSource, setSelectedSource] = useState("");
  const [remoteAgents, setRemoteAgents] = useState<Agent[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  const localAgents = agents.filter(a => a.agent_type === "local_cli");
  const remoteSources = sources.filter(s => s.source_type === "remote_agent" || s.source_type === "remote_open_claw_ws");

  const boundAgent = agents.find(a => a.id === employee.agent_id);
  const isRemoteAgent = employee.agent_id?.includes('/');

  useEffect(() => {
    if (employee.agent_id?.includes('/')) {
      setAgentMode("remote");
      const sourceId = employee.agent_id.split('/')[0];
      setSelectedSource(sourceId);
    } else {
      setAgentMode("local");
    }
  }, [employee.agent_id]);

  useEffect(() => {
    if (activeTab === "binding" && agentMode === "remote" && selectedSource) {
      setLoadingRemote(true);
      fetchRemoteAgents(selectedSource)
        .then(data => {
          setRemoteAgents(data || []);
          setLoadingRemote(false);
        })
        .catch(() => {
          setRemoteAgents([]);
          setLoadingRemote(false);
        });
    }
  }, [activeTab, agentMode, selectedSource, fetchRemoteAgents]);

  useEffect(() => {
    if (activeTab === "persona" && !isRemoteAgent) {
      setLoadingPersonaFiles(true);
      getPersonaFiles(employee.id)
        .then(setPersonaFiles)
        .finally(() => setLoadingPersonaFiles(false));
    }
    if (activeTab === "history") {
      getHistory(employee.id).then(setHistory);
    }
  }, [activeTab, employee.id, isRemoteAgent, getPersonaFiles, getHistory]);

  const handleSaveBasic = async () => {
    await onUpdate(employee.id, {
      display_name: editingDisplayName,
      model: editingModel || undefined,
      avatar_color: editingAvatarColor,
    });
  };

  const handleSaveBinding = async () => {
    await onUpdate(employee.id, {
      agent_id: editingAgentId,
    });
  };

  const handleSavePersonaFiles = async () => {
    await updatePersonaFiles(employee.id, personaFiles);
  };

  const getSourceDisplayName = (agentId?: string) => {
    if (!agentId) return undefined;
    const sourceId = agentId.split('/')[0];
    const source = sources.find(s => s.id === sourceId);
    return source?.display_name;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="h-[80vh] w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white text-[14px] font-medium"
              style={{ backgroundColor: employee.avatar_color || "#7c3aed" }}
            >
              {employee.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{employee.display_name}</h2>
              <p className="text-[12px] text-gray-500">{employee.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-gray-100 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("basic")}
              className={cn(
                "border-b-2 py-3 text-[13px] font-medium",
                activeTab === "basic"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              基本信息
            </button>
            <button
              onClick={() => setActiveTab("binding")}
              className={cn(
                "border-b-2 py-3 text-[13px] font-medium",
                activeTab === "binding"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              绑定 Agent
            </button>
            {!isRemoteAgent && (
              <button
                onClick={() => setActiveTab("persona")}
                className={cn(
                  "border-b-2 py-3 text-[13px] font-medium",
                  activeTab === "persona"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                Persona 文件
              </button>
            )}
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "border-b-2 py-3 text-[13px] font-medium",
                activeTab === "history"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              历史记录
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-120px)] overflow-y-auto p-6">
          {activeTab === "basic" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-medium text-gray-500">状态</div>
                  <div className="mt-1">
                    <EmployeeStatusBadge status={employee.status} />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-gray-500">绑定 Agent</div>
                  <div className="mt-1 text-[13px] text-gray-900">
                    {boundAgent?.display_name || employee.agent_id || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-gray-500">来源</div>
                  <div className="mt-1 text-[13px] text-gray-900">
                    {boundAgent?.source_id || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-gray-500">模型</div>
                  <div className="mt-1 text-[13px] text-gray-900">
                    {employee.model || <span className="text-gray-400">使用默认</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-gray-500">派发统计</div>
                  <div className="mt-1 text-[13px] text-gray-900">
                    {employee.dispatch_count || 0} 次
                    {employee.dispatch_count !== undefined && employee.dispatch_count > 0 && (
                      <span className="ml-1 text-green-600">
                        ({(employee.dispatch_success_count || 0)} 成功)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <h3 className="text-[13px] font-medium text-gray-900 mb-3">编辑基本信息</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700">显示名称</label>
                    <input
                      type="text"
                      value={editingDisplayName}
                      onChange={(e) => setEditingDisplayName(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700">模型覆盖</label>
                    <input
                      type="text"
                      value={editingModel}
                      onChange={(e) => setEditingModel(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                      placeholder="留空使用默认"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700">头像颜色</label>
                    <input
                      type="color"
                      value={editingAvatarColor}
                      onChange={(e) => setEditingAvatarColor(e.target.value)}
                      className="h-9 w-full cursor-pointer rounded-md border border-gray-300"
                    />
                  </div>
                  <button
                    onClick={handleSaveBasic}
                    className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
                  >
                    保存更改
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "binding" && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-[13px] font-medium text-gray-900 mb-2">当前绑定</h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[12px] text-gray-600">Agent: {boundAgent?.display_name || "-"}</div>
                  <div className="text-[12px] text-gray-600">来源: {getSourceDisplayName(employee.agent_id) || "-"}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-[13px] font-medium text-gray-900 mb-3">切换绑定 Agent</h3>
                
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-gray-700 mb-2">绑定方式</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editAgentMode"
                        value="local"
                        checked={agentMode === "local"}
                        onChange={() => {
                          setAgentMode("local");
                          setSelectedSource("");
                        }}
                        className="text-blue-600"
                      />
                      <span className="text-[13px] text-gray-700">本地 Agent</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editAgentMode"
                        value="remote"
                        checked={agentMode === "remote"}
                        onChange={() => {
                          setAgentMode("remote");
                          setSelectedSource("");
                        }}
                        className="text-blue-600"
                      />
                      <span className="text-[13px] text-gray-700">OpenClaw 远程 Agent</span>
                    </label>
                  </div>
                </div>

                {agentMode === "local" ? (
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700">选择本地 Agent</label>
                    <select
                      value={editingAgentId}
                      onChange={(e) => setEditingAgentId(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">请选择本地 Agent</option>
                      {localAgents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.display_name} ({agent.status})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700">选择远程 Source</label>
                      <select
                        value={selectedSource}
                        onChange={(e) => {
                          setSelectedSource(e.target.value);
                          setEditingAgentId("");
                        }}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">请选择远程 Source</option>
                        {remoteSources.map(source => (
                          <option key={source.id} value={source.id}>
                            {source.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedSource && (
                      <div className="mt-3">
                        <label className="block text-[12px] font-medium text-gray-700">
                          选择远程 Agent {loadingRemote && "(加载中...)"}
                        </label>
                        <select
                          value={editingAgentId}
                          onChange={(e) => setEditingAgentId(e.target.value)}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                          disabled={loadingRemote}
                        >
                          <option value="">请选择远程 Agent</option>
                          {remoteAgents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={handleSaveBinding}
                  disabled={!editingAgentId}
                  className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  保存绑定
                </button>
              </div>
            </div>
          )}

          {activeTab === "persona" && !isRemoteAgent && (
            <div className="space-y-4">
              {loadingPersonaFiles ? (
                <div className="flex items-center justify-center py-8 text-gray-500">加载中...</div>
              ) : isRemoteAgent ? (
                <div className="bg-gray-50 rounded-lg p-4 text-[13px] text-gray-600">
                  该员工绑定远程 Agent，默认不使用本地 persona 文件
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700">IDENTITY.md</label>
                    <textarea
                      value={personaFiles.identity}
                      onChange={(e) => setPersonaFiles({ ...personaFiles, identity: e.target.value })}
                      rows={4}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                      placeholder="定义员工的身份和背景..."
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700">SOUL.md</label>
                    <textarea
                      value={personaFiles.soul}
                      onChange={(e) => setPersonaFiles({ ...personaFiles, soul: e.target.value })}
                      rows={6}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                      placeholder="定义员工的工作风格和特点..."
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700">SKILLS.md</label>
                    <textarea
                      value={personaFiles.skills}
                      onChange={(e) => setPersonaFiles({ ...personaFiles, skills: e.target.value })}
                      rows={4}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                      placeholder="技能列表..."
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700">RULES.md</label>
                    <textarea
                      value={personaFiles.rules}
                      onChange={(e) => setPersonaFiles({ ...personaFiles, rules: e.target.value })}
                      rows={4}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                      placeholder="工作规则..."
                    />
                  </div>
                  <button
                    onClick={handleSavePersonaFiles}
                    className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
                  >
                    保存更改
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-3">
              {history.records.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-500">暂无历史记录</div>
              ) : (
                history.records.map((record) => (
                  <div key={record.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-medium text-gray-900">{record.task}</div>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        record.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {record.status === "completed" ? "完成" : "失败"}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-gray-500">
                      {new Date(record.started_at).toLocaleString()} → {new Date(record.completed_at).toLocaleString()}
                    </div>
                    {record.output && (
                      <div className="mt-2 max-h-24 overflow-y-auto rounded bg-gray-50 p-2 text-[12px] text-gray-600">
                        {record.output}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProvidersSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        Provider 管理页面 - 配置和管理 AI 模型供应商和 API Keys
      </p>
    </div>
  );
}

function McpSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        MCP Servers 管理页面 - 配置 MCP 服务器及其在各 CLI 工具中的启用状态
      </p>
    </div>
  );
}

function SkillsSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        Skills 管理页面 - 管理技能仓库和安装状态
      </p>
    </div>
  );
}

function PromptsSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        系统提示词管理页面 - 配置和管理系统提示词模板
      </p>
    </div>
  );
}

function SyncSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        配置同步页面 - 将 CloudCode 的统一配置同步到各 CLI 工具的原生配置文件
      </p>
    </div>
  );
}

function LogsSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        日志和调试信息页面 - 查看系统日志和调试信息
      </p>
    </div>
  );
}
