import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import type { Worker } from "../../lib/types";

export function WorkerList({ loading, workers }: { loading: boolean; workers: Worker[] }) {
  return (
    <Panel title="Workers">
      {loading ? (
        <EmptyState>Loading workers...</EmptyState>
      ) : workers.length === 0 ? (
        <EmptyState>No workers found. Run a worker scan to populate this list.</EmptyState>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {workers.map((worker) => (
            <li key={worker.name} className="rounded-md border border-zinc-200 p-2">
              <strong>{worker.name}</strong> — {worker.available ? "available" : "missing"}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
