import { useState, useEffect, useCallback } from "react";
import { Plus, X, Terminal as TerminalIcon, Monitor, Server, ChevronDown, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { XtermCanvas } from "../features/terminal/XtermCanvas";
import {
  listServers,
  listTerminalSessions,
  createTerminalSession,
  terminateTerminalSession,
  listTerminalBackends,
  type ServerDto,
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
  restored?: boolean;
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
  const [createError, setCreateError] = useState<string | null>(null);

  const createSessionTab = useCallback(
    async ({
      targetType,
      targetId,
      targetLabel,
    }: {
      targetType: TargetType;
      targetId: string | null;
      targetLabel: string;
    }) => {
      setCreateError(null);
      const session = await createTerminalSession({
        title: targetLabel,
        cwd: targetType === "local" ? "~" : undefined,
        backend: "auto",
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
        restored: false,
      };

      setTabs((prev) => {
        const withoutPendingLocal = prev.filter(
          (tab) => !(tab.sessionId === null && tab.targetType === "local" && tab.status === "created")
        );
        return [...withoutPendingLocal, newTab];
      });
      setActiveTabId(newTab.id);
      return newTab;
    },
    []
  );

  // Load existing sessions and backends on mount
  const loadSessions = useCallback(async () => {
    try {
      const [sessions, backendsResp] = await Promise.all([
        listTerminalSessions(),
        listTerminalBackends(),
      ]);
      setBackends(backendsResp.available);

      const persistent = sessions.filter(
        (s) => s.persistence === "persistent" && s.status === "running"
      );
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
          restored: true,
        }));
        setTabs(restoredTabs);
        setActiveTabId(restoredTabs[0].id);
        setSelectedTarget(restoredTabs[0].targetType);
        setSelectedServerId(restoredTabs[0].targetId);
      } else {
        await createSessionTab({
          targetType: "local",
          targetId: null,
          targetLabel: "Local",
        });
      }
    } catch {
      try {
        await createSessionTab({
          targetType: "local",
          targetId: null,
          targetLabel: "Local",
        });
      } catch (e) {
        setCreateError(
          e instanceof Error ? e.message : "Failed to create initial local terminal session"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [createSessionTab]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  useEffect(() => {
    if (!activeTab) return;
    setSelectedTarget(activeTab.targetType);
    setSelectedServerId(activeTab.targetId);
  }, [activeTab]);

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

    try {
      await createSessionTab({
        targetType,
        targetId,
        targetLabel,
      });
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : `Failed to create terminal session for ${targetLabel}`
      );
    }
  };

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id);
      } else if (filtered.length === 0) {
        setActiveTabId(null);
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

    if (tab.persistence === "ephemeral") {
      closeTab(tabId);
      return;
    }

    try {
      await terminateTerminalSession(tab.sessionId);
      // Only close the tab after successful termination
      closeTab(tabId);
    } catch (e) {
      const message =
        typeof e === "string"
          ? e
          : e instanceof Error
            ? e.message
            : "Failed to terminate session";
      // Termination failed — keep the tab visible, show error
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, terminateError: message }
            : t
        )
      );
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
    <div className="flex h-full flex-col bg-[var(--terminal-bg)]">
      {createError && (
        <div className="border-b border-[var(--danger)]/20 bg-[var(--danger)]/8 px-3 py-2 text-[11px] text-[var(--danger)]">
          {createError}
        </div>
      )}
      {/* ── Tab Strip ── */}
      <div className="flex items-end gap-0 bg-[var(--terminal-surface)] px-2 pt-2">
        {/* Tabs */}
        <div className="terminal-tab-strip flex flex-1 items-end gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onSelect={() => setActiveTabId(tab.id)}
              onClose={() => terminateTabSession(tab.id)}
            />
          ))}
        </div>

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
      <div className="flex-1 overflow-hidden bg-[var(--terminal-bg)]">
        {activeTab ? (
          <TerminalCanvasStack
            tabs={tabs}
            activeTabId={activeTabId}
            backends={backends}
          />
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
}: {
  tab: DesktopTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex h-8 shrink-0 items-center gap-1.5 rounded-t-lg px-3 text-[12px] font-medium transition-all",
        isActive
          ? "-mb-px bg-[var(--terminal-bg)] text-[var(--text-strong)] shadow-none"
          : "border border-transparent border-b-0 bg-transparent text-[var(--muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
        tab.terminateError && !isActive && "border-[var(--danger)]/50"
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

      {/* Error indicator */}
      {tab.terminateError && (
        <span className="text-[var(--danger)]" title={tab.terminateError}>
          <AlertCircle size={11} />
        </span>
      )}

      {/* Actions on hover */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--danger-subtle)]",
            tab.terminateError ? "text-[var(--danger)]" : "text-[var(--muted)] hover:text-[var(--danger)]"
          )}
          title={tab.terminateError ? "Retry close terminal" : "Close terminal"}
        >
          <X size={11} />
        </span>
      </div>
    </button>
  );
}

// ── Terminal Canvas ──

function TerminalCanvas({
  tab,
  backends,
  active = true,
}: {
  tab: DesktopTab;
  backends: BackendInfoDto[];
  active?: boolean;
}) {
  const isAttachable = tab.sessionId !== null && tab.backend !== "pending";
  const availableBackends = backends.filter((b) => b.available).map((b) => b.kind);

  return (
    <div className="flex h-full flex-col">
      {/* Error banner */}
      {tab.terminateError && (
        <div className="flex items-center gap-2 border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-2">
          <AlertCircle size={13} className="shrink-0 text-[var(--danger)]" />
          <span className="flex-1 text-[12px] text-[var(--danger)]">{tab.terminateError}</span>
        </div>
      )}

      {/* Terminal area */}
      {isAttachable ? (
        <div className="flex-1 p-1">
          <div className="h-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--terminal-bg)]">
            <XtermCanvas
              sessionId={tab.sessionId!}
              active={active}
              className="flex-1"
              onExit={() => {}}
              onError={() => {}}
            />
          </div>
        </div>
      ) : tab.targetType === "server" ? (
        <div className="flex flex-1 items-center justify-center bg-[var(--terminal-bg)] p-1">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--terminal-surface)] text-[var(--terminal-muted)]">
              <TerminalIcon size={22} />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-[var(--terminal-text)]">
                Remote Terminal
              </p>
              <p className="mt-1 max-w-xs text-[12px] text-[var(--terminal-muted)]">
                Select a server from the target menu and click + to create a remote SSH session.
                Mode: auto. Resolved backend priority is tmux → screen → pty.
              </p>
            </div>
            <div className="mt-2 rounded-[var(--radius-md)] border border-white/8 bg-[var(--terminal-surface)] px-3 py-2 font-mono text-[11px] text-[var(--terminal-muted)]">
              <span className="text-[var(--success)]">$</span> select target and click +
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-[var(--terminal-bg)] p-1">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--terminal-surface)] text-[var(--terminal-muted)]">
              <TerminalIcon size={22} />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-[var(--terminal-text)]">
                Local Terminal Ready
              </p>
              <p className="mt-1 max-w-xs text-[12px] text-[var(--terminal-muted)]">
                Mode: auto. Resolved backend priority is tmux → pty → screen.
                {availableBackends.length > 0
                  ? ` Available: ${availableBackends.join(", ")}.`
                  : " No terminal backend found on this system."}
                Click + to create a session and start a real terminal.
              </p>
            </div>
            <div className="mt-2 rounded-[var(--radius-md)] border border-white/8 bg-[var(--terminal-surface)] px-3 py-2 font-mono text-[11px] text-[var(--terminal-muted)]">
              <span className="text-[var(--success)]">$</span> click + to create a session
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TerminalCanvasStack({
  tabs,
  activeTabId,
  backends,
}: {
  tabs: DesktopTab[];
  activeTabId: string | null;
  backends: BackendInfoDto[];
}) {
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const [mountedEphemeralTabs, setMountedEphemeralTabs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (
      activeTab &&
      activeTab.persistence === "ephemeral" &&
      activeTab.sessionId !== null &&
      activeTab.backend !== "pending"
    ) {
      setMountedEphemeralTabs((prev) => {
        if (prev.has(activeTab.id)) return prev;
        const next = new Set(prev);
        next.add(activeTab.id);
        return next;
      });
    }
  }, [activeTab]);

  useEffect(() => {
    setMountedEphemeralTabs((prev) => {
      const next = new Set(
        [...prev].filter((tabId) =>
          tabs.some(
            (tab) =>
              tab.id === tabId &&
              tab.persistence === "ephemeral" &&
              tab.sessionId !== null &&
              tab.backend !== "pending"
          )
        )
      );

      if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
        return prev;
      }

      return next;
    });
  }, [tabs]);

  if (!activeTab) {
    return <EmptyCanvas onNewTab={() => {}} />;
  }

  const activeIsAttachable = activeTab.sessionId !== null && activeTab.backend !== "pending";

  if (!activeIsAttachable) {
    return <TerminalCanvas tab={activeTab} backends={backends} />;
  }

  return (
    <div className="relative h-full">
      {tabs
        .filter((tab) => {
          if (tab.sessionId === null || tab.backend === "pending") {
            return false;
          }

          if (tab.id === activeTabId) {
            return true;
          }

          return tab.persistence === "ephemeral" && mountedEphemeralTabs.has(tab.id);
        })
        .map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "absolute inset-0",
              tab.id === activeTabId ? "visible z-10" : "invisible pointer-events-none z-0"
            )}
          >
            <TerminalCanvas tab={tab} backends={backends} active={tab.id === activeTabId} />
          </div>
        ))}
    </div>
  );
}

// ── Empty Canvas ──

function EmptyCanvas({ onNewTab }: { onNewTab: () => void }) {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--terminal-bg)] p-1">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--terminal-surface)] text-[var(--terminal-muted)]">
          <TerminalIcon size={22} />
        </div>
        <p className="text-[13px] text-[var(--terminal-muted)]">No open terminals</p>
        <button
          type="button"
          onClick={onNewTab}
          className="rounded-[var(--radius-md)] border border-white/8 bg-[var(--terminal-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--terminal-text)] transition-colors hover:bg-white/10"
        >
          Open Terminal
        </button>
      </div>
    </div>
  );
}
