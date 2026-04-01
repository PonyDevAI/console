import { Bot } from "lucide-react";

export default function SkillsAndAppsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-5 py-3">
          <h1 className="text-[15px] font-medium text-gray-900">技能和应用</h1>
        </div>

        {/* Content */}
        <div className="flex flex-1 items-start justify-center overflow-y-auto px-5 pb-5 pt-2">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
                  <Bot className="h-5 w-5 text-gray-400" strokeWidth={1.8} />
                </div>
              </div>
              <h2 className="mb-2 text-lg font-medium text-gray-900">技能和应用管理</h2>
              <p className="text-[13px] text-gray-500">
                管理已安装的技能（Skills）和应用程序，支持跨 CLI 工具同步配置。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
