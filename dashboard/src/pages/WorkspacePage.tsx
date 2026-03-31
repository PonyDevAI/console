import { useEffect, useRef, useState } from "react";
import { Plus, Send, X, ClipboardList } from "lucide-react";
import { cn } from "../lib/utils";
import {
  getSessions,
  createSession,
  getSession,
  deleteSession,
  postSessionMessage,
  openSessionStream,
  getEmployees,
  updateSessionTitle,
  updateSessionParticipants,
  createProposal,
  confirmProposal,
  cancelProposal,
  doneProposal,
} from "../api";
import type { Session, SessionMessage, SessionEvent, SessionParticipant, Employee, TaskProposal } from "../types";
import { toast } from "../components/Toast";
import MarkdownContent from "../components/MarkdownContent";
import ProposalCard from "../components/ProposalCard";

export default function WorkspacePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Map<string, SessionMessage>>(new Map());
  const [streamingIds, setStreamingIds] = useState<Set<string>>(new Set());
  const [mentions, setMentions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingParticipants, setEditingParticipants] = useState(false);
  const [proposals, setProposals] = useState<Map<string, TaskProposal>>(new Map());
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalDesc, setProposalDesc] = useState("");
  const [proposalEmployee, setProposalEmployee] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollTrigger = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      loadSessionDetail(activeSession.id);
      const cleanup = openSessionStream(activeSession.id, handleStreamEvent);
      return () => cleanup();
    }
  }, [activeSession]);

  useEffect(() => {
    if (activeSession) {
      setParticipants(activeSession.participants);
      setMentions([]);
    }
  }, [activeSession]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function loadSessions() {
    try {
      const data = await getSessions();
      setSessions(data.sessions);
      if (data.sessions.length > 0 && !activeSession) {
        setActiveSession(data.sessions[0]);
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  }

  async function loadSessionDetail(id: string) {
    try {
      const data = await getSession(id);
      setActiveSession(data.session);
      const msgMap = new Map<string, SessionMessage>();
      const pMap = new Map<string, TaskProposal>();
      for (const msg of data.messages) {
        msgMap.set(msg.id, msg);
        if (msg.kind === "proposal") {
          try {
            const p = JSON.parse(msg.content) as TaskProposal;
            pMap.set(p.id, p);
          } catch {}
        }
      }
      setMessages(msgMap);
      setProposals(pMap);
      setStreamingIds(new Set());
    } catch (e) {
      console.error("Failed to load session detail", e);
    }
  }

  function handleStreamEvent(event: SessionEvent) {
    if (event.type === "message_created") {
      const newMsg: SessionMessage = {
        id: event.message_id,
        session_id: activeSession!.id,
        kind: event.kind as "chat" | "system",
        role: event.role as "user" | "assistant",
        author_id: event.author_id,
        author_label: event.author_label,
        content: event.content,
        mentions: event.mentions,
        created_at: event.created_at,
      };
      setMessages((prev) => {
        const next = new Map(prev);
        next.set(event.message_id, newMsg);
        return next;
      });
      if (event.role === "assistant") {
        setStreamingIds((prev) => new Set(prev).add(event.message_id));
      }
    } else if (event.type === "message_delta") {
      setMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.message_id);
        if (existing) {
          next.set(event.message_id, {
            ...existing,
            content: existing.content + event.delta,
          });
        }
        return next;
      });
    } else if (event.type === "message_done") {
      setMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.message_id);
        if (existing) {
          next.set(event.message_id, {
            ...existing,
            content: event.content,
          });
        }
        return next;
      });
      setStreamingIds((prev) => {
        const next = new Set(prev);
        next.delete(event.message_id);
        return next;
      });
    } else if (event.type === "message_error") {
      setStreamingIds((prev) => {
        const next = new Set(prev);
        next.delete(event.message_id);
        return next;
      });
    } else if (event.type === "proposal_updated") {
      setProposals((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.proposal_id);
        if (existing) {
          next.set(event.proposal_id, { ...existing, status: event.status as TaskProposal["status"] });
        }
        return next;
      });
    }
    scrollTrigger.current += 1;
    scrollToBottom();
  }

  async function handleSend() {
    if (!input.trim() || !activeSession) return;
    try {
      await postSessionMessage(activeSession.id, {
        content: input,
        mentions,
      });
      setInput("");
      setMentions([]);
    } catch (e) {
      console.error("Failed to send message", e);
    }
  }

  async function handleCreateSession() {
    if (!newSessionTitle.trim() || selectedParticipantIds.length === 0) return;
    try {
      const session = await createSession({
        title: newSessionTitle,
        participant_ids: selectedParticipantIds,
      });
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setShowNewSessionModal(false);
      setNewSessionTitle("");
      setSelectedParticipantIds([]);
      toast("协作空间已创建", "success");
    } catch (e) {
      console.error("Failed to create session", e);
      toast("创建失败", "error");
    }
  }

  async function handleTitleSave(id: string) {
    if (!editingTitle.trim()) { setEditingSessionId(null); return; }
    try {
      await updateSessionTitle(id, editingTitle);
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: editingTitle } : s));
      if (activeSession?.id === id) setActiveSession((s) => s ? { ...s, title: editingTitle } : s);
    } catch {}
    setEditingSessionId(null);
  }

  async function handleCreateProposal() {
    if (!proposalTitle.trim() || !proposalDesc.trim() || !proposalEmployee || !activeSession) return;
    try {
      await createProposal(activeSession.id, {
        title: proposalTitle,
        description: proposalDesc,
        assigned_employee_id: proposalEmployee,
      });
      setShowProposalModal(false);
      setProposalTitle("");
      setProposalDesc("");
      setProposalEmployee("");
      toast("任务提案已创建", "success");
    } catch {
      toast("创建失败", "error");
    }
  }

  async function handleConfirmProposal(pid: string) {
    if (!activeSession) return;
    try {
      await confirmProposal(activeSession.id, pid);
      setProposals((prev) => {
        const next = new Map(prev);
        const p = next.get(pid);
        if (p) next.set(pid, { ...p, status: "executing" });
        return next;
      });
    } catch { toast("操作失败", "error"); }
  }

  async function handleCancelProposal(pid: string) {
    if (!activeSession) return;
    try {
      await cancelProposal(activeSession.id, pid);
      setProposals((prev) => {
        const next = new Map(prev);
        const p = next.get(pid);
        if (p) next.set(pid, { ...p, status: "cancelled" });
        return next;
      });
    } catch { toast("操作失败", "error"); }
  }

  async function handleDoneProposal(pid: string) {
    if (!activeSession) return;
    try {
      await doneProposal(activeSession.id, pid);
      setProposals((prev) => {
        const next = new Map(prev);
        const p = next.get(pid);
        if (p) next.set(pid, { ...p, status: "done" });
        return next;
      });
    } catch { toast("操作失败", "error"); }
  }

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("确定删除此协作空间？")) return;
    try {
      await deleteSession(id);
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeSession?.id === id) {
          setActiveSession(next[0] || null);
        }
        return next;
      });
      toast("协作空间已删除", "success");
    } catch (e) {
      console.error("Failed to delete session", e);
      toast("删除失败", "error");
    }
  }

  function toggleMention(empId: string) {
    setMentions((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function openNewSessionModal() {
    try {
      const data = await getEmployees();
      setAllEmployees(data.employees);
      setShowNewSessionModal(true);
    } catch (e) {
      console.error("Failed to load employees", e);
    }
  }

  const sortedMessages = Array.from(messages.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4">
      {/* Left sidebar - Sessions list */}
      <div className="w-60 flex-shrink-0 flex flex-col border-r border-[var(--border)] pr-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">协作空间</h2>
          <button
            onClick={openNewSessionModal}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
            title="新建协作空间"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActiveSession(session)}
              className={cn(
                "group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors",
                activeSession?.id === session.id
                  ? "bg-[var(--accent)] text-white"
                  : "hover:bg-[var(--bg-hover)] text-[var(--muted)]"
              )}
            >
              {editingSessionId === session.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleTitleSave(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave(session.id);
                    if (e.key === "Escape") setEditingSessionId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent text-sm font-medium outline-none border-b border-white/50"
                />
              ) : (
                <span
                  className="truncate text-sm font-medium"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingSessionId(session.id);
                    setEditingTitle(session.title);
                  }}
                >
                  {session.title}
                </span>
              )}
              <button
                onClick={(e) => handleDeleteSession(session.id, e)}
                className={cn(
                  "opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity cursor-pointer",
                  activeSession?.id === session.id
                    ? "hover:bg-white/20 text-white"
                    : "hover:bg-[var(--bg-elevated)] text-[var(--muted)]"
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Middle - Message thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {sortedMessages.map((msg) => {
            const isSystem = msg.kind === "system";
            const isUser = msg.role === "user";
            const isStreaming = streamingIds.has(msg.id);
            
            if (msg.kind === "proposal") {
              let proposal: TaskProposal | null = null;
              try { proposal = JSON.parse(msg.content); } catch {}
              if (!proposal) return null;
              const liveProposal = proposals.get(proposal.id) ?? proposal;
              const emp = participants.find((p) => p.employee_id === liveProposal.assigned_employee_id);
              return (
                <div key={msg.id} className="flex justify-start">
                  <ProposalCard
                    proposal={liveProposal}
                    employeeName={emp?.display_name ?? liveProposal.assigned_employee_id}
                    onConfirm={() => handleConfirmProposal(liveProposal.id)}
                    onCancel={() => handleCancelProposal(liveProposal.id)}
                    onDone={() => handleDoneProposal(liveProposal.id)}
                  />
                </div>
              );
            }
            
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex items-start gap-2",
                  isSystem && "justify-center",
                  isUser && !isSystem && "flex-row-reverse"
                )}
              >
                {!isSystem && !isUser && (
                  <div
                    className="h-6 w-6 rounded-full flex-shrink-0"
                    style={{ background: participants.find((p) => p.employee_id === msg.author_id)?.avatar_color || "#888" }}
                  />
                )}
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg px-3 py-2 text-sm",
                    isSystem
                      ? "text-xs text-[var(--muted)] bg-transparent"
                      : isUser
                      ? "bg-[var(--accent)] text-white rounded-br-sm"
                      : "bg-[var(--bg-elevated)] text-[var(--text)] rounded-bl-sm"
                  )}
                >
                  {!isSystem && (
                    <div className={cn("text-xs mb-0.5", isUser ? "text-white/80" : "text-[var(--muted)]")}>
                      {msg.author_label}
                    </div>
                  )}
                  <div className="break-words prose prose-sm max-w-none prose-invert">
                    <MarkdownContent content={msg.content} />
                    {isStreaming && <span className="inline-block animate-pulse ml-0.5">▌</span>}
                  </div>
                  <div className={cn("text-[10px] mt-1", isUser ? "text-white/60" : "text-[var(--muted)]")}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
            className="w-full resize-none overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{ minHeight: "72px" }}
          />
          {/* Mention chips */}
          {participants.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {participants.map((p) => (
                <button
                  key={p.employee_id}
                  onClick={() => toggleMention(p.employee_id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    mentions.includes(p.employee_id)
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-hover)]"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: p.avatar_color }}
                  />
                  @{p.display_name}
                </button>
              ))}
              <button
                onClick={() => { openNewSessionModal(); setShowProposalModal(true); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                发起任务
              </button>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="h-4 w-4" />
              发送
            </button>
          </div>
        </div>
      </div>

      {/* Right sidebar - Participants */}
      <div className="w-52 flex-shrink-0 border-l border-[var(--border)] pl-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">参与者</h3>
          <button
            onClick={() => { openNewSessionModal(); setEditingParticipants(!editingParticipants); }}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
          >
            {editingParticipants ? "完成" : "编辑"}
          </button>
        </div>
        {editingParticipants ? (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {allEmployees.map((emp) => {
              const isParticipant = participants.some((p) => p.employee_id === emp.id);
              return (
                <label
                  key={emp.id}
                  className="flex items-center gap-2 rounded-md p-2 hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isParticipant}
                    onChange={async (e) => {
                      if (!activeSession) return;
                      const add = e.target.checked ? [emp.id] : [];
                      const remove = e.target.checked ? [] : [emp.id];
                      try {
                        await updateSessionParticipants(activeSession.id, { add, remove });
                        if (e.target.checked) {
                          setParticipants((prev) => [...prev, { employee_id: emp.id, display_name: emp.display_name, avatar_color: emp.avatar_color }]);
                        } else {
                          setParticipants((prev) => prev.filter((p) => p.employee_id !== emp.id));
                        }
                        if (activeSession) {
                          setActiveSession((s) => s ? { ...s, participants: e.target.checked ? [...s.participants, { employee_id: emp.id, display_name: emp.display_name, avatar_color: emp.avatar_color }] : s.participants.filter((p) => p.employee_id !== emp.id) } : s);
                        }
                      } catch {}
                    }}
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <div className="h-5 w-5 rounded-full flex-shrink-0" style={{ background: emp.avatar_color }} />
                  <span className="text-sm text-[var(--text)] truncate">{emp.display_name}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.employee_id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-[var(--bg-hover)] transition-colors">
                <div
                  className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: p.avatar_color }}
                >
                  {p.display_name[0]}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--text)]">{p.display_name}</div>
                  <div className="truncate text-[10px] text-[var(--muted)]">{p.employee_id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[480px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text)]">新建协作空间</h3>
              <button
                onClick={() => setShowNewSessionModal(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  空间名称
                </label>
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="输入协作空间名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  选择参与者
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
                  {allEmployees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2 rounded-md p-2 hover:bg-[var(--bg-hover)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipantIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedParticipantIds((prev) => [...prev, emp.id]);
                          } else {
                            setSelectedParticipantIds((prev) => prev.filter((id) => id !== emp.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                      />
                      <div
                        className="h-5 w-5 rounded-full flex-shrink-0"
                        style={{ background: emp.avatar_color }}
                      />
                      <span className="text-sm text-[var(--text)]">{emp.display_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowNewSessionModal(false)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!newSessionTitle.trim() || selectedParticipantIds.length === 0}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Modal */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[480px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text)]">发起任务提案</h3>
              <button onClick={() => setShowProposalModal(false)} className="text-[var(--muted)] hover:text-[var(--text)] cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">任务标题</label>
                <input
                  type="text"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="简短描述任务目标"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">任务描述</label>
                <textarea
                  value={proposalDesc}
                  onChange={(e) => setProposalDesc(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="详细描述任务要求、上下文、约束..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">指定执行者</label>
                <select
                  value={proposalEmployee}
                  onChange={(e) => setProposalEmployee(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">选择 AI 员工</option>
                  {participants.map((p) => (
                    <option key={p.employee_id} value={p.employee_id}>{p.display_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowProposalModal(false)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreateProposal}
                disabled={!proposalTitle.trim() || !proposalDesc.trim() || !proposalEmployee}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                发起
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
