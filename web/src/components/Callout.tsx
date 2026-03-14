import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type CalloutVariant = "info" | "warning" | "danger" | "success";

type CalloutProps = {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
};

const styleMap: Record<CalloutVariant, string> = {
  info: "bg-[var(--info)]/8 border-[var(--info)] text-[var(--text)]",
  warning: "bg-[var(--warning)]/8 border-[var(--warning)] text-[var(--text)]",
  danger: "bg-[var(--danger)]/8 border-[var(--danger)] text-[var(--text)]",
  success: "bg-[var(--success)]/8 border-[var(--success)] text-[var(--text)]",
};

const iconMap = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
  success: CheckCircle2,
};

export default function Callout({ variant = "info", title, children }: CalloutProps) {
  const Icon = iconMap[variant];
  return (
    <div className={cn("rounded-[var(--radius-md)] border border-l-[3px] px-3 py-2", styleMap[variant])}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4" />
        <div>
          {title ? <div className="text-sm font-medium text-[var(--text-strong)]">{title}</div> : null}
          <div className="text-sm text-[var(--muted)]">{children}</div>
        </div>
      </div>
    </div>
  );
}
