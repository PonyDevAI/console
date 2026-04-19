import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  Route,
  Plug,
  Settings,
  PanelLeftClose,
  Tag,
} from "lucide-react";
import { cn } from "../lib/utils";
import { startWindowDrag } from "../lib/windowDrag";

type ViewKey = "overview" | "agent-sources" | "providers" | "mcp" | "settings";

type NavItemDef = {
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItemDef[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "agent-sources", label: "Agent Sources", icon: Package },
  { key: "providers", label: "Providers", icon: Route },
  { key: "mcp", label: "MCP", icon: Plug },
];

type DesktopSidebarProps = {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  buildVersion: string;
};

export function DesktopSidebar({ activeView, onNavigate, buildVersion }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col bg-[var(--bg)] transition-all duration-200",
        collapsed ? "w-[62px]" : "w-[260px]"
      )}
    >
      {/* Brand */}
      <div
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
        className={cn(
          "flex h-[76px] items-end px-4 pb-3 pt-8",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          <div
            data-tauri-drag-region
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-[11px] font-bold text-white"
          >
            CC
          </div>
          {!collapsed && (
            <span
              data-tauri-drag-region
              className="text-[13px] font-semibold text-[var(--text-strong)]"
            >
              CloudCode
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="desktop sections">
        <div className="mb-2 px-2">
          {!collapsed && (
            <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Workspace
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = item.key === activeView;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-1.5 text-[10.5px] font-medium transition-colors",
                  collapsed && "mx-auto h-9 w-9 justify-center rounded-[10px] px-0 py-0",
                  !collapsed && "rounded-[var(--radius-md)]",
                  isActive
                    ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
                    : "text-[var(--text)] hover:bg-[var(--bg-hover)]"
                )}
              >
                <item.icon size={17} strokeWidth={1.8} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div className={cn("mt-auto px-2 pb-3 pt-2", collapsed && "px-1.5")}>
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className={cn(
              "flex items-center gap-3 px-2.5 py-1.5 text-[10.5px] font-medium transition-colors",
              collapsed && "mx-auto h-9 w-9 justify-center rounded-[10px] px-0 py-0",
              !collapsed && "rounded-[var(--radius-md)]",
              activeView === "settings"
                ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
                : "text-[var(--text)] hover:bg-[var(--bg-hover)]"
            )}
          >
            <Settings size={17} strokeWidth={1.8} />
            {!collapsed && <span>Settings</span>}
          </button>

          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              data-no-drag="true"
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] px-0 py-0 text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              <PanelLeftClose
                size={17}
                strokeWidth={1.8}
                className="transition-transform -scale-x-100"
              />
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-[var(--radius-md)]">
              <div className="flex items-center gap-3 px-2.5 py-1.5 text-[10.5px] font-medium text-[var(--text)]">
                <Tag size={17} strokeWidth={1.8} />
                <span className="leading-none">{buildVersion}</span>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                data-no-drag="true"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <PanelLeftClose size={17} strokeWidth={1.8} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
