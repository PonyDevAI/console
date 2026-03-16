import {
  Bot,
  Cpu,
  LayoutDashboard,
  Menu,
  RefreshCw,
  ScrollText,
  Server,
  Settings,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { getHealth } from "./api";
import ThemeModeToggle from "./components/ThemeModeToggle";
import { ToastContainer } from "./components/Toast";
import UpdateBanner from "./components/UpdateBanner";
import useTheme from "./hooks/useTheme";
import { cn } from "./lib/utils";
import Dashboard from "./pages/Dashboard";
import ConfigSyncPage from "./pages/ConfigSyncPage";
import LogsPage from "./pages/LogsPage";
import McpPage from "./pages/McpPage";
import NotFound from "./pages/NotFound";
import ProviderPage from "./pages/ProviderPage";
import SettingsPage from "./pages/SettingsPage";
import SkillPage from "./pages/SkillPage";
import AgentsPage from "./pages/AgentsPage";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "控制",
    items: [
      { to: "/", label: "仪表盘", icon: LayoutDashboard },
      { to: "/agents", label: "Agent 管理", icon: Bot },
    ],
  },
  {
    title: "代理",
    items: [
      { to: "/providers", label: "模型供应商", icon: Cpu },
      { to: "/mcp", label: "MCP 服务器", icon: Server },
      { to: "/skills", label: "技能", icon: Zap },
    ],
  },
  {
    title: "系统",
    items: [
      { to: "/logs", label: "日志", icon: ScrollText },
      { to: "/config-sync", label: "配置同步", icon: RefreshCw },
      { to: "/settings", label: "设置", icon: Settings },
    ],
  },
];

export default function App() {
  const { mode, setMode } = useTheme();
  const [connected, setConnected] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getHealth()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
  }, []);

  return (
    <div
      className="grid h-screen overflow-hidden"
      style={{
        gridTemplateColumns: collapsed ? "78px 1fr" : "288px 1fr",
        gridTemplateRows: "52px 1fr",
        gridTemplateAreas: '"nav topbar" "nav content"',
        animation: "dashboard-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        transition: "grid-template-columns 200ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col overflow-hidden"
        style={{
          gridArea: "nav",
          background: "color-mix(in srgb, var(--bg) 96%, var(--bg-elevated) 4%)",
          padding: collapsed ? "14px 8px" : "14px",
          borderRight: "1px solid var(--border)",
          transition: "padding 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Brand */}
        <div className={cn("mb-5 flex items-center gap-2", collapsed ? "justify-center" : "")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent)] text-sm font-bold text-white shadow-[0_10px_20px_color-mix(in_srgb,black_20%,transparent),inset_0_1px_0_color-mix(in_srgb,white_10%,transparent)]">
            C
          </div>
          {!collapsed && (
            <div className="leading-tight overflow-hidden">
              <div className="text-[14px] font-bold tracking-[0.02em] text-[var(--text-strong)]">CONSOLE</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--muted)]">
                AI CLI 仪表盘
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <div className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.title}>
                {!collapsed && (
                  <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                    {group.title}
                  </div>
                )}
                <div className={cn("grid", collapsed ? "gap-[6px]" : "gap-1")}>
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    if (item.disabled) {
                      return (
                        <button
                          key={item.to}
                          type="button"
                          disabled
                          className={cn(
                            "flex items-center border border-transparent text-[var(--muted)] opacity-50",
                            collapsed
                              ? "mx-auto h-[44px] w-[44px] justify-center rounded-[16px]"
                              : "min-h-[38px] gap-[10px] rounded-[12px] px-3 py-2 text-[13px] font-[550]",
                          )}
                        >
                          <Icon className={collapsed ? "h-[18px] w-[18px]" : "h-[15px] w-[15px]"} />
                          {!collapsed && item.label}
                        </button>
                      );
                    }

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                          cn(
                            "relative flex items-center transition-colors",
                            collapsed
                              ? cn(
                                  "mx-auto h-[44px] w-[44px] justify-center rounded-[16px] border border-transparent",
                                  isActive
                                    ? "bg-[var(--accent)] text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                                    : "text-[var(--muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                                )
                              : cn(
                                  "min-h-[38px] gap-[10px] rounded-[12px] border border-transparent px-3 py-2 text-[13px] font-[550]",
                                  isActive
                                    ? "bg-[var(--accent)] text-white shadow-[0_6px_14px_rgba(0,0,0,0.18)]"
                                    : "text-[var(--muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
                                ),
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={cn(
                                collapsed ? "h-[18px] w-[18px]" : "h-[15px] w-[15px]",
                                isActive ? "text-white" : "",
                              )}
                            />
                            {!collapsed && item.label}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Sidebar footer — empty, matching OpenClaw (version is in topbar) */}
        <div className="shrink-0" />
      </aside>

      {/* ── Topbar ── */}
      <header
        className="flex items-center justify-between px-5"
        style={{
          gridArea: "topbar",
          background: "color-mix(in srgb, var(--bg) 96%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid color-mix(in srgb, var(--border) 74%, transparent)",
        }}
      >
        {/* Left: hamburger toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {/* Right: version + health + avatar + settings */}
        {/* Right: version pill + health pill + theme toggle */}
        <div className="flex items-center gap-2">
          {/* 版本 pill — 橙色圆点表示有更新 */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--text)]"
            style={{
              border: "1px solid color-mix(in srgb, var(--border) 84%, transparent)",
              background: "color-mix(in srgb, var(--bg-elevated) 78%, transparent)",
              height: "32px",
            }}
          >
            <span className="h-2 w-2 rounded-full bg-[var(--warning)]" />
            版本 0.1.0
          </span>
          {/* 健康状况 pill */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--text)]"
            style={{
              border: "1px solid color-mix(in srgb, var(--border) 84%, transparent)",
              background: "color-mix(in srgb, var(--bg-elevated) 78%, transparent)",
              height: "32px",
            }}
          >
            <span
              className={cn("h-2 w-2 rounded-full", connected ? "bg-[var(--success)]" : "bg-[var(--danger)]")}
            />
            {connected ? "健康状况 正常" : "离线"}
          </span>
          {/* 三段式主题切换 */}
          <ThemeModeToggle mode={mode} onChange={setMode} />
        </div>
      </header>

      {/* ── Content ── */}
      <main className="overflow-y-auto bg-[var(--bg)] p-5" style={{ gridArea: "content" }}>
        <UpdateBanner currentVersion="0.1.0" latestVersion="0.2.0" />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/providers" element={<ProviderPage />} />
          <Route path="/mcp" element={<McpPage />} />
          <Route path="/skills" element={<SkillPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/config-sync" element={<ConfigSyncPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <ToastContainer />
    </div>
  );
}
