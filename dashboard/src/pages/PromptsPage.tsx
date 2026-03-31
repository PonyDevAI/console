import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Edit2, Trash2, Save, Power } from "lucide-react";
import { getPrompts, createPrompt, updatePrompt, deletePrompt, activatePrompt } from "../api";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import { toast } from "../components/Toast";
import type { PromptPreset } from "../types";
import { cn } from "../lib/utils";

const APP_OPTIONS = [
  { value: "claude", label: "Claude CLI" },
  { value: "codex", label: "Codex CLI" },
  { value: "opencode", label: "OpenCode CLI" },
  { value: "gemini", label: "Gemini CLI" },
];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptPreset | null>(null);
  const [deletingPrompt, setDeletingPrompt] = useState<PromptPreset | null>(null);
  const [activatingPrompt, setActivatingPrompt] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    content: "",
    apps: [] as string[],
  });

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPrompts();
      setPrompts(data.prompts ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "加载提示词失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const openCreateModal = () => {
    setEditingPrompt(null);
    setForm({ name: "", content: "", apps: [] });
    setShowFormModal(true);
  };

  const openEditModal = (prompt: PromptPreset) => {
    setEditingPrompt(prompt);
    setForm({
      name: prompt.name,
      content: prompt.content,
      apps: [...prompt.apps],
    });
    setShowFormModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.content) {
      toast("请填写名称和内容", "error");
      return;
    }
    try {
      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, {
          name: form.name,
          content: form.content,
          apps: form.apps,
        });
        toast("提示词已更新", "success");
      } else {
        await createPrompt({
          name: form.name,
          content: form.content,
          apps: form.apps,
        });
        toast("提示词已创建", "success");
      }
      setShowFormModal(false);
      void loadPrompts();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "保存失败", "error");
    }
  };

  const handleDelete = async () => {
    if (!deletingPrompt) return;
    try {
      await deletePrompt(deletingPrompt.id);
      toast("提示词已删除", "success");
      setDeletingPrompt(null);
      void loadPrompts();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
    }
  };

  const handleActivate = async (id: string) => {
    setActivatingPrompt(id);
    try {
      await activatePrompt(id);
      toast("提示词已激活，点击同步配置生效", "success");
      void loadPrompts();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "激活失败", "error");
    } finally {
      setActivatingPrompt(null);
    }
  };

  const toggleApp = (app: string) => {
    setForm((prev) => ({
      ...prev,
      apps: prev.apps.includes(app)
        ? prev.apps.filter((a) => a !== app)
        : [...prev.apps, app],
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="系统提示词" description="管理 AI 员工的系统提示词预设">
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          新建提示词
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
        </div>
      ) : prompts.length === 0 ? (
        <EmptyState message="还没有提示词预设，点击新建" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts.map((prompt) => {
            const activeApp = prompt.active;
            return (
              <div
                key={prompt.id}
                className={cn(
                  "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--border-hover)] transition-colors",
                  activeApp && "border-[var(--success)] border-2"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--text)] truncate">{prompt.name}</h3>
                      {activeApp && (
                        <span className="inline-block h-2 w-2 rounded-full bg-[var(--success)]" title="已激活" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      目标应用：{prompt.apps.length === 0 ? "未指定" : prompt.apps.join(", ")}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      修改时间：{new Date(prompt.modified_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 border-t border-[var(--border)] pt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openEditModal(prompt)}>
                    <Edit2 className="w-3 h-3 mr-1" />
                    编辑
                  </Button>
                  {activeApp ? (
                    <Button size="sm" variant="secondary" disabled>
                      已激活
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleActivate(prompt.id)}
                      disabled={activatingPrompt === prompt.id}
                    >
                      <Power className="w-3 h-3 mr-1" />
                      {activatingPrompt === prompt.id ? "激活中..." : "激活"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDeletingPrompt(prompt)}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    删除
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingPrompt}
        title="删除提示词"
        message="请确认删除此提示词，操作不可撤销。"
        confirmLabel="删除"
        variant="danger"
        onCancel={() => setDeletingPrompt(null)}
        onConfirm={handleDelete}
      />

      {showFormModal && (
        <Modal
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          title={editingPrompt ? "编辑提示词" : "新建提示词"}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowFormModal(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit}>
                <Save className="w-3 h-3 mr-1" />
                保存
              </Button>
            </div>
          }
        >
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-strong)] mb-1">
                名称
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. 默认助理"
                className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-strong)] mb-1">
                提示词内容
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="请输入系统提示词内容..."
                className="w-full h-64 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm font-mono resize-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                目标应用
              </label>
              <div className="space-y-2">
                {APP_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={form.apps.includes(opt.value)}
                      onChange={() => toggleApp(opt.value)}
                      className="rounded"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
