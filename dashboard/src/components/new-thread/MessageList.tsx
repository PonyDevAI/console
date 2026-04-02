import { cn } from "../../lib/utils";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type MessageListProps = {
  messages: Message[];
  className?: string;
};

export function MessageList({ messages, className }: MessageListProps) {
  return (
    <div className={cn("flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-4", className)}>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
          isUser
            ? "bg-gray-900 text-white"
            : "bg-gray-100 text-gray-900"
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div
          className={cn(
            "mt-1.5 text-[11px]",
            isUser ? "text-gray-400" : "text-gray-500"
          )}
        >
          {message.timestamp}
        </div>
      </div>
    </div>
  );
}
