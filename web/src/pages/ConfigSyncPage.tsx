import { useCallback, useEffect, useMemo, useState } from "react";
import { getConfigSync, syncAll, syncConfig } from "../api";
import Button from "../components/Button";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import DiffViewer from "../components/DiffViewer";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toast";
import type { ConfigSyncEntry } from "../types";

function relativeTime(input: string | null): string {
  if (!input) return "Never";
  const diffMs = Date.now() - new Date(input).getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const statusVariant: Record<ConfigSyncEntry["status"], "success" | "warning" | "danger"> = {
  synced: "success",
  pending: "warning",
  conflict: "danger",
  error: "danger",
};

export default function ConfigSyncPage() {
  const [entries, setEntries] = useState<ConfigSyncEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigSync();
      setEntries(data.entries ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to load config sync", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSync = async (id: string) => {
    setSyncingId(id);
    try {
      await syncConfig(id);
      const data = await getConfigSync();
      setEntries(data.entries ?? []);
      toast("Config synced", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to sync config", "error");
    } finally {
      setSyncingId(null);
    }
  };

  const onSyncAll = async () => {
    setSyncingAll(true);
    try {
      const data = await syncAll();
      setEntries(data.entries ?? []);
      toast("All configurations synced", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to sync all", "error");
    } finally {
      setSyncingAll(false);
    }
  };

  const columns = useMemo<DataTableColumn<ConfigSyncEntry>[]>(
    () => [
      {
        key: "app",
        header: "App",
        sortable: true,
      },
      {
        key: "config_type",
        header: "Config Type",
        sortable: true,
        render: (row) => row.config_type,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (row) => <StatusBadge label={row.status} variant={statusVariant[row.status]} />,
      },
      {
        key: "last_synced",
        header: "Last Synced",
        sortable: true,
        accessor: (row) => row.last_synced ?? "",
        render: (row) => <span className="text-xs text-[var(--muted)]">{relativeTime(row.last_synced)}</span>,
      },
      {
        key: "id",
        header: "Actions",
        render: (row) => (
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              void onSync(row.id);
            }}
            disabled={syncingId === row.id || syncingAll}
          >
            {syncingId === row.id ? "Syncing..." : "Sync"}
          </Button>
        ),
      },
    ],
    [syncingAll, syncingId],
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="配置同步" description="跨 CLI 工具同步配置">
        <Button onClick={() => void onSyncAll()} disabled={syncingAll}>
          {syncingAll ? "Syncing..." : "Sync All"}
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={entries}
        emptyText="No sync entries."
        onRowClick={(row) => {
          setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(row.id)) next.delete(row.id);
            else next.add(row.id);
            return next;
          });
        }}
        expandedRowIds={expandedIds}
        expandedRowRender={(row) => (
          <DiffViewer
            left={row.local_hash}
            right={row.remote_hash}
            leftLabel="Local Hash"
            rightLabel="Remote Hash"
          />
        )}
      />
    </div>
  );
}
