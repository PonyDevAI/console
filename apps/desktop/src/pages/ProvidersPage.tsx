import { Plus } from "lucide-react";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/Button";

type Provider = {
  name: string;
  mode: "direct" | "switch";
  endpoint: string;
  activeModel: string;
  status: "Active" | "Fallback" | "Offline";
};

const providers: Provider[] = [
  {
    name: "Primary Coding",
    mode: "switch",
    endpoint: "router.debox.ai/v1",
    activeModel: "claude-sonnet-4.5",
    status: "Active",
  },
  {
    name: "Fast Draft",
    mode: "direct",
    endpoint: "openrouter.ai/api/v1",
    activeModel: "gpt-5.4-mini",
    status: "Fallback",
  },
  {
    name: "Local Review",
    mode: "direct",
    endpoint: "127.0.0.1:4000/v1",
    activeModel: "qwen-coder-review",
    status: "Offline",
  },
];

export function ProvidersPage() {
  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Routing
          </span>
          <h3 className="mt-0.5 text-[15px] font-semibold text-[var(--text-strong)]">
            Providers
          </h3>
        </div>
        <Button variant="ghost" size="sm">
          <Plus size={14} strokeWidth={1.8} />
          New provider path
        </Button>
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-3 gap-3">
        {providers.map((provider) => (
          <Card key={provider.name}>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[var(--text-strong)]">
                {provider.name}
              </p>
              <StatusBadge status={provider.status} />
            </div>
            <p className="mt-2 truncate text-[12px] font-mono text-[var(--muted)]">
              {provider.endpoint}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
                  Mode
                </dt>
                <dd className="mt-0.5 text-[12px] font-medium text-[var(--text)]">
                  {provider.mode}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
                  Model
                </dt>
                <dd className="mt-0.5 text-[12px] font-medium text-[var(--text)]">
                  {provider.activeModel}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
