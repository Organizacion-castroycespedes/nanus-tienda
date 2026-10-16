//go:build windows

package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestSingleAuthoritativeUninstallCleanupEntryPoint(t *testing.T) {
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	source, err := os.ReadFile(filepath.Join(filepath.Dir(sourceFile), "main_windows.go"))
	if err != nil {
		t.Fatalf("read main_windows.go: %v", err)
	}
	text := string(source)
	if strings.Contains(text, "func runUninstallCleanup(") {
		t.Fatal("duplicated legacy cleanup implementation must not exist")
	}
	if !strings.Contains(text, "fatal(runUninstallCleanupWithResult(manifest, os.Args[2:]))") {
		t.Fatal("cleanup CLI must dispatch to durable-result cleanup")
	}
	if !strings.Contains(text, "return uninstallWithResult(manifest, removeData)") {
		t.Fatal("legacy uninstall wrapper must delegate to uninstallWithResult")
	}
}
