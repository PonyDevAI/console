import { Mic, Send, Plus, ChevronDown, Globe, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
};

export function Composer({ value, onChange, onSubmit, disabled }: ComposerProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  const hasValue = value.trim().length > 0;

  return (
    <div className="shrink-0 px-5 pb-5">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow",
          isFocused ? "border-gray-300 shadow-md" : "border-gray-200"
        )}
      >
        <div className="px-4 pt-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="向 Console 提问：检测已安装工具、切换模型、同步 MCP、安装技能，或规划一次升级。"
            rows={1}
            className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-gray-900 placeholder-gray-400 outline-none"
            style={{ minHeight: "24px", maxHeight: "200px" }}
          />
        </div>

        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="添加附件"
            >
              <Plus className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
              title="模型选择"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>默认</span>
              <ChevronDown className="h-3 w-3 text-gray-400" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
              title="语言选择"
            >
              <Globe className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>中文</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="语音输入"
            >
              <Mic className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!hasValue || disabled}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                hasValue && !disabled
                  ? "bg-gray-900 text-white hover:bg-black"
                  : "bg-gray-200 text-gray-400"
              )}
              title="发送"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
