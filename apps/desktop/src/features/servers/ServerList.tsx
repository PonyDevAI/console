import { useState } from "react";
import { Server, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { StatusBadge } from "../../components/StatusBadge";
import { OsIcon } from "../server-os-sync/OsIcon";
import type { ServerDto } from "../../lib/server-commands";

type ServerListProps = {
  servers: ServerDto[];
  loading?: boolean;
  onSelect?: (server: ServerDto) => void;
  selectedId?: string;
  activeGroup: string;
};

export function ServerList({
  servers,
  loading,
  onSelect,
  selectedId,
  activeGroup,
}: ServerListProps) {
  const [search, setSearch] = useState("");

  const filtered = servers.filter((s) => {
    if (activeGroup !== "all" && s.group_id !== activeGroup) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.host.includes(search)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[12px] text-[var(--muted)]">Loading servers…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="border-b border-[var(--border)] p-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] py-1.5 pl-7 pr-3 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5">
        <div className="flex flex-col gap-0.5">
          {filtered.map((server) => (
            <button
              key={server.id}
              type="button"
              onClick={() => onSelect?.(server)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-left transition-colors",
                selectedId === server.id
                  ? "bg-[var(--bg-selected)]"
                  : "hover:bg-[var(--bg-hover)]"
              )}
            >
              <OsIcon os={server.os_type} size={18} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[12px] font-medium text-[var(--text-strong)]">
                  <Server size={11} className="shrink-0 text-[var(--muted)]" />
                  {server.name}
                </p>
                <p className="truncate text-[11px] text-[var(--muted)]">
                  {server.host}:{server.port}
                </p>
              </div>
              <StatusBadge status={server.os_detection_status} />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-[12px] text-[var(--muted)]">
              {servers.length === 0 ? "No servers yet" : "No servers found"}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--muted)]">
        {filtered.length} server{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
