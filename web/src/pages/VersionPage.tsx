import { useCallback, useEffect, useState } from "react";
import {
  checkUpdates,
  getCliTools,
  installTool,
  scanCliTools,
  uninstallTool,
  upgradeTool,
} from "../api";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toast";
import type { CliTool } from "../types";

type ActionType = "install" | "upgrade" | "uninstall";

type PendingAction = {
  type: ActionType;
  tool: CliTool;
};

export default function VersionPage() {
  const [tools, setTools] = useState<CliTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCliTools();
      setTools(data.tools ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load CLI tools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await scanCliTools();
      setTools(data.tools ?? []);
      toast("Tool scan completed", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to scan tools");
    } finally {
      setRefreshing(false);
    }
  };

  const onCheckUpdates = async () => {
    setChecking(true);
    setError(null);
    try {
      const data = await checkUpdates();
      setTools(data.tools ?? []);
      toast("Update check completed", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to check updates");
    } finally {
      setChecking(false);
    }
  };

  const onConfirmAction = async () => {
    if (!pending) return;
    setSubmitting(true);
    setError(null);

    try {
      if (pending.type === "install") {
        await installTool(pending.tool.name);
        toast(`${pending.tool.display_name} installed`, "success");
      }
      if (pending.type === "upgrade") {
        await upgradeTool(pending.tool.name);
        toast(`${pending.tool.display_name} upgraded`, "success");
      }
      if (pending.type === "uninstall") {
        await uninstallTool(pending.tool.name);
        toast(`${pending.tool.display_name} uninstalled`, "success");
      }
      const latest = await getCliTools();
      setTools(latest.tools ?? []);
      setPending(null);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-sm text-[var(--muted)]">Loading...</div>;

  return (
    <div className="space-y-4">
      <PageHeader title="实例" description="CLI 工具版本和安装状态">
        <Button variant="secondary" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? "Scanning..." : "Refresh"}
        </Button>
        <Button onClick={() => void onCheckUpdates()} disabled={checking}>
          {checking ? "Checking..." : "Check Updates"}
        </Button>
      </PageHeader>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {tools.length === 0 ? (
        <EmptyState message="No CLI tools detected." />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-accent)] text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left">Tool</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Installed</th>
                <th className="px-4 py-3 text-left">Latest</th>
                <th className="px-4 py-3 text-left">Path</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const hasUpdate =
                  tool.installed &&
                  tool.local_version &&
                  tool.remote_version &&
                  tool.local_version !== tool.remote_version;

                return (
                  <tr key={tool.name} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-3 text-sm text-[var(--text)]">{tool.display_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={tool.installed ? "Installed" : "Missing"}
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
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{tool.remote_version ?? "-"}</td>
                    <td className="max-w-56 truncate px-4 py-3 font-mono text-xs text-[var(--muted)]">{tool.path ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {!tool.installed ? (
                          <Button size="sm" onClick={() => setPending({ type: "install", tool })}>
                            Install
                          </Button>
                        ) : null}
                        {tool.installed && hasUpdate ? (
                          <Button size="sm" onClick={() => setPending({ type: "upgrade", tool })}>
                            Upgrade
                          </Button>
                        ) : null}
                        {tool.installed ? (
                          <Button size="sm" variant="ghost" onClick={() => setPending({ type: "uninstall", tool })}>
                            Uninstall
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={`${pending?.type[0]?.toUpperCase() ?? ""}${pending?.type.slice(1) ?? ""} ${pending?.tool.display_name ?? ""}`}
        message={`Please confirm ${pending?.type ?? "operation"} for ${pending?.tool.display_name ?? "this tool"}.`}
        confirmLabel={pending?.type ? pending.type[0].toUpperCase() + pending.type.slice(1) : "Confirm"}
        variant={pending?.type === "uninstall" ? "danger" : "default"}
        loading={submitting}
        onCancel={() => setPending(null)}
        onConfirm={() => void onConfirmAction()}
      />
    </div>
  );
}
