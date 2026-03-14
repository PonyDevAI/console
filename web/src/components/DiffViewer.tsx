import { useMemo } from "react";
import { cn } from "../lib/utils";

type DiffViewerProps = {
  left: string;
  right: string;
  leftLabel?: string;
  rightLabel?: string;
};

export default function DiffViewer({
  left,
  right,
  leftLabel = "Local",
  rightLabel = "Remote",
}: DiffViewerProps) {
  const rows = useMemo(() => {
    const leftLines = left.split("\n");
    const rightLines = right.split("\n");
    const total = Math.max(leftLines.length, rightLines.length);

    return Array.from({ length: total }).map((_, index) => {
      const l = leftLines[index] ?? "";
      const r = rightLines[index] ?? "";
      return {
        index: index + 1,
        leftLine: l,
        rightLine: r,
        changed: l !== r,
      };
    });
  }, [left, right]);

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
        <div className="border-b border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {leftLabel}
        </div>
        <div className="font-mono text-xs">
          {rows.map((row) => (
            <div
              key={`l-${row.index}`}
              className={cn(
                "grid grid-cols-[42px_1fr] border-b border-[var(--border)]/60 px-2 py-1",
                row.changed ? "bg-[var(--danger)]/10" : "",
              )}
            >
              <span className="text-[var(--muted)]">{row.index}</span>
              <span className="text-[var(--text)]">{row.leftLine || " "}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
        <div className="border-b border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {rightLabel}
        </div>
        <div className="font-mono text-xs">
          {rows.map((row) => (
            <div
              key={`r-${row.index}`}
              className={cn(
                "grid grid-cols-[42px_1fr] border-b border-[var(--border)]/60 px-2 py-1",
                row.changed ? "bg-[var(--success)]/10" : "",
              )}
            >
              <span className="text-[var(--muted)]">{row.index}</span>
              <span className="text-[var(--text)]">{row.rightLine || " "}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
