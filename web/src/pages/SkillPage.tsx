import { useEffect, useState } from "react";
import { getSkills } from "../api";
import AppBadgeList from "../components/AppBadgeList";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import type { Skill } from "../types";

export default function SkillPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkills()
      .then((data) => setSkills(data.skills ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load skills");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Skills">
        <button
          disabled
          title="Coming soon"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sync All
        </button>
        <button
          disabled
          title="Coming soon"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Install Skill
        </button>
      </PageHeader>

      {error ? <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {skills.length === 0 ? (
        <EmptyState message="No skills installed." />
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div key={skill.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
              <div>
                <span className="font-semibold">{skill.name}</span>
                {skill.description ? <p className="mt-1 text-sm text-zinc-500">{skill.description}</p> : null}
                {skill.source ? <p className="mt-1 text-xs text-zinc-400">{skill.source}</p> : null}
                <AppBadgeList apps={skill.enabled_apps} />
              </div>
              <div className="flex gap-2">
                <button disabled title="Coming soon" className="rounded bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60">Configure</button>
                <button disabled title="Coming soon" className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-60">Uninstall</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
