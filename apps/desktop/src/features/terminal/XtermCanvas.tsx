import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";

import "@xterm/xterm/css/xterm.css";

type XtermCanvasProps = {
  sessionId: string;
  className?: string;
  active?: boolean;
  onExit?: () => void;
  onError?: (message: string) => void;
  onPerfUpdate?: (stats: XtermPerfStats) => void;
};

export type XtermPerfStats = {
  renderer: "canvas" | "webgl";
  attached: boolean;
  queueChars: number;
  queuedChunks: number;
  writeInFlight: boolean;
  cols: number;
  rows: number;
  attachDurationMs: number | null;
};

export function XtermCanvas({
  sessionId,
  className,
  active = true,
  onExit,
  onError,
  onPerfUpdate,
}: XtermCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const onExitRef = useRef(onExit);
  const onErrorRef = useRef(onError);
  const onPerfUpdateRef = useRef(onPerfUpdate);
  const attachStartedRef = useRef(false);
  const decoderRef = useRef(new TextDecoder("utf-8"));
  const fitFrameRef = useRef<number | null>(null);
  const outputFlushFrameRef = useRef<number | null>(null);
  const outputFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outputQueueRef = useRef<string[]>([]);
  const outputQueueCharsRef = useRef(0);
  const writeInFlightRef = useRef(false);
  const lastSentSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const activeRef = useRef(active);
  const rendererModeRef = useRef<"canvas" | "webgl">("canvas");
  const attachStartRef = useRef<number | null>(null);
  const attachDurationRef = useRef<number | null>(null);
  const attachedRef = useRef(false);
  const disposedRef = useRef(false);
  const [attached, setAttached] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const MAX_OUTPUT_BATCH_CHARS = 32 * 1024;
  const MAX_OUTPUT_LATENCY_MS = 12;

  useEffect(() => {
    onExitRef.current = onExit;
    onErrorRef.current = onError;
    onPerfUpdateRef.current = onPerfUpdate;
  }, [onExit, onError, onPerfUpdate]);

  const emitPerfUpdate = useCallback(
    (rendererOverride?: "canvas" | "webgl") => {
      if (!onPerfUpdateRef.current || !terminalRef.current) return;
      onPerfUpdateRef.current({
        renderer: rendererOverride ?? rendererModeRef.current,
        attached: attachedRef.current,
        queueChars: outputQueueCharsRef.current,
        queuedChunks: outputQueueRef.current.length,
        writeInFlight: writeInFlightRef.current,
        cols: terminalRef.current.cols,
        rows: terminalRef.current.rows,
        attachDurationMs: attachDurationRef.current,
      });
    },
    []
  );

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    attachedRef.current = attached;
  }, [attached]);

  const applyTerminalTheme = useCallback(() => {
    if (!terminalRef.current || disposedRef.current) return;

    const styles = getComputedStyle(document.documentElement);
    try {
      terminalRef.current.options.theme = {
        background: styles.getPropertyValue("--terminal-bg").trim() || "#0c1118",
        foreground: styles.getPropertyValue("--terminal-text").trim() || "#e5edf6",
        cursor: styles.getPropertyValue("--terminal-text").trim() || "#e5edf6",
        selectionBackground:
          styles.getPropertyValue("--terminal-selection").trim() || "rgba(148, 163, 184, 0.28)",
      };
      terminalRef.current.refresh(0, terminalRef.current.rows - 1);
    } catch {
      // Ignore theme updates after disposal races.
    }
  }, []);

  const cleanup = useCallback(() => {
    if (fitFrameRef.current !== null) {
      cancelAnimationFrame(fitFrameRef.current);
      fitFrameRef.current = null;
    }
    if (outputFlushFrameRef.current !== null) {
      cancelAnimationFrame(outputFlushFrameRef.current);
      outputFlushFrameRef.current = null;
    }
    if (outputFlushTimeoutRef.current !== null) {
      clearTimeout(outputFlushTimeoutRef.current);
      outputFlushTimeoutRef.current = null;
    }

    const remaining = decoderRef.current.decode();
    if (remaining && terminalRef.current) {
      terminalRef.current.write(remaining);
    }
    outputQueueRef.current = [];
    outputQueueCharsRef.current = 0;
    writeInFlightRef.current = false;
    lastSentSizeRef.current = null;
    rendererModeRef.current = "canvas";
    disposedRef.current = true;
    attachStartedRef.current = false;
    setAttached(false);
    onPerfUpdateRef.current?.({
      renderer: "canvas",
      attached: false,
      queueChars: 0,
      queuedChunks: 0,
      writeInFlight: false,
      cols: 0,
      rows: 0,
      attachDurationMs: null,
    });

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
      const lastSentSize = lastSentSizeRef.current;
      if (
        cols > 0 &&
        rows > 0 &&
        (!lastSentSize || lastSentSize.cols !== cols || lastSentSize.rows !== rows)
      ) {
        lastSentSizeRef.current = { cols, rows };
        invoke("resize_terminal_session", {
          sessionId,
          cols,
          rows,
        }).catch(() => {});
      }
      emitPerfUpdate();
    } catch {
      // Terminal may still be hidden or not fully laid out.
    }
  }, [sessionId, emitPerfUpdate]);

  const scheduleFitAndSync = useCallback(() => {
    if (!activeRef.current) return;
    if (fitFrameRef.current !== null) return;
    fitFrameRef.current = requestAnimationFrame(() => {
      fitFrameRef.current = null;
      fitAndSync();
    });
  }, [fitAndSync]);

  const flushOutputQueue = useCallback(() => {
    if (outputFlushFrameRef.current !== null) {
      cancelAnimationFrame(outputFlushFrameRef.current);
      outputFlushFrameRef.current = null;
    }
    if (outputFlushTimeoutRef.current !== null) {
      clearTimeout(outputFlushTimeoutRef.current);
      outputFlushTimeoutRef.current = null;
    }
    if (!terminalRef.current || outputQueueRef.current.length === 0 || writeInFlightRef.current) {
      return;
    }

    let batchChars = 0;
    const batchParts: string[] = [];
    while (outputQueueRef.current.length > 0 && batchChars < MAX_OUTPUT_BATCH_CHARS) {
      const chunk = outputQueueRef.current[0];
      outputQueueRef.current.shift();
      outputQueueCharsRef.current -= chunk.length;
      batchParts.push(chunk);
      batchChars += chunk.length;
    }

    if (batchParts.length === 0) return;

    writeInFlightRef.current = true;
    emitPerfUpdate();
    terminalRef.current.write(batchParts.join(""), () => {
      writeInFlightRef.current = false;
      emitPerfUpdate();
      if (outputQueueRef.current.length > 0) {
        if (outputQueueCharsRef.current >= MAX_OUTPUT_BATCH_CHARS) {
          flushOutputQueue();
          return;
        }
        scheduleOutputFlush();
      }
    });
  }, []);

  const scheduleOutputFlush = useCallback(() => {
    if (writeInFlightRef.current) return;

    if (outputQueueCharsRef.current >= MAX_OUTPUT_BATCH_CHARS) {
      flushOutputQueue();
      return;
    }

    if (outputFlushFrameRef.current === null) {
      outputFlushFrameRef.current = requestAnimationFrame(() => {
        flushOutputQueue();
      });
    }

    if (outputFlushTimeoutRef.current === null) {
      outputFlushTimeoutRef.current = setTimeout(() => {
        flushOutputQueue();
      }, MAX_OUTPUT_LATENCY_MS);
    }
  }, [flushOutputQueue]);

  useEffect(() => {
    if (!containerRef.current) return;
    disposedRef.current = false;
    let cancelled = false;
    let initialFitFrame: number | null = null;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace',
      allowProposedApi: true,
      scrollback: 5000,
      allowTransparency: false,
      minimumContrastRatio: 1,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit after a brief delay to ensure container is sized
    rendererModeRef.current = "canvas";
    emitPerfUpdate("canvas");

    initialFitFrame = requestAnimationFrame(() => {
      if (cancelled || disposedRef.current || terminalRef.current !== term) return;
      try {
        applyTerminalTheme();
        fitAddon.fit();
        scheduleFitAndSync();
      } catch {
        // Container may not be visible yet
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      scheduleFitAndSync();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Handle user input
    term.onData((data) => {
      invoke("send_terminal_input", { sessionId, data }).catch(() => {});
    });

    return () => {
      cancelled = true;
      if (initialFitFrame !== null) {
        cancelAnimationFrame(initialFitFrame);
      }
      resizeObserver.disconnect();
      cleanup();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, cleanup, applyTerminalTheme, scheduleFitAndSync]);

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

    scheduleFitAndSync();
  }, [active, scheduleFitAndSync]);

  // Attach to the session
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current) return;
    if (attachStartedRef.current) return;
    attachStartedRef.current = true;

    let cancelled = false;

    const doAttach = async () => {
      attachStartRef.current = performance.now();
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
        lastSentSizeRef.current = { cols, rows };
        attachDurationRef.current =
          attachStartRef.current === null ? null : performance.now() - attachStartRef.current;
        setAttached(true);
        setAttachError(null);
        scheduleFitAndSync();
        emitPerfUpdate();
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
  }, [sessionId, scheduleFitAndSync, emitPerfUpdate]);

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
                outputQueueRef.current.push(decoded);
                outputQueueCharsRef.current += decoded.length;
                emitPerfUpdate();
                scheduleOutputFlush();
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
  }, [attached, sessionId, scheduleOutputFlush, emitPerfUpdate]);

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
