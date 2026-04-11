import { useCallback, useEffect, useState } from "react";
import {
  getAgents,
  getAgent,
  getAgentsBySource,
  fetchRemoteAgentsForSource,
} from "../api";
import type { Agent } from "../types";

export default function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setError(null);
    try {
      const data = await getAgents();
      setAgents(data.agents ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载 Agents 失败");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    getAgents()
      .then((data) => {
        if (!mounted) return;
        setAgents(data.agents ?? []);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载 Agents 失败");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getAgentById = useCallback(async (id: string) => {
    setError(null);
    try {
      return await getAgent(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取 Agent 失败");
      return null;
    }
  }, []);

  const getAgentsForSource = useCallback(async (sourceId: string) => {
    setError(null);
    try {
      const data = await getAgentsBySource(sourceId);
      return data.agents ?? [];
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取 Source Agents 失败");
      return [];
    }
  }, []);

  const fetchRemoteAgents = useCallback(async (sourceId: string) => {
    setError(null);
    try {
      const data = await fetchRemoteAgentsForSource(sourceId);
      return data.agents ?? [];
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取远程 Agents 失败");
      return [];
    }
  }, []);

  const getLocalAgents = useCallback(() => {
    return agents.filter((a) => a.agent_type === "local_cli");
  }, [agents]);

  const getRemoteAgents = useCallback(() => {
    return agents.filter((a) => a.agent_type === "remote_agent");
  }, [agents]);

  return {
    agents,
    loading,
    error,
    fetchAgents,
    getAgentById,
    getAgentsForSource,
    fetchRemoteAgents,
    getLocalAgents,
    getRemoteAgents,
  };
}
