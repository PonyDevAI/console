import { useEffect, useMemo, useState } from "react";
import { DesktopSidebar } from "./components/DesktopSidebar";
import { TopBar } from "./components/TopBar";
import { DashboardPage } from "./pages/DashboardPage";
import { AgentSourcesPage } from "./pages/AgentSourcesPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { McpPage } from "./pages/McpPage";
import { SettingsPage } from "./pages/SettingsPage";

type ViewKey = "overview" | "agent-sources" | "providers" | "mcp" | "settings";

const viewMeta: Record<ViewKey, { label: string; chips: { label: string; variant: "ok" | "neutral" | "accent" }[] }> = {
  overview: {
    label: "Overview",
    chips: [
      { label: "shell ready", variant: "ok" },
      { label: "mock data", variant: "neutral" },
      { label: "tauri next", variant: "accent" },
    ],
  },
  "agent-sources": {
    label: "Agent Sources",
    chips: [
      { label: "shell ready", variant: "ok" },
      { label: "mock data", variant: "neutral" },
    ],
  },
  providers: {
    label: "Providers",
    chips: [
      { label: "shell ready", variant: "ok" },
      { label: "mock data", variant: "neutral" },
    ],
  },
  mcp: {
    label: "MCP",
    chips: [
      { label: "shell ready", variant: "ok" },
      { label: "mock data", variant: "neutral" },
    ],
  },
  settings: {
    label: "Settings",
    chips: [
      { label: "shell ready", variant: "ok" },
      { label: "mock data", variant: "neutral" },
    ],
  },
};

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const meta = useMemo(() => viewMeta[activeView], [activeView]);
  const buildVersion =
    import.meta.env.VITE_CLOUDCODE_BUILD_VERSION?.trim() ||
    (import.meta.env.DEV ? "Dev" : "Release");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyThemeMode = (isDark: boolean) => {
      const mode = isDark ? "dark" : "light";
      document.documentElement.dataset.themeMode = mode;
      setThemeMode(mode);
    };

    applyThemeMode(media.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyThemeMode(event.matches);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <DesktopSidebar
        activeView={activeView}
        onNavigate={setActiveView}
        buildVersion={buildVersion}
      />
      <main className="flex min-w-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[16px] bg-[var(--bg-elevated)]">
          <TopBar title={meta.label} chips={meta.chips} />
          <div className="flex-1 overflow-y-auto">
            {activeView === "overview" && <DashboardPage />}
            {activeView === "agent-sources" && <AgentSourcesPage />}
            {activeView === "providers" && <ProvidersPage />}
            {activeView === "mcp" && <McpPage />}
            {activeView === "settings" && <SettingsPage />}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
