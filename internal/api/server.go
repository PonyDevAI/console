package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/PonyDevAI/console/internal/state"
	"github.com/PonyDevAI/console/internal/worker"
)

type Server struct {
	Address string
	store   *state.Store
}

func NewServer(address string, store *state.Store) *Server {
	return &Server{Address: address, store: store}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()
	startTime := time.Now()

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})

	mux.HandleFunc("/api/status", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"service": "console",
			"uptime":  time.Since(startTime).Round(time.Second).String(),
			"started": startTime.Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/api/workspaces", s.handleWorkspaces)
	mux.HandleFunc("/api/workers", s.handleWorkers)
	mux.HandleFunc("/api/workers/scan", s.handleWorkersScan)

	return http.ListenAndServe(s.Address, mux)
}

func (s *Server) handleWorkspaces(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := s.store.ReadWorkspaces()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var input state.WorkspaceCreateInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, errors.New("invalid JSON request body"))
			return
		}
		workspace, err := s.store.AddWorkspace(input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusCreated, workspace)
	default:
		writeMethodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func (s *Server) handleWorkers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w, http.MethodGet)
		return
	}
	snapshot, err := s.store.ReadWorkers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (s *Server) handleWorkersScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w, http.MethodPost)
		return
	}
	snapshot := worker.ScanKnownWorkers()
	if err := s.store.UpdateWorkers(snapshot); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func writeMethodNotAllowed(w http.ResponseWriter, methods ...string) {
	w.Header().Set("Allow", joinMethods(methods))
	writeError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
}

func joinMethods(methods []string) string {
	if len(methods) == 0 {
		return ""
	}
	joined := methods[0]
	for i := 1; i < len(methods); i++ {
		joined += ", " + methods[i]
	}
	return joined
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
