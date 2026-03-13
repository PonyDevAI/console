package worker

import (
	"errors"
	"fmt"
	"strings"
)

type RunRequest struct {
	RepoPath string
	Prompt   string
}

type Adapter interface {
	ID() string
	BuildCommand(request RunRequest) (string, []string, error)
}

type CommandAdapter struct {
	id          string
	command     string
	promptFlags []string
}

func NewCommandAdapter(id string, command string, promptFlags []string) CommandAdapter {
	return CommandAdapter{id: id, command: command, promptFlags: promptFlags}
}

func (a CommandAdapter) ID() string {
	return a.id
}

func (a CommandAdapter) BuildCommand(request RunRequest) (string, []string, error) {
	prompt := strings.TrimSpace(request.Prompt)
	if prompt == "" {
		return "", nil, errors.New("prompt is required")
	}

	args := make([]string, 0, len(a.promptFlags)+1)
	args = append(args, a.promptFlags...)
	args = append(args, prompt)
	return a.command, args, nil
}

type Registry struct {
	adapters map[string]Adapter
}

func NewRegistry(adapters []Adapter) *Registry {
	indexed := make(map[string]Adapter, len(adapters))
	for _, adapter := range adapters {
		indexed[adapter.ID()] = adapter
	}
	return &Registry{adapters: indexed}
}

func DefaultRegistry() *Registry {
	adapters := []Adapter{
		NewCommandAdapter("cursor", "cursor", []string{"chat", "--prompt"}),
		NewCommandAdapter("claude", "claude", []string{"-p"}),
		NewCommandAdapter("codex", "codex", []string{"exec", "--skip-git-repo-check"}),
	}
	return NewRegistry(adapters)
}

func (r *Registry) Get(workerID string) (Adapter, error) {
	adapter, ok := r.adapters[workerID]
	if !ok {
		return nil, fmt.Errorf("unknown workerId %q", workerID)
	}
	return adapter, nil
}
