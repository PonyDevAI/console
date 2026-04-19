import { useState } from "react";
import { KeyRound, Shield, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { StatusBadge } from "../../components/StatusBadge";
import type { CredentialDto } from "../../lib/server-commands";

type CredentialListProps = {
  credentials: CredentialDto[];
  loading?: boolean;
  onSelect?: (cred: CredentialDto) => void;
  selectedId?: string;
};

export function CredentialList({
  credentials,
  loading,
  onSelect,
  selectedId,
}: CredentialListProps) {
  const [filter, setFilter] = useState<"all" | "password" | "private_key">("all");
  const [search, setSearch] = useState("");

  const filtered = credentials.filter((c) => {
    if (filter !== "all" && c.kind !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[12px] text-[var(--muted)]">Loading credentials…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filters */}
      <div className="flex flex-col gap-2 border-b border-[var(--border)] p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search credentials…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] py-1.5 pl-8 pr-3 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "private_key", "password"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === f
                  ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
                  : "text-[var(--muted)] hover:bg-[var(--bg-hover)]"
              )}
            >
              {f === "all" ? "All" : f === "private_key" ? "Keys" : "Passwords"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          {filtered.map((cred) => (
            <button
              key={cred.id}
              type="button"
              onClick={() => onSelect?.(cred)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition-colors",
                selectedId === cred.id
                  ? "bg-[var(--bg-selected)]"
                  : "hover:bg-[var(--bg-hover)]"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  cred.kind === "private_key"
                    ? "bg-[var(--info)]/15 text-[var(--info)]"
                    : "bg-[var(--warning)]/15 text-[var(--warning)]"
                )}
              >
                {cred.kind === "private_key" ? <KeyRound size={15} /> : <Shield size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[var(--text-strong)]">{cred.name}</p>
                <p className="truncate text-[11px] text-[var(--muted)]">
                  {cred.kind === "private_key"
                    ? `${cred.algorithm}${cred.rsa_bits ? ` ${cred.rsa_bits}-bit` : ""}`
                    : "Password credential"}
                </p>
              </div>
              <StatusBadge status={cred.source === "imported" ? "Imported" : cred.kind === "private_key" ? "Active" : "Manual"} />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-[12px] text-[var(--muted)]">No credentials found</p>
          )}
        </div>
      </div>

      {/* Footer count */}
      <div className="border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]">
        {filtered.length} credential{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
