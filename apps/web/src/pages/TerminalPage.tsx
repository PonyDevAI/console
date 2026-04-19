import { useState, useCallback, useEffect, useRef } from "react";
import TerminalView from "../components/terminal/TerminalView";
import { createTerminalSession, terminateTerminalSession } from "../api";
import type { TerminalSessionMeta, TerminalConnectionStatus } from "../types";

type TerminalTab = {
  sessionId: string;
  status: TerminalConnectionStatus;
};

export default function TerminalPage() {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Map<string, TerminalSessionMeta>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tabStatusRef = useRef<Map<string, TerminalConnectionStatus>>(new Map());
  const creatingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let loaded = false;
    
    const loadSessions = async () => {
      if (loaded) return;
      loaded = true;
      
      try {
        const response = await fetch("/api/terminal/sessions");
        if (!mountedRef.current) return;
        
        const data = await response.json();
        const sessionMap = new Map<string, TerminalSessionMeta>();
        const newTabs: TerminalTab[] = [];
        
        for (const session of data.sessions) {
          sessionMap.set(session.id, session);
          const initialStatus = session.persistence === "persistent" && session.status === "running"
            ? "connected"
            : "disconnected";
          newTabs.push({
            sessionId: session.id,
            status: initialStatus,
          });
          tabStatusRef.current.set(session.id, initialStatus);
        }
        
        setSessions(sessionMap);
        setTabs(newTabs);
        
        if (newTabs.length > 0) {
          setActiveTabId(newTabs[0].sessionId);
          setLoading(false);
        } else {
          await handleCreateSessionInternal();
          if (mountedRef.current) {
            setLoading(false);
          }
        }
      } catch (e) {
        if (!mountedRef.current) return;
        setError("Failed to load sessions");
        await handleCreateSessionInternal();
        setLoading(false);
      }
    };
    loadSessions();
  }, []);

  const handleCreateSessionInternal = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    
    try {
      const response = await createTerminalSession({
        cols: 80,
        rows: 24,
        backend: "auto",
        cwd: "~",
      });
      
      if (!mountedRef.current) {
        creatingRef.current = false;
        return;
      }
      
      const sessionId = response.session.id;
      const initialStatus = response.session.persistence === "persistent" ? "connected" : "disconnected";
      
      setSessions(prev => new Map(prev).set(sessionId, response.session));
      setTabs(prev => [...prev, { sessionId, status: initialStatus }]);
      setActiveTabId(sessionId);
      tabStatusRef.current.set(sessionId, initialStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create terminal");
    } finally {
      creatingRef.current = false;
    }
  };

  const handleCreateSession = useCallback(async () => {
    await handleCreateSessionInternal();
  }, []);

  const handleCloseTab = useCallback(async (sessionId: string) => {
    try {
      await terminateTerminalSession(sessionId);
      setSessions(prev => {
        const next = new Map(prev);
        next.delete(sessionId);
        return next;
      });
      setTabs(prev => {
        const next = prev.filter(t => t.sessionId !== sessionId);
        if (activeTabId === sessionId && next.length > 0) {
          setActiveTabId(next[0].sessionId);
        } else if (next.length === 0) {
          setActiveTabId(null);
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close terminal");
    }
  }, [activeTabId]);

  const handleTabStatusChange = useCallback((sessionId: string, status: TerminalConnectionStatus) => {
    tabStatusRef.current.set(sessionId, status);
    setTabs(prev => prev.map(t => 
      t.sessionId === sessionId ? { ...t, status } : t
    ));
    
    if (status === "connected") {
      setSessions(prev => {
        const session = prev.get(sessionId);
        if (session && session.status !== "running") {
          return new Map(prev).set(sessionId, { ...session, status: "running" });
        }
        return prev;
      });
    }
  }, []);

  const handleTabError = useCallback((sessionId: string, message: string) => {
    setError(message);
    handleTabStatusChange(sessionId, "error");
  }, [handleTabStatusChange]);

  const activeTab = tabs.find(t => t.sessionId === activeTabId);
  const activeSession = sessions.get(activeTabId || "");

  const getBackendIcon = (backend: string) => {
    switch (backend) {
      case "tmux": return "🖥";
      case "screen": return "📺";
      case "pty": return "⚡";
      default: return "💻";
    }
  };

  const getStatusColor = (sessionId: string, tabStatus: TerminalConnectionStatus) => {
    const session = sessions.get(sessionId);
    if (sessionId !== activeTabId && session?.persistence === "persistent") {
      return session.status === "running" ? "bg-green-500" : "bg-gray-400";
    }
    switch (tabStatus) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black">
      {error && (
        <div className="bg-red-900/50 text-red-200 text-xs px-4 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100">×</button>
        </div>
      )}

      <div className="flex items-center bg-black/50 px-2 border-b border-white/10">
        {tabs.map(tab => {
          const session = sessions.get(tab.sessionId);
          if (!session) return null;
          
          return (
            <div
              key={tab.sessionId}
              className={`flex items-center gap-2 px-3 py-2 border-r border-white/10 cursor-pointer ${
                activeTabId === tab.sessionId
                  ? "bg-white/10 text-gray-100"
                  : "text-gray-400 hover:bg-white/5"
              }`}
              onClick={() => setActiveTabId(tab.sessionId)}
            >
              <span className="text-xs">{getBackendIcon(session.backend)}</span>
              <span className="text-xs truncate max-w-32">{session.title}</span>
              <div className={`h-2 w-2 rounded-full ${getStatusColor(tab.sessionId, tab.status)}`} />
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleCloseTab(tab.sessionId);
                }}
                className="text-gray-500 hover:text-gray-300 ml-1"
              >
                ×
              </button>
            </div>
          );
        })}
        
        <button
          onClick={handleCreateSession}
          className="px-3 py-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 flex items-center gap-1"
          title="New terminal"
        >
          <span className="text-sm">+</span>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <span className="text-sm">Loading...</span>
        </div>
      ) : activeTab && activeSession ? (
        <div className="flex-1 min-h-0">
          <TerminalView
            sessionId={activeTab.sessionId}
            onStatusChange={status => handleTabStatusChange(activeTab.sessionId, status)}
            onError={msg => handleTabError(activeTab.sessionId, msg)}
            onSessionExit={() => {
              if (activeSession.persistence === "ephemeral") {
                setSessions(prev => {
                  const next = new Map(prev);
                  next.delete(activeTab.sessionId);
                  return next;
                });
                setTabs(prev => prev.filter(t => t.sessionId !== activeTab.sessionId));
              }
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-4">Terminal</p>
            <button
              onClick={handleCreateSession}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Open Terminal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}