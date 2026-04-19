import { cn } from "../lib/utils";

const APPS = ["claude", "codex", "gemini", "cursor", "opencode", "openclaw"] as const;

type AppToggleListProps = {
  selected: string[];
  onChange: (apps: string[]) => void;
};

export default function AppToggleList({ selected, onChange }: AppToggleListProps) {
  const toggle = (app: string) => {
    if (selected.includes(app)) {
      onChange(selected.filter((a) => a !== app));
      return;
    }
    onChange([...selected, app]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {APPS.map((app) => {
        const active = selected.includes(app);
        return (
          <button
            key={app}
            type="button"
            onClick={() => toggle(app)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs cursor-pointer",
              active ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "bg-[var(--bg-hover)] text-[var(--muted)]",
            )}
          >
            {app}
          </button>
        );
      })}
    </div>
  );
}
