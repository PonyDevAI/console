import { useState } from "react";
import { KeyRound, Shield, FileDown, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { PrivateKeyImportForm } from "./PrivateKeyImportForm";
import { PrivateKeyGenerateForm } from "./PrivateKeyGenerateForm";
import { PasswordCredentialForm } from "./PasswordCredentialForm";

type NewCredentialMode = "menu" | "import-key" | "generate-key" | "create-password";

type NewCredentialModalProps = {
  onCancel: () => void;
  onCreated: () => void;
};

export function NewCredentialModal({ onCancel, onCreated }: NewCredentialModalProps) {
  const [mode, setMode] = useState<NewCredentialMode>("menu");

  const handleCreated = () => {
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-lg)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-[14px] font-semibold text-[var(--text-strong)]">
            {mode === "menu" && "New Credential"}
            {mode === "import-key" && "Import Private Key"}
            {mode === "generate-key" && "Generate Key"}
            {mode === "create-password" && "Create Password"}
          </h3>
          {mode !== "menu" && (
            <button
              type="button"
              onClick={() => setMode("menu")}
              className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
            >
              Back
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto">
          {mode === "menu" && (
            <div className="p-4">
              <p className="mb-4 text-[12px] text-[var(--muted)]">
                Choose the type of credential to create.
              </p>
              <div className="flex flex-col gap-2">
                <MenuOption
                  icon={<KeyRound size={16} />}
                  title="Import Private Key"
                  description="Import an existing SSH key from a file or PEM text"
                  onClick={() => setMode("import-key")}
                />
                <MenuOption
                  icon={<Zap size={16} />}
                  title="Generate Private Key"
                  description="Create a new Ed25519 or RSA 4096 key"
                  onClick={() => setMode("generate-key")}
                />
                <MenuOption
                  icon={<Shield size={16} />}
                  title="Create Password"
                  description="Store a password credential securely"
                  onClick={() => setMode("create-password")}
                />
              </div>
            </div>
          )}

          {mode === "import-key" && (
            <div className="p-4">
              <PrivateKeyImportForm
                onCancel={() => setMode("menu")}
                onSubmit={async (name, pem, passphrase) => {
                  const { importPrivateKey } = await import("../../lib/server-commands");
                  await importPrivateKey(name, pem, passphrase);
                  handleCreated();
                }}
              />
            </div>
          )}

          {mode === "generate-key" && (
            <div className="p-4">
              <PrivateKeyGenerateForm
                onCancel={() => setMode("menu")}
                onSubmit={async (name, algorithm) => {
                  const { generatePrivateKey } = await import("../../lib/server-commands");
                  await generatePrivateKey(name, algorithm);
                  handleCreated();
                }}
              />
            </div>
          )}

          {mode === "create-password" && (
            <div className="p-4">
              <PasswordCredentialForm
                onCancel={() => setMode("menu")}
                onSubmit={async (name, secret) => {
                  const { createPasswordCredential } = await import("../../lib/server-commands");
                  await createPasswordCredential(name, secret);
                  handleCreated();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuOption({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-left transition-colors",
        "hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--text)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--text-strong)]">{title}</p>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">{description}</p>
      </div>
    </button>
  );
}
