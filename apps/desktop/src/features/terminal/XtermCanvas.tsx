import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";

import "xterm/css/xterm.css";

type XtermCanvasProps = {
  sessionId: string;
  className?: string;
  onExit?: () => void;
  onError?: (message: string) => void;
};

export function XtermCanvas({ sessionId, className, onExit, onError }: XtermCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const [attached, setAttached] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    // Unlisten all events
    for (const unlisten of unlistenRefs.current) {
      unlisten();
    }
    unlistenRefs.current = [];

    // Detach from Tauri backend
    invoke("detach_terminal_session", { sessionId }).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace',
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit after a brief delay to ensure container is sized
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // Container may not be visible yet
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        const dims = fitAddon.proposeDimensions();
        if (dims && dims.cols && dims.rows) {
          invoke("resize_terminal_session", {
            sessionId,
            cols: dims.cols,
            rows: dims.rows,
          }).catch(() => {});
        }
      } catch {
        // Fit may fail if terminal is not visible
      }
    });
    if (containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    // Handle user input
    term.onData((data) => {
      invoke("send_terminal_input", { sessionId, data }).catch(() => {});
    });

    return () => {
      resizeObserver.disconnect();
      cleanup();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, cleanup]);

  // Attach to the session
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;

    let cancelled = false;

    const doAttach = async () => {
      const dims = fitAddonRef.current!.proposeDimensions();
      const cols = dims?.cols ?? 80;
      const rows = dims?.rows ?? 24;

      try {
        await invoke("attach_terminal_session", {
          sessionId,
          cols,
          rows,
        });

        if (cancelled) return;
        setAttached(true);
        setAttachError(null);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to attach to session";
        setAttachError(msg);
        onError?.(msg);
      }
    };

    doAttach();

    return () => {
      cancelled = true;
    };
  }, [sessionId, onError]);

  // Listen for output events
  useEffect(() => {
    if (!attached || !terminalRef.current) return;

    const setupListeners = async () => {
      const outputUnlisten = await listen(
        `terminal-output-${sessionId}`,
        (event: any) => {
          const payload = event.payload as { data: string };
          if (payload?.data && terminalRef.current) {
            try {
              const decoded = atob(payload.data);
              terminalRef.current.write(decoded);
            } catch {
              // Ignore decode errors
            }
          }
        }
      );
      unlistenRefs.current.push(outputUnlisten);

      const exitUnlisten = await listen(
        `terminal-exit-${sessionId}`,
        () => {
          setAttached(false);
          onExit?.();
        }
      );
      unlistenRefs.current.push(exitUnlisten);

      const errorUnlisten = await listen(
        `terminal-error-${sessionId}`,
        (event: any) => {
          const payload = event.payload as { message: string };
          setAttachError(payload?.message ?? "Unknown error");
          onError?.(payload?.message ?? "Unknown error");
        }
      );
      unlistenRefs.current.push(errorUnlisten);
    };

    setupListeners();
  }, [attached, sessionId, onExit, onError]);

  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      {attachError && (
        <div className="absolute inset-x-0 top-0 z-10 rounded-b-[var(--radius-md)] border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-1.5 text-[11px] text-[var(--danger)]">
          {attachError}
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
