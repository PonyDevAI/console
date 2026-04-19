import { Box } from "lucide-react";
import { ProjectPicker } from "./ProjectPicker";
import { type Project } from "../app-shell/ProjectTree";

type StarterHeroProps = {
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
};

export function StarterHero({ selectedProject, onProjectSelect }: StarterHeroProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-32 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-6 w-0.5 bg-gray-900" />
      </div>

      <h2 className="mb-1 text-2xl font-medium tracking-tight text-gray-900">
        开始构建
      </h2>

      <div className="mt-3 mb-8">
        <ProjectPicker
          selectedProject={selectedProject}
          onSelect={onProjectSelect}
          variant="inline"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-6">
        <StarterCard
          title="CLI 工具检测"
          description="检测本机已安装 CLI 并建立适配器清单"
        />
        <StarterCard
          title="一键同步"
          description="同步 Provider / MCP / Skills 到各 CLI 原生配置"
        />
        <StarterCard
          title="配置迁移"
          description="规划跨工具的配置迁移与版本升级"
        />
      </div>
    </div>
  );
}

type StarterCardProps = {
  title: string;
  description: string;
};

function StarterCard({ title, description }: StarterCardProps) {
  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md">
      <div className="mb-1 text-[13px] font-medium text-gray-900">{title}</div>
      <div className="text-[12px] leading-relaxed text-gray-500">{description}</div>
    </div>
  );
}
