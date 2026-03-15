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
  if (!input) return "从未";
  const diffMs = Date.now() - new Date(input).getTime();
  if (diffMs < 60_000) return "刚刚";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
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
      toast(err instanceof Error ? err.message : "加载配置同步失败", "error");
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
      toast("配置已同步", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "同步配置失败", "error");
    } finally {
      setSyncingId(null);
    }
  };

  const onSyncAll = async () => {
    setSyncingAll(true);
    try {
      const data = await syncAll();
      setEntries(data.entries ?? []);
      toast("所有配置已同步", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "全部同步失败", "error");
    } finally {
      setSyncingAll(false);
    }
  };

  const columns = useMemo<DataTableColumn<ConfigSyncEntry>[]>(
    () => [
      {
        key: "app",
        header: "应用",
        sortable: true,
      },
      {
        key: "config_type",
        header: "配置类型",
        sortable: true,
        render: (row) => row.config_type,
      },
      {
        key: "status",
        header: "状态",
        sortable: true,
        render: (row) => <StatusBadge label={row.status} variant={statusVariant[row.status]} />,
      },
      {
        key: "last_synced",
        header: "上次同步",
        sortable: true,
        accessor: (row) => row.last_synced ?? "",
        render: (row) => <span className="text-xs text-[var(--muted)]">{relativeTime(row.last_synced)}</span>,
      },
      {
        key: "id",
        header: "操作",
        render: (row) => (
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              void onSync(row.id);
            }}
            disabled={syncingId === row.id || syncingAll}
          >
            {syncingId === row.id ? "同步中..." : "同步"}
          </Button>
        ),
      },
    ],
    [syncingAll, syncingId],
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="配置同步" description="跨工具同步配置">
        <Button onClick={() => void onSyncAll()} disabled={syncingAll}>
          {syncingAll ? "同步中..." : "全部同步"}
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={entries}
        emptyText="暂无同步条目。"
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
            leftLabel="本地哈希"
            rightLabel="远程哈希"
          />
        )}
      />
    </div>
  );
}
