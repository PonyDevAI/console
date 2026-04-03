import { TerminalConnectionStatus } from "../../types";

type TerminalToolbarProps = {
  status: TerminalConnectionStatus;
  onDisconnect: () => void;
  onReconnect: () => void;
};

export default function TerminalToolbar({
  status,
  onDisconnect,
  onReconnect,
}: TerminalToolbarProps) {
  const statusColors: Record<TerminalConnectionStatus, string> = {
    disconnected: "bg-gray-400",
    connecting: "bg-yellow-500",
    connected: "bg-green-500",
    error: "bg-red-500",
  };

  const statusLabels: Record<TerminalConnectionStatus, string> = {
    disconnected: "未连接",
    connecting: "连接中...",
    connected: "已连接",
    error: "连接错误",
  };

  return (
    <div className="flex items-center gap-4 border-b border-white/10 bg-black px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400">当前主机</span>
      </div>

      <div className="flex items-center gap-2">
        {status === "connected" ? (
          <button
            onClick={onDisconnect}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            断开
          </button>
        ) : (
          <button
            onClick={onReconnect}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            {status === "error" ? "重连" : "连接"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
        <span className="text-xs font-medium text-gray-400">
          {statusLabels[status]}
        </span>
      </div>
    </div>
  );
}