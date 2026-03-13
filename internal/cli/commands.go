package cli

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/PonyDevAI/console/internal/api"
	"github.com/PonyDevAI/console/internal/config"
	"github.com/PonyDevAI/console/internal/run"
	"github.com/PonyDevAI/console/internal/state"
	"github.com/PonyDevAI/console/internal/worker"
	"github.com/PonyDevAI/console/internal/workspace"
)

func Run(args []string) error {
	paths, err := config.DefaultPaths()
	if err != nil {
		return err
	}

	if len(args) == 0 {
		return usageError()
	}

	switch args[0] {
	case "init":
		return runInit(paths)
	case "start":
		return runStart(paths)
	case "status":
		return runStatus(paths)
	case "doctor":
		return runDoctor(paths)
	case "worker":
		if len(args) >= 2 && args[1] == "scan" {
			return runWorkerScan(paths)
		}
		return usageError()
	default:
		return usageError()
	}
}

func runInit(paths config.Paths) error {
	store := state.NewStore(paths)
	if err := store.EnsureInitialized(); err != nil {
		return err
	}

	fmt.Printf("Initialized Console home at %s\n", paths.Home)
	return nil
}

func runStart(paths config.Paths) error {
	store := state.NewStore(paths)
	if err := store.EnsureInitialized(); err != nil {
		return err
	}

	cfg, err := store.ReadConfig()
	if err != nil {
		return err
	}

	address := cfg.Server.Address
	registry := worker.DefaultRegistry()
	runManager := run.NewManager(registry, paths.Logs)
	workspaceService := workspace.NewService(store)
	workerService := worker.NewService(store, registry)

	fmt.Printf("Console server listening on http://%s\n", address)
	return api.NewServer(address, runManager, workspaceService, workerService).Start()
}

func runStatus(paths config.Paths) error {
	_, err := os.Stat(paths.Home)
	initialized := err == nil

	fmt.Println("Console status")
	fmt.Printf("  initialized: %t\n", initialized)
	fmt.Printf("  home: %s\n", paths.Home)
	fmt.Println("  api: GET /api/health, GET /api/status")
	if initialized {
		fmt.Println("  hint: run `console doctor` for checks")
	} else {
		fmt.Println("  hint: run `console init`")
	}
	return nil
}

func runDoctor(paths config.Paths) error {
	fmt.Println("Console doctor")

	checks := []struct {
		name string
		fn   func() (bool, string)
	}{
		{
			name: "home directory exists",
			fn: func() (bool, string) {
				_, err := os.Stat(paths.Home)
				if err == nil {
					return true, paths.Home
				}
				if os.IsNotExist(err) {
					return false, "not initialized (run console init)"
				}
				return false, err.Error()
			},
		},
		{
			name: "config readable",
			fn: func() (bool, string) {
				_, err := os.ReadFile(paths.ConfigFile)
				if err == nil {
					return true, paths.ConfigFile
				}
				if os.IsNotExist(err) {
					return false, "missing config.json"
				}
				return false, err.Error()
			},
		},
	}

	for _, check := range checks {
		ok, detail := check.fn()
		status := "FAIL"
		if ok {
			status = "OK"
		}
		fmt.Printf("  [%s] %s: %s\n", status, check.name, detail)
	}

	snapshot := worker.ScanKnownWorkers(worker.DefaultRegistry())
	available := 0
	for _, result := range snapshot.Workers {
		state := "missing"
		if result.Available {
			state = "found"
			available++
		}
		fmt.Printf("  [INFO] worker %s (%s): %s\n", result.Name, result.Command, state)
	}
	fmt.Printf("  summary: %d/%d workers available\n", available, len(snapshot.Workers))

	return nil
}

func runWorkerScan(paths config.Paths) error {
	store := state.NewStore(paths)
	if err := store.EnsureInitialized(); err != nil {
		return err
	}

	registry := worker.DefaultRegistry()
	workerService := worker.NewService(store, registry)
	snapshot, err := workerService.Scan()
	if err != nil {
		return err
	}

	fmt.Printf("Updated %s\n", paths.Workers)
	for _, result := range snapshot.Workers {
		line := fmt.Sprintf("- %s: missing", result.Name)
		if result.Available {
			line = fmt.Sprintf("- %s: found (%s)", result.Name, result.Path)
		}
		fmt.Println(line)
	}
	return nil
}

func usageError() error {
	var b strings.Builder
	b.WriteString("Usage:\n")
	b.WriteString("  console init\n")
	b.WriteString("  console start\n")
	b.WriteString("  console status\n")
	b.WriteString("  console doctor\n")
	b.WriteString("  console worker scan\n")
	return errors.New(strings.TrimSpace(b.String()))
}
