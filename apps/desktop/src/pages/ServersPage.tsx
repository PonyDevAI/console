import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Plug,
  FolderInput,
  Monitor,
  RotateCw,
  TestTube,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../components/Button";
import { ServerList } from "../features/servers/ServerList";
import { ServerForm } from "../features/servers/ServerForm";
import { GroupList } from "../features/servers/GroupList";
import {
  listServers,
  listGroups,
  createServer,
  updateServer,
  deleteServer,
  duplicateServer,
  createGroup,
  renameGroup,
  deleteGroup,
  moveServerToGroup,
  type ServerDto,
  type GroupDto,
} from "../lib/server-commands";

type ModalMode = "none" | "create" | "edit";

export function ServersPage() {
  const [modalMode, setModalMode] = useState<ModalMode>("none");
  const [selectedServer, setSelectedServer] = useState<ServerDto | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [servers, setServers] = useState<ServerDto[]>([]);
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Runtime capabilities — truthfully reflect what's available
  const sshProbeAvailable = false;
  const testConnectionAvailable = false;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, g] = await Promise.all([listServers(), listGroups()]);
      setServers(s);
      setGroups(g);
      setSelectedServer((current) =>
        current ? s.find((server) => server.id === current.id) ?? null : null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelect = (server: ServerDto) => {
    setSelectedServer(server);
  };

  const handleCreateServer = async (input: {
    name: string;
    host: string;
    port: number;
    username: string;
    authMethod: "password" | "private_key";
    credentialId: string;
    groupId?: string | null;
  }) => {
    try {
      await createServer({
        name: input.name,
        host: input.host,
        port: input.port,
        username: input.username,
        authMethod: input.authMethod,
        credentialId: input.credentialId,
        groupId: input.groupId || undefined,
      });
      setModalMode("none");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create server");
    }
  };

  const handleUpdateServer = async (input: {
    name: string;
    host: string;
    port: number;
    username: string;
    authMethod: "password" | "private_key";
    credentialId: string;
    groupId?: string | null;
  }) => {
    if (!selectedServer) return;
    try {
      await updateServer({
        id: selectedServer.id,
        name: input.name,
        host: input.host,
        port: input.port,
        username: input.username,
        authMethod: input.authMethod,
        credentialId: input.credentialId,
        groupId: input.groupId,
      });
      setModalMode("none");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update server");
    }
  };

  const handleCreateGroup = async () => {
    const name = window.prompt("New group name");
    if (!name?.trim()) return;
    try {
      await createGroup(name.trim());
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    }
  };

  const handleRenameGroup = async (groupId: string) => {
    const current = groups.find((g) => g.id === groupId);
    if (!current) return;
    const name = window.prompt("Rename group", current.name);
    if (!name?.trim() || name.trim() === current.name) return;
    try {
      await renameGroup(current.id, name.trim());
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename group");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const current = groups.find((g) => g.id === groupId);
    if (!current) return;
    const confirmed = window.confirm(
      `Delete group "${current.name}" and move its servers to ungrouped?`
    );
    if (!confirmed) return;
    try {
      await deleteGroup(current.id, "rehome");
      if (activeGroup === groupId) setActiveGroup("all");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete group");
    }
  };

  const handleDuplicateServer = async () => {
    if (!selectedServer) return;
    try {
      const duplicated = await duplicateServer(selectedServer.id);
      await loadData();
      setSelectedServer(duplicated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate server");
    }
  };

  const handleDeleteServer = async () => {
    if (!selectedServer) return;
    const confirmed = window.confirm(`Delete server "${selectedServer.name}"?`);
    if (!confirmed) return;
    try {
      await deleteServer(selectedServer.id);
      setSelectedServer(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete server");
    }
  };

  const handleMoveToGroup = async (groupId: string | null) => {
    if (!selectedServer) return;
    try {
      await moveServerToGroup(selectedServer.id, groupId);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to move server to group");
    }
  };

  return (
    <div className="flex h-full">
      {/* ── Left: group navigation ── */}
      <div className="flex w-52 shrink-0 flex-col border-r border-[var(--border)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Groups
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCreateGroup}
            title="Create group"
          >
            <Plus size={12} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <GroupList
            groups={groups}
            servers={servers}
            activeGroup={activeGroup}
            onSelect={setActiveGroup}
            onRename={handleRenameGroup}
            onDelete={handleDeleteGroup}
          />
        </div>
        <div className="border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--muted)]">
          {groups.length} group{groups.length !== 1 ? "s" : ""} · {servers.length} server{servers.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Middle: server list + toolbar ── */}
      <div className="flex w-72 shrink-0 flex-col border-r border-[var(--border)]">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {activeGroup === "all"
              ? "All Servers"
              : groups.find((g) => g.id === activeGroup)?.name ?? "Servers"}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setModalMode("create")}
              title="New server"
            >
              <Plus size={13} />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled
              title="OS sync requires SSH probe runtime (not yet available)"
            >
              <RotateCw size={13} />
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-1.5 text-[11px] text-[var(--danger)]">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 text-[var(--muted)] hover:text-[var(--text)]"
            >
              ✕
            </button>
          </div>
        )}

        {/* Server list */}
        <ServerList
          servers={servers}
          loading={loading}
          onSelect={handleSelect}
          selectedId={selectedServer?.id}
          activeGroup={activeGroup}
        />
      </div>

      {/* ── Right: inspector ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selectedServer ? (
          <ServerInspector
            server={selectedServer}
            groups={groups}
            onEdit={() => setModalMode("edit")}
            onDuplicate={handleDuplicateServer}
            onDelete={handleDeleteServer}
            onMoveToGroup={handleMoveToGroup}
            sshProbeAvailable={sshProbeAvailable}
            testConnectionAvailable={testConnectionAvailable}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-center text-[12px] text-[var(--muted)]">
              Select a server to view details
            </p>
            <Button variant="secondary" size="sm" onClick={() => setModalMode("create")}>
              <Plus size={13} />
              Add Server
            </Button>
          </div>
        )}
      </div>

      {/* ── Server form modal ── */}
      {modalMode !== "none" && (
        <ServerFormModal
          mode={modalMode}
          initial={
            modalMode === "edit" && selectedServer
              ? {
                  name: selectedServer.name,
                  host: selectedServer.host,
                  port: selectedServer.port,
                  username: selectedServer.username,
                  authMethod: selectedServer.auth_method,
                  credentialId: selectedServer.credential_id,
                  groupId: selectedServer.group_id,
                }
              : undefined
          }
          groups={groups}
          onCancel={() => setModalMode("none")}
          onSubmit={modalMode === "edit" ? handleUpdateServer : handleCreateServer}
        />
      )}
    </div>
  );
}

/* ── Server Inspector (operational panel) ── */

function ServerInspector({
  server,
  groups,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveToGroup,
  sshProbeAvailable,
  testConnectionAvailable,
}: {
  server: ServerDto;
  groups: GroupDto[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveToGroup: (groupId: string | null) => void;
  sshProbeAvailable: boolean;
  testConnectionAvailable: boolean;
}) {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--info)]/15 text-[var(--info)]">
            <Monitor size={14} />
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--text-strong)]">{server.name}</h3>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-3 py-2">
        <ActionButton
          icon={<TestTube size={13} />}
          label="Test Connection"
          disabled={!testConnectionAvailable}
          tooltip="SSH runtime not yet available"
          onClick={() => {}}
        />
        <ActionButton
          icon={<RotateCw size={13} />}
          label="Sync OS"
          disabled={!sshProbeAvailable}
          tooltip="SSH probe runtime not yet available"
          onClick={() => {}}
        />

        {/* Move to group */}
        <div className="relative">
          <ActionButton
            icon={<FolderInput size={13} />}
            label="Move to Group"
            onClick={() => setMoveMenuOpen(!moveMenuOpen)}
          />
          {moveMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMoveMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-md)]">
                <button
                  type="button"
                  onClick={() => { onMoveToGroup(null); setMoveMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[12px] text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="text-[var(--muted)]">No group</span>
                </button>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { onMoveToGroup(g.id); setMoveMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[12px] text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span>{g.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        <ActionButton icon={<Copy size={13} />} label="Duplicate" onClick={onDuplicate} />
        <ActionButton icon={<Pencil size={13} />} label="Edit" onClick={onEdit} />
        <ActionButton icon={<Trash2 size={13} />} label="Delete" onClick={onDelete} variant="danger" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Connection section */}
        <Section title="Connection">
          <DetailRow label="Host" value={`${server.host}:${server.port}`} />
          <DetailRow label="Username" value={server.username} />
          <DetailRow
            label="Auth"
            value={server.auth_method === "private_key" ? "Private Key" : "Password"}
          />
          <DetailRow label="Credential" value={server.credential_id.slice(0, 8) + "…"} mono />
        </Section>

        {/* OS Detection section */}
        <Section title="OS Detection">
          <DetailRow label="OS" value={server.os_type} />
          <DetailRow label="Status" value={server.os_detection_status} />
          <DetailRow label="Source" value={server.os_detected_from} />
          <DetailRow
            label="Last Sync"
            value={server.last_os_sync_at ? new Date(server.last_os_sync_at).toLocaleString() : "Never"}
          />
          {!sshProbeAvailable && (
            <div className="mt-1 rounded-[var(--radius-md)] bg-[var(--warn-subtle)] px-2.5 py-2">
              <p className="text-[11px] text-[var(--warning)]">
                SSH probe runtime is not yet available. OS detection requires an active SSH connection to probe the remote host.
              </p>
            </div>
          )}
        </Section>

        {/* Metadata section */}
        <Section title="Metadata">
          <DetailRow
            label="Group"
            value={
              server.group_id
                ? groups.find((g) => g.id === server.group_id)?.name ?? "Unknown"
                : "None"
            }
          />
          <DetailRow label="Metrics" value={server.enable_metrics ? "Enabled" : "Disabled"} />
          <DetailRow label="Containers" value={server.enable_containers ? "Enabled" : "Disabled"} />
          <DetailRow
            label="Tags"
            value={server.tags.length > 0 ? server.tags.join(", ") : "None"}
          />
          {server.description && (
            <DetailRow label="Description" value={server.description} />
          )}
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-4 py-2">
        <p className="text-[10px] text-[var(--muted)]">
          Created {new Date(server.created_at).toLocaleDateString()} · Updated {new Date(server.updated_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

/* ── Server Form Modal ── */

function ServerFormModal({
  mode,
  initial,
  groups,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: {
    name: string;
    host: string;
    port: number;
    username: string;
    authMethod: "password" | "private_key";
    credentialId: string;
    groupId?: string | null;
  };
  groups: GroupDto[];
  onCancel: () => void;
  onSubmit: (data: {
    name: string;
    host: string;
    port: number;
    username: string;
    authMethod: "password" | "private_key";
    credentialId: string;
    groupId?: string | null;
  }) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-[14px] font-semibold text-[var(--text-strong)]">
            {mode === "edit" ? "Edit Server" : "New Server"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-[var(--muted)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <ServerForm
            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
            initial={initial}
            onCancel={onCancel}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Shared sub-components ── */

function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip ?? label}
      className={cn(
        "flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[11px] font-medium transition-colors",
        disabled && "cursor-not-allowed opacity-40",
        variant === "danger"
          ? "text-[var(--danger)] hover:bg-[var(--danger-subtle)]"
          : "text-[var(--text)] hover:bg-[var(--bg-hover)]"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] px-4 py-3 last:border-b-0">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h4>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-24 shrink-0 text-[11px] text-[var(--muted)]">{label}</span>
      <span
        className={cn(
          "text-[12px] text-[var(--text-strong)]",
          mono && "font-mono text-[11px]"
        )}
      >
        {value}
      </span>
    </div>
  );
}
