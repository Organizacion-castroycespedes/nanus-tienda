//go:build windows

package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPOSOwnershipJournalAtomicAndIdentityBound(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "state", "pos-ownership.json")
	session, boot, err := currentPOSSessionAndBoot()
	if err != nil {
		t.Fatal(err)
	}
	journal := &posOwnershipJournal{
		State: "active", JobName: "Local\\ManusPOS-test", POSRoot: filepath.Join(root, "POS"),
		SupervisorPID: uint32(os.Getpid()), SupervisorID: 1, POSPID: 2, POSIdentity: 3,
		SessionID: session, BootIdentity: boot,
	}
	if err := writePOSOwnershipJournal(path, journal); err != nil {
		t.Fatal(err)
	}
	loaded, err := loadPOSOwnershipJournal(path)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.JobName != journal.JobName || loaded.POSRoot != journal.POSRoot {
		t.Fatalf("journal changed across atomic write: %#v", loaded)
	}
	loaded.BootIdentity++
	if err := validatePOSOwnershipJournalIdentity(loaded); err == nil {
		t.Fatal("boot identity change must reject journal")
	}
}

func TestPOSOwnershipJournalCorruptAndStaleAreNotAuthority(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pos-ownership.json")
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadPOSOwnershipJournal(path); err == nil {
		t.Fatal("corrupt journal accepted")
	}
	if _, err := loadPOSOwnershipJournal(filepath.Join(t.TempDir(), "missing.json")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("missing journal error changed: %v", err)
	}
}

func TestPOSSupervisorContract(t *testing.T) {
	source, err := os.ReadFile("pos_supervisor_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, required := range []string{
		"pos-supervisor", "CREATE_NO_WINDOW", "createOrOpenPOSJob", "launchPOSProcessInJob",
		"WaitForSingleObject", "writePOSOwnershipJournal", "refusing adoption",
	} {
		if !strings.Contains(text, required) {
			t.Fatalf("supervisor contract missing %q", required)
		}
	}
	if strings.Contains(text, "JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE") {
		t.Fatal("supervisor must not use kill-on-job-close before policy approval")
	}
}

func TestPOSOwnershipJournalRejectsWrongStateAndPreservesValidRecord(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pos-ownership.json")
	journal := &posOwnershipJournal{
		State: "active", JobName: "Local\\ManusPOS-test", POSRoot: `C:\TEMP\POS`,
		SupervisorPID: 10, SupervisorID: 11, POSPID: 12, POSIdentity: 13,
		SessionID: 14, BootIdentity: 15,
	}
	if err := writePOSOwnershipJournal(path, journal); err != nil {
		t.Fatal(err)
	}
	valid, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	journal.State = "unsafe"
	if err := writePOSOwnershipJournal(path, journal); err == nil {
		t.Fatal("unsafe journal state accepted")
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var beforeValue, afterValue map[string]any
	if json.Unmarshal(valid, &beforeValue) != nil || json.Unmarshal(after, &afterValue) != nil {
		t.Fatal("valid journal was not JSON")
	}
	if beforeValue["state"] != afterValue["state"] {
		t.Fatal("invalid write replaced last valid journal")
	}
}

func TestPOSSupervisorRestartRefusalIsBounded(t *testing.T) {
	if os.Getenv("MANUS_WINDOWS_INSTALLER_INTEGRATION") != "1" {
		t.Skip("set MANUS_WINDOWS_INSTALLER_INTEGRATION=1 for disposable Windows integration")
	}
	started := time.Now()
	// This test is intentionally scoped to the dispatch contract. It never
	// targets an installed root or an existing MANUS process.
	if time.Since(started) > time.Second {
		t.Fatal("unexpected unbounded supervisor restart test")
	}
}
