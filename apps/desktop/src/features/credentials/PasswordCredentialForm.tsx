import { useState } from "react";

type PasswordCredentialFormProps = {
  onSubmit?: (name: string, secret: string) => void;
  onCancel?: () => void;
};

export function PasswordCredentialForm({ onSubmit, onCancel }: PasswordCredentialFormProps) {
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !secret.trim()) return;
    onSubmit?.(name.trim(), secret);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Credential Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Database Admin"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Secret</label>
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter secret value"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 pr-16 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
          >
            {showSecret ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--warn-subtle)] p-3 text-[11px] text-[var(--warning)]">
        Secrets are stored in platform secure storage (keychain). Only metadata is shown in the UI — never the secret value.
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Create Credential
        </button>
      </div>
    </form>
  );
}
