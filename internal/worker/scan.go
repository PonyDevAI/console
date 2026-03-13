package worker

import "time"

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

func NewSnapshot(results []Result) Snapshot {
	if results == nil {
		results = []Result{}
	}
	return Snapshot{
		ScannedAt: time.Now().Format(time.RFC3339),
		Workers:   results,
	}
}

func ScanKnownWorkers(registry *Registry) Snapshot {
	if registry == nil {
		registry = DefaultRegistry()
	}
	return registry.Snapshot()
}
