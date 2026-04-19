import { KeyRound, Shield, Calendar, Hash, Cpu, Fingerprint, Database, Pencil, RotateCw, Trash2, Server } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import type { CredentialDto, ServerDto } from "../../lib/server-commands";

type CredentialDetailPanelProps = {
  credential: CredentialDto | null;
  boundServers?: ServerDto[];
  onChangePassphrase?: (id: string) => void | Promise<void>;
  onValidate?: (id: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

export function CredentialDetailPanel({
  credential,
  boundServers = [],
  onChangePassphrase,
  onValidate,
  onDelete,
}: CredentialDetailPanelProps) {
  const [passphraseModal, setPassphraseModal] = useState(false);
  const [validating, setValidating] = useState(false);

  if (!credential) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-[12px] text-[var(--muted)]">
          Select a credential to view details
        </p>
      </div>
    );
  }

  const isPrivateKey = credential.kind === "private_key";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              isPrivateKey
                ? "bg-[var(--info)]/15 text-[var(--info)]"
                : "bg-[var(--warning)]/15 text-[var(--warning)]"
            )}
          >
            {isPrivateKey ? <KeyRound size={14} /> : <Shield size={14} />}
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--text-strong)]">{credential.name}</h3>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
        {isPrivateKey && onChangePassphrase && (
          <ActionButton
            icon={<Pencil size={13} />}
            label="Change Passphrase"
            onClick={() => setPassphraseModal(true)}
          />
        )}
        {onValidate && (
          <ActionButton
            icon={<RotateCw size={13} />}
            label="Recheck"
            onClick={async () => {
              setValidating(true);
              try {
                await onValidate(credential.id);
              } finally {
                setValidating(false);
              }
            }}
            disabled={validating}
            tooltip={validating ? "Validating credential…" : "Validate stored secret and metadata"}
          />
        )}
        {onDelete && (
          <ActionButton
            icon={<Trash2 size={13} />}
            label="Delete"
            onClick={() => onDelete(credential.id)}
            variant="danger"
          />
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Metadata section */}
        <Section title="Properties">
          <DetailRow label="ID" value={credential.id} mono />
          <DetailRow
            label="Kind"
            value={isPrivateKey ? "Private Key" : "Password"}
          />

          {isPrivateKey && (
            <>
              <DetailRow
                label="Algorithm"
                value={credential.algorithm ? credential.algorithm.toUpperCase() : "Unknown"}
              />
              {credential.rsa_bits && (
                <DetailRow label="Key Size" value={`${credential.rsa_bits} bits`} />
              )}
              <DetailRow
                label="Fingerprint"
                value={credential.fingerprint || "Not available"}
                mono
              />
              <DetailRow label="Source" value={credential.source || "Unknown"} />
              {credential.strength && (
                <DetailRow label="Strength" value={credential.strength} />
              )}
              <DetailRow
                label="Passphrase"
                value={credential.has_passphrase ? "Set" : "None"}
              />
            </>
          )}

          {!isPrivateKey && (
            <DetailRow
              label="Has Value"
              value={credential.has_value ? "Yes" : "No"}
            />
          )}

          <DetailRow
            label="Storage"
            value={credential.storage_mode === "keychain_ref" ? "Platform Keychain" : "Encrypted File"}
          />
          <DetailRow
            label="Created"
            value={new Date(credential.created_at).toLocaleString()}
          />
          <DetailRow
            label="Updated"
            value={new Date(credential.updated_at).toLocaleString()}
          />
          {credential.last_validated_at && (
            <DetailRow
              label="Last Validated"
              value={new Date(credential.last_validated_at).toLocaleString()}
            />
          )}
        </Section>

        {/* Bound servers section */}
        <Section title={`Bound Servers (${boundServers.length})`}>
          {boundServers.length === 0 ? (
            <p className="py-2 text-[12px] text-[var(--muted)]">
              No servers currently use this credential.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {boundServers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-accent)] px-2.5 py-2"
                >
                  <Server size={12} className="shrink-0 text-[var(--muted)]" />
                  <span className="flex-1 truncate text-[12px] text-[var(--text-strong)]">
                    {s.name}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {s.host}:{s.port}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-4 py-2">
        <p className="text-[10px] text-[var(--muted)]">
          Secret values are never displayed. Only metadata is shown.
        </p>
      </div>

      {/* Passphrase change modal */}
      {passphraseModal && isPrivateKey && (
        <ChangePassphraseModal
          credentialId={credential.id}
          hasPassphrase={credential.has_passphrase ?? false}
          onSubmit={async (oldP, newP) => {
            const { changePrivateKeyPassphrase } = await import("../../lib/server-commands");
            await changePrivateKeyPassphrase(credential.id, oldP, newP);
            setPassphraseModal(false);
            onChangePassphrase?.(credential.id);
          }}
          onCancel={() => setPassphraseModal(false)}
        />
      )}
    </div>
  );
}

/* ── Sub-components ── */

function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip ?? label}
      className={cn(
        "flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[11px] font-medium transition-colors",
        disabled && "cursor-not-allowed opacity-40",
        variant === "danger"
          ? "text-[var(--danger)] hover:bg-[var(--danger-subtle)]"
          : "text-[var(--text)] hover:bg-[var(--bg-hover)]"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] px-4 py-3 last:border-b-0">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h4>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-24 shrink-0 text-[11px] text-[var(--muted)]">{label}</span>
      <span
        className={cn(
          "text-[12px] text-[var(--text-strong)]",
          mono && "font-mono text-[11px]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Change Passphrase Modal ── */

function ChangePassphraseModal({
  credentialId,
  hasPassphrase,
  onSubmit,
  onCancel,
}: {
  credentialId: string;
  hasPassphrase: boolean;
  onSubmit: (
    oldPassphrase: string | undefined,
    newPassphrase: string
  ) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [oldPassphrase, setOldPassphrase] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassphrase !== confirmPassphrase) {
      setError("New passphrase and confirmation do not match.");
      return;
    }
    if (!newPassphrase.trim()) {
      setError("New passphrase is required.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(
        hasPassphrase ? oldPassphrase || undefined : undefined,
        newPassphrase
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change passphrase.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-[14px] font-semibold text-[var(--text-strong)]">
            Change Passphrase
          </h3>
          <button type="button" onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--text)]">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4">
          <p className="mb-3 text-[12px] text-[var(--muted)]">
            {hasPassphrase
              ? "Enter the current passphrase and the new one."
              : "This key has no passphrase. Set one now."}
          </p>
          <div className="flex flex-col gap-3">
            {error && (
              <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[11px] text-[var(--danger)]">
                {error}
              </div>
            )}
            {hasPassphrase && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
                  Current Passphrase
                </label>
                <input
                  type="password"
                  value={oldPassphrase}
                  onChange={(e) => setOldPassphrase(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] focus:border-[var(--border-strong)] focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
                New Passphrase
              </label>
              <input
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                disabled={submitting}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] focus:border-[var(--border-strong)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
                Confirm
              </label>
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                disabled={submitting}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] focus:border-[var(--border-strong)] focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Updating…" : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
