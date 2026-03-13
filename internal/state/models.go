package state

// Config maps ~/.console/config.json.
type Config struct {
	Version string       `json:"version"`
	Server  ConfigServer `json:"server"`
}

type ConfigServer struct {
	Address string `json:"address"`
}

// WorkspaceList maps ~/.console/state/workspaces.json.
type WorkspaceList struct {
	Workspaces []Workspace `json:"workspaces"`
}

type Workspace struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Repo       Repo   `json:"repo"`
	CreatedAt  string `json:"createdAt"`
	ModifiedAt string `json:"modifiedAt"`
}

// Repo points to a real filesystem repository path.
type Repo struct {
	Path string `json:"path"`
}

type WorkspaceCreateInput struct {
	Name     string `json:"name"`
	RepoPath string `json:"repoPath"`
}

// WorkerState maps ~/.console/state/workers.json.
type WorkerState struct {
	ScannedAt string        `json:"scannedAt"`
	Workers   []WorkerEntry `json:"workers"`
}

type WorkerEntry struct {
	Name      string `json:"name"`
	Command   string `json:"command"`
	Available bool   `json:"available"`
	Path      string `json:"path,omitempty"`
}
