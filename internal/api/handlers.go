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
	"github.com/PonyDevAI/console/internal/stream"
)

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"service": "console",
		"uptime":  time.Since(s.startedAt).Round(time.Second).String(),
		"started": s.startedAt.Format(time.RFC3339),
	})
}

func (s *Server) handleWorkspaces(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := s.workspaces.List()
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
		workspace, err := s.workspaces.Create(input)
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
	snapshot, err := s.workers.List()
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
	snapshot, err := s.workers.Scan()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
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
	stream.SetupSSEHeaders(w)

	for _, event := range events {
		if err := stream.WriteSSE(w, event); err != nil {
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
			if err := stream.WriteSSE(w, event); err != nil {
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
