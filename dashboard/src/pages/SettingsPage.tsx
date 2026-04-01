import { useState } from "react";
import { cn } from "../lib/utils";
import { Box, Cloud, Server, Wrench, FileText, Repeat, ScrollText, Users } from "lucide-react";

type SettingsSection = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const sections: SettingsSection[] = [
  { id: "versions", label: "版本管理", icon: <Box className="h-4 w-4" /> },
  { id: "agents", label: "AI 员工", icon: <Users className="h-4 w-4" /> },
  { id: "providers", label: "Provider 管理", icon: <Cloud className="h-4 w-4" /> },
  { id: "mcp", label: "MCP Servers", icon: <Server className="h-4 w-4" /> },
  { id: "skills", label: "Skills", icon: <Wrench className="h-4 w-4" /> },
  { id: "prompts", label: "系统提示词", icon: <FileText className="h-4 w-4" /> },
  { id: "sync", label: "配置同步", icon: <Repeat className="h-4 w-4" /> },
  { id: "logs", label: "日志 / 调试", icon: <ScrollText className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("versions");

  return (
    <div className="flex h-full overflow-hidden bg-[var(--bg-elevated)]">
      <div className="w-52 shrink-0 border-r border-gray-100 bg-gray-50/50 p-3">
        <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          设置
        </div>
        <nav className="space-y-0.5">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors",
                activeSection === section.id
                  ? "bg-white text-gray-900"
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900",
              )}
            >
              <span className={cn(activeSection === section.id ? "text-gray-900" : "text-gray-500")}>
                {section.icon}
              </span>
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {sections.find((s) => s.id === activeSection)?.label}
            </h1>
            <p className="mt-1 text-[13px] text-gray-500">
              管理 Console 的{sections.find((s) => s.id === activeSection)?.label.toLowerCase()}配置
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {activeSection === "versions" && <VersionsSection />}
            {activeSection === "agents" && <AgentsSection />}
            {activeSection === "providers" && <ProvidersSection />}
            {activeSection === "mcp" && <McpSection />}
            {activeSection === "skills" && <SkillsSection />}
            {activeSection === "prompts" && <PromptsSection />}
            {activeSection === "sync" && <SyncSection />}
            {activeSection === "logs" && <LogsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionsSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        版本管理页面 - 管理各 CLI 工具的安装、升级和卸载
      </p>
    </div>
  );
}

function AgentsSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        AI 员工配置页面 - 配置和管理 AI Agent/员工角色和权限
      </p>
    </div>
  );
}

function ProvidersSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        Provider 管理页面 - 配置和管理 AI 模型供应商和 API Keys
      </p>
    </div>
  );
}

function McpSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        MCP Servers 管理页面 - 配置 MCP 服务器及其在各 CLI 工具中的启用状态
      </p>
    </div>
  );
}

function SkillsSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        Skills 管理页面 - 管理技能仓库和安装状态
      </p>
    </div>
  );
}

function PromptsSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        系统提示词管理页面 - 配置和管理系统提示词模板
      </p>
    </div>
  );
}

function SyncSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        配置同步页面 - 将 Console 的统一配置同步到各 CLI 工具的原生配置文件
      </p>
    </div>
  );
}

function LogsSection() {
  return (
    <div>
      <p className="text-[13px] text-gray-600">
        日志和调试信息页面 - 查看系统日志和调试信息
      </p>
    </div>
  );
}
