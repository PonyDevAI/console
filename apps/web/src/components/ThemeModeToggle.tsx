import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../lib/utils";
import type { ThemeMode } from "../hooks/useTheme";

type ThemeModeToggleProps = {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
};

const options: { id: ThemeMode; icon: typeof Monitor; label: string }[] = [
  { id: "system", icon: Monitor, label: "跟随系统" },
  { id: "light", icon: Sun, label: "浅色" },
  { id: "dark", icon: Moon, label: "深色" },
];

export default function ThemeModeToggle({ mode, onChange }: ThemeModeToggleProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border p-[3px]"
      style={{
        borderColor: "color-mix(in srgb, var(--border) 84%, transparent)",
        background: "color-mix(in srgb, var(--bg-elevated) 78%, transparent)",
        height: "32px",
      }}
      role="group"
      aria-label="Color mode"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = opt.id === mode;
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.label}
            aria-label={`Color mode: ${opt.label}`}
            aria-pressed={isActive}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-transparent transition-all cursor-pointer",
              isActive
                ? "bg-[var(--accent)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                : "bg-transparent text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
