import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import type { Workspace } from "../../lib/types";

export function WorkspaceList({ loading, workspaces }: { loading: boolean; workspaces: Workspace[] }) {
  return (
    <Panel title="Workspaces">
      {loading ? (
        <EmptyState>Loading workspaces...</EmptyState>
      ) : workspaces.length === 0 ? (
        <EmptyState>No workspaces yet. Add one from the backend API.</EmptyState>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {workspaces.map((workspace) => (
            <li key={workspace.id} className="grid gap-1 rounded-md border border-zinc-200 p-2">
              <strong>{workspace.name}</strong>
              <code className="inline-block rounded bg-zinc-100 px-1 py-0.5 text-xs">{workspace.repo.path}</code>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
