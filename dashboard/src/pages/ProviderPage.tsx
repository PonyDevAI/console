import { ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  activateProvider,
  createProvider,
  deleteProvider,
  exportProviders,
  getProviders,
  getSwitchModes,
  importProviders,
  setSwitchMode,
  testProvider,
  updateProvider,
} from "../api";
import AppToggleList from "../components/AppToggleList";
import Button from "../components/Button";
import Card from "../components/Card";
import ChipRow from "../components/ChipRow";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import { Input } from "../components/FormFields";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import SecretField from "../components/SecretField";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toast";
import type { CreateProviderInput, Provider, SwitchMode } from "../types";

const ALL_APPS = ["claude", "codex", "gemini", "cursor", "opencode", "openclaw"] as const;

const emptyForm: CreateProviderInput = {
  name: "",
  api_endpoint: "",
  api_key_ref: "",
  apps: [],
};

const providerModels: Record<string, string[]> = {
  OpenAI: ["gpt-4o", "gpt-4.1", "o3-mini"],
  Anthropic: ["claude-3.5-sonnet", "claude-3.7-sonnet", "claude-3-haiku"],
  OpenRouter: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash"],
};

export default function ProviderPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [form, setForm] = useState<CreateProviderInput>(emptyForm);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [switchModes, setSwitchModes] = useState<Record<string, SwitchMode>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProviders();
      setProviders(data.providers ?? []);
      const modeData = await getSwitchModes();
      setSwitchModes(modeData.modes ?? {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载供应商失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => providers.filter((provider) => provider.active).length, [providers]);

  const openCreateModal = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(true);
  };

  const openEditModal = (provider: Provider) => {
    setEditing(provider);
    setForm({
      name: provider.name,
      api_endpoint: provider.api_endpoint,
      api_key_ref: provider.api_key_ref,
      apps: provider.apps,
    });
    setOpenForm(true);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateProvider(editing.id, form);
        toast("供应商已更新", "success");
      } else {
        await createProvider(form);
        toast("供应商已创建", "success");
      }
      setOpenForm(false);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "保存供应商失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const onActivate = async (id: string) => {
    try {
      await activateProvider(id);
      toast("供应商已激活", "success");
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "激活供应商失败", "error");
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteProvider(deleting.id);
      toast("供应商已删除", "success");
      setDeleting(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "删除供应商失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const onTestProvider = async (provider: Provider) => {
    setTestingId(provider.id);
    try {
      const result = await testProvider(provider.id);
      const text = result.ok ? `已连接 (${result.latency_ms}ms)` : "失败";
      setTestResult((prev) => ({ ...prev, [provider.id]: text }));
      toast(result.ok ? `${provider.name} 测试通过` : `${provider.name} 测试失败`, result.ok ? "success" : "error");
    } catch (err: unknown) {
      setTestResult((prev) => ({ ...prev, [provider.id]: "失败" }));
      toast(err instanceof Error ? err.message : "测试供应商失败", "error");
    } finally {
      setTestingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onChangeSwitchMode = async (app: string, mode: SwitchMode) => {
    try {
      await setSwitchMode(app, mode);
      setSwitchModes((prev) => ({ ...prev, [app]: mode }));
      toast(`${app} 模式已设为 ${mode === "switch" ? "切换" : "叠加"}`, "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "设置切换模式失败", "error");
    }
  };

  const onExportProviders = async () => {
    try {
      const data = await exportProviders();
      const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "providers.json";
      a.click();
      URL.revokeObjectURL(url);
      toast("供应商已导出", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "导出供应商失败", "error");
    }
  };

  const onImportClick = () => {
    fileInputRef.current?.click();
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const result = await importProviders(content);
      toast(`已导入 ${result.imported.length} 个供应商`, "success");
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "导入供应商失败", "error");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div>
      <PageHeader title="供应商" description="模型供应商和端点配置">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void onExportProviders()}>导出</Button>
          <Button variant="secondary" onClick={onImportClick}>导入</Button>
          <Button onClick={openCreateModal}>添加供应商</Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void onImportFile(event)} />
        </div>
      </PageHeader>

      <Card>
        <div className="space-y-3">
          <div className="text-sm font-medium text-[var(--text-strong)]">切换模式</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ALL_APPS.map((app) => {
              const mode = switchModes[app] ?? "switch";
              return (
                <div key={app} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] p-2">
                  <span className="text-xs text-[var(--text-strong)]">{app}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={mode === "switch" ? "default" : "secondary"}
                      onClick={() => void onChangeSwitchMode(app, "switch")}
                    >
                      切换
                    </Button>
                    <Button
                      size="sm"
                      variant={mode === "additive" ? "default" : "secondary"}
                      onClick={() => void onChangeSwitchMode(app, "additive")}
                    >
                      叠加
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {loading ? <Spinner /> : null}
      {!loading && error ? (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {!loading && !error && providers.length === 0 ? <EmptyState message="暂无供应商配置。" /> : null}

      {!loading && !error && providers.length > 0 ? (
        <div className="space-y-3">
          {providers.map((provider) => {
            const expanded = expandedIds.has(provider.id);
            const models = providerModels[provider.name] ?? ["default-model"];

            return (
              <Card key={provider.id}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-strong)]">{provider.name}</span>
                        <StatusBadge
                          label={provider.active ? "已激活" : "未激活"}
                          variant={provider.active ? "success" : "muted"}
                        />
                      </div>
                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">{provider.api_endpoint}</p>
                      <ChipRow items={provider.apps} variant="accent" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!provider.active ? (
                        <Button size="sm" onClick={() => void onActivate(provider.id)}>
                          激活
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void onTestProvider(provider)}
                        disabled={testingId === provider.id}
                      >
                        <FlaskConical className="h-4 w-4" />
                        {testingId === provider.id ? "测试中..." : "测试连接"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openEditModal(provider)}>
                        编辑
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(provider.id)}>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        详情
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(provider)}>
                        删除
                      </Button>
                    </div>
                  </div>

                  {testResult[provider.id] ? (
                    <div className="text-xs text-[var(--muted)]">连接测试: {testResult[provider.id]}</div>
                  ) : null}

                  {expanded ? (
                    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] p-3">
                      <div>
                        <div className="text-xs font-medium text-[var(--muted)]">API 密钥</div>
                        <div className="mt-1 max-w-sm">
                          <SecretField value={provider.api_key_ref} readOnly />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[var(--muted)]">模型</div>
                        <ChipRow items={models} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Modal
        open={openForm}
        onClose={() => !saving && setOpenForm(false)}
        title={editing ? "编辑供应商" : "添加供应商"}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenForm(false)}>
              取消
            </Button>
            <Button type="submit" form="provider-form" disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        }
      >
        <form id="provider-form" className="space-y-4" onSubmit={(event) => void submitForm(event)}>
          <Input
            label="名称"
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            label="API 端点"
            required
            value={form.api_endpoint}
            onChange={(event) => setForm((prev) => ({ ...prev, api_endpoint: event.target.value }))}
          />
          <SecretField
            label="API 密钥引用"
            required
            value={form.api_key_ref}
            onChange={(event) => setForm((prev) => ({ ...prev, api_key_ref: event.target.value }))}
          />
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--muted)]">启用的应用</div>
            <AppToggleList selected={form.apps} onChange={(apps) => setForm((prev) => ({ ...prev, apps }))} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="删除供应商"
        message={`确定要删除 ${deleting?.name ?? "该供应商"} 吗？`}
        confirmLabel="删除"
        variant="danger"
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
