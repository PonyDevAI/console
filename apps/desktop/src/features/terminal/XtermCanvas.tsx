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
  active?: boolean;
  onExit?: () => void;
  onError?: (message: string) => void;
};

export function XtermCanvas({
  sessionId,
  className,
  active = true,
  onExit,
  onError,
}: XtermCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const onExitRef = useRef(onExit);
  const onErrorRef = useRef(onError);
  const attachStartedRef = useRef(false);
  const decoderRef = useRef(new TextDecoder("utf-8"));
  const [attached, setAttached] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  useEffect(() => {
    onExitRef.current = onExit;
    onErrorRef.current = onError;
  }, [onExit, onError]);

  const applyTerminalTheme = useCallback(() => {
    if (!terminalRef.current) return;

    const styles = getComputedStyle(document.documentElement);
    terminalRef.current.options.theme = {
      background: styles.getPropertyValue("--terminal-bg").trim() || "#0c1118",
      foreground: styles.getPropertyValue("--terminal-text").trim() || "#e5edf6",
      cursor: styles.getPropertyValue("--terminal-text").trim() || "#e5edf6",
      selectionBackground:
        styles.getPropertyValue("--terminal-selection").trim() || "rgba(148, 163, 184, 0.28)",
    };
    terminalRef.current.refresh(0, terminalRef.current.rows - 1);
  }, []);

  const cleanup = useCallback(() => {
    // Unlisten all events
    for (const unlisten of unlistenRefs.current) {
      unlisten();
    }
    unlistenRefs.current = [];

    // Detach from Tauri backend
    invoke("detach_terminal_session", { sessionId }).catch(() => {});
  }, [sessionId]);

  const fitAndSync = useCallback(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;

    try {
      fitAddonRef.current.fit();
      const cols = terminalRef.current.cols;
      const rows = terminalRef.current.rows;
      if (cols > 0 && rows > 0) {
        invoke("resize_terminal_session", {
          sessionId,
          cols,
          rows,
        }).catch(() => {});
      }
    } catch {
      // Terminal may still be hidden or not fully laid out.
    }
  }, [sessionId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
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
        applyTerminalTheme();
        fitAddon.fit();
      } catch {
        // Container may not be visible yet
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAndSync();
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
  }, [sessionId, cleanup, applyTerminalTheme, fitAndSync]);

  useEffect(() => {
    applyTerminalTheme();

    const observer = new MutationObserver(() => {
      applyTerminalTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme-mode"],
    });

    return () => {
      observer.disconnect();
    };
  }, [applyTerminalTheme]);

  useEffect(() => {
    if (!active) return;

    requestAnimationFrame(() => {
      fitAndSync();
    });
  }, [active, fitAndSync]);

  // Attach to the session
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;
    if (attachStartedRef.current) return;
    attachStartedRef.current = true;

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
        const msg =
          typeof e === "string"
            ? e
            : e instanceof Error
              ? e.message
              : "Failed to attach to session";
        setAttachError(msg);
        onErrorRef.current?.(msg);
      }
    };

    doAttach();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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
              const binary = atob(payload.data);
              const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
              const decoded = decoderRef.current.decode(bytes, { stream: true });
              if (decoded) {
                terminalRef.current.write(decoded);
              }
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
          onExitRef.current?.();
        }
      );
      unlistenRefs.current.push(exitUnlisten);

      const errorUnlisten = await listen(
        `terminal-error-${sessionId}`,
        (event: any) => {
          const payload = event.payload as { message: string };
          setAttachError(payload?.message ?? "Unknown error");
          onErrorRef.current?.(payload?.message ?? "Unknown error");
        }
      );
      unlistenRefs.current.push(errorUnlisten);
    };

    setupListeners();
  }, [attached, sessionId]);

  return (
    <div
      className={cn("relative flex h-full flex-col overflow-hidden bg-[var(--terminal-bg)]", className)}
    >
      {attachError && (
        <div className="absolute inset-x-0 top-0 z-10 rounded-b-[var(--radius-md)] border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-1.5 text-[11px] text-[var(--danger)]">
          {attachError}
        </div>
      )}
      <div className="flex-1 p-2">
        <div ref={containerRef} className="h-full overflow-hidden bg-[var(--terminal-bg)]" />
      </div>
    </div>
  );
}
