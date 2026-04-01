import { useState } from "react";
import { Terminal, ArrowRight, Repeat2, Plus, Paperclip, Mic, ChevronDown, Search, Folder } from "lucide-react";
import useCliTools from "../hooks/useCliTools";
import { cn } from "../lib/utils";
import { defaultProjects, type Project } from "../components/app-shell/ProjectTree";

export default function NewThreadPage() {
  const { tools, loading, scanning, scan } = useCliTools();
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(defaultProjects[0] || null);
  const [searchQuery, setSearchQuery] = useState("");

  const installedCount = tools.filter((tool) => tool.installed).length;

  const filteredProjects = defaultProjects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-0 pt-4">
        {/* Welcome section */}
        <div className="flex flex-col items-center justify-center px-5 py-6 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="h-6 w-0.5 bg-gray-900" />
          </div>
          <h2 className="mb-2 text-2xl font-medium tracking-tight text-gray-900">
            开始构建你的 Console 工作台
          </h2>
          
          {/* Project selector */}
          <div className="relative mt-4">
            <button
              type="button"
              onClick={() => setProjectSelectorOpen(!projectSelectorOpen)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Folder className="h-4 w-4 text-gray-500" strokeWidth={1.8} />
              <span>{selectedProject?.name || "选择项目"}</span>
              <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", projectSelectorOpen && "rotate-180")} strokeWidth={1.8} />
            </button>

            {/* Project selector dropdown */}
            {projectSelectorOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setProjectSelectorOpen(false)}
                />
                <div className="absolute left-1/2 z-20 mt-2 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  {/* Search */}
                  <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                    <Search className="h-4 w-4 text-gray-400" strokeWidth={1.8} />
                    <input
                      type="text"
                      placeholder="搜索项目..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-[13px] text-gray-900 placeholder-gray-400 outline-none"
                      autoFocus
                    />
                  </div>
                  
                  {/* Project list */}
                  <div className="max-h-64 overflow-y-auto p-1.5">
                    {filteredProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setSelectedProject(project);
                          setProjectSelectorOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                          selectedProject?.id === project.id
                            ? "bg-[#dbeafe] text-gray-900"
                            : "text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        <Folder className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.8} />
                        <span className="truncate">{project.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Add new project */}
                  <div className="border-t border-gray-100 p-1.5">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.8} />
                      添加新项目
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-gray-500">
            统一管理 Claude / Codex / Gemini / Cursor 的版本、Provider、MCP、Skills 与系统提示词。
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 gap-3 px-5 pb-2 sm:grid-cols-3">
          <FeatureCard
            icon={<Terminal className="h-4 w-4" />}
            title="CLI 工具检测"
            description="检测本机已安装 CLI 并建立适配器清单"
          />
          <FeatureCard
            icon={<Repeat2 className="h-4 w-4" />}
            title="一键同步"
            description="同步 Provider / MCP / Skills 到各 CLI 原生配置"
          />
          <FeatureCard
            icon={<ArrowRight className="h-4 w-4" />}
            title="配置迁移"
            description="规划跨工具的配置迁移与版本升级"
          />
        </div>

        <div className="flex-1" />
      </div>

      {/* Composer area - fixed at bottom */}
      <div className="shrink-0 px-5 pb-5">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="text-[13px] text-gray-400">
              Ask Console anything：检测已安装工具、切换模型、同步 MCP、安装技能，或规划一次升级。
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                <Paperclip className="h-3.5 w-3.5" strokeWidth={1.8} />
                附加上下文
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                默认权限
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <Mic className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={scan}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-black disabled:opacity-50"
              >
                {scanning ? "扫描中..." : "开始同步"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info bar */}
      <div className="shrink-0 border-t border-gray-100 px-5 py-2.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <span>本地优先</span>
            <span>SSE streaming</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{installedCount} adapters online</span>
            <span className="font-mono">main</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md">
      <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 text-gray-700 group-hover:bg-gray-100">
        {icon}
      </div>
      <div className="mb-1 text-[13px] font-medium text-gray-900">{title}</div>
      <div className="text-[12px] leading-relaxed text-gray-500">{description}</div>
    </div>
  );
}
