package api

import (
	"encoding/json"
	"errors"
	"net/http"
)

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
