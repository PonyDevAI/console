import React, { useCallback, useEffect, useState } from "react";
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getSoulFiles,
  updateSoulFiles,
  addBinding,
  updateBinding,
  deleteBinding,
  dispatchEmployee,
  getRemoteAgents,
  getRemoteWorkers,
  testEmployeeBinding,
  getDispatchHistory,
} from "../api";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import { toast } from "../components/Toast";
import type {
  AgentBinding,
  AgentBindingRequest,
  AgentProtocol,
  DispatchRequest,
  Employee,
  SoulFiles,
  Task,
  UpdateBindingRequest,
  UpdateEmployeeRequest,
  RemoteAgent,
  WorkerInfo,
  DispatchRecord,
} from "../types";
import { cn } from "../lib/utils";
import { useTasks } from "../contexts/TaskContext";
import { Terminal, Globe, Server, Play, Trash2, Edit2, Plus, Save } from "lucide-react";

const AVATAR_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

type BindingFormData = {
  label: string;
  is_primary: boolean;
  protocol: AgentProtocol;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<string | null>(null);
  const [dispatchingEmployee, setDispatchingEmployee] = useState<string | null>(null);
  const { tasks } = useTasks();

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmployees();
      setEmployees(data.employees ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "加载员工列表失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const handleCreate = async (data: { name: string; display_name: string; role: string; avatar_color: string }) => {
    try {
      await createEmployee(data);
      toast("员工创建成功", "success");
      setShowCreateModal(false);
      void loadEmployees();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "创建失败", "error");
    }
  };

  const handleUpdate = async (id: string, data: UpdateEmployeeRequest) => {
    try {
      await updateEmployee(id, data);
      toast("员工更新成功", "success");
      setEditingEmployee(null);
      void loadEmployees();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "更新失败", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEmployee(id);
      toast("员工已删除", "success");
      setDeletingEmployee(null);
      void loadEmployees();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
    }
  };

  const handleUpdateSoulFiles = async (id: string, soulFiles: SoulFiles) => {
    try {
      await updateSoulFiles(id, soulFiles);
      toast("Soul 文件已保存", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "保存失败", "error");
    }
  };

  const handleAddBinding = async (id: string, binding: BindingFormData) => {
    try {
      const req: AgentBindingRequest = { label: binding.label, is_primary: binding.is_primary, protocol: binding.protocol };
      await addBinding(id, req);
      toast("绑定添加成功", "success");
      void loadEmployees();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "添加绑定失败", "error");
    }
  };

  const handleUpdateBinding = async (id: string, bid: string, data: UpdateBindingRequest) => {
    try {
      await updateBinding(id, bid, data);
      toast("绑定更新成功", "success");
      void loadEmployees();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "更新绑定失败", "error");
    }
  };

  const handleDeleteBinding = async (id: string, bid: string) => {
    try {
      await deleteBinding(id, bid);
      toast("绑定已删除", "success");
      void loadEmployees();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "删除绑定失败", "error");
    }
  };

  const handleDispatch = async (id: string, data: DispatchRequest) => {
    try {
      await dispatchEmployee(id, data);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "派发失败", "error");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="AI 员工">
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          新建员工
        </Button>
      </PageHeader>
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" /></div>
      ) : employees.length === 0 ? (
        <EmptyState message="还没有 AI 员工，点击新建" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const primaryBinding = emp.bindings.find((b) => b.is_primary) ?? emp.bindings[0];
            const localCount = emp.bindings.filter((b) => b.protocol.type === "local_process").length;
            const openclawCount = emp.bindings.filter((b) => b.protocol.type === "open_ai_compatible").length;
            const sshCount = emp.bindings.filter((b) => b.protocol.type === "ssh_exec").length;
            const activeTask = Array.from(tasks.values()).find(
              (t: Task) => t.action === "dispatch" &&
                           t.target === emp.display_name &&
                           (t.status === "pending" || t.status === "running")
            );
            const isRunning = !!activeTask;
            return (
              <div key={emp.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--border-hover)] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: emp.avatar_color }}>
                      {emp.display_name.charAt(0).toUpperCase()}
                    </div>
                    {isRunning && (
                      <span className="absolute -top-0.5 -left-0.5 h-3 w-3 rounded-full bg-[var(--accent)] animate-pulse border-2 border-[var(--card)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--text)] truncate">{emp.display_name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-accent)] rounded text-[var(--muted)]">{emp.role || "员工"}</span>
                    </div>
                    <p className="text-sm text-[var(--muted)] truncate">{emp.name}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]">
                  {localCount > 0 && (<span className="inline-flex items-center gap-1" title={`本地进程：${localCount}`}><Terminal className="w-3 h-3" />{localCount}</span>)}
                  {openclawCount > 0 && (<span className="inline-flex items-center gap-1" title={`OpenClaw: ${openclawCount}`}><Globe className="w-3 h-3" />{openclawCount}</span>)}
                  {sshCount > 0 && (<span className="inline-flex items-center gap-1" title={`SSH: ${sshCount}`}><Server className="w-3 h-3" />{sshCount}</span>)}
                  {emp.bindings.length === 0 && <span>未绑定 Agent</span>}
                </div>
                {primaryBinding && (
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    <span className="font-medium">主绑定：</span>
                    <span className="font-mono">{primaryBinding.label}</span>
                    <span className="ml-2 px-1 py-0.5 bg-[var(--bg-accent)] rounded text-[9px]">
                      {primaryBinding.protocol.type === "local_process" ? "本地进程" : primaryBinding.protocol.type === "open_ai_compatible" ? "OpenAI 兼容" : "SSH"}
                    </span>
                  </div>
                )}
                {emp.last_dispatched_at && (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    最近派发：{new Date(emp.last_dispatched_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {emp.dispatch_count != null && emp.dispatch_count > 0 && (
                      <span className="ml-2">
                        成功率 {Math.round((emp.dispatch_success_count ?? 0) / emp.dispatch_count * 100)}%
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => setDispatchingEmployee(emp.id)} disabled={emp.bindings.length === 0 || isRunning}>
                    <Play className="w-3 h-3 mr-1" />
                    {isRunning ? "执行中..." : "派发任务"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingEmployee(emp)}><Edit2 className="w-3 h-3 mr-1" />编辑</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeletingEmployee(emp.id)}><Trash2 className="w-3 h-3 mr-1" />删除</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!deletingEmployee} title="删除员工" message="请确认删除此员工，操作不可撤销。" confirmLabel="删除" variant="danger" onCancel={() => setDeletingEmployee(null)} onConfirm={() => deletingEmployee && void handleDelete(deletingEmployee)} />
      {showCreateModal && <EmployeeFormModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onSubmit={handleCreate} />}
      {editingEmployee && (
        <EmployeeEditModal open={!!editingEmployee} employee={editingEmployee} onClose={() => setEditingEmployee(null)} onUpdate={handleUpdate} onUpdateSoulFiles={handleUpdateSoulFiles} onAddBinding={handleAddBinding} onUpdateBinding={handleUpdateBinding} onDeleteBinding={handleDeleteBinding} />
      )}
      {dispatchingEmployee && <DispatchModal open={!!dispatchingEmployee} employeeId={dispatchingEmployee} onClose={() => setDispatchingEmployee(null)} />}
    </div>
  );
}

function EmployeeFormModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (data: { name: string; display_name: string; role: string; avatar_color: string }) => void }) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  const handleSubmit = () => {
    if (!name || !displayName) { toast("请填写名称和显示名称", "error"); return; }
    onSubmit({ name, display_name: displayName, role, avatar_color: avatarColor });
  };

  return (
    <Modal open={open} onClose={onClose} title="新建 AI 员工" footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>取消</Button><Button onClick={handleSubmit}>创建</Button></div>}>
      <div className="space-y-4">
        <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">名称（slug）</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. alice" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
        <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">显示名称</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Alice" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
        <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">角色</label><input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. 前端工程师" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
        <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-2">头像颜色</label><div className="flex gap-2">{AVATAR_COLORS.map((color) => (<button key={color} type="button" onClick={() => setAvatarColor(color)} className={cn("w-8 h-8 rounded-full transition-transform", avatarColor === color && "ring-2 ring-[var(--text)] scale-110")} style={{ backgroundColor: color }} />))}</div></div>
      </div>
    </Modal>
  );
}

function EmployeeEditModal({ open, employee, onClose, onUpdate, onUpdateSoulFiles, onAddBinding, onUpdateBinding, onDeleteBinding }: { open: boolean; employee: Employee; onClose: () => void; onUpdate: (id: string, data: UpdateEmployeeRequest) => void; onUpdateSoulFiles: (id: string, files: SoulFiles) => void; onAddBinding: (id: string, binding: BindingFormData) => void; onUpdateBinding: (id: string, bid: string, data: UpdateBindingRequest) => void; onDeleteBinding: (id: string, bid: string) => void }) {
  const [activeTab, setActiveTab] = useState<"info" | "soul" | "bindings">("info");
  const [displayName, setDisplayName] = useState(employee.display_name);
  const [role, setRole] = useState(employee.role);
  const [avatarColor, setAvatarColor] = useState(employee.avatar_color);
  const [soulFiles, setSoulFiles] = useState<SoulFiles>({ soul: "", skills: "", rules: "" });
  const [activeSoulTab, setActiveSoulTab] = useState<"soul" | "skills" | "rules">("soul");
  const [showAddBinding, setShowAddBinding] = useState(false);
  const [loadingSoul, setLoadingSoul] = useState(true);
  const [testingBinding, setTestingBinding] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latency_ms?: number; error?: string }>>({});

  useEffect(() => {
    setLoadingSoul(true);
    getSoulFiles(employee.id).then((data) => { setSoulFiles(data); setLoadingSoul(false); });
  }, [employee.id]);

  const handleSave = () => { onUpdate(employee.id, { display_name: displayName, role, avatar_color: avatarColor }); };
  const handleSaveSoul = () => { onUpdateSoulFiles(employee.id, soulFiles); };

  const handleTestBinding = async (bid: string) => {
    setTestingBinding(bid);
    try {
      const result = await testEmployeeBinding(employee.id, bid);
      setTestResults(prev => ({ ...prev, [bid]: result }));
      toast(result.ok ? "连接正常" : `连接失败：${result.error}`, result.ok ? "success" : "error");
    } catch {
      toast("测试失败", "error");
    } finally {
      setTestingBinding(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`编辑员工：${employee.display_name}`} footer={activeTab === "info" ? (<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>取消</Button><Button onClick={handleSave}>保存</Button></div>) : activeTab === "soul" ? (<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>关闭</Button><Button onClick={handleSaveSoul}><Save className="w-3 h-3 mr-1" />保存</Button></div>) : null}>
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-[var(--border)] pb-2">
          <button className={cn("px-3 py-1 text-sm rounded-t-md transition-colors", activeTab === "info" && "bg-[var(--bg-accent)] text-[var(--text)] font-medium")} onClick={() => setActiveTab("info")}>基本信息</button>
          <button className={cn("px-3 py-1 text-sm rounded-t-md transition-colors", activeTab === "soul" && "bg-[var(--bg-accent)] text-[var(--text)] font-medium")} onClick={() => setActiveTab("soul")}>Soul 文件</button>
          <button className={cn("px-3 py-1 text-sm rounded-t-md transition-colors", activeTab === "bindings" && "bg-[var(--bg-accent)] text-[var(--text)] font-medium")} onClick={() => setActiveTab("bindings")}>Agent 绑定</button>
        </div>
        {activeTab === "info" && (
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">显示名称</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
            <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">角色</label><input type="text" value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
            <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-2">头像颜色</label><div className="flex gap-2">{AVATAR_COLORS.map((color) => (<button key={color} type="button" onClick={() => setAvatarColor(color)} className={cn("w-8 h-8 rounded-full transition-transform", avatarColor === color && "ring-2 ring-[var(--text)] scale-110")} style={{ backgroundColor: color }} />))}</div></div>
          </div>
        )}
        {activeTab === "soul" && (
          <div className="space-y-4">
            <div className="flex gap-2 border-b border-[var(--border)] pb-2">
              {(["soul", "skills", "rules"] as const).map((tab) => (<button key={tab} className={cn("px-3 py-1 text-xs rounded-t-md transition-colors capitalize", activeSoulTab === tab && "bg-[var(--bg-accent)] text-[var(--text)] font-medium")} onClick={() => setActiveSoulTab(tab)}>{tab}</button>))}
            </div>
            {loadingSoul ? (<div className="flex justify-center py-6"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--accent)]" /></div>) : (
              <textarea value={activeSoulTab === "soul" ? soulFiles.soul : activeSoulTab === "skills" ? soulFiles.skills : soulFiles.rules} onChange={(e) => setSoulFiles({ ...soulFiles, [activeSoulTab]: e.target.value })} placeholder={activeSoulTab === "soul" ? "在此定义员工的核心身份和角色..." : activeSoulTab === "skills" ? "在此定义员工的技能和能力..." : "在此定义员工的行为规则和约束..."} className="w-full h-64 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm font-mono resize-none" />
            )}
          </div>
        )}
        {activeTab === "bindings" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center"><h4 className="text-sm font-medium text-[var(--text-strong)]">Agent 绑定</h4><Button size="sm" onClick={() => setShowAddBinding(true)}><Plus className="w-3 h-3 mr-1" />添加绑定</Button></div>
            {employee.bindings.length === 0 ? (<div className="text-sm text-[var(--muted)] text-center py-6">暂无绑定</div>) : (
              <div className="space-y-2">{employee.bindings.map((binding) => (
                <div key={binding.id} className="flex items-center justify-between p-3 rounded-md border border-[var(--border)] bg-[var(--bg-accent)]">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[var(--text)]">{binding.label}</span>
                    <span className="px-1.5 py-0.5 bg-[var(--bg)] rounded text-[9px] text-[var(--muted)]">{binding.protocol.type === "local_process" ? "本地进程" : binding.protocol.type === "open_ai_compatible" ? "OpenAI 兼容" : "SSH"}</span>
                    {binding.is_primary && (<span className="px-1.5 py-0.5 bg-[var(--accent)] text-white rounded text-[9px]">主绑定</span>)}
                    {testResults[binding.id] && (
                      <span className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        testResults[binding.id].ok ? "bg-[var(--success)]" : "bg-[var(--danger)]"
                      )} title={testResults[binding.id].ok
                        ? `连接正常 ${testResults[binding.id].latency_ms ?? ""}ms`
                        : testResults[binding.id].error
                      } />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleTestBinding(binding.id)}
                      disabled={testingBinding === binding.id}
                      className="text-[10px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50 cursor-pointer px-2 py-1"
                    >
                      {testingBinding === binding.id ? "测试中..." : "测试"}
                    </button>
                    {!binding.is_primary && (<Button size="sm" variant="ghost" onClick={() => onUpdateBinding(employee.id, binding.id, { is_primary: true })}>设为主绑定</Button>)}
                    <Button size="sm" variant="ghost" onClick={() => onDeleteBinding(employee.id, binding.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}</div>
            )}
          </div>
        )}
      </div>
      {showAddBinding && <AddBindingModal open={showAddBinding} onClose={() => setShowAddBinding(false)} onSubmit={(data) => { onAddBinding(employee.id, data); setShowAddBinding(false); }} />}
    </Modal>
  );
}

function AddBindingModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (data: BindingFormData) => void }) {
  const [protocolType, setProtocolType] = useState<"local_process" | "open_ai_compatible" | "ssh_exec">("local_process");
  const [label, setLabel] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [executable, setExecutable] = useState("claude");
  const [soulArg, setSoulArg] = useState("--system-prompt");
  const [remoteAgents, setRemoteAgents] = useState<RemoteAgent[]>([]);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [stream, setStream] = useState(true);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [user, setUser] = useState("root");
  const [keyPath, setKeyPath] = useState("~/.ssh/id_rsa");

  useEffect(() => {
    getRemoteAgents().then(data => setRemoteAgents(data.agents ?? []));
  }, []);

  const handleSelectRemoteAgent = async (agentId: string) => {
    const agent = remoteAgents.find(a => a.id === agentId);
    if (!agent) return;
    setEndpoint(agent.endpoint);
    if (agent.api_key) setApiKey(agent.api_key);
    setLoadingWorkers(true);
    try {
      const data = await getRemoteWorkers(agentId);
      setWorkers(data.workers ?? []);
    } catch {
      toast("无法获取 worker 列表", "error");
    } finally {
      setLoadingWorkers(false);
    }
  };

  const handleSubmit = () => {
    if (!label) { toast("请填写绑定标签", "error"); return; }
    let protocol: AgentProtocol;
    if (protocolType === "local_process") { protocol = { type: "local_process", executable, soul_arg: soulArg, extra_args: [] }; }
    else if (protocolType === "open_ai_compatible") { protocol = { type: "open_ai_compatible", endpoint, api_key: apiKey || undefined, model, stream }; }
    else { protocol = { type: "ssh_exec", host, port: parseInt(port), user, key_path: keyPath, executable, soul_arg: soulArg }; }
    onSubmit({ label, is_primary: isPrimary, protocol });
  };

  return (
    <Modal open={open} onClose={onClose} title="添加 Agent 绑定" footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>取消</Button><Button onClick={handleSubmit}>添加</Button></div>}>
      <div className="space-y-4">
        <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">协议类型</label><select value={protocolType} onChange={(e) => setProtocolType(e.target.value as any)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm"><option value="local_process">本地进程</option><option value="open_ai_compatible">OpenAI 兼容</option><option value="ssh_exec">SSH 执行</option></select></div>
        <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">绑定标签</label><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 主 Agent" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
        <div className="flex items-center gap-2"><input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="rounded" /><label className="text-sm text-[var(--text)]">设为主绑定</label></div>
        {protocolType === "local_process" && (<>
          <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">可执行文件</label><input type="text" value={executable} onChange={(e) => setExecutable(e.target.value)} placeholder="claude | codex | opencode | gemini" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
          <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">System Prompt 参数</label><input type="text" value={soulArg} onChange={(e) => setSoulArg(e.target.value)} placeholder="--system-prompt (claude) | --instructions (codex)" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
        </>)}
        {protocolType === "open_ai_compatible" && (<>
          {remoteAgents.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-strong)] mb-1">
                从已有 RemoteAgent 选择（可选）
              </label>
              <select
                onChange={(e) => e.target.value && handleSelectRemoteAgent(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm"
              >
                <option value="">-- 手动填写 --</option>
                {remoteAgents.map(a => (
                  <option key={a.id} value={a.id}>{a.display_name} ({a.endpoint})</option>
                ))}
              </select>
            </div>
          )}
          <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">Endpoint</label><input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="http://192.168.1.100:18789" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-strong)] mb-1">
              API Key（可选）
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Bearer token / API key"
              className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm"
            />
          </div>
          <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">Model</label><input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="openclaw/alice | gpt-4o" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
          {workers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-strong)] mb-1">
                选择 Worker
              </label>
              {loadingWorkers ? (
                <div className="text-sm text-[var(--muted)]">加载中...</div>
              ) : (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm"
                >
                  <option value="">-- 选择 worker --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.display_name} ({w.id})</option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div className="flex items-center gap-2"><input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} className="rounded" /><label className="text-sm text-[var(--text)]">启用 Stream</label></div>
        </>)}
        {protocolType === "ssh_exec" && (<>
          <div className="grid grid-cols-2 gap-2"><div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">Host</label><input type="text" value={host} onChange={(e) => setHost(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div><div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">Port</label><input type="text" value={port} onChange={(e) => setPort(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div></div>
          <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">User</label><input type="text" value={user} onChange={(e) => setUser(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
          <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">Key Path</label><input type="text" value={keyPath} onChange={(e) => setKeyPath(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
          <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">可执行文件</label><input type="text" value={executable} onChange={(e) => setExecutable(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
          <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">System Prompt 参数</label><input type="text" value={soulArg} onChange={(e) => setSoulArg(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
        </>)}
      </div>
    </Modal>
  );
}

function DispatchModal({ open, employeeId, onClose }: { open: boolean; employeeId: string; onClose: () => void }) {
  const [bindingId, setBindingId] = useState("");
  const [cwd, setCwd] = useState("");
  const [task, setTask] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [history, setHistory] = useState<DispatchRecord[]>([]);

  const { tasks } = useTasks();

  const activeTask = activeTaskId ? tasks.get(activeTaskId) ?? null : null;
  const isRunning = activeTask?.status === "pending" || activeTask?.status === "running";
  const isDone = activeTask?.status === "completed" || activeTask?.status === "failed";

  useEffect(() => {
    if (!isDone) return;
    getDispatchHistory(employeeId)
      .then(d => setHistory(d.records ?? []))
      .catch(() => {});
  }, [isDone, employeeId]);

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    setActiveTaskId(null);
    getEmployee(employeeId)
      .then((data) => {
        const emp = data.employee;
        setEmployee(emp || null);
        if (emp) {
          const primary = emp.bindings.find((b) => b.is_primary) ?? emp.bindings[0];
          setBindingId(primary?.id || "");
        }
      })
      .catch(() => toast("加载员工信息失败", "error"))
      .finally(() => setLoading(false));
    
    getDispatchHistory(employeeId)
      .then(d => setHistory(d.records ?? []))
      .catch(() => {});
  }, [employeeId]);

  const handleSubmit = async () => {
    if (!task) { toast("请填写任务内容", "error"); return; }
    setDispatching(true);
    setActiveTaskId(null);
    try {
      const result = await dispatchEmployee(employeeId, {
        task,
        cwd: cwd || undefined,
        binding_id: bindingId || undefined,
      });
      setActiveTaskId(result.task_id);
      toast("任务已派发", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "派发失败", "error");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`派发任务给 ${employee?.display_name ?? ""}`} footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>关闭</Button>
        {!activeTaskId && (
          <Button onClick={handleSubmit} disabled={dispatching || !task}>
            {dispatching ? "派发中..." : "派发"}
          </Button>
        )}
      </div>
    }>
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--accent)]" />
          </div>
        ) : (
          <>
            {!activeTaskId && (
              <>
                <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">使用绑定</label><select value={bindingId} onChange={(e) => setBindingId(e.target.value)} className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm">{employee?.bindings.map((b) => (<option key={b.id} value={b.id}>{b.label}{b.is_primary ? " (主)" : ""}</option>))}</select></div>
                <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">工作目录（可选）</label><input type="text" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="e.g. /path/to/project" className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm" /></div>
                <div><label className="block text-sm font-medium text-[var(--text-strong)] mb-1">任务内容</label><textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder="请输入要派发的任务..." className="w-full h-32 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm resize-none" /></div>
                {history.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-[var(--text-strong)] mb-2">最近记录</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {history.map(r => (
                        <div key={r.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-accent)] text-xs">
                          <span className="shrink-0 mt-0.5">
                            {r.status === "completed"
                              ? <span className="text-[var(--success)]">✓</span>
                              : <span className="text-[var(--danger)]">✗</span>}
                          </span>
                          <span className="text-[var(--muted)] truncate flex-1" title={r.task}>{r.task}</span>
                          <span className="shrink-0 text-[var(--muted)]">{r.binding_label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTask && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-[var(--text)]">
                  {isRunning && (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                  )}
                  {activeTask.status === "completed" && (
                    <span className="text-[var(--success)]">✓</span>
                  )}
                  {activeTask.status === "failed" && (
                    <span className="text-[var(--danger)]">✗</span>
                  )}
                  <span>
                    {isRunning ? "执行中..." : activeTask.status === "completed" ? "执行完成" : "执行失败"}
                  </span>
                </div>
                {activeTask.message && (
                  <pre className="w-full max-h-72 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-accent)] text-[var(--text)] text-xs font-mono overflow-auto whitespace-pre-wrap">
                    {activeTask.message}
                  </pre>
                )}
                {isDone && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setActiveTaskId(null);
                      setTask("");
                    }}
                  >
                    再次派发
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
