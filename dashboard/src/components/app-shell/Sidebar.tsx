import { ChevronRight, Settings, Home, Plus, Folder, Bot, Sparkles, ListTodo } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import type { Project } from "./ProjectTree";

type SidebarProps = {
  collapsed?: boolean;
  projects: Project[];
  onProjectToggle?: (projectId: string) => void;
  onToggleMobile?: () => void;
  mobileOpen?: boolean;
};

const consoleNavItems = [
  { to: "/", label: "概览", icon: Home },
  { to: "/new-thread", label: "新线程", icon: Plus },
  { to: "/skills-and-apps", label: "技能和应用", icon: Bot },
  { to: "/automations", label: "自动化", icon: Sparkles },
  { to: "/task-board", label: "任务看板", icon: ListTodo },
];

export default function Sidebar({
  collapsed = false,
  projects = [],
  onProjectToggle,
  onToggleMobile,
  mobileOpen = false,
}: SidebarProps) {
  // Mobile sidebar - overlay style with backdrop built-in
  if (mobileOpen && onToggleMobile) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={onToggleMobile}
        />
        <aside className="relative z-50 h-full w-64 overflow-hidden bg-[#e8eef3] shadow-xl md:hidden">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="shrink-0 px-3 py-3">
              <div className="text-[14px] font-semibold text-gray-900">Console</div>
            </div>

            <nav className="shrink-0 px-2">
              <div className="space-y-0.5">
                {consoleNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={onToggleMobile}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors",
                          isActive
                            ? "bg-[#dbeafe] text-gray-900"
                            : "text-gray-600 hover:bg-[#e8eef3] hover:text-gray-900",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-gray-900" : "text-gray-500")} strokeWidth={1.8} />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </nav>

            <nav className="min-h-0 shrink-0 flex-1 overflow-y-auto px-2">
              <div className="mb-1.5 mt-3 px-2 text-[9px] font-medium uppercase tracking-wider text-gray-400">
                工程
              </div>
              <div className="space-y-0.5">
                {projects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    onToggle={() => onProjectToggle?.(project.id)}
                  />
                ))}
              </div>
            </nav>

            <div className="shrink-0 px-2 py-2">
              <NavLink
                to="/settings"
                end
                onClick={onToggleMobile}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors",
                    isActive
                      ? "bg-[#dbeafe] text-gray-900"
                      : "text-gray-600 hover:bg-[#e8eef3] hover:text-gray-900",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Settings className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-gray-900" : "text-gray-500")} strokeWidth={1.8} />
                    <span>设置</span>
                  </>
                )}
              </NavLink>
            </div>
          </div>
        </aside>
      </>
    );
  }

  // Collapsed state (desktop)
  if (collapsed) {
    return (
      <aside
        className="flex h-full flex-col items-center py-3"
        style={{ backgroundColor: "#e8eef3", width: "72px" }}
      >
        {/* Brand icon only - folded state */}
        <div className="mb-4 flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-white">
          <span className="text-[11px] font-bold">C</span>
        </div>
        
        <nav className="flex w-full flex-col gap-0.5 px-1.5">
          {consoleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-[#dbeafe] text-gray-900"
                      : "text-gray-500 hover:bg-[#e8eef3] hover:text-gray-700",
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </NavLink>
            );
          })}
        </nav>
        
        <div className="mt-auto flex w-full flex-col gap-0.5 px-1.5 pb-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                isActive
                  ? "bg-[#dbeafe] text-gray-900"
                  : "text-gray-500 hover:bg-[#e8eef3] hover:text-gray-700",
              )
            }
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={1.8} />
          </NavLink>
        </div>
      </aside>
    );
  }

  // Expanded state (desktop)
  return (
    <aside
      className="flex h-full flex-col overflow-hidden"
      style={{ width: "260px" }}
    >
      {/* Brand */}
      <div className="shrink-0 px-3 py-3">
        <div className="text-[14px] font-semibold text-gray-900">Console</div>
      </div>

      {/* Console navigation - no section header */}
      <nav className="shrink-0 px-2">
        <div className="space-y-0.5">
          {consoleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors",
                    isActive
                      ? "bg-[#dbeafe] text-gray-900"
                      : "text-gray-600 hover:bg-[#e8eef3] hover:text-gray-900",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-gray-900" : "text-gray-500")} strokeWidth={1.8} />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Projects section */}
      <nav className="min-h-0 shrink-0 flex-1 overflow-y-auto px-2">
        <div className="mb-1.5 mt-3 px-2 text-[9px] font-medium uppercase tracking-wider text-gray-400">
          工程
        </div>
        <div className="space-y-0.5">
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              onToggle={() => onProjectToggle?.(project.id)}
            />
          ))}
        </div>
      </nav>

      {/* Settings - bottom with more spacing */}
      <div className="shrink-0 px-2 pb-3 pt-2">
        <NavLink
          to="/settings"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors",
              isActive
                ? "bg-[#dbeafe] text-gray-900"
                : "text-gray-600 hover:bg-[#e8eef3] hover:text-gray-900",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Settings className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-gray-900" : "text-gray-500")} strokeWidth={1.8} />
              <span>设置</span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}

type ProjectItemProps = {
  project: Project;
  onToggle: () => void;
};

function ProjectItem({ project, onToggle }: ProjectItemProps) {
  const isExpanded = project.expanded ?? false;
  const hasThreads = project.threads && project.threads.length > 0;

  return (
    <div className="space-y-0.5">
      <div
        onClick={onToggle}
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors",
          "text-gray-700 hover:bg-[#e8eef3] hover:text-gray-900",
        )}
      >
        <ChevronRight
          className={cn(
            "h-2.5 w-2.5 shrink-0 text-gray-400 transition-transform",
            isExpanded && "rotate-90",
          )}
          strokeWidth={2}
        />
        <Folder className="h-3.5 w-3.5 shrink-0 text-gray-500" strokeWidth={1.8} />
        <span className="truncate text-[11.5px] font-medium">{project.name}</span>
      </div>
      {isExpanded && hasThreads && project.threads && (
        <div className="space-y-0.5 pl-5">
          {project.threads.map((thread) => (
            <NavLink
              key={thread.id}
              to={`/projects/${project.id}/threads/${thread.id}`}
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors",
                  isActive
                    ? "bg-[#dbeafe] text-gray-900"
                    : "text-gray-600 hover:bg-[#e8eef3] hover:text-gray-900",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn("h-1 w-1 shrink-0 rounded-full", isActive ? "bg-gray-900" : "bg-gray-400")} />
                  <span className="truncate text-[11.5px]">{thread.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
