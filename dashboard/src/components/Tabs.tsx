import type { ComponentType } from "react";
import { cn } from "../lib/utils";

type TabItem = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

type TabsProps = {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
};

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="border-b border-[var(--border)]">
      <div className="flex items-center gap-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-0 py-2 text-sm transition-colors",
                active
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
