import { Eye, Radio } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createMcpServer, deleteMcpServer, getMcpServers, pingMcpServer, updateMcpServer } from "../api";
import AppToggleList from "../components/AppToggleList";
import Button from "../components/Button";
import Card from "../components/Card";
import ChipRow from "../components/ChipRow";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import { Input, Select } from "../components/FormFields";
import KeyValueEditor from "../components/KeyValueEditor";
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
  env: Record<string, string>;
  enabled_apps: string[];
};

const emptyForm: McpFormState = {
  name: "",
  transport: "stdio",
  command: "",
  argsText: "",
  url: "",
  env: {},
  enabled_apps: [],
};

export default function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [deleting, setDeleting] = useState<McpServer | null>(null);
  const [viewing, setViewing] = useState<McpServer | null>(null);
  const [form, setForm] = useState<McpFormState>(emptyForm);
  const [pingResult, setPingResult] = useState<Record<string, string>>({});

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
      env: server.env,
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
      env: form.env,
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
          env: payload.env,
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
      setDeleting(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete MCP server", "error");
    } finally {
      setSaving(false);
    }
  };

  const onPing = async (server: McpServer) => {
    setPingingId(server.id);
    try {
      const result = await pingMcpServer(server.id);
      const text = result.ok ? `${result.latency_ms}ms` : "Failed";
      setPingResult((prev) => ({ ...prev, [server.id]: text }));
      toast(result.ok ? `${server.name} is reachable` : `${server.name} ping failed`, result.ok ? "success" : "error");
    } catch (err: unknown) {
      setPingResult((prev) => ({ ...prev, [server.id]: "Failed" }));
      toast(err instanceof Error ? err.message : "Failed to ping MCP server", "error");
    } finally {
      setPingingId(null);
    }
  };

  return (
    <div>
      <PageHeader title="MCP 服务器" description="托管上下文协议服务器注册表">
        <Button onClick={openCreateModal}>Add Server</Button>
      </PageHeader>

      {loading ? <Spinner /> : null}
      {!loading && error ? (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {!loading && !error && servers.length === 0 ? <EmptyState message="No MCP servers configured." /> : null}

      {!loading && !error && servers.length > 0 ? (
        <div className="space-y-3">
          {servers.map((server) => (
            <Card key={server.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-strong)]">{server.name}</span>
                    <StatusBadge label={server.transport} variant="accent" />
                  </div>
                  {server.command ? (
                    <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                      {server.command} {server.args.join(" ")}
                    </p>
                  ) : null}
                  {server.url ? <p className="mt-1 font-mono text-xs text-[var(--muted)]">{server.url}</p> : null}
                  <ChipRow items={server.enabled_apps} variant="accent" />
                  {pingResult[server.id] ? (
                    <div className="mt-2 text-xs text-[var(--muted)]">Ping: {pingResult[server.id]}</div>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void onPing(server)}
                    disabled={pingingId === server.id}
                  >
                    <Radio className="h-4 w-4" />
                    {pingingId === server.id ? "Pinging..." : "Ping"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setViewing(server)}>
                    <Eye className="h-4 w-4" />
                    View Config
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEditModal(server)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleting(server)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Modal
        open={openForm}
        onClose={() => !saving && setOpenForm(false)}
        title={editing ? "Edit MCP Server" : "Add MCP Server"}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="mcp-form" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <form id="mcp-form" className="space-y-4" onSubmit={(event) => void submitForm(event)}>
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
              setForm((prev) => ({ ...prev, transport: event.target.value as "stdio" | "http" | "sse" }))
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
            <div className="mb-1 text-xs font-medium text-[var(--muted)]">Env Variables</div>
            <KeyValueEditor value={form.env} onChange={(env) => setForm((prev) => ({ ...prev, env }))} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--muted)]">Enabled Apps</div>
            <AppToggleList
              selected={form.enabled_apps}
              onChange={(enabled_apps) => setForm((prev) => ({ ...prev, enabled_apps }))}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={`MCP Config: ${viewing?.name ?? ""}`}
      >
        <pre className="overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] p-3">
          <code className="font-mono text-xs text-[var(--text)]">{JSON.stringify(viewing, null, 2)}</code>
        </pre>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete MCP Server"
        message={`Confirm delete ${deleting?.name ?? "this server"}?`}
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
