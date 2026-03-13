const APPS = ["claude", "codex", "gemini", "cursor"] as const;

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
            className={`rounded px-2 py-1 text-xs ${active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}
          >
            {app}
          </button>
        );
      })}
    </div>
  );
}
