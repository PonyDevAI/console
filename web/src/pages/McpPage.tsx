import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createMcpServer,
  deleteMcpServer,
  getMcpServers,
  updateMcpServer,
} from "../api";
import AppBadgeList from "../components/AppBadgeList";
import AppToggleList from "../components/AppToggleList";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import { Input, Select } from "../components/FormFields";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toast";
import type { CreateMcpServerInput, McpServer } from "../types";

type McpFormState = {
  name: string;
  transport: "stdio" | "http" | "sse";
  command: string;
  argsText: string;
  url: string;
  enabled_apps: string[];
};

const emptyForm: McpFormState = {
  name: "",
  transport: "stdio",
  command: "",
  argsText: "",
  url: "",
  enabled_apps: [],
};

export default function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [deleting, setDeleting] = useState<McpServer | null>(null);
  const [form, setForm] = useState<McpFormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMcpServers();
      setServers(data.servers ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load MCP servers");
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

  const openEditModal = (server: McpServer) => {
    setEditing(server);
    setForm({
      name: server.name,
      transport: server.transport,
      command: server.command ?? "",
      argsText: server.args.join(","),
      url: server.url ?? "",
      enabled_apps: server.enabled_apps,
    });
    setOpenForm(true);
  };

  const buildPayload = (): CreateMcpServerInput => {
    const args = form.argsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      name: form.name,
      transport: form.transport,
      command: form.transport === "stdio" ? form.command || undefined : undefined,
      args,
      url: form.transport === "http" || form.transport === "sse" ? form.url || undefined : undefined,
      env: {},
      enabled_apps: form.enabled_apps,
    };
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        const updatePayload: McpServer = {
          id: editing.id,
          name: payload.name,
          transport: payload.transport,
          command: payload.command ?? null,
          args: payload.args,
          url: payload.url ?? null,
          env: editing.env,
          enabled_apps: payload.enabled_apps,
        };
        await updateMcpServer(editing.id, updatePayload);
        toast("MCP server updated", "success");
      } else {
        await createMcpServer(payload);
        toast("MCP server created", "success");
      }
      setOpenForm(false);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to save MCP server", "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteMcpServer(deleting.id);
      toast("MCP server deleted", "success");
      setOpenDelete(false);
      setDeleting(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete MCP server", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="MCP Servers">
        <button
          onClick={openCreateModal}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
        >
          Add Server
        </button>
      </PageHeader>

      {loading ? <Spinner /> : null}
      {!loading && error ? <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!loading && !error && servers.length === 0 ? <EmptyState message="No MCP servers configured." /> : null}

      {!loading && !error && servers.length > 0 ? (
        <div className="space-y-3">
          {servers.map((server) => (
            <Card key={server.id} className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{server.name}</span>
                  <StatusBadge label={server.transport} variant="purple" />
                </div>
                {server.command ? (
                  <p className="mt-1 font-mono text-sm text-zinc-500">
                    {server.command} {server.args.join(" ")}
                  </p>
                ) : null}
                {server.url ? <p className="mt-1 font-mono text-sm text-zinc-500">{server.url}</p> : null}
                <AppBadgeList apps={server.enabled_apps} />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(server)}
                  className="rounded bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDeleting(server);
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
        title={editing ? "Edit MCP Server" : "Add MCP Server"}
      >
        <form className="space-y-4" onSubmit={(event) => void submitForm(event)}>
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />

          <Select
            label="Transport"
            value={form.transport}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                transport: event.target.value as "stdio" | "http" | "sse",
              }))
            }
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
            <option value="sse">sse</option>
          </Select>

          {form.transport === "stdio" ? (
            <Input
              label="Command"
              value={form.command}
              onChange={(event) => setForm((prev) => ({ ...prev, command: event.target.value }))}
            />
          ) : null}

          <Input
            label="Args (comma separated)"
            value={form.argsText}
            onChange={(event) => setForm((prev) => ({ ...prev, argsText: event.target.value }))}
          />

          {form.transport === "http" || form.transport === "sse" ? (
            <Input
              label="URL"
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            />
          ) : null}

          <div>
            <div className="mb-1 text-sm font-medium text-zinc-700">Enabled Apps</div>
            <AppToggleList
              selected={form.enabled_apps}
              onChange={(enabled_apps) => setForm((prev) => ({ ...prev, enabled_apps }))}
            />
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
        title="Delete MCP Server"
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
