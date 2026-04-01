import { ListTodo, PanelLeftClose, Menu } from "lucide-react";
import { cn } from "../../lib/utils";

type MainPanelProps = {
  activeTaskCount?: number;
  versionInfo?: { current: string; updateAvailable?: boolean };
  connected?: boolean;
  collapsed?: boolean;
  onToggleSidebar?: () => void;
  onToggleMobile?: () => void;
  children: React.ReactNode;
};

export default function MainPanel({
  activeTaskCount = 0,
  versionInfo,
  connected = true,
  collapsed = false,
  onToggleSidebar,
  onToggleMobile,
  children,
}: MainPanelProps) {
  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={{
        minWidth: 0,
        background: "var(--bg-elevated)",
      }}
    >
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMobile}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 md:hidden"
            aria-label="打开菜单"
          >
            <Menu className="h-4 w-4" strokeWidth={1.8} />
          </button>
          
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 md:flex"
            aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            <PanelLeftClose className={cn("h-4 w-4 transition-transform", collapsed && "-scale-x-100")} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap",
              activeTaskCount > 0 ? "bg-orange-50 text-orange-700" : "bg-gray-100 text-gray-600",
            )}
            title={activeTaskCount > 0 ? `${activeTaskCount} 个任务进行中` : "任务队列"}
          >
            {activeTaskCount > 0 ? (
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
            ) : (
              <ListTodo className="h-3 w-3" strokeWidth={1.8} />
            )}
            {activeTaskCount > 0 && <span className="min-w-[1ch]">{activeTaskCount}</span>}
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap",
              versionInfo?.updateAvailable ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600",
            )}
            title={versionInfo?.updateAvailable ? "有新版本可用" : "已是最新版本"}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                versionInfo?.updateAvailable ? "bg-amber-500" : "bg-emerald-500",
              )}
            />
            <span className="text-right">{versionInfo?.current ?? "..."}</span>
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
              connected ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}
            title={connected ? "已连接" : "未连接"}
          >
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", connected ? "bg-emerald-500" : "bg-red-500")}
            />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
