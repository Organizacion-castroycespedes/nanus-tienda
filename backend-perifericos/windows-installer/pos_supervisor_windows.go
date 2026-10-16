//go:build windows

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"golang.org/x/sys/windows"
)

const posOwnershipJournalSchema = 1

var getTickCount64Proc = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetTickCount64")

type posOwnershipJournal struct {
	SchemaVersion int    `json:"schemaVersion"`
	State         string `json:"state"`
	JobName       string `json:"jobName"`
	POSRoot       string `json:"posRoot"`
	SupervisorPID uint32 `json:"supervisorPid"`
	SupervisorID  uint64 `json:"supervisorStartIdentity"`
	POSPID        uint32 `json:"posPid"`
	POSIdentity   uint64 `json:"posStartIdentity"`
	SessionID     uint32 `json:"sessionId"`
	BootIdentity  uint64 `json:"bootIdentity"`
	UpdatedAt     string `json:"updatedAt"`
}

func posOwnershipJournalPath(layout runtimeLayout) string {
	return filepath.Join(layout.StateRoot, "pos-ownership.json")
}

func currentPOSSessionAndBoot() (uint32, uint64, error) {
	var session uint32
	if err := windows.ProcessIdToSessionId(uint32(os.Getpid()), &session); err != nil {
		return 0, 0, err
	}
	boot, _, _ := getTickCount64Proc.Call()
	if boot == 0 {
		return 0, 0, errors.New("GetTickCount64 returned zero")
	}
	return session, uint64(boot), nil
}

func writePOSOwnershipJournal(path string, journal *posOwnershipJournal) error {
	if path == "" || journal == nil {
		return errors.New("POS ownership journal path and value are required")
	}
	if journal.SchemaVersion == 0 {
		journal.SchemaVersion = posOwnershipJournalSchema
	}
	if journal.JobName == "" || journal.POSRoot == "" || journal.SupervisorPID == 0 || journal.POSPID == 0 {
		return errors.New("POS ownership journal identity is incomplete")
	}
	if journal.State != "active" && journal.State != "exited" {
		return fmt.Errorf("invalid POS ownership journal state %q", journal.State)
	}
	journal.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	data, err := json.MarshalIndent(journal, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	temp := path + ".tmp-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	if err := os.WriteFile(temp, append(data, '\n'), 0o600); err != nil {
		return err
	}
	from, err := windows.UTF16PtrFromString(temp)
	if err != nil {
		_ = os.Remove(temp)
		return err
	}
	to, err := windows.UTF16PtrFromString(path)
	if err != nil {
		_ = os.Remove(temp)
		return err
	}
	if err := windows.MoveFileEx(from, to, windows.MOVEFILE_REPLACE_EXISTING|windows.MOVEFILE_WRITE_THROUGH); err != nil {
		_ = os.Remove(temp)
		return err
	}
	return nil
}

func loadPOSOwnershipJournal(path string) (*posOwnershipJournal, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var journal posOwnershipJournal
	if err := json.Unmarshal(data, &journal); err != nil {
		return nil, fmt.Errorf("decode POS ownership journal: %w", err)
	}
	if journal.SchemaVersion != posOwnershipJournalSchema || journal.JobName == "" || journal.POSRoot == "" || journal.SupervisorPID == 0 || journal.POSPID == 0 {
		return nil, errors.New("invalid POS ownership journal")
	}
	if journal.State != "active" && journal.State != "exited" {
		return nil, errors.New("invalid POS ownership journal state")
	}
	return &journal, nil
}

func validatePOSOwnershipJournalIdentity(journal *posOwnershipJournal) error {
	if journal == nil {
		return errors.New("POS ownership journal is required")
	}
	session, boot, err := currentPOSSessionAndBoot()
	if err != nil {
		return err
	}
	if journal.SessionID != session {
		return errors.New("POS ownership journal session mismatch")
	}
	if journal.BootIdentity != boot {
		return errors.New("POS ownership journal boot identity mismatch")
	}
	if journal.State == "active" {
		h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, journal.SupervisorPID)
		if err != nil {
			return fmt.Errorf("POS supervisor is not live: %w", err)
		}
		defer windows.CloseHandle(h)
		identity, err := processStartIdentity(h)
		if err != nil || identity != journal.SupervisorID {
			return errors.New("POS supervisor identity is stale")
		}
	}
	return nil
}

func launchManagedPOS(layout runtimeLayout) error {
	if layout.POSInstallRoot == "" || !exists(layout.POSExecutable) {
		return errors.New("managed POS executable is missing")
	}
	journalPath := posOwnershipJournalPath(layout)
	if existing, err := loadPOSOwnershipJournal(journalPath); err == nil && existing.State == "active" {
		return errors.New("POS supervisor journal is active; refusing unsafe adoption")
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(executable, "pos-supervisor", layout.POSInstallRoot, layout.POSExecutable, journalPath)
	cmd.Dir = filepath.Dir(executable)
	cmd.SysProcAttr = &windows.SysProcAttr{CreationFlags: windows.CREATE_NO_WINDOW}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start POS supervisor: %w", err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		journal, readErr := loadPOSOwnershipJournal(journalPath)
		if readErr == nil && journal.State == "active" {
			return nil
		}
		if cmd.ProcessState != nil {
			return errors.New("POS supervisor exited before publishing ownership")
		}
		time.Sleep(25 * time.Millisecond)
	}
	return errors.New("POS supervisor ownership handoff timed out")
}

func runPOSSupervisor(args []string) error {
	if len(args) != 3 {
		return errors.New("pos-supervisor requires POS root, executable, and journal path")
	}
	root, executable, journalPath := args[0], args[1], args[2]
	session, boot, err := currentPOSSessionAndBoot()
	if err != nil {
		return err
	}
	job, err := createOrOpenPOSJob(root)
	if err != nil {
		return fmt.Errorf("create POS Job Object: %w", err)
	}
	defer windows.CloseHandle(job)
	members, err := queryPOSJobMembers(job)
	if err != nil {
		return err
	}
	if len(members) != 0 {
		return errors.New("POS Job Object already owns a process; refusing adoption")
	}
	processInfo, err := launchPOSProcessInJob(job, executable, nil, filepath.Dir(executable))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(processInfo.Thread)
	defer windows.CloseHandle(processInfo.Process)
	identity, err := processStartIdentity(processInfo.Process)
	if err != nil {
		return err
	}
	supervisorIdentity, err := processStartIdentity(windows.CurrentProcess())
	if err != nil {
		return err
	}
	journal := &posOwnershipJournal{
		State:         "active",
		JobName:       posJobObjectName(root),
		POSRoot:       root,
		SupervisorPID: uint32(os.Getpid()),
		SupervisorID:  supervisorIdentity,
		POSPID:        processInfo.ProcessId,
		POSIdentity:   identity,
		SessionID:     session,
		BootIdentity:  boot,
	}
	if err := writePOSOwnershipJournal(journalPath, journal); err != nil {
		return err
	}
	_, err = windows.WaitForSingleObject(processInfo.Process, windows.INFINITE)
	if err != nil {
		return err
	}
	journal.State = "exited"
	return writePOSOwnershipJournal(journalPath, journal)
}
