package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/PonyDevAI/console/internal/run"
	"github.com/PonyDevAI/console/internal/state"
	"github.com/PonyDevAI/console/internal/worker"
)

type Server struct {
	Address string
	store   *state.Store
	runs    *run.Manager
}

func NewServer(address string, store *state.Store, runs *run.Manager) *Server {
	return &Server{Address: address, store: store, runs: runs}
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
	mux.HandleFunc("/api/runs", s.handleRuns)
	mux.HandleFunc("/api/runs/", s.handleRunStream)

	return http.ListenAndServe(s.Address, mux)
}

func (s *Server) handleRuns(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w, http.MethodPost)
		return
	}

	var input run.CreateInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid JSON request body"))
		return
	}

	created, err := s.runs.Create(input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"run":        created,
		"streamPath": fmt.Sprintf("/api/runs/%s/stream", created.ID),
	})
}

func (s *Server) handleRunStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w, http.MethodGet)
		return
	}

	runID, ok := parseRunStreamPath(r.URL.Path)
	if !ok {
		writeError(w, http.StatusNotFound, errors.New("run stream not found"))
		return
	}

	events, err := s.runs.Events(runID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, errors.New("streaming unsupported"))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	for _, event := range events {
		if err := writeSSE(w, event); err != nil {
			return
		}
	}
	flusher.Flush()

	subscription, unsubscribe, err := s.runs.Subscribe(runID)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	defer unsubscribe()

	for {
		select {
		case <-r.Context().Done():
			return
		case event, open := <-subscription:
			if !open {
				return
			}
			if err := writeSSE(w, event); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func parseRunStreamPath(path string) (string, bool) {
	if !strings.HasPrefix(path, "/api/runs/") {
		return "", false
	}
	trimmed := strings.TrimPrefix(path, "/api/runs/")
	parts := strings.Split(strings.Trim(trimmed, "/"), "/")
	if len(parts) != 2 || parts[1] != "stream" || parts[0] == "" {
		return "", false
	}
	return parts[0], true
}

func writeSSE(w http.ResponseWriter, event run.Event) error {
	bytes, err := json.Marshal(event)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "data: %s\n\n", string(bytes))
	return err
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
