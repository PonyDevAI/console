import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";

type McpService = {
  name: string;
  appScope: string;
  transport: string;
  status: "Enabled" | "Disabled" | "Warning";
};

const mcpServices: McpService[] = [
  { name: "GitHub", appScope: "codex, claude", transport: "stdio", status: "Enabled" },
  { name: "Context7", appScope: "codex", transport: "stdio", status: "Enabled" },
  { name: "Memory", appScope: "claude, codex, desktop", transport: "stdio", status: "Enabled" },
  { name: "Playwright", appScope: "desktop", transport: "stdio", status: "Warning" },
  { name: "Exa", appScope: "codex", transport: "stdio", status: "Disabled" },
];

export function McpPage() {
  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Section heading */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Integration
        </span>
        <h3 className="mt-0.5 text-[15px] font-semibold text-[var(--text-strong)]">
          MCP Services
        </h3>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="w-full">
          {/* Header */}
          <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] border-b border-[var(--border)] bg-[var(--bg-accent)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            <span>Name</span>
            <span>Scope</span>
            <span>Transport</span>
            <span>Status</span>
          </div>

          {/* Rows */}
          {mcpServices.map((service) => (
            <div
              key={service.name}
              className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] items-center border-b border-[var(--border)] px-4 py-3 text-[13px] transition-colors last:border-b-0 hover:bg-[var(--bg-hover)]"
            >
              <span className="font-medium text-[var(--text-strong)]">{service.name}</span>
              <span className="text-[var(--text)]">{service.appScope}</span>
              <span className="font-mono text-[12px] text-[var(--muted)]">
                {service.transport}
              </span>
              <span>
                <StatusBadge status={service.status} />
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
