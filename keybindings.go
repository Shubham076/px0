package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
)

// The user's keybindings sit beside settings.json, in ~/.px0/keybindings.json (or
// XDG_CONFIG_HOME/px0). The file is read on every request, so edits show on
// reload, and it may be a symlink into a dotfiles repository.
func keybindingsPath() string {
	p := settingsPath()
	if p == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(p), "keybindings.json")
}

// readKeybindings maps an action id to one combo or a list of them, written as
// the help sheet writes them: {"diff.toggle": "Ctrl+D", "history.back": ["Mod+["]}.
// A missing file is no bindings. Keys starting with "//" are comments.
func readKeybindings() (map[string]any, error) {
	p := keybindingsPath()
	if p == "" {
		return map[string]any{}, nil
	}
	data, err := os.ReadFile(p)
	if errors.Is(err, os.ErrNotExist) {
		return map[string]any{}, nil
	}
	if err != nil {
		return map[string]any{}, err
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return map[string]any{}, err
	}
	for k := range m {
		if len(k) >= 2 && k[:2] == "//" {
			delete(m, k)
		}
	}
	return m, nil
}

// handleKeybindings serves the user's keybindings. A broken file is reported
// beside an empty set rather than as a failure, so the built-in shortcuts still load.
func (s *Server) handleKeybindings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, http.StatusMethodNotAllowed, "GET only")
		return
	}
	m, err := readKeybindings()
	res := map[string]any{"bindings": m, "path": keybindingsPath()}
	if err != nil {
		res["problem"] = err.Error()
	}
	writeJSON(w, res)
}
