package worker

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

type RunRequest struct {
	RepoPath string
	Prompt   string
}

type Adapter interface {
	ID() string
	Detect() Result
	BuildCommand(request RunRequest) (string, []string, error)
	Start(request RunRequest) (*exec.Cmd, error)
}

type CLIAdapter struct {
	id          string
	command     string
	promptFlags []string
}

func NewCLIAdapter(id string, command string, promptFlags []string) CLIAdapter {
	return CLIAdapter{id: id, command: command, promptFlags: promptFlags}
}

func (a CLIAdapter) ID() string {
	return a.id
}

func (a CLIAdapter) Detect() Result {
	path, err := exec.LookPath(a.command)
	result := Result{
		Name:      a.id,
		Command:   a.command,
		Available: err == nil,
	}
	if err == nil {
		result.Path = path
	}
	return result
}

func (a CLIAdapter) BuildCommand(request RunRequest) (string, []string, error) {
	prompt := strings.TrimSpace(request.Prompt)
	if prompt == "" {
		return "", nil, errors.New("prompt is required")
	}

	args := make([]string, 0, len(a.promptFlags)+1)
	args = append(args, a.promptFlags...)
	args = append(args, prompt)
	return a.command, args, nil
}

func (a CLIAdapter) Start(request RunRequest) (*exec.Cmd, error) {
	name, args, err := a.BuildCommand(request)
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(name, args...)
	cmd.Dir = request.RepoPath
	return cmd, nil
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
		NewCLIAdapter("cursor", "cursor", []string{"chat", "--prompt"}),
		NewCLIAdapter("claude", "claude", []string{"-p"}),
		NewCLIAdapter("codex", "codex", []string{"exec", "--skip-git-repo-check"}),
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

func (r *Registry) Snapshot() Snapshot {
	results := make([]Result, 0, len(r.adapters))
	for _, id := range []string{"cursor", "claude", "codex"} {
		adapter, ok := r.adapters[id]
		if !ok {
			continue
		}
		results = append(results, adapter.Detect())
	}
	return NewSnapshot(results)
}
