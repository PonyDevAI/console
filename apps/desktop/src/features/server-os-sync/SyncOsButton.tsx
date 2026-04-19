import { useState } from "react";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/Button";

type SyncState = "idle" | "syncing" | "success" | "failed";

type SyncOsButtonProps = {
  onSync?: () => Promise<void>;
  syncing?: boolean;
  disabled?: boolean;
  idleLabel?: string;
};

export function SyncOsButton({
  onSync,
  syncing: externalSyncing,
  disabled = false,
  idleLabel = "Sync OS",
}: SyncOsButtonProps) {
  const [state, setState] = useState<SyncState>("idle");

  const handleSync = async () => {
    if (disabled || !onSync) return;
    setState("syncing");
    try {
      await onSync();
      setState("success");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("failed");
    }
  };

  const isSyncing = externalSyncing ?? state === "syncing";
  const isDisabled = disabled || !onSync;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={state === "failed" ? "destructive" : state === "success" ? "default" : "secondary"}
        size="sm"
        onClick={handleSync}
        disabled={isSyncing || isDisabled}
      >
        {isSyncing && <RefreshCw size={14} className="animate-spin" />}
        {state === "success" && !isSyncing && <Check size={14} />}
        {state === "failed" && !isSyncing && <AlertTriangle size={14} />}
        {!isSyncing && (
          <span>
            {state === "idle" && idleLabel}
            {state === "success" && "Synced"}
            {state === "failed" && "Failed"}
          </span>
        )}
        {isSyncing && <span>Syncing…</span>}
      </Button>

      {state === "failed" && !isSyncing && (
        <button
          type="button"
          onClick={() => setState("idle")}
          className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
