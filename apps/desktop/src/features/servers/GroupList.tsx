import { Folder, Pencil, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { GroupDto, ServerDto } from "../../lib/server-commands";

type GroupListProps = {
  groups: GroupDto[];
  servers: ServerDto[];
  activeGroup?: string;
  onSelect?: (groupId: string) => void;
  onRename?: (groupId: string) => void;
  onDelete?: (groupId: string) => void;
};

export function GroupList({ groups, servers, activeGroup, onSelect, onRename, onDelete }: GroupListProps) {
  const allCount = servers.length;
  const activeGroupData = activeGroup !== "all" ? groups.find((g) => g.id === activeGroup) : null;

  return (
    <div className="flex flex-col gap-0.5">
      {/* All group */}
      <GroupItem
        label="All"
        count={allCount}
        isActive={activeGroup === "all"}
        onClick={() => onSelect?.("all")}
      />

      {/* User groups */}
      {groups.map((g) => {
        const count = servers.filter((s) => s.group_id === g.id).length;
        return (
          <GroupItem
            key={g.id}
            label={g.name}
            count={count}
            isActive={activeGroup === g.id}
            onClick={() => onSelect?.(g.id)}
            onRename={() => onRename?.(g.id)}
            onDelete={() => onDelete?.(g.id)}
          />
        );
      })}

      {groups.length === 0 && (
        <p className="px-2 py-4 text-center text-[11px] text-[var(--muted)]">
          No groups yet
        </p>
      )}

      {/* Active group action bar — visible when a group is selected */}
      {activeGroupData && onRename && onDelete && (
        <div className="mt-2 flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-2 py-1.5">
          <span className="flex-1 truncate text-[11px] text-[var(--muted)]">
            {activeGroupData.name}
          </span>
          <button
            type="button"
            onClick={() => onRename(activeGroupData.id)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)]"
            title="Rename group"
          >
            <Pencil size={11} />
            <span>Rename</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(activeGroupData.id)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--danger)] transition-colors hover:bg-[var(--danger-subtle)]"
            title="Delete group"
          >
            <Trash2 size={11} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

function GroupItem({
  label,
  count,
  isActive,
  onClick,
  onRename,
  onDelete,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5 text-left transition-colors",
        isActive
          ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
          : "text-[var(--text)] hover:bg-[var(--bg-hover)]"
      )}
    >
      <Folder size={13} className={cn("shrink-0", isActive ? "text-[var(--text)]" : "text-[var(--muted)]")} />
      <span className="flex-1 truncate text-[12px] font-medium">{label}</span>
      <span className={cn("text-[11px]", isActive ? "text-[var(--text)]" : "text-[var(--muted)]")}>
        {count}
      </span>
    </button>
  );
}
