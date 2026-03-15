import { useCallback, useEffect, useState } from "react";
import { getCliTools, scanCliTools } from "../api";
import type { CliTool } from "../types";

export default function useCliTools() {
  const [tools, setTools] = useState<CliTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getCliTools()
      .then((data) => {
        if (!mounted) return;
        setTools(data.tools ?? []);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载 CLI 工具失败");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const data = await scanCliTools();
      setTools(data.tools ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "扫描 CLI 工具失败");
    } finally {
      setScanning(false);
    }
  }, []);

  return { tools, loading, scanning, error, scan };
}
