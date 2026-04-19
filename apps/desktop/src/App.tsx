import { useEffect, useState, useCallback } from "react";
import { DesktopSidebar } from "./components/DesktopSidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { AgentSourcesPage } from "./pages/AgentSourcesPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { McpPage } from "./pages/McpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CredentialsPage } from "./pages/CredentialsPage";
import { ServersPage } from "./pages/ServersPage";
import { TerminalPage } from "./pages/TerminalPage";
import { listServers, type ServerDto } from "./lib/server-commands";

type ViewKey = "overview" | "agent-sources" | "providers" | "mcp" | "credentials" | "servers" | "terminal" | "settings";

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [servers, setServers] = useState<ServerDto[]>([]);
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

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <DesktopSidebar
        activeView={activeView}
        onNavigate={setActiveView}
        buildVersion={buildVersion}
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
            {activeView === "terminal" && <TerminalPage servers={servers} />}
            {activeView === "settings" && <SettingsPage />}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
