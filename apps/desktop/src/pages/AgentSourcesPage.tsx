import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/Button";

type AgentSource = {
  name: string;
  channel: string;
  version: string;
  models: number;
  status: "Healthy" | "Needs Update" | "Draft";
  summary: string;
};

const agentSources: AgentSource[] = [
  {
    name: "OpenRouter Catalog",
    channel: "remote",
    version: "2026.04",
    models: 18,
    status: "Healthy",
    summary: "Primary model catalog for multi-provider routing and fallback selection.",
  },
  {
    name: "DeBox Internal",
    channel: "managed",
    version: "2026.03",
    models: 9,
    status: "Needs Update",
    summary: "Company-maintained source for approved coding and review models.",
  },
  {
    name: "Experimental Sandbox",
    channel: "local",
    version: "draft",
    models: 5,
    status: "Draft",
    summary: "Temporary source for trying narrow model mixes before promotion.",
  },
];

export function AgentSourcesPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = agentSources[selectedIndex];

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Catalog
          </span>
          <h3 className="mt-0.5 text-[15px] font-semibold text-[var(--text-strong)]">
            Agent Sources
          </h3>
        </div>
        <Button variant="ghost" size="sm">
          <Plus size={14} strokeWidth={1.8} />
          Add source
        </Button>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-[0.92fr_1.08fr] gap-4">
        {/* List */}
        <Card>
          <div className="flex flex-col gap-2">
            {agentSources.map((source, i) => (
              <button
                key={source.name}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={`flex items-start justify-between gap-4 rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors ${
                  i === selectedIndex
                    ? "border-[var(--border-strong)] bg-[var(--bg-selected)]"
                    : "border-[var(--border)] bg-[var(--bg-accent)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-strong)]">
                    {source.name}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
                    {source.summary}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[11px] text-[var(--muted)]">{source.channel}</span>
                  <StatusBadge status={source.status} />
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Detail */}
        <Card
          header={
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Selected Source
              </span>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--text-strong)]">
                {selected.name}
              </p>
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">
            {selected.summary}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-4">
            {[
              { label: "Channel", value: selected.channel },
              { label: "Version", value: selected.version },
              { label: "Models", value: String(selected.models) },
              { label: "Status", value: selected.status },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                  {item.label}
                </dt>
                <dd className="mt-1 text-[14px] font-medium text-[var(--text-strong)]">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--info)]/20 bg-[var(--info)]/8 px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Next Integration
            </span>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
              Wire this page to a <code className="text-[var(--text)]">list_agent_sources</code> desktop command and keep the two-column layout.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
