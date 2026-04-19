import { ThreadMessage } from "../../types";

interface ThreadMessageListProps {
  messages: ThreadMessage[];
  isLoading?: boolean;
}

function getMessageStatusDisplay(message: ThreadMessage) {
  if (!message.status) return null;
  
  if (message.status === "running") {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
        <span>生成中...</span>
      </div>
    );
  }
  
  if (message.status === "done") {
    return (
      <div className="text-xs text-green-600 mt-1">
        已完成
      </div>
    );
  }
  
  if (message.status === "cancelled") {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
        <span>已取消</span>
      </div>
    );
  }
  
  if (message.status.startsWith("error:")) {
    const error = message.status.replace("error: ", "");
    return (
      <div className="text-xs text-red-600 mt-1">
        错误：{error}
      </div>
    );
  }
  
  return null;
}

export function ThreadMessageList({ messages, isLoading }: ThreadMessageListProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Start a conversation</p>
          <p className="text-xs text-gray-400 mt-1">Your messages will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-900"
              } ${message.status === "cancelled" ? "opacity-60" : ""} ${message.status?.startsWith("error:") ? "border border-red-200 bg-red-50" : ""}`}
            >
              <div className="text-[13px] whitespace-pre-wrap">{message.content}</div>
              {message.role === "assistant" && getMessageStatusDisplay(message)}
              <div
                className={`text-[10px] mt-1 ${
                  message.role === "user" ? "text-blue-100" : "text-gray-400"
                }`}
              >
                {new Date(message.created_at).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && messages.filter(m => m.status === "running").length === 0 && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
