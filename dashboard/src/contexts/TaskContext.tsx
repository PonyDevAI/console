import React, { createContext, useContext } from "react";
import { useTaskStream } from "../hooks/useTask";
import type { Task } from "../types";

interface TaskContextValue {
  tasks: Map<string, Task>;
  getTaskForTarget: (target: string) => Task | null;
}

const TaskContext = createContext<TaskContextValue>({
  tasks: new Map(),
  getTaskForTarget: () => null,
});

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const value = useTaskStream();
  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  return useContext(TaskContext);
}
