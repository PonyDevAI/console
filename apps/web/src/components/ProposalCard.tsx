import { useState } from "react";
import { CheckCircle, XCircle, Star, Loader2, RefreshCw, MessageSquare } from "lucide-react";
import type { TaskProposal } from "../types";
import { cn } from "../lib/utils";

interface Props {
  proposal: TaskProposal;
  employeeName: string;
  participants: { employee_id: string; display_name: string }[];
  onConfirm: () => void;
  onCancel: () => void;
  onDone: () => void;
  onRequestReview: (reviewerId: string) => void;
  onRevise: (newDesc?: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "待确认",
  executing: "执行中",
  reviewing: "待审查",
  revising: "修改中",
  done: "已完成",
  cancelled: "已取消",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-400",
  executing: "text-blue-400",
  reviewing: "text-purple-400",
  revising: "text-orange-400",
  done: "text-green-400",
  cancelled: "text-[var(--muted)]",
};

export default function ProposalCard({ proposal, employeeName, participants, onConfirm, onCancel, onDone, onRequestReview, onRevise }: Props) {
  const isDone = proposal.status === "done" || proposal.status === "cancelled";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3 w-full max-w-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-[var(--muted)] mb-0.5">任务提案</div>
          <div className="text-sm font-semibold text-[var(--text)]">{proposal.title}</div>
        </div>
        <span className={cn("text-xs font-medium shrink-0", STATUS_COLOR[proposal.status])}>
          {STATUS_LABEL[proposal.status] ?? proposal.status}
          {proposal.status === "executing" && <Loader2 className="inline ml-1 h-3 w-3 animate-spin" />}
        </span>
      </div>

      <p className="text-xs text-[var(--muted)] leading-relaxed">{proposal.description}</p>

      <div className="text-xs text-[var(--muted)]">
        执行者：<span className="text-[var(--text)] font-medium">{employeeName}</span>
      </div>

      {!isDone && (
        <div className="flex gap-2 pt-1">
          {proposal.status === "pending" && (
            <>
              <button
                onClick={onConfirm}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 cursor-pointer"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                确认执行
              </button>
              <button
                onClick={onCancel}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <XCircle className="h-3.5 w-3.5" />
                取消
              </button>
            </>
          )}
          {proposal.status === "reviewing" && (
            <div className="space-y-2 w-full">
              <ReviewerSelect participants={participants} onSelect={onRequestReview} />
              <div className="flex gap-2">
                <button
                  onClick={() => onRevise()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新执行
                </button>
                <button
                  onClick={onDone}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 cursor-pointer"
                >
                  <Star className="h-3.5 w-3.5" />
                  标记完成
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewerSelect({
  participants,
  onSelect,
}: {
  participants: { employee_id: string; display_name: string }[];
  onSelect: (id: string) => void;
}) {
  const [selected, setSelected] = useState("");
  return (
    <div className="flex gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
        <option value="">选择 Reviewer</option>
        {participants.map((p) => (
          <option key={p.employee_id} value={p.employee_id}>{p.display_name}</option>
        ))}
      </select>
      <button
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
        className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        发起 Review
      </button>
    </div>
  );
}
