import { useEffect, useMemo, useState, type FormEvent } from "react";

import { RunForm } from "../features/runs/RunForm";
import { RunOutput } from "../features/runs/RunOutput";
import { WorkerList } from "../features/workers/WorkerList";
import { WorkspaceList } from "../features/workspaces/WorkspaceList";
import { createRun, fetchHealth, fetchWorkers, fetchWorkspaces } from "../lib/api/client";
import type { OutputLine, Run, RunEvent, Worker, Workspace } from "../lib/types";

const defaultWorkerId = "codex";

export default function App() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workerLoading, setWorkerLoading] = useState(true);

  const [repoPath, setRepoPath] = useState("");
  const [workerId, setWorkerId] = useState(defaultWorkerId);
  const [prompt, setPrompt] = useState("");

  const [run, setRun] = useState<Run | null>(null);
  const [runOutput, setRunOutput] = useState<OutputLine[]>([]);
  const [runError, setRunError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((data) => setStatus(data.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));

    fetchWorkspaces()
      .then((data) => {
        const list = data.workspaces ?? [];
        setWorkspaces(list);
        if (list.length > 0) {
          setRepoPath((current) => current || list[0].repo.path);
        }
      })
      .catch(() => setWorkspaces([]))
      .finally(() => setWorkspaceLoading(false));

    fetchWorkers()
      .then((data) => {
        const list = data.workers ?? [];
        setWorkers(list);
        const firstAvailable = list.find((item) => item.available)?.name;
        if (firstAvailable) {
          setWorkerId(firstAvailable);
        }
      })
      .catch(() => setWorkers([]))
      .finally(() => setWorkerLoading(false));
  }, []);

  const availableWorkers = useMemo(() => workers.filter((item) => item.available), [workers]);

  useEffect(() => {
    if (!run) {
      return;
    }

    const eventSource = new EventSource(`/api/runs/${run.id}/stream`);
    eventSource.onmessage = (message) => {
      const event = JSON.parse(message.data) as RunEvent;
      if (event.type === "state") {
        if (event.status) {
          const nextStatus = event.status;
          setRun((current) => (current && current.id === run.id ? { ...current, status: nextStatus } : current));
          setRunOutput((current) => [
            ...current,
            { stream: "state", message: `Run state -> ${event.status}`, timestamp: event.timestamp },
          ]);
        }
        if (event.exitCode !== undefined) {
          setRun((current) => (current && current.id === run.id ? { ...current, exitCode: event.exitCode } : current));
        }
        if (event.message) {
          setRun((current) => (current && current.id === run.id ? { ...current, error: event.message } : current));
          setRunOutput((current) => [
            ...current,
            { stream: "state", message: `Run error: ${event.message}`, timestamp: event.timestamp },
          ]);
        }
      }

      if (event.type === "output") {
        setRunOutput((current) => [
          ...current,
          { stream: event.stream ?? "stdout", message: event.message ?? "", timestamp: event.timestamp },
        ]);
      }

      if (event.status === "succeeded" || event.status === "failed") {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [run?.id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRunError("");
    setIsSubmitting(true);
    setRunOutput([]);
    setRun(null);

    try {
      const payload = await createRun({ repoPath, workerId, prompt });
      setRun(payload.run);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "run creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl p-6 font-sans">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Console</h1>
        <p>Backend status: {status}</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <WorkspaceList loading={workspaceLoading} workspaces={workspaces} />
        <WorkerList loading={workerLoading} workers={workers} />
        <RunForm
          workspaces={workspaces}
          availableWorkers={availableWorkers}
          repoPath={repoPath}
          workerId={workerId}
          prompt={prompt}
          runError={runError}
          isSubmitting={isSubmitting}
          onRepoPathChange={setRepoPath}
          onWorkerChange={setWorkerId}
          onPromptChange={setPrompt}
          onSubmit={handleSubmit}
        />
        <RunOutput run={run} output={runOutput} />
      </section>
    </main>
  );
}
