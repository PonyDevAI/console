package worker

import (
	"os/exec"
	"time"
)

type Result struct {
	Name      string `json:"name"`
	Command   string `json:"command"`
	Available bool   `json:"available"`
	Path      string `json:"path,omitempty"`
}

type Snapshot struct {
	ScannedAt string   `json:"scannedAt"`
	Workers   []Result `json:"workers"`
}

func ScanKnownWorkers() Snapshot {
	known := []struct {
		name    string
		command string
	}{
		{name: "cursor", command: "cursor"},
		{name: "claude", command: "claude"},
		{name: "codex", command: "codex"},
	}

	results := make([]Result, 0, len(known))
	for _, item := range known {
		path, err := exec.LookPath(item.command)
		result := Result{
			Name:      item.name,
			Command:   item.command,
			Available: err == nil,
		}
		if err == nil {
			result.Path = path
		}
		results = append(results, result)
	}

	return Snapshot{
		ScannedAt: time.Now().Format(time.RFC3339),
		Workers:   results,
	}
}
