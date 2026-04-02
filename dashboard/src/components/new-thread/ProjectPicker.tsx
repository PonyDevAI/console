import { useState } from "react";
import { ChevronDown, Search, Plus, Folder } from "lucide-react";
import { cn } from "../../lib/utils";
import { defaultProjects, type Project } from "../app-shell/ProjectTree";

type ProjectPickerProps = {
  selectedProject: Project | null;
  onSelect: (project: Project) => void;
  variant?: "inline" | "compact";
};

export function ProjectPicker({ selectedProject, onSelect, variant = "inline" }: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = defaultProjects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (variant === "compact") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          <span className="truncate max-w-[200px]">{selectedProject?.name || "选择项目"}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-gray-400 transition-transform",
              open && "rotate-180"
            )}
            strokeWidth={1.8}
          />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <ProjectDropdown
              filteredProjects={filteredProjects}
              selectedProject={selectedProject}
              onSelect={(project) => {
                onSelect(project);
                setOpen(false);
              }}
              onClose={() => setOpen(false)}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group inline-flex items-center gap-1.5 text-[28px] font-medium text-gray-900 transition-colors hover:text-gray-700"
      >
        <span className="tracking-tight">{selectedProject?.name || "选择项目"}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-gray-400 transition-transform group-hover:text-gray-500",
            open && "rotate-180"
          )}
          strokeWidth={1.8}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ProjectDropdown
            filteredProjects={filteredProjects}
            selectedProject={selectedProject}
            onSelect={(project) => {
              onSelect(project);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}

type ProjectDropdownProps = {
  filteredProjects: Project[];
  selectedProject: Project | null;
  onSelect: (project: Project) => void;
  onClose: () => void;
};

function ProjectDropdown({ filteredProjects, selectedProject, onSelect, onClose }: ProjectDropdownProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="absolute left-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
        <Search className="h-4 w-4 text-gray-400" strokeWidth={1.8} />
        <input
          type="text"
          placeholder="搜索项目..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-[13px] text-gray-900 placeholder-gray-400 outline-none"
          autoFocus
        />
      </div>

      <div className="max-h-64 overflow-y-auto p-1.5">
        {filteredProjects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelect(project)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
              selectedProject?.id === project.id
                ? "bg-[#dbeafe] text-gray-900"
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <Folder className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.8} />
            <span className="truncate">{project.name}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 p-1.5">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" strokeWidth={1.8} />
          添加新项目
        </button>
      </div>
    </div>
  );
}
