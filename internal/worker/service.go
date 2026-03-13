package worker

import "github.com/PonyDevAI/console/internal/state"

type Service struct {
	store    *state.Store
	registry *Registry
}

func NewService(store *state.Store, registry *Registry) *Service {
	return &Service{store: store, registry: registry}
}

func (s *Service) List() (Snapshot, error) {
	stored, err := s.store.ReadWorkers()
	if err != nil {
		return Snapshot{}, err
	}
	return fromState(stored), nil
}

func (s *Service) Scan() (Snapshot, error) {
	snapshot := ScanKnownWorkers(s.registry)
	if err := s.store.UpdateWorkers(toState(snapshot)); err != nil {
		return Snapshot{}, err
	}
	return snapshot, nil
}

func toState(snapshot Snapshot) state.WorkerState {
	entries := make([]state.WorkerEntry, 0, len(snapshot.Workers))
	for _, item := range snapshot.Workers {
		entries = append(entries, state.WorkerEntry{
			Name:      item.Name,
			Command:   item.Command,
			Available: item.Available,
			Path:      item.Path,
		})
	}
	return state.WorkerState{ScannedAt: snapshot.ScannedAt, Workers: entries}
}

func fromState(snapshot state.WorkerState) Snapshot {
	results := make([]Result, 0, len(snapshot.Workers))
	for _, item := range snapshot.Workers {
		results = append(results, Result{
			Name:      item.Name,
			Command:   item.Command,
			Available: item.Available,
			Path:      item.Path,
		})
	}
	return Snapshot{ScannedAt: snapshot.ScannedAt, Workers: results}
}
