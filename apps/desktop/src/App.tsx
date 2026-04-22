import { useEffect, useState, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { DesktopSidebar } from "./components/DesktopSidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { AgentSourcesPage } from "./pages/AgentSourcesPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { McpPage } from "./pages/McpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CredentialsPage } from "./pages/CredentialsPage";
import { ServersPage } from "./pages/ServersPage";
import { TerminalPage } from "./pages/TerminalPage";
import {
  listServers,
  setNativeSidebarToggleState,
  type ServerDto,
} from "./lib/server-commands";

type ViewKey = "overview" | "agent-sources" | "providers" | "mcp" | "credentials" | "servers" | "terminal" | "settings";

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [servers, setServers] = useState<ServerDto[]>([]);
  const [hasVisitedTerminal, setHasVisitedTerminal] = useState(false);
  const buildVersion =
    import.meta.env.VITE_CLOUDCODE_BUILD_VERSION?.trim() ||
    (import.meta.env.DEV ? "Dev" : "Release");

  const loadServers = useCallback(async () => {
    try {
      const s = await listServers();
      setServers(s);
    } catch {
      // Terminal page handles empty server list gracefully
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyThemeMode = (isDark: boolean) => {
      const mode = isDark ? "dark" : "light";
      document.documentElement.dataset.themeMode = mode;
    };

    applyThemeMode(media.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyThemeMode(event.matches);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    const handleNativeSidebarToggle = () => {
      setSidebarCollapsed((value) => !value);
    };

    window.__cloudcodeToggleSidebar = handleNativeSidebarToggle;

    void listen("native-sidebar-toggle", () => {
      handleNativeSidebarToggle();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // The browser build has no native titlebar events.
      });

    return () => {
      delete window.__cloudcodeToggleSidebar;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    void setNativeSidebarToggleState(sidebarCollapsed).catch(() => {
      // Non-macOS builds or browser previews do not expose the native titlebar bridge.
    });
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (activeView === "terminal") {
      setHasVisitedTerminal(true);
    }
  }, [activeView]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <DesktopSidebar
        activeView={activeView}
        onNavigate={setActiveView}
        buildVersion={buildVersion}
        collapsed={sidebarCollapsed}
      />
      <main className="flex min-w-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[16px] bg-[var(--bg-elevated)]">
          <div className="flex-1 overflow-y-auto">
            {activeView === "overview" && <DashboardPage />}
            {activeView === "agent-sources" && <AgentSourcesPage />}
            {activeView === "providers" && <ProvidersPage />}
            {activeView === "mcp" && <McpPage />}
            {activeView === "credentials" && <CredentialsPage />}
            {activeView === "servers" && <ServersPage />}
            {activeView === "settings" && <SettingsPage />}
            {hasVisitedTerminal && (
              <div className={activeView === "terminal" ? "h-full" : "hidden"}>
                <TerminalPage servers={servers} />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
