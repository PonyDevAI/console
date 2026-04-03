import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import type { TerminalClientMessage, TerminalServerMessage } from "../../types";
import { getTerminalWebSocketUrl } from "../../api";

type TerminalViewProps = {
  sessionId: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  onStatusChange: (status: "disconnected" | "connecting" | "connected" | "error") => void;
  onError: (message: string) => void;
  onSessionClosed?: () => void;
};

export default function TerminalView({
  sessionId,
  status,
  onStatusChange,
  onError,
  onSessionClosed,
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const hadErrorRef = useRef(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: "#000000",
        foreground: "#eee",
      },
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);

    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN && terminal.cols && terminal.rows) {
            const resizeMsg: TerminalClientMessage = {
              type: "resize",
              cols: terminal.cols,
              rows: terminal.rows,
            };
            ws.send(JSON.stringify(resizeMsg));
          }
        } catch (e) {
          // fit 失败静默忽略（terminal 可能已 dispose）
        }
      });
    });

    if (terminalRef.current) {
      observer.observe(terminalRef.current);
    }

    return () => {
      observer.disconnect();
      try {
        terminal.dispose();
      } catch (e) {
        console.warn("Terminal dispose failed:", e);
      }
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    hadErrorRef.current = false;
    const wsUrl = getTerminalWebSocketUrl(sessionId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear();
      terminalInstanceRef.current.write("[Connecting...]\r\n");
    }

    ws.onopen = () => {
      onStatusChange("connected");
      const terminal = terminalInstanceRef.current;
      if (terminal && terminal.cols && terminal.rows) {
        const resizeMsg: TerminalClientMessage = {
          type: "resize",
          cols: terminal.cols,
          rows: terminal.rows,
        };
        ws.send(JSON.stringify(resizeMsg));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: TerminalServerMessage = JSON.parse(event.data);
        switch (msg.type) {
          case "output":
            terminalInstanceRef.current?.write(msg.data);
            break;
          case "exit":
            terminalInstanceRef.current?.write(`\r\n[进程退出，代码: ${msg.code}]\r\n`);
            onStatusChange("disconnected");
            onSessionClosed?.();
            break;
          case "error":
            hadErrorRef.current = true;
            onError(msg.message);
            terminalInstanceRef.current?.write(`\r\n[错误: ${msg.message}]\r\n`);
            onStatusChange("error");
            break;
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onerror = () => {
      hadErrorRef.current = true;
      onError("WebSocket 连接错误");
      onStatusChange("error");
      onSessionClosed?.();
    };

    ws.onclose = () => {
      if (!hadErrorRef.current) {
        onStatusChange("disconnected");
        onSessionClosed?.();
      }
    };

    let dataDisposable: { dispose: () => void } | undefined;
    if (terminalInstanceRef.current) {
      dataDisposable = terminalInstanceRef.current.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputMsg: TerminalClientMessage = { type: "input", data };
          ws.send(JSON.stringify(inputMsg));
        }
      });
    }

    return () => {
      dataDisposable?.dispose();
      if (ws.readyState === WebSocket.OPEN) {
        const closeMsg: TerminalClientMessage = { type: "close" };
        ws.send(JSON.stringify(closeMsg));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, onStatusChange, onError, onSessionClosed]);

  return (
    <div className="flex h-full flex-1 flex-col min-h-0">
      <div ref={terminalRef} className="h-full w-full min-h-0" />
    </div>
  );
}