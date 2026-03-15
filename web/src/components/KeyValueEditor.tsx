import { Plus, Trash2 } from "lucide-react";
import Button from "./Button";

type Entry = {
  key: string;
  value: string;
};

type KeyValueEditorProps = {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
};

function toEntries(value: Record<string, string>): Entry[] {
  return Object.entries(value).map(([key, val]) => ({ key, value: val }));
}

function toRecord(entries: Entry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    result[key] = entry.value;
  }
  return result;
}

export default function KeyValueEditor({ value, onChange }: KeyValueEditorProps) {
  const entries = toEntries(value);

  const updateAt = (index: number, patch: Partial<Entry>) => {
    const next = [...entries];
    next[index] = { ...next[index], ...patch };
    onChange(toRecord(next));
  };

  const removeAt = (index: number) => {
    const next = entries.filter((_, i) => i !== index);
    onChange(toRecord(next));
  };

  const addRow = () => {
    onChange(toRecord([...entries, { key: "", value: "" }]));
  };

  return (
    <div className="space-y-2">
      {entries.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
          暂无条目
        </div>
      ) : null}
      {entries.map((entry, index) => (
        <div key={`${index}-${entry.key}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            placeholder="键"
            value={entry.key}
            onChange={(event) => updateAt(index, { key: event.target.value })}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <input
            placeholder="值"
            value={entry.value}
            onChange={(event) => updateAt(index, { value: event.target.value })}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => removeAt(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </div>
  );
}
