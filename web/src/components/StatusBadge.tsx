type StatusBadgeVariant = "success" | "danger" | "warning" | "info" | "muted" | "purple";

type StatusBadgeProps = {
  label: string;
  variant?: StatusBadgeVariant;
};

const variantStyles: Record<StatusBadgeVariant, string> = {
  success: "bg-green-100 text-green-700",
  danger: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
  muted: "bg-zinc-100 text-zinc-600",
  purple: "bg-fuchsia-100 text-fuchsia-700",
};

export default function StatusBadge({ label, variant = "muted" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${variantStyles[variant]}`}>
      {label}
    </span>
  );
}
