import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "../lib/utils";

export function ThemeModeToggle() {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme-mode");
    return (stored as "light" | "dark") || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.setAttribute("data-theme-mode", "dark");
    } else {
      root.removeAttribute("data-theme-mode");
    }
    localStorage.setItem("theme-mode", mode);
  }, [mode]);

  return (
    <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-accent)] p-[3px]">
      <button
        type="button"
        onClick={() => setMode("light")}
        className={cn(
          "flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors",
          mode === "light"
            ? "bg-[var(--accent)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        )}
      >
        <Sun size={14} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={() => setMode("dark")}
        className={cn(
          "flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors",
          mode === "dark"
            ? "bg-[var(--accent)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        )}
      >
        <Moon size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
