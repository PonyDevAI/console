import type { FormEvent } from "react";

import { Panel } from "../../components/Panel";
import type { Worker, Workspace } from "../../lib/types";

type Props = {
  workspaces: Workspace[];
  availableWorkers: Worker[];
  repoPath: string;
  workerId: string;
  prompt: string;
  runError: string;
  isSubmitting: boolean;
  onRepoPathChange: (value: string) => void;
  onWorkerChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function RunForm(props: Props) {
  return (
    <Panel title="Run prompt">
      <form onSubmit={props.onSubmit} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          Workspace repo quick-select
          <select
            value={props.repoPath}
            onChange={(e) => props.onRepoPathChange(e.target.value)}
            className="rounded-md border border-zinc-300 p-2"
            disabled={props.workspaces.length === 0}
          >
            {props.workspaces.length === 0 ? (
              <option value="">No workspaces available</option>
            ) : (
              props.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.repo.path}>
                  {workspace.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          Repo path (manual override)
          <input
            value={props.repoPath}
            onChange={(e) => props.onRepoPathChange(e.target.value)}
            className="rounded-md border border-zinc-300 p-2"
            required
          />
        </label>

        <label className="grid gap-1 text-sm">
          Worker
          <select
            value={props.workerId}
            onChange={(e) => props.onWorkerChange(e.target.value)}
            className="rounded-md border border-zinc-300 p-2"
            required
          >
            {props.availableWorkers.length === 0 ? (
              <option value="">No available workers</option>
            ) : (
              props.availableWorkers.map((worker) => (
                <option key={worker.name} value={worker.name}>
                  {worker.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          Prompt
          <textarea
            value={props.prompt}
            onChange={(e) => props.onPromptChange(e.target.value)}
            className="min-h-24 rounded-md border border-zinc-300 p-2"
            required
          />
        </label>

        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={props.isSubmitting || props.availableWorkers.length === 0}
        >
          {props.isSubmitting ? "Starting run..." : "Run"}
        </button>

        {props.runError ? <p className="m-0 text-red-700">Run error: {props.runError}</p> : null}
      </form>
    </Panel>
  );
}
