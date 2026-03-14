import { cn } from "../lib/utils";

type StatusBadgeVariant = "success" | "danger" | "warning" | "info" | "muted" | "purple" | "accent";

type StatusBadgeProps = {
  label: string;
  variant?: StatusBadgeVariant;
};

const variantStyles: Record<StatusBadgeVariant, string> = {
  success: "bg-[var(--success)]/15 text-[var(--success)]",
  danger: "bg-[var(--danger)]/15 text-[var(--danger)]",
  warning: "bg-[var(--warning)]/15 text-[var(--warning)]",
  info: "bg-[var(--info)]/15 text-[var(--info)]",
  muted: "bg-[var(--bg-hover)] text-[var(--muted)]",
  purple: "bg-[var(--accent-subtle)] text-[var(--accent)]",
  accent: "bg-[var(--accent-subtle)] text-[var(--accent)]",
};

export default function StatusBadge({ label, variant = "muted" }: StatusBadgeProps) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", variantStyles[variant])}>
      {label}
    </span>
  );
}
