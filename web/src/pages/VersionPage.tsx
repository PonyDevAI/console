import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useCliTools from "../hooks/useCliTools";

export default function VersionPage() {
  const { tools, loading, scanning, error, scan } = useCliTools();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Version Management">
        <button
          onClick={scan}
          disabled={scanning}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {scanning ? "Scanning..." : "Refresh"}
        </button>
      </PageHeader>

      {error ? <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {tools.length === 0 ? (
        <EmptyState message="No CLI tools detected. Click Refresh to scan." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">CLI Tool</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">Installed</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">Latest</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">Path</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.name} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{tool.display_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={tool.installed ? "Installed" : "Not installed"} variant={tool.installed ? "success" : "muted"} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{tool.local_version ?? "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{tool.remote_version ?? "-"}</td>
                  <td className="max-w-56 truncate px-4 py-3 font-mono text-xs text-zinc-400">{tool.path ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        disabled
                        title="Coming in Phase 1"
                        className="rounded bg-green-50 px-2 py-1 text-xs text-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Install
                      </button>
                      <button
                        disabled
                        title="Coming in Phase 1"
                        className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Upgrade
                      </button>
                      <button
                        disabled
                        title="Coming in Phase 1"
                        className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Uninstall
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
