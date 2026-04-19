import { useCallback, useEffect, useState } from "react";
import {
  getEmployees,
  createEmployee,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  getPersonaFiles,
  updatePersonaFiles,
  dispatchEmployee,
  getDispatchHistory,
  testEmployee,
} from "../api";
import type { Employee, PersonaFiles, DispatchRequest, DispatchResponse, DispatchHistory, CreateEmployeeRequest, UpdateEmployeeRequest } from "../types";

export default function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setError(null);
    try {
      const data = await getEmployees();
      setEmployees(data.employees ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载员工列表失败");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchEmployees()
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载员工列表失败");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [fetchEmployees]);

  const create = useCallback(async (data: CreateEmployeeRequest) => {
    setError(null);
    try {
      await createEmployee(data);
      await fetchEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建员工失败");
    }
  }, [fetchEmployees]);

  const update = useCallback(async (id: string, data: UpdateEmployeeRequest) => {
    setError(null);
    try {
      await updateEmployee(id, data);
      await fetchEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "更新员工失败");
    }
  }, [fetchEmployees]);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteEmployee(id);
      await fetchEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除员工失败");
    }
  }, [fetchEmployees]);

  const getPersonaFilesForEmployee = useCallback(async (id: string) => {
    setError(null);
    try {
      return await getPersonaFiles(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取 Persona 文件失败");
      return { identity: "", soul: "", skills: "", rules: "" } as PersonaFiles;
    }
  }, []);

  const updatePersonaFilesForEmployee = useCallback(async (id: string, data: PersonaFiles) => {
    setError(null);
    try {
      await updatePersonaFiles(id, data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "更新 Persona 文件失败");
    }
  }, []);

  const dispatch = useCallback(async (id: string, data: DispatchRequest) => {
    setError(null);
    try {
      return await dispatchEmployee(id, data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "派发任务失败");
      return { task_id: "" } as DispatchResponse;
    }
  }, []);

  const getHistory = useCallback(async (id: string) => {
    setError(null);
    try {
      return await getDispatchHistory(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取历史记录失败");
      return { records: [] } as DispatchHistory;
    }
  }, []);

  const test = useCallback(async (id: string) => {
    setError(null);
    try {
      return await testEmployee(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "测试员工失败");
      return { ok: false, error: err instanceof Error ? err.message : "测试员工失败" };
    }
  }, []);

  return {
    employees,
    loading,
    error,
    fetchEmployees,
    create,
    update,
    remove,
    getPersonaFiles: getPersonaFilesForEmployee,
    updatePersonaFiles: updatePersonaFilesForEmployee,
    dispatch,
    getHistory,
    test,
  };
}
