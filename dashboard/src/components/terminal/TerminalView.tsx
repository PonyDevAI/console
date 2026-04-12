import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import type { TerminalClientMessage, TerminalServerMessage, TerminalConnectionStatus } from "../../types";
import { getTerminalWebSocketUrl } from "../../api";

type TerminalViewProps = {
  sessionId: string | null;
  onStatusChange: (status: TerminalConnectionStatus) => void;
  onError: (message: string) => void;
  onSessionExit?: () => void;
};

export default function TerminalView({
  sessionId,
  onStatusChange,
  onError,
  onSessionExit,
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const hadErrorRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  const onSessionExitRef = useRef(onSessionExit);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onSessionExitRef.current = onSessionExit;
  }, [onSessionExit]);

  const fitTerminal = () => {
    const container = terminalRef.current;
    const terminal = terminalInstanceRef.current;
    const fitAddon = fitAddonRef.current;

    if (!container || !terminal || !fitAddon) return;
    if (container.clientWidth <= 0 || container.clientHeight <= 0) return;

    try {
      fitAddon.fit();
    } catch (e) {
      console.warn("Fit failed:", e);
    }
  };

  const decodeBase64 = (value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let mounted = true;

    const initTerminal = () => {
      if (!mounted || !container) return;
      
      if (container.clientWidth <= 0 || container.clientHeight <= 0) {
        requestAnimationFrame(initTerminal);
        return;
      }

      terminal = new Terminal({
        theme: { background: "#000000", foreground: "#eee" },
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        letterSpacing: 0,
        lineHeight: 1.2,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(container);

      if (!mounted) {
        terminal.dispose();
        return;
      }

      terminalInstanceRef.current = terminal;
      fitAddonRef.current = fitAddon;

      requestAnimationFrame(() => {
        if (mounted && fitAddon) {
          try {
            fitAddon.fit();
          } catch (e) {
            console.warn("Initial fit failed:", e);
          }
        }
      });
    };

    requestAnimationFrame(initTerminal);

    return () => {
      mounted = false;
      try {
        terminal?.dispose();
      } catch (e) {
        console.warn("Terminal dispose failed:", e);
      }
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    mountedRef.current = true;
    hadErrorRef.current = false;

    const existingWs = wsRef.current;
    const existingWsUrl = wsUrlRef.current;
    if (existingWs && existingWsUrl) {
      const expectedUrl = getTerminalWebSocketUrl(sessionId);
      if (existingWsUrl === expectedUrl && (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING)) {
        console.log("[TerminalView] Reusing existing WebSocket for session:", sessionId);
        return;
      }
      console.log("[TerminalView] Closing old WebSocket, switching to new session:", sessionId);
      if (existingWs.readyState === WebSocket.OPEN) {
        existingWs.close(1000, "Session switch");
      }
      wsRef.current = null;
      wsUrlRef.current = null;
    }

    let initialCols: number | undefined;
    let initialRows: number | undefined;
    fitTerminal();
    if (terminalInstanceRef.current) {
      initialCols = terminalInstanceRef.current.cols;
      initialRows = terminalInstanceRef.current.rows;
    }

    const wsUrl = getTerminalWebSocketUrl(sessionId, initialCols, initialRows);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    wsUrlRef.current = wsUrl;
    console.log("[TerminalView] Creating new WebSocket for session:", sessionId);

    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear();
    }

    ws.onopen = () => {
      console.log("[TerminalView] WebSocket opened for session:", sessionId);
      if (!mountedRef.current) return;
      onStatusChangeRef.current("connected");
      
      fitTerminal();
      if (terminalInstanceRef.current) {
        const { cols, rows } = terminalInstanceRef.current;
        const resizeMsg: TerminalClientMessage = { type: "resize", cols, rows };
        ws.send(JSON.stringify(resizeMsg));
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg: TerminalServerMessage = JSON.parse(event.data);
        switch (msg.type) {
          case "output":
            if (msg.encoding === "base64") {
              terminalInstanceRef.current?.write(decodeBase64(msg.data));
            } else {
              terminalInstanceRef.current?.write(msg.data);
            }
            break;
          case "exit":
            terminalInstanceRef.current?.write(`\r\n[Session exited]\r\n`);
            onStatusChangeRef.current("disconnected");
            onSessionExitRef.current?.();
            break;
          case "error":
            hadErrorRef.current = true;
            onErrorRef.current(msg.message);
            terminalInstanceRef.current?.write(`\r\n[Error: ${msg.message}]\r\n`);
            onStatusChangeRef.current("error");
            break;
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      hadErrorRef.current = true;
      console.error("[TerminalView] WebSocket error for session:", sessionId);
      onErrorRef.current("WebSocket connection error");
      onStatusChangeRef.current("error");
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      wsUrlRef.current = null;
      console.log("[TerminalView] WebSocket closed:", event.code, event.reason);
      if (!mountedRef.current) return;
      if (!hadErrorRef.current) {
        onStatusChangeRef.current("disconnected");
      }
    };

    let dataDisposable: { dispose: () => void } | undefined;
    const terminal = terminalInstanceRef.current;
    if (terminal) {
      dataDisposable = terminal.onData((data) => {
        console.log("[TerminalView] onData:", data.length, "bytes, ws.readyState:", ws.readyState, "mounted:", mountedRef.current);
        if (mountedRef.current && ws.readyState === WebSocket.OPEN) {
          const inputMsg: TerminalClientMessage = { type: "input", data };
          ws.send(JSON.stringify(inputMsg));
        }
      });
    }

    let resizeDisposable: { dispose: () => void } | undefined;
    if (terminal && fitAddonRef.current) {
      resizeDisposable = terminal.onResize(({ cols, rows }) => {
        if (mountedRef.current && ws.readyState === WebSocket.OPEN) {
          const resizeMsg: TerminalClientMessage = { type: "resize", cols, rows };
          ws.send(JSON.stringify(resizeMsg));
        }
      });
    }

    const handleContainerResize = () => {
      if (!mountedRef.current) return;
      fitTerminal();
    };

    const resizeObserver = new ResizeObserver(handleContainerResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      mountedRef.current = false;
      resizeObserver.disconnect();
      dataDisposable?.dispose();
      resizeDisposable?.dispose();
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Unmount");
      }
    };
  }, [sessionId]);

  return (
    <div className="h-full w-full min-h-0 p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}