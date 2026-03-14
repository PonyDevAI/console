import { CheckCircle2, ChevronDown, ChevronUp, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getSkills, installSkill, uninstallSkill } from "../api";
import AppToggleList from "../components/AppToggleList";
import Button from "../components/Button";
import Card from "../components/Card";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import { toast } from "../components/Toast";
import type { Skill } from "../types";

type FilterType = "all" | "ready" | "missing";
type PendingAction = { type: "install" | "uninstall"; skill: Skill } | null;

export default function SkillPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSkills();
      setSkills(data.skills ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const withReady = useMemo(
    () => skills.map((skill) => ({ ...skill, ready: Boolean(skill.installed_at) })),
    [skills],
  );

  const readyCount = withReady.filter((skill) => skill.ready).length;

  const filtered = withReady.filter((skill) => {
    if (filter === "ready" && !skill.ready) return false;
    if (filter === "missing" && skill.ready) return false;
    if (!keyword.trim()) return true;
    const k = keyword.toLowerCase();
    return (
      skill.name.toLowerCase().includes(k) ||
      (skill.description ?? "").toLowerCase().includes(k) ||
      (skill.source ?? "").toLowerCase().includes(k)
    );
  });

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateEnabledApps = (id: string, enabled_apps: string[]) => {
    setSkills((prev) => prev.map((skill) => (skill.id === id ? { ...skill, enabled_apps } : skill)));
  };

  const onConfirmAction = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      if (pending.type === "install") {
        await installSkill(pending.skill.id);
        toast(`${pending.skill.name} installed`, "success");
      } else {
        await uninstallSkill(pending.skill.id);
        toast(`${pending.skill.name} uninstalled`, "success");
      }
      setPending(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="技能" description="技能库存与就绪状态">
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </PageHeader>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search skills"
            className="w-full rounded-full border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant={filter === "all" ? "default" : "secondary"} onClick={() => setFilter("all")}>All</Button>
          <Button size="sm" variant={filter === "ready" ? "default" : "secondary"} onClick={() => setFilter("ready")}>Ready</Button>
          <Button size="sm" variant={filter === "missing" ? "default" : "secondary"} onClick={() => setFilter("missing")}>Missing</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No skills found." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((skill) => {
            const isInstalled = Boolean(skill.installed_at);
            const isExpanded = expanded.has(skill.id);

            return (
              <Card key={skill.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-strong)]">{skill.name}</div>
                      <div className="text-xs text-[var(--muted)]">{skill.source ?? "local"}</div>
                    </div>
                    {isInstalled ? (
                      <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
                    ) : (
                      <XCircle className="h-5 w-5 text-[var(--danger)]" />
                    )}
                  </div>

                  <p className="min-h-10 text-sm text-[var(--muted)]">{skill.description ?? "No description."}</p>

                  <div className="flex flex-wrap gap-2">
                    {isInstalled ? (
                      <Button size="sm" variant="ghost" onClick={() => setPending({ type: "uninstall", skill })}>
                        Uninstall
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setPending({ type: "install", skill })}>
                        Install
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => toggleExpanded(skill.id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Details
                    </Button>
                  </div>

                  {isExpanded ? (
                    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] p-3">
                      <div className="text-xs text-[var(--muted)]">Source: {skill.source ?? "N/A"}</div>
                      <div className="text-xs text-[var(--muted)]">
                        Installed At: {skill.installed_at ? new Date(skill.installed_at).toLocaleString() : "Not installed"}
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium text-[var(--muted)]">Enabled Apps</div>
                        <AppToggleList
                          selected={skill.enabled_apps}
                          onChange={(enabled_apps) => updateEnabledApps(skill.id, enabled_apps)}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={`${pending?.type === "install" ? "Install" : "Uninstall"} Skill`}
        message={`Confirm ${pending?.type ?? "update"} for ${pending?.skill.name ?? "this skill"}?`}
        confirmLabel={pending?.type === "install" ? "Install" : "Uninstall"}
        variant={pending?.type === "uninstall" ? "danger" : "default"}
        loading={submitting}
        onCancel={() => setPending(null)}
        onConfirm={() => void onConfirmAction()}
      />
    </div>
  );
}
