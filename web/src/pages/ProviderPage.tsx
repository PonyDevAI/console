import { useEffect, useState } from "react";
import { getProviders } from "../api";
import AppBadgeList from "../components/AppBadgeList";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import type { Provider } from "../types";

export default function ProviderPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProviders()
      .then((data) => setProviders(data.providers ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load providers");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Provider Management">
        <button
          disabled
          title="Coming soon"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add Provider
        </button>
      </PageHeader>

      {error ? <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {providers.length === 0 ? (
        <EmptyState message="No providers configured." />
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{provider.name}</span>
                  <StatusBadge label={provider.active ? "Active" : "Inactive"} variant={provider.active ? "success" : "muted"} />
                </div>
                <p className="mt-1 text-sm text-zinc-500">{provider.api_endpoint}</p>
                <AppBadgeList apps={provider.apps} />
              </div>
              <div className="flex gap-2">
                <button disabled title="Coming soon" className="rounded bg-blue-50 px-3 py-1.5 text-xs text-blue-700 disabled:cursor-not-allowed disabled:opacity-60">Activate</button>
                <button disabled title="Coming soon" className="rounded bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60">Edit</button>
                <button disabled title="Coming soon" className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-60">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
