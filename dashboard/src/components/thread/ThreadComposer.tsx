import { useState, useRef, useEffect } from "react";
import { Paperclip, Mic, Send, Square, Settings, GitBranch, Folder, Lock } from "lucide-react";
import { ThreadRuntimeConfig, RuntimeOption } from "../../types";

interface ThreadComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  disabled?: boolean;
  isRunning?: boolean;
  runtimeConfig: ThreadRuntimeConfig;
  onWorkspaceChange?: (path: string) => void;
  onRuntimeChange?: (config: Partial<ThreadRuntimeConfig>) => void;
  availableRuntimes?: RuntimeOption[];
}

const RUNTIME_PROFILES: RuntimeOption[] = [
  {
    id: "codex-gpt54",
    label: "Codex · GPT-5.4",
    adapter: "codex",
    model: "gpt-5.4",
  },
  {
    id: "claude-sonnet46",
    label: "Claude · Sonnet 4.6",
    adapter: "claude",
    model: "sonnet-4.6",
  },
];

const REASONING_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

const PERMISSION_MODES = [
  { value: "default", label: "Default" },
  { value: "read_only", label: "Read Only" },
  { value: "workspace_write", label: "Workspace Write" },
  { value: "full_access", label: "Full Access" },
] as const;

export function ThreadComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled = false,
  isRunning = false,
  runtimeConfig,
  onWorkspaceChange,
  onRuntimeChange,
  availableRuntimes = RUNTIME_PROFILES,
}: ThreadComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit();
      }
    }
  };

  const handleSubmit = () => {
    if (!disabled && value.trim()) {
      onSubmit();
    }
  };

  const handleWorkspaceClick = () => {
    const path = prompt("Enter workspace path:", runtimeConfig.workspacePath);
    if (path && onWorkspaceChange) {
      onWorkspaceChange(path);
    }
  };

  return (
    <div className="shrink-0 border-t border-gray-100 bg-white">
      {/* Input area */}
      <div className="px-5 py-4">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-500"
                title="Add attachment"
              >
                <Paperclip className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={`${runtimeConfig.adapter}:${runtimeConfig.model}`}
                onChange={(e) => {
                  const [adapter, model] = e.target.value.split(":");
                  onRuntimeChange?.({ adapter: adapter as any, model });
                }}
                className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableRuntimes.map((rt) => (
                  <option key={rt.id} value={`${rt.adapter}:${rt.model}`}>
                    {rt.label}
                  </option>
                ))}
              </select>
              <select
                value={runtimeConfig.reasoningEffort}
                onChange={(e) => {
                  onRuntimeChange?.({ reasoningEffort: e.target.value as any });
                }}
                className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REASONING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400"
                title="Voice input (coming soon)"
                disabled
              >
                <Mic className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div className="px-3 py-2">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              disabled={disabled || isRunning}
              className="w-full resize-none bg-transparent text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none max-h-[200px]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-3 pb-3 pt-2 border-t border-gray-50">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg ${showSettings ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50 text-gray-500"}`}
              title="Runtime settings"
            >
              <Settings className="h-4 w-4" strokeWidth={1.8} />
            </button>
            {isRunning ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <Square className="h-3.5 w-3.5" strokeWidth={1.8} />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={disabled || !value.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-5 pb-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
                  Permission Mode
                </label>
                <select
                  value={runtimeConfig.permissionMode}
                  onChange={(e) => {
                    onRuntimeChange?.({ permissionMode: e.target.value as any });
                  }}
                  className="w-full h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PERMISSION_MODES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context bar */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleWorkspaceClick}
              className="flex items-center gap-1.5 hover:text-gray-600 transition-colors"
              title="Click to change workspace"
            >
              <Folder className="h-3 w-3" strokeWidth={1.8} />
              <span>{runtimeConfig.workspacePath.split("/").pop() || "Select workspace"}</span>
            </button>
            <div className="flex items-center gap-1.5">
              <Lock className="h-3 w-3" strokeWidth={1.8} />
              <span>{PERMISSION_MODES.find((m) => m.value === runtimeConfig.permissionMode)?.label || "Default"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {runtimeConfig.gitBranch && (
              <div className="flex items-center gap-1.5" title="Git branch">
                <GitBranch className="h-3 w-3" strokeWidth={1.8} />
                <span className="font-mono">{runtimeConfig.gitBranch}</span>
              </div>
            )}
            {isRunning && (
              <div className="flex items-center gap-1.5 text-blue-500">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>Running</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
