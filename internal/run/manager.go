package run

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/PonyDevAI/console/internal/worker"
)

type Status string

const (
	StatusQueued  Status = "queued"
	StatusRunning Status = "running"
	StatusSuccess Status = "succeeded"
	StatusFailed  Status = "failed"
)

type CreateInput struct {
	RepoPath string `json:"repoPath"`
	WorkerID string `json:"workerId"`
	Prompt   string `json:"prompt"`
}

type Run struct {
	ID         string `json:"id"`
	RepoPath   string `json:"repoPath"`
	WorkerID   string `json:"workerId"`
	Prompt     string `json:"prompt"`
	Status     Status `json:"status"`
	CreatedAt  string `json:"createdAt"`
	StartedAt  string `json:"startedAt,omitempty"`
	FinishedAt string `json:"finishedAt,omitempty"`
	ExitCode   *int   `json:"exitCode,omitempty"`
	Error      string `json:"error,omitempty"`
	events     []Event
}

type Event struct {
	Type      string `json:"type"`
	RunID     string `json:"runId"`
	Status    Status `json:"status,omitempty"`
	Stream    string `json:"stream,omitempty"`
	Message   string `json:"message,omitempty"`
	ExitCode  *int   `json:"exitCode,omitempty"`
	Timestamp string `json:"timestamp"`
}

type Manager struct {
	mu          sync.RWMutex
	runs        map[string]*Run
	subscribers map[string]map[chan Event]struct{}
	registry    *worker.Registry
	logsDir     string
}

func NewManager(registry *worker.Registry, logsDir string) *Manager {
	return &Manager{
		runs:        make(map[string]*Run),
		subscribers: make(map[string]map[chan Event]struct{}),
		registry:    registry,
		logsDir:     logsDir,
	}
}

func (m *Manager) Create(input CreateInput) (Run, error) {
	repoPath := strings.TrimSpace(input.RepoPath)
	workerID := strings.TrimSpace(input.WorkerID)
	prompt := strings.TrimSpace(input.Prompt)

	if repoPath == "" {
		return Run{}, errors.New("repoPath is required")
	}
	if workerID == "" {
		return Run{}, errors.New("workerId is required")
	}
	if prompt == "" {
		return Run{}, errors.New("prompt is required")
	}

	absoluteRepoPath, err := filepath.Abs(repoPath)
	if err != nil {
		return Run{}, fmt.Errorf("invalid repoPath: %w", err)
	}
	info, err := os.Stat(absoluteRepoPath)
	if err != nil {
		if os.IsNotExist(err) {
			return Run{}, errors.New("repoPath does not exist")
		}
		return Run{}, err
	}
	if !info.IsDir() {
		return Run{}, errors.New("repoPath must be a directory")
	}

	adapter, err := m.registry.Get(workerID)
	if err != nil {
		return Run{}, err
	}

	now := time.Now()
	r := &Run{
		ID:        fmt.Sprintf("run_%d", now.UnixMilli()),
		RepoPath:  absoluteRepoPath,
		WorkerID:  workerID,
		Prompt:    prompt,
		Status:    StatusQueued,
		CreatedAt: now.Format(time.RFC3339),
		events:    []Event{},
	}

	m.mu.Lock()
	m.runs[r.ID] = r
	m.mu.Unlock()

	m.publish(r.ID, Event{Type: "state", RunID: r.ID, Status: StatusQueued, Timestamp: time.Now().Format(time.RFC3339)})
	go m.execute(r.ID, adapter, worker.RunRequest{RepoPath: absoluteRepoPath, Prompt: prompt})

	return m.Get(r.ID)
}

func (m *Manager) Get(id string) (Run, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	r, ok := m.runs[id]
	if !ok {
		return Run{}, errors.New("run not found")
	}
	copy := *r
	copy.events = append([]Event{}, r.events...)
	return copy, nil
}

func (m *Manager) Events(id string) ([]Event, error) {
	r, err := m.Get(id)
	if err != nil {
		return nil, err
	}
	return r.events, nil
}

func (m *Manager) Subscribe(id string) (<-chan Event, func(), error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.runs[id]; !ok {
		return nil, nil, errors.New("run not found")
	}
	ch := make(chan Event, 32)
	if _, ok := m.subscribers[id]; !ok {
		m.subscribers[id] = make(map[chan Event]struct{})
	}
	m.subscribers[id][ch] = struct{}{}
	unsubscribe := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		if listeners, ok := m.subscribers[id]; ok {
			if _, exists := listeners[ch]; exists {
				delete(listeners, ch)
				close(ch)
			}
			if len(listeners) == 0 {
				delete(m.subscribers, id)
			}
		}
	}
	return ch, unsubscribe, nil
}

func (m *Manager) execute(runID string, adapter worker.Adapter, request worker.RunRequest) {
	cmd, err := adapter.Start(request)
	if err != nil {
		m.finishFailed(runID, err.Error(), nil)
		return
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		m.finishFailed(runID, err.Error(), nil)
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		m.finishFailed(runID, err.Error(), nil)
		return
	}

	logWriter := m.openLogWriter(runID)
	if err := cmd.Start(); err != nil {
		m.finishFailed(runID, err.Error(), nil)
		return
	}

	m.mu.Lock()
	r := m.runs[runID]
	r.Status = StatusRunning
	r.StartedAt = time.Now().Format(time.RFC3339)
	m.mu.Unlock()
	m.publish(runID, Event{Type: "state", RunID: runID, Status: StatusRunning, Timestamp: time.Now().Format(time.RFC3339)})

	var wg sync.WaitGroup
	wg.Add(2)
	go m.readStream(runID, "stdout", stdout, logWriter, &wg)
	go m.readStream(runID, "stderr", stderr, logWriter, &wg)

	waitErr := cmd.Wait()
	wg.Wait()
	if logWriter != nil {
		_ = logWriter.Close()
	}

	if waitErr == nil {
		exitCode := 0
		m.finishSuccess(runID, &exitCode)
		return
	}

	var exitErr *exec.ExitError
	if errors.As(waitErr, &exitErr) {
		exitCode := exitErr.ExitCode()
		m.finishFailed(runID, waitErr.Error(), &exitCode)
		return
	}
	m.finishFailed(runID, waitErr.Error(), nil)
}

func (m *Manager) readStream(runID string, stream string, reader io.Reader, logWriter io.Writer, wg *sync.WaitGroup) {
	defer wg.Done()
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		event := Event{Type: "output", RunID: runID, Stream: stream, Message: line, Timestamp: time.Now().Format(time.RFC3339)}
		if logWriter != nil {
			_, _ = fmt.Fprintf(logWriter, "%s [%s] %s\n", event.Timestamp, stream, line)
		}
		m.publish(runID, event)
	}
}

func (m *Manager) finishSuccess(runID string, exitCode *int) {
	m.mu.Lock()
	r := m.runs[runID]
	r.Status = StatusSuccess
	r.FinishedAt = time.Now().Format(time.RFC3339)
	r.ExitCode = exitCode
	r.Error = ""
	m.mu.Unlock()
	m.publish(runID, Event{Type: "state", RunID: runID, Status: StatusSuccess, ExitCode: exitCode, Timestamp: time.Now().Format(time.RFC3339)})
	m.closeSubscribers(runID)
}

func (m *Manager) finishFailed(runID string, message string, exitCode *int) {
	m.mu.Lock()
	r := m.runs[runID]
	r.Status = StatusFailed
	r.FinishedAt = time.Now().Format(time.RFC3339)
	r.ExitCode = exitCode
	r.Error = message
	m.mu.Unlock()
	m.publish(runID, Event{Type: "state", RunID: runID, Status: StatusFailed, Message: message, ExitCode: exitCode, Timestamp: time.Now().Format(time.RFC3339)})
	m.closeSubscribers(runID)
}

func (m *Manager) publish(runID string, event Event) {
	m.mu.Lock()
	run, ok := m.runs[runID]
	if !ok {
		m.mu.Unlock()
		return
	}
	run.events = append(run.events, event)
	listeners := m.subscribers[runID]
	channels := make([]chan Event, 0, len(listeners))
	for ch := range listeners {
		channels = append(channels, ch)
	}
	m.mu.Unlock()

	for _, ch := range channels {
		select {
		case ch <- event:
		default:
		}
	}
}

func (m *Manager) closeSubscribers(runID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	listeners := m.subscribers[runID]
	for ch := range listeners {
		close(ch)
	}
	delete(m.subscribers, runID)
}

func (m *Manager) openLogWriter(runID string) io.WriteCloser {
	if strings.TrimSpace(m.logsDir) == "" {
		return nil
	}
	if err := os.MkdirAll(m.logsDir, 0o755); err != nil {
		return nil
	}
	file, err := os.OpenFile(filepath.Join(m.logsDir, runID+".log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil
	}
	return file
}
