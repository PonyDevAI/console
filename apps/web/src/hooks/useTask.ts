import { useEffect, useRef, useState, useCallback } from 'react';
import type { Task } from '../types';

export function useTaskStream() {
  const [tasks, setTasks] = useState<Map<string, Task>>(new Map());
  const esRef = useRef<EventSource | null>(null);

  // Load existing tasks on mount (survives page refresh)
  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: { tasks: Task[] }) => {
        setTasks(prev => {
          const next = new Map(prev);
          for (const task of data.tasks) {
            next.set(task.id, task);
          }
          return next;
        });
      })
      .catch(() => {});
  }, []);

  // SSE for incremental updates
  useEffect(() => {
    const es = new EventSource('/api/tasks/stream');
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const task: Task = JSON.parse(e.data);
        setTasks(prev => {
          const next = new Map(prev);
          next.set(task.id, task);
          return next;
        });
      } catch {}
    };

    es.onerror = () => {
      // 自动重连由 EventSource 处理
    };

    return () => es.close();
  }, []);

  const getTaskForTarget = useCallback((target: string) => {
    for (const task of tasks.values()) {
      if (task.target === target && (task.status === 'pending' || task.status === 'running')) {
        return task;
      }
    }
    return null;
  }, [tasks]);

  return { tasks, getTaskForTarget };
}
