import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();

export function toast(message: string, variant: ToastVariant = "info") {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  listeners.forEach((listener) => listener({ id, message, variant }));
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast: Listener = (item) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== item.id));
      }, 3000);
    };

    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex min-w-64 items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm",
            item.variant === "success"
              ? "border border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
              : item.variant === "error"
                ? "border border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]"
                : "border border-[var(--border)] bg-[var(--card)] text-[var(--text)]",
          )}
        >
          {item.variant === "success" ? <CheckCircle2 className="h-4 w-4" /> : item.variant === "error" ? <XCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
