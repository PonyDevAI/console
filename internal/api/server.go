package api

import (
	"encoding/json"
	"net/http"
	"time"
)

type Server struct {
	Address string
}

func NewServer(address string) *Server {
	return &Server{Address: address}
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

	return http.ListenAndServe(s.Address, mux)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
