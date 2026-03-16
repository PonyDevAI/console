import { cn } from "../lib/utils";

type ChipRowProps = {
  items: string[];
  variant?: "default" | "accent";
  size?: "sm" | "md";
};

export default function ChipRow({ items, variant = "default", size = "sm" }: ChipRowProps) {
  if (items.length === 0) {
    return <span className="text-xs text-[var(--muted)]">None</span>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            size === "md" ? "px-2.5 py-1 text-xs" : "",
            variant === "accent"
              ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
              : "bg-[var(--bg-hover)] text-[var(--muted)]",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
