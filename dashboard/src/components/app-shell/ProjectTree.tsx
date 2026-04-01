export type Project = {
  id: string;
  name: string;
  expanded?: boolean;
  threads?: Thread[];
};

export type Thread = {
  id: string;
  name: string;
  updatedAt?: string;
};

export const defaultProjects: Project[] = [
  {
    id: "console",
    name: "console",
    expanded: true,
    threads: [
      { id: "overview", name: "概览", updatedAt: new Date().toISOString() },
      { id: "thread-12", name: "新线程 #12", updatedAt: new Date().toISOString() },
      { id: "sync-mcp", name: "同步 MCP 到 Codex", updatedAt: new Date().toISOString() },
    ],
  },
  {
    id: "cloud-router",
    name: "cloud-router",
    expanded: false,
    threads: [],
  },
];
