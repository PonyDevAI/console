import { type ReactNode } from "react";
import { cn } from "../lib/utils";

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  className?: string;
};

export function StatCard({ icon, label, value, note, className }: StatCardProps) {
  return (
    <article
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 transition-all duration-180 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]",
        "animate-[rise_0.3s_ease-out_both]",
        className
      )}
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text)]">
        {icon}
      </div>
      <p className="text-[22px] font-bold leading-none tabular-nums text-[var(--text-strong)]">
        {value}
      </p>
      <p className="mt-1 text-[13px] font-medium text-[var(--text)]">{label}</p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">{note}</p>
    </article>
  );
}
