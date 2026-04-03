import { useState, useCallback, useEffect, useRef } from "react";
import TerminalToolbar from "../components/terminal/TerminalToolbar";
import TerminalView from "../components/terminal/TerminalView";
import { createLocalTerminalSession, closeTerminalSession } from "../api";
import type { TerminalConnectionStatus } from "../types";

export default function TerminalPage() {
  const [status, setStatus] = useState<TerminalConnectionStatus>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (connectedRef.current) return;
    connectedRef.current = true;

    const connect = async () => {
      try {
        setStatus("connecting");
        setError(null);
        const response = await createLocalTerminalSession(80, 24);
        setSessionId(response.session_id);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "连接失败";
        setError(errorMessage);
        setStatus("error");
      }
    };

    connect();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const cleanup = () => {
      closeTerminalSession(sessionId).catch((e) => {
        console.error("Failed to close session on unmount:", e);
      });
    };

    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [sessionId]);

  const handleDisconnect = useCallback(async () => {
    try {
      if (sessionId) {
        await closeTerminalSession(sessionId);
      }
    } catch (e) {
      console.error("Failed to close session:", e);
    } finally {
      setSessionId(null);
      setStatus("disconnected");
      setError(null);
    }
  }, [sessionId]);

  const handleReconnect = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);
      const response = await createLocalTerminalSession(80, 24);
      setSessionId(response.session_id);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "连接失败";
      setError(errorMessage);
      setStatus("error");
    }
  }, []);

  const handleStatusChange = useCallback((newStatus: TerminalConnectionStatus) => {
    setStatus(newStatus);
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const handleSessionClosed = useCallback(() => {
    setSessionId(null);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TerminalToolbar
        status={status}
        onDisconnect={handleDisconnect}
        onReconnect={handleReconnect}
      />
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <TerminalView
        sessionId={sessionId}
        status={status}
        onStatusChange={handleStatusChange}
        onError={handleError}
        onSessionClosed={handleSessionClosed}
      />
    </div>
  );
}
