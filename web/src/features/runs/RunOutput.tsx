import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import type { OutputLine, Run } from "../../lib/types";

export function RunOutput({ run, output }: { run: Run | null; output: OutputLine[] }) {
  return (
    <Panel title="Run output (SSE)">
      {run ? (
        <>
          <p className="mt-0">
            Run {run.id} — <strong>{run.status}</strong>
            {run.exitCode !== undefined ? ` (exit ${run.exitCode})` : ""}
          </p>
          {run.error ? <p className="m-0 text-red-700">Error: {run.error}</p> : null}
        </>
      ) : (
        <EmptyState>No run started in this browser session.</EmptyState>
      )}

      <div className="mt-2 max-h-72 overflow-auto rounded-md bg-zinc-950 p-2 font-mono text-xs text-zinc-100">
        {output.length === 0 ? (
          <EmptyState>No streamed output yet.</EmptyState>
        ) : (
          output.map((line, index) => (
            <p key={`${line.timestamp}-${index}`} className={`mb-1 mt-0 whitespace-pre-wrap ${line.stream === "stderr" ? "text-red-300" : ""}`}>
              <span className="text-zinc-400">{line.timestamp}</span> [{line.stream}] {line.message}
            </p>
          ))
        )}
      </div>
    </Panel>
  );
}
