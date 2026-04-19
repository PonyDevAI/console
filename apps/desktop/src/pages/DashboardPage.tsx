import {
  Terminal,
  Route,
  Plug,
  Activity,
  ArrowRight,
  Clock,
} from "lucide-react";
import { StatCard } from "../components/StatCard";
import { Card } from "../components/Card";

const overviewStats = [
  { label: "Managed CLIs", value: "4", note: "Claude, Codex, Gemini, Cursor" },
  { label: "Provider Paths", value: "7", note: "Including fallback and switch chains" },
  { label: "MCP Services", value: "12", note: "8 enabled, 3 scoped, 1 warning" },
  { label: "Sync Health", value: "97%", note: "Last dry-run: 4 minutes ago" },
];

const recentActivity = [
  "Codex provider path switched to low-latency route",
  "Claude MCP bundle re-synced after local config drift",
  "Cursor skills mirror completed from SSOT repository",
  "Gemini endpoint draft updated but not activated",
];

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Hero */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Desktop First
            </span>
            <h3 className="mt-1 text-[15px] font-semibold text-[var(--text-strong)]">
              Build the native management shell before wiring runtime behavior.
            </h3>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
          This first UI pass fixes layout, hierarchy, and page ownership for desktop.
          It intentionally avoids cloning the browser dashboard.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          icon={<Terminal size={18} strokeWidth={1.8} />}
          label={overviewStats[0].label}
          value={overviewStats[0].value}
          note={overviewStats[0].note}
        />
        <StatCard
          icon={<Route size={18} strokeWidth={1.8} />}
          label={overviewStats[1].label}
          value={overviewStats[1].value}
          note={overviewStats[1].note}
        />
        <StatCard
          icon={<Plug size={18} strokeWidth={1.8} />}
          label={overviewStats[2].label}
          value={overviewStats[2].value}
          note={overviewStats[2].note}
        />
        <StatCard
          icon={<Activity size={18} strokeWidth={1.8} />}
          label={overviewStats[3].label}
          value={overviewStats[3].value}
          note={overviewStats[3].note}
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-[1.2fr_0.8fr] gap-4">
        <Card
          header={
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Recent Activity
                </span>
                <p className="mt-0.5 text-[13px] font-medium text-[var(--text)]">
                  What the operator should see first
                </p>
              </div>
            </div>
          }
        >
          <ul className="flex flex-col gap-2">
            {recentActivity.map((entry) => (
              <li
                key={entry}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2.5 text-[13px] text-[var(--text)]"
              >
                <Clock size={14} strokeWidth={1.8} className="shrink-0 text-[var(--muted)]" />
                {entry}
              </li>
            ))}
          </ul>
        </Card>

        <Card
          header={
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                First Build Scope
              </span>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--text)]">
                Overview, Agent Sources, Providers
              </p>
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">
            These three screens are enough to test desktop information architecture
            without committing to full data editing or terminal workflows.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["independent nav", "mock datasets", "desktop-specific density"].map(
              (tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-accent)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)]"
                >
                  {tag}
                  <ArrowRight size={12} strokeWidth={1.8} />
                </span>
              )
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
