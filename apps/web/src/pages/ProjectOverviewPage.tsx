import { useParams } from "react-router-dom";
import { Folder, Terminal, GitBranch, Settings } from "lucide-react";

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        {/* Project Header */}
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <Folder className="h-5 w-5 text-gray-600" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[15px] font-medium text-gray-900">
              {projectId || "Unknown Project"}
            </h1>
            <p className="text-[13px] text-gray-500">
              项目级配置与线程总览
            </p>
          </div>
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ProjectStatCard
            icon={<Terminal className="h-4 w-4" />}
            label="CLI 配置"
            value="未设置"
            subtext="适配器"
          />
          <ProjectStatCard
            icon={<GitBranch className="h-4 w-4" />}
            label="线程记录"
            value="0"
            subtext="活跃"
          />
          <ProjectStatCard
            icon={<Settings className="h-4 w-4" />}
            label="项目配置"
            value="默认"
            subtext="同步状态"
          />
        </div>

        {/* Threads List */}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-gray-900">项目线程</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
                <Terminal className="h-5 w-5 text-gray-400" strokeWidth={1.8} />
              </div>
            </div>
            <p className="text-[13px] text-gray-500">
              此项目暂无线程记录
            </p>
            <p className="mt-1 text-[12px] text-gray-400">
              从左侧导航创建新线程或选择已有线程
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.8} />
            <div>
              <div className="text-[13px] font-medium text-gray-900">项目功能开发中</div>
              <div className="mt-0.5 text-[12px] text-gray-500">
                项目级配置管理、线程归档、跨工具同步等功能正在规划中。
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

type ProjectStatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
};

function ProjectStatCard({ icon, label, value, subtext }: ProjectStatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-500">{icon}</div>
      <div className="text-[20px] font-semibold text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500">{subtext}</div>
      <div className="text-[11px] font-medium text-gray-400">{label}</div>
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
