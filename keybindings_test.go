package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func getKeybindings(t *testing.T) map[string]any {
	t.Helper()
	s, _ := newTestServer(t)
	rec := httptest.NewRecorder()
	s.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/keybindings", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	return res
}

func TestKeybindingsServesUserFileWithoutComments(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)
	os.MkdirAll(filepath.Join(dir, "px0"), 0o755)
	os.WriteFile(filepath.Join(dir, "px0", "keybindings.json"),
		[]byte(`{"// note": "x", "diff.toggle": "Ctrl+D", "history.back": ["Mod+["]}`), 0o644)

	b := getKeybindings(t)["bindings"].(map[string]any)
	if b["diff.toggle"] != "Ctrl+D" || len(b["history.back"].([]any)) != 1 {
		t.Fatalf("bindings %v", b)
	}
	if _, ok := b["// note"]; ok {
		t.Fatal("comment key was served")
	}
}

func TestKeybindingsMissingOrBrokenFileIsEmpty(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)
	if b := getKeybindings(t)["bindings"].(map[string]any); len(b) != 0 {
		t.Fatalf("missing file gave %v", b)
	}
	os.MkdirAll(filepath.Join(dir, "px0"), 0o755)
	os.WriteFile(filepath.Join(dir, "px0", "keybindings.json"), []byte(`{nope`), 0o644)
	res := getKeybindings(t)
	if len(res["bindings"].(map[string]any)) != 0 || res["problem"] == nil {
		t.Fatalf("broken file gave %v", res)
	}
}
