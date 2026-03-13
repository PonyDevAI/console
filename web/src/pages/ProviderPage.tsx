import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  activateProvider,
  createProvider,
  deleteProvider,
  getProviders,
  updateProvider,
} from "../api";
import AppBadgeList from "../components/AppBadgeList";
import AppToggleList from "../components/AppToggleList";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import { Input } from "../components/FormFields";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
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

export default function ProviderPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [form, setForm] = useState<CreateProviderInput>(emptyForm);

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

  const activeProviderName = useMemo(
    () => providers.find((provider) => provider.active)?.name ?? "None",
    [providers],
  );

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
      setOpenDelete(false);
      setDeleting(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete provider", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Provider Management">
        <button
          onClick={openCreateModal}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
        >
          Add Provider
        </button>
      </PageHeader>

      <div className="mb-4 text-sm text-zinc-500">Active Provider: {activeProviderName}</div>

      {loading ? <Spinner /> : null}
      {!loading && error ? <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!loading && !error && providers.length === 0 ? <EmptyState message="No providers configured." /> : null}

      {!loading && !error && providers.length > 0 ? (
        <div className="space-y-3">
          {providers.map((provider) => (
            <Card key={provider.id} className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{provider.name}</span>
                  <StatusBadge
                    label={provider.active ? "Active" : "Inactive"}
                    variant={provider.active ? "success" : "muted"}
                  />
                </div>
                <p className="mt-1 text-sm text-zinc-500">{provider.api_endpoint}</p>
                <AppBadgeList apps={provider.apps} />
              </div>

              <div className="flex gap-2">
                {!provider.active ? (
                  <button
                    onClick={() => void onActivate(provider.id)}
                    className="rounded bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100"
                  >
                    Activate
                  </button>
                ) : null}
                <button
                  onClick={() => openEditModal(provider)}
                  className="rounded bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDeleting(provider);
                    setOpenDelete(true);
                  }}
                  className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Modal
        open={openForm}
        onClose={() => !saving && setOpenForm(false)}
        title={editing ? "Edit Provider" : "Add Provider"}
      >
        <form className="space-y-4" onSubmit={(event) => void submitForm(event)}>
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
          <Input
            label="API Key Ref"
            required
            value={form.api_key_ref}
            onChange={(event) => setForm((prev) => ({ ...prev, api_key_ref: event.target.value }))}
          />
          <div>
            <div className="mb-1 text-sm font-medium text-zinc-700">Enabled Apps</div>
            <AppToggleList selected={form.apps} onChange={(apps) => setForm((prev) => ({ ...prev, apps }))} />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenForm(false)}
              className="rounded bg-zinc-100 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openDelete}
        onClose={() => !saving && setOpenDelete(false)}
        title="Delete Provider"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            Confirm delete <span className="font-semibold text-zinc-900">{deleting?.name}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenDelete(false)}
              className="rounded bg-zinc-100 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={saving}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
