import { useState, useRef } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "../../lib/utils";

type PrivateKeyImportFormProps = {
  onSubmit?: (name: string, pem: string, passphrase?: string) => void;
  onCancel?: () => void;
};

export function PrivateKeyImportForm({ onSubmit, onCancel }: PrivateKeyImportFormProps) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<"file" | "paste">("file");
  const [pemContent, setPemContent] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [fileName, setFileName] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPemContent(ev.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (source === "file" && !fileName) return;
    if (source === "paste" && !pemContent.trim()) return;
    onSubmit?.(name.trim(), pemContent, passphrase || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Credential Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Production SSH Key"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Passphrase (optional)</label>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Leave empty if no passphrase"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>

      {/* Source toggle */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Import Source</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setSource("file")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] font-medium transition-colors",
              source === "file"
                ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
                : "text-[var(--muted)] hover:bg-[var(--bg-hover)]"
            )}
          >
            <Upload size={13} /> File Upload
          </button>
          <button
            type="button"
            onClick={() => setSource("paste")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] font-medium transition-colors",
              source === "paste"
                ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
                : "text-[var(--muted)] hover:bg-[var(--bg-hover)]"
            )}
          >
            <FileText size={13} /> Paste PEM
          </button>
        </div>
      </div>

      {/* File upload area */}
      {source === "file" && (
        <div
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed p-6 transition-colors",
            fileName
              ? "border-[var(--border-strong)] bg-[var(--bg-accent)]"
              : "border-[var(--border)] hover:border-[var(--border-strong)]"
          )}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".pem,.key,.txt" className="hidden" onChange={handleFileChange} />
          {fileName ? (
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[var(--info)]" />
              <span className="text-[12px] font-medium text-[var(--text-strong)]">{fileName}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFileName(undefined);
                  setPemContent("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-[var(--muted)] hover:text-[var(--danger)]"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={20} className="mb-2 text-[var(--muted)]" />
              <span className="text-[12px] text-[var(--muted)]">Click to upload .pem or .key file</span>
            </>
          )}
        </div>
      )}

      {/* Paste area */}
      {source === "paste" && (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">PEM Content</label>
          <textarea
            value={pemContent}
            onChange={(e) => setPemContent(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            rows={6}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2 font-mono text-[11px] text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </div>
      )}

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
          Import Key
        </button>
      </div>
    </form>
  );
}
