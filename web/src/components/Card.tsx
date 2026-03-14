import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type CardProps = {
  children?: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
};

export default function Card({ children, className, header, footer }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] transition-[border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--border-strong)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      {header ? <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--muted)]">{header}</div> : null}
      {children ? <div className="p-4">{children}</div> : null}
      {footer ? <div className="border-t border-[var(--border)] px-4 py-3">{footer}</div> : null}
    </div>
  );
}
