package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/PonyDevAI/console/internal/config"
	"github.com/PonyDevAI/console/internal/worker"
)

type Store struct {
	paths config.Paths
}

type Config struct {
	Version string       `json:"version"`
	Server  ConfigServer `json:"server"`
}

type ConfigServer struct {
	Address string `json:"address"`
}

type Workspace struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	RepoPath   string `json:"repoPath"`
	CreatedAt  string `json:"createdAt"`
	ModifiedAt string `json:"modifiedAt"`
}

type WorkspaceCreateInput struct {
	Name     string `json:"name"`
	RepoPath string `json:"repoPath"`
}

type WorkspaceList struct {
	Workspaces []Workspace `json:"workspaces"`
}

type WorkerState = worker.Snapshot

func NewStore(paths config.Paths) *Store {
	return &Store{paths: paths}
}

func (s *Store) EnsureInitialized() error {
	dirs := []string{s.paths.Home, s.paths.StateDir, s.paths.Credentials, s.paths.Logs, s.paths.Artifacts, s.paths.WorkspaceDir}
	for _, dir := range dirs {
		if err := EnsureDir(dir); err != nil {
			return err
		}
	}

	if err := EnsureJSONFile(s.paths.ConfigFile, defaultConfig()); err != nil {
		return err
	}
	if err := EnsureJSONFile(s.paths.Workspaces, WorkspaceList{Workspaces: []Workspace{}}); err != nil {
		return err
	}
	if err := EnsureJSONFile(s.paths.Workers, WorkerState{Workers: []worker.Result{}}); err != nil {
		return err
	}

	return nil
}

func (s *Store) ReadConfig() (Config, error) {
	var cfg Config
	err := readJSONFile(s.paths.ConfigFile, &cfg)
	return cfg, err
}

func (s *Store) ReadWorkspaces() (WorkspaceList, error) {
	var list WorkspaceList
	if err := readJSONFile(s.paths.Workspaces, &list); err != nil {
		return WorkspaceList{}, err
	}
	if list.Workspaces == nil {
		list.Workspaces = []Workspace{}
	}
	sort.Slice(list.Workspaces, func(i, j int) bool {
		return list.Workspaces[i].Name < list.Workspaces[j].Name
	})
	return list, nil
}

func (s *Store) AddWorkspace(input WorkspaceCreateInput) (Workspace, error) {
	name := strings.TrimSpace(input.Name)
	repoPath := strings.TrimSpace(input.RepoPath)
	if name == "" {
		return Workspace{}, errors.New("name is required")
	}
	if repoPath == "" {
		return Workspace{}, errors.New("repoPath is required")
	}

	absoluteRepoPath, err := filepath.Abs(repoPath)
	if err != nil {
		return Workspace{}, fmt.Errorf("invalid repoPath: %w", err)
	}
	info, err := os.Stat(absoluteRepoPath)
	if err != nil {
		if os.IsNotExist(err) {
			return Workspace{}, errors.New("repoPath does not exist")
		}
		return Workspace{}, err
	}
	if !info.IsDir() {
		return Workspace{}, errors.New("repoPath must be a directory")
	}

	list, err := s.ReadWorkspaces()
	if err != nil {
		return Workspace{}, err
	}

	for _, existing := range list.Workspaces {
		if existing.RepoPath == absoluteRepoPath {
			return Workspace{}, errors.New("workspace already exists for repoPath")
		}
	}

	now := time.Now().Format(time.RFC3339)
	id := fmt.Sprintf("ws_%d", time.Now().UnixMilli())
	entry := Workspace{
		ID:         id,
		Name:       name,
		RepoPath:   absoluteRepoPath,
		CreatedAt:  now,
		ModifiedAt: now,
	}

	list.Workspaces = append(list.Workspaces, entry)
	if err := WriteJSONFile(s.paths.Workspaces, list); err != nil {
		return Workspace{}, err
	}

	if err := EnsureDir(filepath.Join(s.paths.WorkspaceDir, id)); err != nil {
		return Workspace{}, err
	}

	return entry, nil
}

func (s *Store) ReadWorkers() (WorkerState, error) {
	var snapshot WorkerState
	if err := readJSONFile(s.paths.Workers, &snapshot); err != nil {
		return WorkerState{}, err
	}
	if snapshot.Workers == nil {
		snapshot.Workers = []worker.Result{}
	}
	return snapshot, nil
}

func (s *Store) UpdateWorkers(snapshot WorkerState) error {
	if snapshot.ScannedAt == "" {
		snapshot.ScannedAt = time.Now().Format(time.RFC3339)
	}
	if snapshot.Workers == nil {
		snapshot.Workers = []worker.Result{}
	}
	return WriteJSONFile(s.paths.Workers, snapshot)
}

func readJSONFile(path string, value any) error {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if len(bytes) == 0 {
		return errors.New("empty JSON file")
	}
	return json.Unmarshal(bytes, value)
}

func defaultConfig() Config {
	return Config{
		Version: "phase0",
		Server:  ConfigServer{Address: "127.0.0.1:8080"},
	}
}
