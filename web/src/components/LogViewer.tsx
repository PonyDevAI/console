import { useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry } from "../types";
import Button from "./Button";
import StatusBadge from "./StatusBadge";

type LogViewerProps = {
  logs: LogEntry[];
  maxHeight?: number;
  autoScroll?: boolean;
};

const variantMap = {
  debug: "muted",
  info: "info",
  warn: "warning",
  error: "danger",
} as const;

export default function LogViewer({ logs, maxHeight = 420, autoScroll = true }: LogViewerProps) {
  const [entries, setEntries] = useState<LogEntry[]>(logs);
  const [follow, setFollow] = useState(autoScroll);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEntries(logs);
  }, [logs]);

  useEffect(() => {
    if (!follow) return;
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries, follow]);

  const countText = useMemo(() => `${entries.length} entries`, [entries.length]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
      <div
        ref={bodyRef}
        className="overflow-auto px-3 py-2 font-mono text-xs"
        style={{ maxHeight }}
      >
        {entries.length === 0 ? (
          <div className="py-6 text-center text-[var(--muted)]">No logs.</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-2 leading-6">
                <span className="text-[11px] text-[var(--muted)]">{new Date(entry.timestamp).toLocaleString()}</span>
                <StatusBadge label={entry.level.toUpperCase()} variant={variantMap[entry.level]} />
                <span className="text-xs text-[var(--accent)]">{entry.source}</span>
                <span className="text-[var(--text)]">{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2">
        <div className="text-xs text-[var(--muted)]">{countText}</div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
            Auto-scroll
          </label>
          <Button size="xs" variant="ghost" onClick={() => setEntries([])}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
