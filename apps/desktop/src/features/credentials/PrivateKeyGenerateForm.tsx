import { useState } from "react";
import { cn } from "../../lib/utils";

type PrivateKeyGenerateFormProps = {
  onSubmit?: (name: string, algorithm: "ed25519" | "rsa") => void;
  onCancel?: () => void;
};

export function PrivateKeyGenerateForm({ onSubmit, onCancel }: PrivateKeyGenerateFormProps) {
  const [name, setName] = useState("");
  const [algorithm, setAlgorithm] = useState<"ed25519" | "rsa">("ed25519");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit?.(name.trim(), algorithm);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Credential Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. New Server Key"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>

      {/* Algorithm selection */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Algorithm</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setAlgorithm("ed25519")}
            className={cn(
              "flex flex-1 flex-col items-center rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors",
              algorithm === "ed25519"
                ? "border-[var(--border-strong)] bg-[var(--bg-selected)]"
                : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
            )}
          >
            <span className="text-[12px] font-medium text-[var(--text-strong)]">Ed25519</span>
            <span className="text-[10px] text-[var(--muted)]">Fast, modern, 256-bit</span>
          </button>
          <button
            type="button"
            onClick={() => setAlgorithm("rsa")}
            className={cn(
              "flex flex-1 flex-col items-center rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors",
              algorithm === "rsa"
                ? "border-[var(--border-strong)] bg-[var(--bg-selected)]"
                : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
            )}
          >
            <span className="text-[12px] font-medium text-[var(--text-strong)]">RSA 4096</span>
            <span className="text-[10px] text-[var(--muted)]">Compatible, 4096-bit</span>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-[var(--radius-md)] bg-[var(--bg-accent)] p-3 text-[11px] text-[var(--muted)]">
        {algorithm === "ed25519"
          ? "Ed25519 keys are smaller, faster, and recommended for modern SSH. Not all legacy systems support them."
          : "RSA 4096 provides maximum compatibility with older systems. Keys are larger and slightly slower to generate."}
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
          Generate Key
        </button>
      </div>
    </form>
  );
}
