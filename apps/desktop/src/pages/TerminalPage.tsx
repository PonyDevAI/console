import { useState, useEffect, useCallback } from "react";
import { Plus, X, Terminal as TerminalIcon, Monitor, Server, ChevronDown, Power, RotateCcw, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { XtermCanvas } from "../features/terminal/XtermCanvas";
import {
  listServers,
  listTerminalSessions,
  createTerminalSession,
  terminateTerminalSession,
  listTerminalBackends,
  type ServerDto,
  type TerminalSessionDto,
  type BackendInfoDto,
} from "../lib/server-commands";

// ── Types ──

type TargetType = "local" | "server";

interface DesktopTab {
  id: string;
  sessionId: string | null;
  title: string;
  targetType: TargetType;
  targetId: string | null;
  targetLabel: string;
  backend: string;
  persistence: string;
  status: string;
  terminateError?: string;
}

// ── Terminal Page ──

type TerminalPageProps = {
  servers?: ServerDto[];
};

export function TerminalPage({ servers = [] }: TerminalPageProps) {
  const [tabs, setTabs] = useState<DesktopTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<TargetType>("local");
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backends, setBackends] = useState<BackendInfoDto[]>([]);
  const [defaultBackend, setDefaultBackend] = useState<string>("");
  const [closedSessions, setClosedSessions] = useState<TerminalSessionDto[]>([]);
  const [showClosedMenu, setShowClosedMenu] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load existing sessions and backends on mount
  const loadSessions = useCallback(async () => {
    try {
      const [sessions, backendsResp] = await Promise.all([
        listTerminalSessions(),
        listTerminalBackends(),
      ]);
      setBackends(backendsResp.available);
      setDefaultBackend(backendsResp.default_backend);

      // Only restore persistent sessions
      const persistent = sessions.filter((s) => s.persistence === "persistent");
      if (persistent.length > 0) {
        const restoredTabs: DesktopTab[] = persistent.map((s) => ({
          id: `tab-${s.id}`,
          sessionId: s.id,
          title: s.title,
          targetType: s.target_type as TargetType,
          targetId: s.target_id,
          targetLabel: s.target_label,
          backend: s.backend,
          persistence: s.persistence,
          status: s.status,
        }));
        setTabs(restoredTabs);
        setActiveTabId(restoredTabs[0].id);
      } else {
        // Create default local tab (no session yet)
        addLocalTab();
      }
    } catch {
      addLocalTab();
    } finally {
      setLoading(false);
    }
  }, []);

  const addLocalTab = () => {
    const id = `tab-local-${Date.now()}`;
    const newTab: DesktopTab = {
      id,
      sessionId: null,
      title: "Local",
      targetType: "local",
      targetId: null,
      targetLabel: "Local",
      backend: "pending",
      persistence: "pending",
      status: "created",
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
  };

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const addTab = async () => {
    let targetType: TargetType = selectedTarget;
    let targetId: string | null = null;
    let targetLabel = "Local";

    if (targetType === "server" && selectedServerId) {
      const srv = servers.find((s) => s.id === selectedServerId);
      if (srv) {
        targetId = srv.id;
        targetLabel = srv.name;
      }
    }

    // Create real session for both local and server targets
    try {
      setCreateError(null);
      const session = await createTerminalSession({
        title: targetLabel,
        target_type: targetType,
        target_id: targetId,
        target_label: targetLabel,
      });

      const newTab: DesktopTab = {
        id: `tab-${session.id}`,
        sessionId: session.id,
        title: session.title,
        targetType: session.target_type as TargetType,
        targetId: session.target_id,
        targetLabel: session.target_label,
        backend: session.backend,
        persistence: session.persistence,
        status: session.status,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : `Failed to create terminal session for ${targetLabel}`
      );
    }
  };

  const closeTab = (tabId: string) => {
    // Closing a tab does NOT terminate the session.
    // Persistent sessions survive tab close and can be restored.
    setTabs((prev) => {
      const closingTab = prev.find((t) => t.id === tabId);
      // Track closed persistent sessions for restore
      if (closingTab?.sessionId && closingTab.persistence === "persistent") {
        setClosedSessions((cs) => {
          // Avoid duplicates
          if (cs.find((s) => s.id === closingTab.sessionId)) return cs;
          return [...cs, {
            id: closingTab.sessionId!,
            title: closingTab.title,
            cwd: "",
            shell: "",
            backend: closingTab.backend,
            persistence: closingTab.persistence,
            status: closingTab.status,
            target_type: closingTab.targetType,
            target_id: closingTab.targetId,
            target_label: closingTab.targetLabel,
            created_at: "",
            updated_at: "",
          }];
        });
      }

      const filtered = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id);
      } else if (filtered.length === 0) {
        // Always keep at least one tab
        const id = `tab-local-${Date.now()}`;
        const newTab: DesktopTab = {
          id,
          sessionId: null,
          title: "Local",
          targetType: "local",
          targetId: null,
          targetLabel: "Local",
          backend: "pending",
          persistence: "pending",
          status: "created",
        };
        setActiveTabId(id);
        return [newTab];
      }
      return filtered;
    });
  };

  const terminateTabSession = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab?.sessionId) {
      closeTab(tabId);
      return;
    }

    try {
      await terminateTerminalSession(tab.sessionId);
      // Only close the tab after successful termination
      closeTab(tabId);
    } catch (e) {
      // Termination failed — keep the tab visible, show error
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, terminateError: e instanceof Error ? e.message : "Failed to terminate session" }
            : t
        )
      );
    }
  };

  const restoreSession = async (session: TerminalSessionDto) => {
    // Check if session is already open
    const existingTab = tabs.find((t) => t.sessionId === session.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      setShowClosedMenu(false);
      return;
    }

    // Verify session still exists on the backend
    try {
      const sessions = await listTerminalSessions();
      const live = sessions.find((s) => s.id === session.id);
      if (!live) {
        // Session no longer exists, remove from closed list
        setClosedSessions((cs) => cs.filter((s) => s.id !== session.id));
        return;
      }

      const newTab: DesktopTab = {
        id: `tab-${live.id}`,
        sessionId: live.id,
        title: live.title,
        targetType: live.target_type as TargetType,
        targetId: live.target_id,
        targetLabel: live.target_label,
        backend: live.backend,
        persistence: live.persistence,
        status: live.status,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setClosedSessions((cs) => cs.filter((s) => s.id !== session.id));
      setShowClosedMenu(false);
    } catch {
      // If verification fails, remove from closed list
      setClosedSessions((cs) => cs.filter((s) => s.id !== session.id));
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg)]">
        <p className="text-[12px] text-[var(--muted)]">Loading terminal sessions…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      {createError && (
        <div className="border-b border-[var(--danger)]/20 bg-[var(--danger)]/8 px-3 py-2 text-[11px] text-[var(--danger)]">
          {createError}
        </div>
      )}
      {/* ── Tab Strip ── */}
      <div className="flex items-end gap-0 border-b border-[var(--border)] bg-[var(--bg-accent)] px-2 pt-2">
        {/* Tabs */}
        <div className="flex flex-1 items-end gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onSelect={() => setActiveTabId(tab.id)}
              onClose={() => closeTab(tab.id)}
              onTerminate={() => terminateTabSession(tab.id)}
            />
          ))}
        </div>

        {/* Restore closed sessions */}
        {closedSessions.length > 0 && (
          <div className="relative mb-1">
            <button
              type="button"
              onClick={() => setShowClosedMenu(!showClosedMenu)}
              className="mb-1 flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
              title="Restore closed sessions"
            >
              <RotateCcw size={13} />
              <span>{closedSessions.length}</span>
            </button>
            {showClosedMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowClosedMenu(false)} />
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-lg)]">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Closed Sessions
                  </div>
                  {closedSessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => restoreSession(s)}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-[12px] text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      {s.target_type === "local" ? (
                        <Monitor size={12} className="shrink-0 text-[var(--muted)]" />
                      ) : (
                        <Server size={12} className="shrink-0 text-[var(--info)]" />
                      )}
                      <span className="flex-1 truncate">{s.title}</span>
                      <span className="text-[10px] text-[var(--muted)]">{s.backend}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Add tab */}
        <button
          type="button"
          onClick={addTab}
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
          title="New terminal"
        >
          <Plus size={15} />
        </button>

        {/* Target selector */}
        <div className="relative mb-1 ml-1">
          <button
            type="button"
            onClick={() => setTargetMenuOpen(!targetMenuOpen)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-[11px] font-medium text-[var(--text)] transition-colors hover:border-[var(--border-strong)]"
            )}
          >
            {selectedTarget === "local" ? (
              <Monitor size={12} className="text-[var(--muted)]" />
            ) : (
              <Server size={12} className="text-[var(--info)]" />
            )}
            <span className="max-w-24 truncate">
              {selectedTarget === "local"
                ? "Local"
                : servers.find((s) => s.id === selectedServerId)?.name ?? "Server"}
            </span>
            <ChevronDown size={11} className="text-[var(--muted)]" />
          </button>

          {targetMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setTargetMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-lg)]">
                {/* Local */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTarget("local");
                    setSelectedServerId(null);
                    setTargetMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-[12px] transition-colors",
                    selectedTarget === "local"
                      ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
                      : "text-[var(--text)] hover:bg-[var(--bg-hover)]"
                  )}
                >
                  <Monitor size={13} className="text-[var(--muted)]" />
                  <span>Local</span>
                </button>

                {/* Divider */}
                {servers.length > 0 && (
                  <div className="my-1 border-t border-[var(--border)]" />
                )}

                {/* Servers */}
                {servers.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11px] text-[var(--muted)]">
                    No servers available
                  </p>
                ) : (
                  servers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedTarget("server");
                        setSelectedServerId(s.id);
                        setTargetMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-[12px] transition-colors",
                        selectedTarget === "server" && selectedServerId === s.id
                          ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
                          : "text-[var(--text)] hover:bg-[var(--bg-hover)]"
                      )}
                    >
                      <Server size={13} className="text-[var(--info)]" />
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="text-[10px] text-[var(--muted)]">
                        {s.host}:{s.port}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Terminal Canvas ── */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <TerminalCanvas tab={activeTab} backends={backends} defaultBackend={defaultBackend} />
        ) : (
          <EmptyCanvas onNewTab={addTab} />
        )}
      </div>
    </div>
  );
}

// ── Tab Card (Arc-style) ──

function TabCard({
  tab,
  isActive,
  onSelect,
  onClose,
  onTerminate,
}: {
  tab: DesktopTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onTerminate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex h-8 shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 text-[12px] font-medium transition-all",
        isActive
          ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-strong)]"
          : "border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
        tab.terminateError && "border-[var(--danger)]/50"
      )}
    >
      {/* Target icon */}
      {tab.targetType === "local" ? (
        <Monitor size={12} className="shrink-0 text-[var(--muted)]" />
      ) : (
        <Server size={12} className="shrink-0 text-[var(--info)]" />
      )}

      {/* Title */}
      <span className="max-w-24 truncate">{tab.title}</span>

      {/* Backend badge */}
      {tab.backend !== "pending" && (
        <span className="rounded bg-[var(--bg-accent)] px-1 py-0.5 text-[9px] font-medium text-[var(--muted)]">
          {tab.backend}
        </span>
      )}

      {/* Error indicator */}
      {tab.terminateError && (
        <span className="text-[var(--danger)]" title={tab.terminateError}>
          <AlertCircle size={11} />
        </span>
      )}

      {/* Actions on hover */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {tab.sessionId && !tab.terminateError && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onTerminate();
            }}
            className="flex h-4 w-4 items-center justify-center rounded text-[var(--danger)] hover:bg-[var(--danger-subtle)]"
            title="Terminate session"
          >
            <Power size={9} />
          </span>
        )}
        {tab.terminateError && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onTerminate();
            }}
            className="flex h-4 w-4 items-center justify-center rounded text-[var(--danger)] hover:bg-[var(--danger-subtle)]"
            title="Retry terminate"
          >
            <Power size={9} />
          </span>
        )}
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex h-4 w-4 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
          title="Close tab"
        >
          <X size={10} />
        </span>
      </div>
    </button>
  );
}

// ── Terminal Canvas ──

function TerminalCanvas({ tab, backends, defaultBackend }: { tab: DesktopTab; backends: BackendInfoDto[]; defaultBackend: string }) {
  const isAttachable = tab.sessionId !== null && tab.backend !== "pending";
  const availableBackends = backends.filter((b) => b.available).map((b) => b.kind);

  return (
    <div className="flex h-full flex-col">
      {/* Tab info bar */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-accent)] px-4 py-1.5">
        {tab.targetType === "local" ? (
          <Monitor size={12} className="text-[var(--muted)]" />
        ) : (
          <Server size={12} className="text-[var(--info)]" />
        )}
        <span className="text-[11px] text-[var(--muted)]">
          {tab.targetType === "local" ? "Local shell" : `Remote: ${tab.targetLabel}`}
        </span>
        {tab.backend !== "pending" && (
          <>
            <span className="text-[var(--border)]">·</span>
            <span className="text-[11px] text-[var(--muted)]">
              {tab.backend} · {tab.persistence}
            </span>
          </>
        )}
        {!isAttachable && tab.targetType === "local" && (
          <span className="ml-auto text-[10px] text-[var(--muted)]">
            Available: {availableBackends.length > 0 ? availableBackends.join(", ") : "none"} · Default: {defaultBackend}
          </span>
        )}
        {!isAttachable && tab.targetType === "server" && (
          <span className="ml-auto text-[10px] text-[var(--muted)]">
            Select a server target and click + to create a remote session
          </span>
        )}
      </div>

      {/* Error banner */}
      {tab.terminateError && (
        <div className="flex items-center gap-2 border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2">
          <AlertCircle size={13} className="shrink-0 text-[var(--danger)]" />
          <span className="flex-1 text-[12px] text-[var(--danger)]">{tab.terminateError}</span>
        </div>
      )}

      {/* Terminal area */}
      {isAttachable ? (
        <XtermCanvas
          sessionId={tab.sessionId!}
          className="flex-1"
          onExit={() => {}}
          onError={() => {}}
        />
      ) : tab.targetType === "server" ? (
        <div className="flex flex-1 items-center justify-center bg-[var(--bg)]">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--muted)]">
              <TerminalIcon size={22} />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-[var(--text-strong)]">
                Remote Terminal
              </p>
              <p className="mt-1 max-w-xs text-[12px] text-[var(--muted)]">
                Select a server from the target menu and click + to create a remote SSH session.
                Backend priority: tmux → screen → pty (all SSH-backed).
              </p>
            </div>
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2 font-mono text-[11px] text-[var(--muted)]">
              <span className="text-[var(--success)]">$</span> select target and click +
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-[var(--bg)]">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--muted)]">
              <TerminalIcon size={22} />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-[var(--text-strong)]">
                Local Terminal Ready
              </p>
              <p className="mt-1 max-w-xs text-[12px] text-[var(--muted)]">
                Backend priority: tmux → screen → pty.
                {availableBackends.length > 0
                  ? ` Available: ${availableBackends.join(", ")}.`
                  : " No terminal backend found on this system."}
                Click + to create a session and start a real terminal.
              </p>
            </div>
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2 font-mono text-[11px] text-[var(--muted)]">
              <span className="text-[var(--success)]">$</span> click + to create a session
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty Canvas ──

function EmptyCanvas({ onNewTab }: { onNewTab: () => void }) {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--muted)]">
          <TerminalIcon size={22} />
        </div>
        <p className="text-[13px] text-[var(--muted)]">No open terminals</p>
        <button
          type="button"
          onClick={onNewTab}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          Open Terminal
        </button>
      </div>
    </div>
  );
}
