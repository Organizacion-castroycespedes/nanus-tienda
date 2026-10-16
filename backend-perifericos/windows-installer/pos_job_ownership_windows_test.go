//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

func TestPOSJobTreeChild(t *testing.T) {
	if os.Getenv("MANUS_JOB_TREE_CHILD") != "1" {
		return
	}
	if os.Getenv("MANUS_JOB_TREE_PARENT") != "1" {
		child := exec.Command(os.Args[0], "-test.run=TestPOSJobTreeChild", "-test.v=false")
		child.Env = append(os.Environ(), "MANUS_JOB_TREE_CHILD=1", "MANUS_JOB_TREE_PARENT=1")
		if err := child.Start(); err != nil {
			t.Fatal(err)
		}
	}
	for {
		time.Sleep(250 * time.Millisecond)
	}
}

func TestPOSJobObjectNameDoesNotExposeRoot(t *testing.T) {
	root := filepath.Join(t.TempDir(), "POS")
	name := posJobObjectName(root)
	if name == "" || filepath.IsAbs(name) || filepath.Base(name) == name {
		t.Fatalf("unexpected local job name %q", name)
	}
	if filepath.IsAbs(name) || filepath.Clean(name) == filepath.Clean(root) {
		t.Fatalf("job name leaks root: %q", name)
	}
	if name != posJobObjectName(stringsToUpperPath(root)) {
		t.Fatalf("job name is not case-stable: %q", name)
	}
	if name == posJobObjectName(filepath.Join(filepath.Dir(root), "other")) {
		t.Fatalf("different roots share job name: %q", name)
	}
}

func stringsToUpperPath(path string) string {
	result := []rune(path)
	for index, value := range result {
		if value >= 'a' && value <= 'z' {
			result[index] = value - ('a' - 'A')
		}
	}
	return string(result)
}

func TestPOSJobMemberEnumerationInvalidHandleFailsClosed(t *testing.T) {
	if _, err := queryPOSJobMembers(windows.Handle(^uintptr(0))); err == nil {
		t.Fatal("invalid Job Object handle was accepted")
	}
}

func TestPOSJobObjectOwnershipIntegration(t *testing.T) {
	if os.Getenv("MANUS_WINDOWS_INSTALLER_INTEGRATION") != "1" {
		t.Skip("set MANUS_WINDOWS_INSTALLER_INTEGRATION=1 for disposable Windows integration")
	}
	root := t.TempDir()
	scopedRoot := filepath.Join(root, "POS")
	unrelatedRoot := filepath.Join(root, "unrelated")
	if err := os.MkdirAll(scopedRoot, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(unrelatedRoot, 0o700); err != nil {
		t.Fatal(err)
	}
	current, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	scopedExe := filepath.Join(scopedRoot, "Manus POS.exe")
	unrelatedExe := filepath.Join(unrelatedRoot, "Electron Like.exe")
	copyDisposableExecutable(t, current, scopedExe)
	copyDisposableExecutable(t, current, unrelatedExe)

	job, err := createOrOpenPOSJob(scopedRoot)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = windows.TerminateJobObject(job, 1); _ = windows.CloseHandle(job) })
	if members, err := queryPOSJobMembers(job); err != nil || len(members) != 0 {
		t.Fatalf("new Job Object was not empty: members=%v err=%v", members, err)
	}

	t.Setenv("MANUS_JOB_TREE_CHILD", "1")
	t.Setenv("MANUS_JOB_TREE_PARENT", "")

	launched, err := launchPOSProcessInJob(job, scopedExe, []string{"-test.run=TestPOSJobTreeChild", "-test.v=false"}, scopedRoot)
	if err != nil {
		t.Fatal(err)
	}
	scopedPID := uint32(launched.ProcessId)
	_ = windows.CloseHandle(launched.Thread)
	_ = windows.CloseHandle(launched.Process)

	unrelated := exec.Command(unrelatedExe, "-test.run=TestPOSJobTreeChild", "-test.v=false")
	unrelated.Env = append(os.Environ(), "MANUS_JOB_TREE_CHILD=1", "MANUS_JOB_TREE_PARENT=1")
	if err := unrelated.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if unrelated.Process != nil {
			_ = unrelated.Process.Kill()
			_, _ = unrelated.Process.Wait()
		}
	})

	deadline := time.Now().Add(10 * time.Second)
	var discovered []scopedPOSProcess
	owned := false
	for time.Now().Before(deadline) {
		discovered, owned, err = discoverPOSJobProcesses(scopedRoot)
		if owned && err == nil && len(discovered) >= 2 {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if err != nil || len(discovered) < 2 {
		t.Fatalf("Job Object did not expose parent and child: count=%d err=%v", len(discovered), err)
	}
	members, err := queryPOSJobMembers(job)
	if err != nil || len(members) < 2 {
		t.Fatalf("Job Object child containment missing: members=%v err=%v", members, err)
	}
	if !containsPOSJobMember(members, scopedPID) {
		t.Fatalf("launched parent PID %d is not a Job Object member: %v", scopedPID, members)
	}
	if containsPOSJobMember(members, uint32(unrelated.Process.Pid)) {
		t.Fatalf("unrelated process entered POS Job Object: %v", members)
	}

	failedLaunch, assignmentErr := launchPOSProcessInJob(0, scopedExe, []string{"-test.run=TestPOSJobTreeChild", "-test.v=false"}, scopedRoot)
	if assignmentErr == nil {
		t.Fatal("invalid Job Object handle was accepted for assignment")
	}
	if failedLaunch.Process != 0 || failedLaunch.Thread != 0 {
		t.Fatalf("failed assignment leaked process handles: %+v", failedLaunch)
	}

	if err := closeScopedPOSProcesses(scopedRoot, nil); err != nil {
		t.Fatalf("controlled POS Job Object cleanup failed: %v", err)
	}
	deadline = time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		members, err = queryPOSJobMembers(job)
		if err == nil && len(members) == 0 {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if err != nil || len(members) != 0 {
		t.Fatalf("POS Job Object retained members after cleanup: %v err=%v", members, err)
	}
	if unrelated.ProcessState != nil {
		t.Fatal("unrelated process exited during POS cleanup")
	}
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(unrelated.Process.Pid))
	if err != nil {
		t.Fatalf("unrelated process was not preserved: %v", err)
	}
	_ = windows.CloseHandle(handle)
}
