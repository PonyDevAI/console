package workspace

import "github.com/PonyDevAI/console/internal/state"

type Service struct {
	store *state.Store
}

func NewService(store *state.Store) *Service {
	return &Service{store: store}
}

func (s *Service) List() (state.WorkspaceList, error) {
	return s.store.ReadWorkspaces()
}

func (s *Service) Create(input state.WorkspaceCreateInput) (state.Workspace, error) {
	return s.store.AddWorkspace(input)
}
