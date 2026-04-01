import { Terminal, CheckCircle2, AlertCircle, Cloud, Server, Wrench, Activity, Box, FileText, Users } from "lucide-react";
import useCliTools from "../hooks/useCliTools";

export default function Dashboard() {
  const { tools, loading, scanning, scan } = useCliTools();

  const installedCount = tools.filter((tool) => tool.installed).length;
  const totalTools = tools.length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {/* Header - no Console category label */}
        <div className="mb-1">
          <h1 className="text-[15px] font-medium text-gray-900">概览</h1>
          <p className="text-[13px] text-gray-500">
            Console 平台状态总览
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Terminal className="h-4 w-4" />}
            label="CLI 工具"
            value={`${installedCount}/${totalTools}`}
            subtext="已安装"
          />
          <StatCard
            icon={<Cloud className="h-4 w-4" />}
            label="Providers"
            value="—"
            subtext="配置中"
          />
          <StatCard
            icon={<Server className="h-4 w-4" />}
            label="MCP Servers"
            value="—"
            subtext="已启用"
          />
          <StatCard
            icon={<Wrench className="h-4 w-4" />}
            label="Skills"
            value="—"
            subtext="已安装"
          />
        </div>

        {/* CLI Tools Status */}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-gray-900">CLI 工具状态</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {tools.length === 0 && loading ? (
              <div className="p-6 text-center text-[13px] text-gray-500">
                正在扫描已安装的 CLI 工具...
              </div>
            ) : tools.length === 0 ? (
              <div className="p-6 text-center">
                <button
                  type="button"
                  onClick={scan}
                  disabled={scanning}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black disabled:opacity-50"
                >
                  <Terminal className="h-4 w-4" strokeWidth={1.8} />
                  {scanning ? "扫描中..." : "扫描已安装工具"}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      {tool.installed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" strokeWidth={1.8} />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-300" strokeWidth={1.8} />
                      )}
                      <div>
                        <div className="text-[13px] font-medium text-gray-900">
                          {tool.display_name || tool.name}
                        </div>
                        {tool.installed && tool.local_version && (
                          <div className="text-[11px] text-gray-400">
                            v{tool.local_version}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      {tool.installed ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          已安装
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          未安装
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Configuration Overview */}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-gray-900">配置概览</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ConfigCard
              icon={<Cloud className="h-4 w-4" />}
              label="Provider 配置"
              status="未配置"
              statusColor="gray"
            />
            <ConfigCard
              icon={<Server className="h-4 w-4" />}
              label="MCP Servers"
              status="未配置"
              statusColor="gray"
            />
            <ConfigCard
              icon={<Users className="h-4 w-4" />}
              label="AI 员工"
              status="未配置"
              statusColor="gray"
            />
            <ConfigCard
              icon={<FileText className="h-4 w-4" />}
              label="系统提示词"
              status="未配置"
              statusColor="gray"
            />
          </div>
        </div>

        {/* Health Status */}
        <div>
          <h2 className="mb-2 text-[13px] font-semibold text-gray-900">健康状态</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <HealthCard
              icon={<Activity className="h-4 w-4" />}
              label="后端服务"
              status="正常"
              statusColor="emerald"
            />
            <HealthCard
              icon={<Box className="h-4 w-4" />}
              label="配置同步"
              status="正常"
              statusColor="emerald"
            />
            <HealthCard
              icon={<Terminal className="h-4 w-4" />}
              label="版本状态"
              status="最新"
              statusColor="emerald"
            />
          </div>
        </div>

        <div className="flex-1" />
      </div>
    </div>
  );
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
};

function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-500">{icon}</div>
      <div className="text-[22px] font-semibold text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500">{subtext}</div>
      <div className="text-[11px] font-medium text-gray-400">{label}</div>
    </div>
  );
}

type ConfigCardProps = {
  icon: React.ReactNode;
  label: string;
  status: string;
  statusColor: "emerald" | "amber" | "red" | "gray";
};

function ConfigCard({ icon, label, status, statusColor }: ConfigCardProps) {
  const colorMap = {
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-red-600 bg-red-50",
    gray: "text-gray-600 bg-gray-100",
  };

  return (
    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="text-gray-500">{icon}</div>
        <span className="text-[13px] font-medium text-gray-900">{label}</span>
      </div>
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colorMap[statusColor]}`}>
        {status}
      </span>
    </div>
  );
}

type HealthCardProps = {
  icon: React.ReactNode;
  label: string;
  status: string;
  statusColor: "emerald" | "amber" | "red";
};

function HealthCard({ icon, label, status, statusColor }: HealthCardProps) {
  const colorMap = {
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-red-600 bg-red-50",
  };

  return (
    <div className="flex items-center justify-between overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="text-gray-500">{icon}</div>
        <span className="text-[13px] font-medium text-gray-900">{label}</span>
      </div>
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colorMap[statusColor]}`}>
        {status}
      </span>
    </div>
  );
}
