import { Routes, Route, NavLink } from "react-router-dom";
import { ToastContainer } from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import McpPage from "./pages/McpPage";
import NotFound from "./pages/NotFound";
import ProviderPage from "./pages/ProviderPage";
import SkillPage from "./pages/SkillPage";
import VersionPage from "./pages/VersionPage";

const nav = [
  { to: "/", label: "Dashboard", icon: "◉" },
  { to: "/versions", label: "Versions", icon: "↑" },
  { to: "/providers", label: "Providers", icon: "⇄" },
  { to: "/mcp", label: "MCP Servers", icon: "◎" },
  { to: "/skills", label: "Skills", icon: "✦" },
];

export default function App() {
  return (
    <div className="flex h-screen bg-zinc-50">
      <aside className="flex w-56 flex-col bg-zinc-900 text-zinc-300">
        <div className="border-b border-zinc-800 px-5 py-5">
          <h1 className="text-lg font-bold tracking-tight text-white">Console</h1>
          <p className="mt-0.5 text-xs text-zinc-500">AI CLI Management</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-zinc-800 font-medium text-white" : "hover:bg-zinc-800/50 hover:text-white"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-800 px-5 py-4 text-xs text-zinc-600">v0.1.0 - Phase 0</div>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/versions" element={<VersionPage />} />
          <Route path="/providers" element={<ProviderPage />} />
          <Route path="/mcp" element={<McpPage />} />
          <Route path="/skills" element={<SkillPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <ToastContainer />
    </div>
  );
}
