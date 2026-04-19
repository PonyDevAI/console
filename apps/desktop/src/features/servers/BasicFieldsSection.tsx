type BasicFieldsSectionProps = {
  name: string;
  onNameChange: (v: string) => void;
  host: string;
  onHostChange: (v: string) => void;
  port: number;
  onPortChange: (v: number) => void;
  username: string;
  onUsernameChange: (v: string) => void;
};

export function BasicFieldsSection({
  name, onNameChange,
  host, onHostChange,
  port, onPortChange,
  username, onUsernameChange,
}: BasicFieldsSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Server Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. prod-web-01"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Host</label>
          <input
            type="text"
            value={host}
            onChange={(e) => onHostChange(e.target.value)}
            placeholder="e.g. 10.0.1.10"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </div>
        <div className="w-20">
          <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => onPortChange(Number(e.target.value))}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="e.g. deploy"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>
    </div>
  );
}
