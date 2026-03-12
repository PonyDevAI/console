package state

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func EnsureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}

func EnsureJSONFile(path string, value any) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	bytes, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	bytes = append(bytes, '\n')

	return os.WriteFile(path, bytes, 0o644)
}

func WriteJSONFile(path string, value any) error {
	bytes, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	bytes = append(bytes, '\n')

	return os.WriteFile(path, bytes, 0o644)
}
