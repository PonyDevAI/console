import { useCallback, useEffect, useState } from "react";
import {
  getAgentSources,
  scanAgentSources,
  checkAgentSourceUpdates,
  installAgentSource,
  upgradeAgentSource,
  uninstallAgentSource,
  testAgentSource,
  getAgentSourceModels,
  setAgentSourceDefaultModel,
  createAgentSource,
  updateAgentSource,
  deleteAgentSource,
  type AgentSourceTestResult,
} from "../api";
import type { AgentSource } from "../types";

export default function useAgentSources() {
  const [sources, setSources] = useState<AgentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getAgentSources()
      .then((sourcesData) => {
        if (!mounted) return;
        setSources(sourcesData.sources ?? []);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载 Agent Sources 失败");
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
      const data = await scanAgentSources();
      setSources(data.sources ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "扫描 Agent Sources 失败");
    } finally {
      setScanning(false);
    }
  }, []);

  const checkUpdates = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const data = await checkAgentSourceUpdates();
      setSources(data.sources ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "检查更新失败");
    } finally {
      setScanning(false);
    }
  }, []);

  const install = useCallback(async (id: string) => {
    setError(null);
    try {
      await installAgentSource(id);
      await scan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "安装失败");
    }
  }, [scan]);

  const upgrade = useCallback(async (id: string) => {
    setError(null);
    try {
      await upgradeAgentSource(id);
      await scan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "升级失败");
    }
  }, [scan]);

  const uninstall = useCallback(async (id: string) => {
    setError(null);
    try {
      await uninstallAgentSource(id);
      await scan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "卸载失败");
    }
  }, [scan]);

  const test = useCallback(async (id: string): Promise<AgentSourceTestResult> => {
    setError(null);
    try {
      const result = await testAgentSource(id);
      if ('ok' in result && result.ok && result.type === 'remote_openclaw_ws') {
        return result;
      }
      if ('healthy' in result) {
        return result;
      }
      return { source_id: id, healthy: false };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "测试失败");
      return { source_id: id, healthy: false };
    }
  }, []);

  const getModels = useCallback(async (id: string) => {
    setError(null);
    try {
      return await getAgentSourceModels(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取模型信息失败");
      return { source_id: id, current_model: null, default_model: null, supported_models: [] };
    }
  }, []);

  const setDefaultModel = useCallback(async (id: string, model: string) => {
    setError(null);
    try {
      await setAgentSourceDefaultModel(id, model);
      await scan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "设置默认模型失败");
    }
  }, [scan]);

  const createSource = useCallback(async (data: {
    name: string;
    display_name: string;
    source_type: string;
    endpoint?: string;
    api_key?: string;
    origin?: string;
  }) => {
    setError(null);
    try {
      await createAgentSource(data);
      await scan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建 Source 失败");
      throw err;
    }
  }, [scan]);

  const updateSource = useCallback(async (id: string, data: {
    display_name?: string;
    endpoint?: string;
    api_key?: string;
    origin?: string;
  }) => {
    setError(null);
    try {
      await updateAgentSource(id, data);
      await scan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "更新 Source 失败");
      throw err;
    }
  }, [scan]);

  const deleteSource = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteAgentSource(id);
      await scan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除 Source 失败");
      throw err;
    }
  }, [scan]);

  const pingRemote = useCallback(async (id: string) => {
    setError(null);
    try {
      const result = await testAgentSource(id);
      await scan();
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "测试 Source 失败");
      return { source_id: id, healthy: false };
    }
  }, [scan]);

  const pingAllRemote = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const data = await scanAgentSources();
      setSources(data.sources ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "刷新所有 Source 失败");
    } finally {
      setScanning(false);
    }
  }, [scan]);

  const getLatestVersion = useCallback(async (): Promise<string | null> => {
    setError(null);
    try {
      return null;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取最新版本失败");
      return null;
    }
  }, []);

  return {
    sources,
    loading,
    scanning,
    error,
    scan,
    checkUpdates,
    install,
    upgrade,
    uninstall,
    test,
    getModels,
    setDefaultModel,
    createSource,
    updateSource,
    deleteSource,
    pingRemote,
    pingAllRemote,
    getLatestVersion,
  };
}
