import { ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  activateProvider,
  createProvider,
  deleteProvider,
  getProviders,
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
import type { CreateProviderInput, Provider } from "../types";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProviders();
      setProviders(data.providers ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
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
        toast("Provider updated", "success");
      } else {
        await createProvider(form);
        toast("Provider created", "success");
      }
      setOpenForm(false);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to save provider", "error");
    } finally {
      setSaving(false);
    }
  };

  const onActivate = async (id: string) => {
    try {
      await activateProvider(id);
      toast("Provider activated", "success");
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to activate provider", "error");
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteProvider(deleting.id);
      toast("Provider deleted", "success");
      setDeleting(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete provider", "error");
    } finally {
      setSaving(false);
    }
  };

  const onTestProvider = async (provider: Provider) => {
    setTestingId(provider.id);
    try {
      const result = await testProvider(provider.id);
      const text = result.ok ? `Connected (${result.latency_ms}ms)` : "Failed";
      setTestResult((prev) => ({ ...prev, [provider.id]: text }));
      toast(result.ok ? `${provider.name} test passed` : `${provider.name} test failed`, result.ok ? "success" : "error");
    } catch (err: unknown) {
      setTestResult((prev) => ({ ...prev, [provider.id]: "Failed" }));
      toast(err instanceof Error ? err.message : "Failed to test provider", "error");
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

  return (
    <div>
      <PageHeader title="供应商" description="模型供应商和端点配置">
        <Button onClick={openCreateModal}>Add Provider</Button>
      </PageHeader>

      {loading ? <Spinner /> : null}
      {!loading && error ? (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {!loading && !error && providers.length === 0 ? <EmptyState message="No providers configured." /> : null}

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
                          label={provider.active ? "Active" : "Inactive"}
                          variant={provider.active ? "success" : "muted"}
                        />
                      </div>
                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">{provider.api_endpoint}</p>
                      <ChipRow items={provider.apps} variant="accent" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!provider.active ? (
                        <Button size="sm" onClick={() => void onActivate(provider.id)}>
                          Activate
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void onTestProvider(provider)}
                        disabled={testingId === provider.id}
                      >
                        <FlaskConical className="h-4 w-4" />
                        {testingId === provider.id ? "Testing..." : "Test Connection"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openEditModal(provider)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(provider.id)}>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        Details
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(provider)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  {testResult[provider.id] ? (
                    <div className="text-xs text-[var(--muted)]">Connection Test: {testResult[provider.id]}</div>
                  ) : null}

                  {expanded ? (
                    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] p-3">
                      <div>
                        <div className="text-xs font-medium text-[var(--muted)]">API Key</div>
                        <div className="mt-1 max-w-sm">
                          <SecretField value={provider.api_key_ref} readOnly />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[var(--muted)]">Models</div>
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
        title={editing ? "Edit Provider" : "Add Provider"}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="provider-form" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <form id="provider-form" className="space-y-4" onSubmit={(event) => void submitForm(event)}>
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            label="API Endpoint"
            required
            value={form.api_endpoint}
            onChange={(event) => setForm((prev) => ({ ...prev, api_endpoint: event.target.value }))}
          />
          <SecretField
            label="API Key Ref"
            required
            value={form.api_key_ref}
            onChange={(event) => setForm((prev) => ({ ...prev, api_key_ref: event.target.value }))}
          />
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--muted)]">Enabled Apps</div>
            <AppToggleList selected={form.apps} onChange={(apps) => setForm((prev) => ({ ...prev, apps }))} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Provider"
        message={`Confirm delete ${deleting?.name ?? "this provider"}?`}
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
