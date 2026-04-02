import { MessageSquare } from "lucide-react";

interface ThreadHeaderProps {
  title: string;
  onTitleChange?: (title: string) => void;
}

export function ThreadHeader({ title, onTitleChange }: ThreadHeaderProps) {
  const handleTitleDoubleClick = () => {
    if (onTitleChange) {
      const newTitle = prompt("Enter thread title:", title);
      if (newTitle && newTitle.trim()) {
        onTitleChange(newTitle.trim());
      }
    }
  };

  return (
    <div className="shrink-0 border-b border-gray-100 px-5 py-3 bg-white">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
          <MessageSquare className="h-4 w-4 text-gray-600" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <h1 
            className="text-[15px] font-medium text-gray-900 cursor-pointer hover:text-gray-700"
            onDoubleClick={handleTitleDoubleClick}
            title="Double-click to edit title"
          >
            {title || "New Thread"}
          </h1>
        </div>
      </div>
    </div>
  );
}
