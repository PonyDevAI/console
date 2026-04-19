import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/app-shell/Sidebar";
import TopBar from "./components/app-shell/TopBar";
import { defaultProjects, type Project } from "./components/app-shell/ProjectTree";
import { getHealth, checkSystemUpdate } from "./api";
import Dashboard from "./pages/Dashboard";
import NewThreadPage from "./pages/NewThreadPage";
import SkillsAndAppsPage from "./pages/SkillsAndAppsPage";
import AutomationsPage from "./pages/AutomationsPage";
import TaskBoardPage from "./pages/TaskBoardPage";
import TerminalPage from "./pages/TerminalPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import ProjectOverviewPage from "./pages/ProjectOverviewPage";
import ProjectThreadPage from "./pages/ProjectThreadPage";
import { TaskProvider, useTasks } from "./contexts/TaskContext";

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [connected, setConnected] = useState(true);
  const [versionInfo, setVersionInfo] = useState<{ current: string; latest: string; updateAvailable: boolean } | null>(null);
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { tasks } = useTasks();

  const location = useLocation();
  const isTerminal = location.pathname === "/terminal";
  const allTasks = Array.from(tasks.values()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const activeTasks = allTasks.filter(t => t.status === 'pending' || t.status === 'running');
  const activeCount = activeTasks.length;

  useEffect(() => {
    getHealth()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    async function fetchVersion() {
      try {
        const data = await checkSystemUpdate();
        setVersionInfo({ current: data.current, latest: data.latest, updateAvailable: data.update_available });
      } catch {
        // Silent fail
      }
    }
    void fetchVersion();
  }, []);

  const handleProjectToggle = (projectId: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId ? { ...p, expanded: !p.expanded } : p
      )
    );
  };

  return (
    <TaskProvider>
      <div className="flex h-screen overflow-hidden bg-[#e8eef3]">
        {/* Desktop Sidebar */}
        <aside
          className="hidden md:block"
          style={{
            width: collapsed ? "72px" : "260px",
            flexShrink: 0,
          }}
        >
          <Sidebar
            collapsed={collapsed}
            projects={projects}
            onProjectToggle={handleProjectToggle}
          />
        </aside>

        {/* Mobile Sidebar Overlay - only rendered when mobile menu is open */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <Sidebar
              mobileOpen
              projects={projects}
              onProjectToggle={handleProjectToggle}
              onToggleMobile={() => setMobileOpen(false)}
            />
          </div>
        )}

        {/* Main Content Area - white panel that fills all remaining space */}
        <div
          className="flex flex-1 flex-col overflow-hidden"
          style={{
            minWidth: 0,
            backgroundColor: "#ffffff",
            borderTopLeftRadius: "16px",
            borderBottomLeftRadius: "16px",
          }}
        >
          <TopBar
            activeTaskCount={activeCount}
            versionInfo={versionInfo ? { current: versionInfo.current, updateAvailable: versionInfo.updateAvailable } : undefined}
            connected={connected}
            collapsed={collapsed}

            onToggleSidebar={() => setCollapsed(!collapsed)}
            onToggleMobile={() => setMobileOpen(!mobileOpen)}
          />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden" style={isTerminal ? { backgroundColor: "#000000" } : undefined}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new-thread" element={<NewThreadPage />} />
              <Route path="/skills-and-apps" element={<SkillsAndAppsPage />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/task-board" element={<TaskBoardPage />} />
              <Route path="/terminal" element={<TerminalPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/projects/:projectId/overview" element={<ProjectOverviewPage />} />
              <Route path="/projects/:projectId/threads/:threadId" element={<ProjectThreadPage />} />
              <Route path="/not-found" element={<NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </TaskProvider>
  );
}
