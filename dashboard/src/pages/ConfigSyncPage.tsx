import { useCallback, useEffect, useMemo, useState } from "react";
import { getConfigSync, syncAll, syncConfig, getBackups, createBackup, restoreBackup, deleteBackup } from "../api";
import Button from "../components/Button";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import DiffViewer from "../components/DiffViewer";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toast";
import type { ConfigSyncEntry, BackupMeta } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";

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

  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingBackup, setDeletingBackup] = useState<BackupMeta | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupMeta | null>(null);

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

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      const data = await getBackups();
      setBackups(data.backups ?? []);
    } catch { /* 静默 */ } finally {
      setBackupsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadBackups();
  }, [load, loadBackups]);

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

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await createBackup();
      toast("备份创建成功", "success");
      void loadBackups();
    } catch {
      toast("备份失败", "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      await restoreBackup(id);
      toast("恢复成功，建议重启服务使配置生效", "success");
    } catch {
      toast("恢复失败", "error");
    } finally {
      setRestoringId(null);
      setConfirmRestore(null);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    try {
      await deleteBackup(id);
      toast("备份已删除", "success");
      void loadBackups();
    } catch {
      toast("删除失败", "error");
    } finally {
      setDeletingBackup(null);
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

      {/* 备份 / 恢复 */}
      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-strong)]">配置备份</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">快照 ~/.console/state/ 下所有配置文件</p>
          </div>
          <Button onClick={handleCreateBackup} disabled={creatingBackup}>
            {creatingBackup ? "备份中..." : "立即备份"}
          </Button>
        </div>

        {backupsLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : backups.length === 0 ? (
          <div className="text-sm text-[var(--muted)] text-center py-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)]">
            暂无备份
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map(b => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
                <div>
                  <div className="text-sm font-medium text-[var(--text)]">{b.label}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {new Date(b.created_at).toLocaleString("zh-CN")}
                    <span className="ml-2">{(b.size_bytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary"
                    onClick={() => setConfirmRestore(b)}
                    disabled={!!restoringId}
                  >
                    {restoringId === b.id ? "恢复中..." : "恢复"}
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => setDeletingBackup(b)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 确认恢复弹窗 */}
      <ConfirmDialog
        open={!!confirmRestore}
        title="确认恢复"
        message={`恢复备份「${confirmRestore?.label}」将覆盖当前所有配置，操作不可撤销。确定继续？`}
        confirmLabel="恢复"
        variant="danger"
        onCancel={() => setConfirmRestore(null)}
        onConfirm={() => confirmRestore && void handleRestore(confirmRestore.id)}
      />

      {/* 确认删除弹窗 */}
      <ConfirmDialog
        open={!!deletingBackup}
        title="删除备份"
        message={`确认删除备份「${deletingBackup?.label}」？`}
        confirmLabel="删除"
        variant="danger"
        onCancel={() => setDeletingBackup(null)}
        onConfirm={() => deletingBackup && void handleDeleteBackup(deletingBackup.id)}
      />
    </div>
  );
}
