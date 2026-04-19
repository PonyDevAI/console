import { ListTodo, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useTasks } from "../contexts/TaskContext";

export default function TaskBoardPage() {
  const { tasks } = useTasks();
  const allTasks = Array.from(tasks.values()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const runningTasks = allTasks.filter(t => t.status === 'running');
  const completedTasks = allTasks.filter(t => t.status === 'completed');
  const failedTasks = allTasks.filter(t => t.status === 'failed');

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {/* Header */}
        <div className="mb-1">
          <h1 className="text-[15px] font-medium text-gray-900">任务看板</h1>
          <p className="text-[13px] text-gray-500">
            查看和管理所有后台任务
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<ListTodo className="h-4 w-4" />}
            label="进行中"
            value={runningTasks.length.toString()}
            color="blue"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="等待中"
            value={pendingTasks.length.toString()}
            color="gray"
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="已完成"
            value={completedTasks.length.toString()}
            color="emerald"
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="失败"
            value={failedTasks.length.toString()}
            color="red"
          />
        </div>

        {/* Task List */}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-gray-900">所有任务</h2>
          {allTasks.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-8 text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
                  <ListTodo className="h-5 w-5 text-gray-400" strokeWidth={1.8} />
                </div>
              </div>
              <h3 className="mb-1 text-[14px] font-medium text-gray-900">暂无任务</h3>
              <p className="text-[13px] text-gray-500">
                任务将在后台执行时显示在这里
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="divide-y divide-gray-100">
                {allTasks.map((task) => (
                  <div key={task.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={task.status} />
                          <span className="truncate text-[13px] font-medium text-gray-900">
                            {task.action}
                          </span>
                        </div>
                        {task.target && (
                          <div className="mt-0.5 text-[12px] text-gray-500">
                            {task.target}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-[11px] text-gray-400">
                        {new Date(task.updated_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />
      </div>
    </div>
  );
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "gray" | "emerald" | "red";
};

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50",
    gray: "text-gray-600 bg-gray-100",
    emerald: "text-emerald-600 bg-emerald-50",
    red: "text-red-600 bg-red-50",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-500">{icon}</div>
      <div className="text-[22px] font-semibold text-gray-900">{value}</div>
      <div className="mt-1">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colorMap[color]}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; className: string }> = {
    pending: { label: "等待中", className: "bg-gray-100 text-gray-600" },
    running: { label: "运行中", className: "bg-blue-50 text-blue-600" },
    completed: { label: "已完成", className: "bg-emerald-50 text-emerald-600" },
    failed: { label: "失败", className: "bg-red-50 text-red-600" },
  };

  const config = statusMap[status] || { label: status, className: "bg-gray-100 text-gray-600" };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
