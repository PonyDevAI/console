import { cn } from "../lib/utils";
import { startWindowDrag } from "../lib/windowDrag";

type TopBarProps = {
  title: string;
  chips?: { label: string; variant: "ok" | "neutral" | "accent" }[];
};

export function TopBar({ title, chips = [] }: TopBarProps) {
  return (
    <header
      data-tauri-drag-region
      onMouseDown={startWindowDrag}
      className="flex h-10 items-center justify-between bg-[var(--bg-elevated)] px-5"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span
          data-tauri-drag-region
          className="inline-flex items-center rounded-md bg-[var(--accent-subtle)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-strong)]"
        >
          {title}
        </span>
      </div>

      {chips.length > 0 && (
        <div data-tauri-drag-region className="flex items-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.label}
              data-tauri-drag-region
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                chip.variant === "ok" &&
                  "bg-[var(--success)]/15 text-[var(--success)]",
                chip.variant === "neutral" &&
                  "bg-[var(--accent-subtle)] text-[var(--muted)]",
                chip.variant === "accent" &&
                  "bg-[var(--info)]/15 text-[var(--info)]"
              )}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
