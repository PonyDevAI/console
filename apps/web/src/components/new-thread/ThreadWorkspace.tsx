import { ProjectPicker } from "./ProjectPicker";
import { MessageList, type Message } from "./MessageList";
import { StarterHero } from "./StarterHero";
import { type Project } from "../app-shell/ProjectTree";

type ThreadWorkspaceProps = {
  messages: Message[];
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
};

export function ThreadWorkspace({ messages, selectedProject, onProjectSelect }: ThreadWorkspaceProps) {
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {!hasMessages ? (
        <StarterHero
          selectedProject={selectedProject}
          onProjectSelect={onProjectSelect}
        />
      ) : (
        <>
          <div className="shrink-0 border-b border-gray-100 px-5 py-3">
            <div className="flex items-center justify-between">
              <ProjectPicker
                selectedProject={selectedProject}
                onSelect={onProjectSelect}
                variant="compact"
              />
            </div>
          </div>
          <MessageList messages={messages} />
        </>
      )}
    </div>
  );
}
