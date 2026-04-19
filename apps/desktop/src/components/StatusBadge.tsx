import { cn } from "../lib/utils";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = statusTone(status);

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "ok" && "bg-[var(--success)]/15 text-[var(--success)]",
        tone === "warn" && "bg-[var(--warning)]/15 text-[var(--warning)]",
        tone === "danger" && "bg-[var(--danger)]/15 text-[var(--danger)]",
        tone === "muted" && "bg-[var(--accent-subtle)] text-[var(--muted)]",
        tone === "info" && "bg-[var(--info)]/15 text-[var(--info)]",
        className
      )}
    >
      {status}
    </span>
  );
}

function statusTone(status: string): "ok" | "warn" | "danger" | "muted" | "info" {
  if (
    status === "Healthy" ||
    status === "Active" ||
    status === "Enabled"
  ) {
    return "ok";
  }
  if (
    status === "Needs Update" ||
    status === "Fallback" ||
    status === "Warning"
  ) {
    return "warn";
  }
  if (status === "Offline" || status === "Disabled") {
    return "muted";
  }
  if (status === "Draft") {
    return "info";
  }
  return "muted";
}
