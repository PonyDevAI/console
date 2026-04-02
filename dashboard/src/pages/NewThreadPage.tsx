import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ThreadHeader, ThreadMessageList, ThreadComposer } from "../components/thread";
import type { Thread, ThreadMessage, ThreadRuntimeConfig, ThreadEvent, WorkspaceInspectResult } from "../types";

const DEFAULT_RUNTIME_CONFIG: ThreadRuntimeConfig = {
  adapter: "codex",
  model: "gpt-5.4",
  reasoningEffort: "medium",
  permissionMode: "default",
  workspacePath: "/Users/luoxiang/workspace/bull/console",
  gitBranch: "main",
};

export default function NewThreadPage() {
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [title, setTitle] = useState("New Thread");
  const [composerValue, setComposerValue] = useState("");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<ThreadRuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load thread on mount if in a project context
  useEffect(() => {
    const storedWorkspace = localStorage.getItem("console_workspace");
    if (storedWorkspace) {
      setRuntimeConfig((prev) => ({ ...prev, workspacePath: storedWorkspace }));
      inspectWorkspace(storedWorkspace);
    }
  }, []);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const inspectWorkspace = async (path: string) => {
    try {
      const response = await fetch("/api/workspaces/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (response.ok) {
        const result: WorkspaceInspectResult = await response.json();
        setRuntimeConfig((prev) => ({
          ...prev,
          workspacePath: result.path,
          gitBranch: result.git_branch || undefined,
        }));
      }
    } catch (err) {
      console.error("Failed to inspect workspace:", err);
    }
  };

  const createThread = async (): Promise<string> => {
    const response = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Thread",
        workspace: runtimeConfig.workspacePath,
        runtime: {
          adapter: runtimeConfig.adapter,
          model: runtimeConfig.model,
          reasoning_effort: runtimeConfig.reasoningEffort,
          permission_mode: runtimeConfig.permissionMode,
        },
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to create thread");
    }
    const data = await response.json();
    return data.thread.id;
  };

  const loadThreadMessages = async (threadId: string) => {
    try {
      const response = await fetch(`/api/threads/${threadId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const setupSSE = (threadId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Close any existing connection first
      eventSourceRef.current?.close();

      const eventSource = new EventSource(`/api/threads/${threadId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        resolve();
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
        // Don't reject on temporary errors - let browser handle reconnection
        // But still resolve so we can proceed
        resolve();
      };

      eventSource.addEventListener("message.delta", (event) => {
        const data: ThreadEvent = JSON.parse(event.data);
        if (data.type === "message_delta") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: msg.content + data.delta }
                : msg
            )
          );
        }
      });

      eventSource.addEventListener("message.done", (event) => {
        const data: ThreadEvent = JSON.parse(event.data);
        if (data.type === "message_done") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, status: "done", content: data.content }
                : msg
            )
          );
        }
        setIsRunning(false);
        setIsSubmitting(false);
        setActiveRunId(null);
        // Don't close EventSource - keep it open for future messages
      });

      eventSource.addEventListener("message.error", (event) => {
        const data: ThreadEvent = JSON.parse(event.data);
        if (data.type === "message_error") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, status: "error", error: data.error }
                : msg
            )
          );
          setError(data.error);
        }
        setIsRunning(false);
        setIsSubmitting(false);
        setActiveRunId(null);
        // Don't close EventSource - keep it open
      });

      eventSource.addEventListener("run.cancelled", () => {
        // Update the last assistant message to cancelled state
        setMessages((prev) => {
          const lastAssistantMsg = [...prev].reverse().find(m => m.role === "assistant" && m.status === "running");
          if (lastAssistantMsg) {
            return prev.map(msg =>
              msg.id === lastAssistantMsg.id
                ? { ...msg, status: "cancelled" }
                : msg
            );
          }
          return prev;
        });
        setIsRunning(false);
        setIsSubmitting(false);
        setActiveRunId(null);
        // Don't close EventSource - keep it open
      });
    });
  };

  const sendMessage = async (threadId: string, content: string) => {
    const response = await fetch(`/api/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        attachments: [],
        stream: true,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to send message");
    }
    return await response.json();
  };

  const ensureThreadAndStream = async (): Promise<string> => {
    let currentThreadId = threadId;
    if (!currentThreadId) {
      currentThreadId = await createThread();
      setThreadId(currentThreadId);
      setTitle("New Thread");
    }

    // Ensure SSE is connected before sending any messages
    if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
      await setupSSE(currentThreadId);
      // Load existing messages first
      await loadThreadMessages(currentThreadId);
    }

    return currentThreadId;
  };

  const handleSubmit = async () => {
    if (!composerValue.trim() || isSubmitting) return;

    setError(null);
    const messageContent = composerValue.trim();
    setComposerValue("");
    setIsSubmitting(true);
    setIsRunning(true);

    try {
      // Step 1: Ensure thread exists and SSE is connected FIRST
      const currentThreadId = await ensureThreadAndStream();

      // Step 2: Send message - backend returns full user and assistant messages
      const result = await sendMessage(currentThreadId, messageContent);
      setActiveRunId(result.run_id);

      // Step 3: Use backend-returned messages directly (no local temp messages!)
      setMessages((prev) => [
        ...prev,
        result.user_message,
        result.assistant_message
      ]);
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      setIsSubmitting(false);
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    if (!threadId || !activeRunId) return;
    
    try {
      await fetch(`/api/threads/${threadId}/runs/${activeRunId}/cancel`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to cancel run:", err);
    } finally {
      // Don't close EventSource - keep it for next message
      setIsRunning(false);
      setIsSubmitting(false);
      setActiveRunId(null);
    }
  };

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    if (threadId) {
      try {
        await fetch(`/api/threads/${threadId}/title`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
      } catch (err) {
        console.error("Failed to update thread title:", err);
      }
    }
  };

  const handleWorkspaceChange = (path: string) => {
    inspectWorkspace(path);
  };

  const handleRuntimeChange = (config: Partial<ThreadRuntimeConfig>) => {
    setRuntimeConfig((prev) => ({ ...prev, ...config }));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Header */}
      <ThreadHeader title={title} onTitleChange={handleTitleChange} />

      {/* Message List */}
      <ThreadMessageList messages={messages} isLoading={isRunning && messages.length > 0} />

      {/* Error banner */}
      {error && (
        <div className="shrink-0 mx-5 mb-3 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Composer */}
      <ThreadComposer
        value={composerValue}
        onChange={setComposerValue}
        onSubmit={handleSubmit}
        onStop={handleStop}
        disabled={false}
        isRunning={isRunning}
        runtimeConfig={runtimeConfig}
        onWorkspaceChange={handleWorkspaceChange}
        onRuntimeChange={handleRuntimeChange}
      />
    </div>
  );
}
