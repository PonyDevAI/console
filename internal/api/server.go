package api

import (
	"net/http"
	"time"

	"github.com/PonyDevAI/console/internal/run"
	"github.com/PonyDevAI/console/internal/worker"
	"github.com/PonyDevAI/console/internal/workspace"
)

type Server struct {
	Address    string
	runs       *run.Manager
	workspaces *workspace.Service
	workers    *worker.Service
	startedAt  time.Time
}

func NewServer(address string, runs *run.Manager, workspaces *workspace.Service, workers *worker.Service) *Server {
	return &Server{Address: address, runs: runs, workspaces: workspaces, workers: workers, startedAt: time.Now()}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/workspaces", s.handleWorkspaces)
	mux.HandleFunc("/api/workers", s.handleWorkers)
	mux.HandleFunc("/api/workers/scan", s.handleWorkersScan)
	mux.HandleFunc("/api/runs", s.handleRuns)
	mux.HandleFunc("/api/runs/", s.handleRunStream)

	return http.ListenAndServe(s.Address, mux)
}
