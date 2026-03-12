package config

import (
	"os"
	"path/filepath"
)

type Paths struct {
	Home         string
	ConfigFile   string
	StateDir     string
	Workspaces   string
	Workers      string
	Credentials  string
	Logs         string
	Artifacts    string
	WorkspaceDir string
}

func DefaultPaths() (Paths, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return Paths{}, err
	}

	root := filepath.Join(home, ".console")
	stateDir := filepath.Join(root, "state")

	return Paths{
		Home:         root,
		ConfigFile:   filepath.Join(root, "config.json"),
		StateDir:     stateDir,
		Workspaces:   filepath.Join(stateDir, "workspaces.json"),
		Workers:      filepath.Join(stateDir, "workers.json"),
		Credentials:  filepath.Join(root, "credentials"),
		Logs:         filepath.Join(root, "logs"),
		Artifacts:    filepath.Join(root, "artifacts"),
		WorkspaceDir: filepath.Join(root, "workspaces"),
	}, nil
}
