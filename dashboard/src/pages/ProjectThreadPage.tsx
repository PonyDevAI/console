import { useParams } from "react-router-dom";
import { MessageSquare, Clock, User } from "lucide-react";

export default function ProjectThreadPage() {
  const { projectId, threadId } = useParams<{ projectId: string; threadId: string }>();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {/* Thread Header */}
        <div className="mb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <MessageSquare className="h-4 w-4 text-gray-600" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[15px] font-medium text-gray-900">
                {threadId || "Unknown Thread"}
              </h1>
              <p className="text-[12px] text-gray-500">
                项目：{projectId}
              </p>
            </div>
          </div>
        </div>

        {/* Thread Metadata */}
        <div className="flex items-center gap-4 text-[12px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>—</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>刚刚</span>
          </div>
        </div>

        {/* Messages Empty State */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
              <MessageSquare className="h-5 w-5 text-gray-400" strokeWidth={1.8} />
            </div>
          </div>
          <p className="text-[13px] text-gray-500">
            此线程暂无对话记录
          </p>
          <p className="mt-1 text-[12px] text-gray-400">
            执行操作后会在此显示详细的执行记录和输出
          </p>
        </div>

        {/* Info */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.8} />
            <div>
              <div className="text-[13px] font-medium text-gray-900">线程功能开发中</div>
              <div className="mt-0.5 text-[12px] text-gray-500">
                线程对话记录、执行日志、上下文管理等功能正在规划中。
              </div>
            </div>
          </div>
        </div>

        {/* Footer spacer */}
        <div className="flex-1" />
      </div>
    </div>
  );
}

function AlertCircle({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
