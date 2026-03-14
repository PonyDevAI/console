import type { ComponentType } from "react";
import { Link } from "react-router-dom";

type StatItem = {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  href?: string;
};

type StatGridProps = {
  stats: StatItem[];
};

export default function StatGrid({ stats }: StatGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const body = (
          <div
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]"
            style={{
              animation: "rise 0.25s cubic-bezier(0.16, 1, 0.3, 1) backwards",
              animationDelay: `${index * 50}ms`,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-hover)]">
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold tabular-nums text-[var(--text-strong)]">{stat.value}</div>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">{stat.label}</div>
          </div>
        );

        if (stat.href) {
          return (
            <Link key={stat.label} to={stat.href}>
              {body}
            </Link>
          );
        }

        return <div key={stat.label}>{body}</div>;
      })}
    </div>
  );
}
