import { useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();

export function toast(message: string, variant: ToastVariant = "info") {
  const item: ToastItem = { id: crypto.randomUUID(), message, variant };
  listeners.forEach((listener) => listener(item));
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

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`min-w-56 rounded-lg px-3 py-2 text-sm shadow ${
            item.variant === "success"
              ? "bg-green-100 text-green-800"
              : item.variant === "error"
                ? "bg-red-100 text-red-800"
                : "bg-blue-100 text-blue-800"
          }`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
