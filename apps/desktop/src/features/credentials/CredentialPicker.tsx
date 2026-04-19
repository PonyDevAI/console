import { useState, useEffect } from "react";
import { ChevronDown, KeyRound, Shield, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { listCredentials, type CredentialDto } from "../../lib/server-commands";

type AuthMethod = "password" | "private_key";

type CredentialPickerProps = {
  authMethod: AuthMethod;
  value?: string;
  onChange?: (credentialId: string) => void;
};

export function CredentialPicker({ authMethod, value, onChange }: CredentialPickerProps) {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<CredentialDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCredentials(authMethod === "private_key" ? "private_key" : "password")
      .then((data) => {
        if (!cancelled) setCredentials(data);
      })
      .catch(() => {
        if (!cancelled) setCredentials([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [authMethod]);

  const selected = credentials.find((c) => c.id === value);

  return (
    <div className="relative">
      <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
        {authMethod === "private_key" ? "SSH Key" : "Password"}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] hover:border-[var(--border-strong)] focus:border-[var(--border-strong)] focus:outline-none"
      >
        {loading ? (
          <span className="text-[var(--muted)]">Loading…</span>
        ) : selected ? (
          <div className="flex items-center gap-2">
            {selected.kind === "private_key" ? (
              <KeyRound size={13} className="text-[var(--info)]" />
            ) : (
              <Shield size={13} className="text-[var(--warning)]" />
            )}
            <span>{selected.name}</span>
          </div>
        ) : (
          <span className="text-[var(--muted)]">
            {authMethod === "private_key" ? "Select an SSH key…" : "Select a password…"}
          </span>
        )}
        <ChevronDown size={14} className={cn("text-[var(--muted)] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-md)]">
            {loading ? (
              <p className="px-3 py-2 text-[11px] text-[var(--muted)]">Loading credentials…</p>
            ) : credentials.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-[var(--muted)]">
                No active {authMethod === "private_key" ? "SSH keys" : "passwords"} available
              </p>
            ) : (
              credentials.map((cred) => (
                <button
                  key={cred.id}
                  type="button"
                  onClick={() => {
                    onChange?.(cred.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors",
                    value === cred.id
                      ? "bg-[var(--bg-selected)]"
                      : "hover:bg-[var(--bg-hover)]"
                  )}
                >
                  {cred.kind === "private_key" ? (
                    <KeyRound size={13} className="text-[var(--info)]" />
                  ) : (
                    <Shield size={13} className="text-[var(--warning)]" />
                  )}
                  <span className="flex-1 text-[12px] text-[var(--text-strong)]">{cred.name}</span>
                  {value === cred.id && <Check size={13} className="text-[var(--success)]" />}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
