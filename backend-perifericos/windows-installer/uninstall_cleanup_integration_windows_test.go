//go:build windows

package main

import (
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

func TestDisposablePOSChild(t *testing.T) {
	if os.Getenv("MANUS_DISPOSABLE_CHILD") != "1" {
		return
	}
	for {
		time.Sleep(250 * time.Millisecond)
	}
}

func copyDisposableExecutable(t *testing.T, source, destination string) {
	t.Helper()
	in, err := os.Open(source)
	if err != nil {
		t.Fatal(err)
	}
	defer in.Close()
	out, err := os.Create(destination)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close()
		t.Fatal(err)
	}
	if err := out.Close(); err != nil {
		t.Fatal(err)
	}
}

func waitForDisposableProcesses(t *testing.T, root string, want int) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		processes, err := (nativePOSProcessOperations{}).Discover(root)
		if err == nil && len(processes) >= want {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	processes, err := (nativePOSProcessOperations{}).Discover(root)
	t.Fatalf("disposable process fixture did not start: count=%d err=%v", len(processes), err)
}

type disposableNativeProcessAPI struct {
	pids           []uint32
	snapshots      map[windows.Handle]int
	handles        map[windows.Handle]uint32
	terminated     map[uint32]bool
	nextSnapshotID uint32
}

func (a *disposableNativeProcessAPI) boundary() nativeProcessAPIBoundary {
	return nativeProcessAPIBoundary{
		createSnapshot: a.createSnapshot,
		closeHandle: func(handle windows.Handle) error {
			if _, ok := a.snapshots[handle]; ok {
				delete(a.snapshots, handle)
				return nil
			}
			return windows.CloseHandle(handle)
		},
		processFirst:        a.processFirst,
		processNext:         a.processNext,
		openProcess:         a.openProcess,
		queryImagePath:      processImagePath,
		queryIdentity:       processStartIdentity,
		terminateProcess:    a.terminateProcess,
		waitForSingleObject: nativeProcessAPIs.waitForSingleObject,
	}
}

func (a *disposableNativeProcessAPI) openProcess(access uint32, inheritHandle bool, pid uint32) (windows.Handle, error) {
	if a.terminated[pid] {
		return 0, windows.ERROR_INVALID_PARAMETER
	}
	handle, err := windows.OpenProcess(access, inheritHandle, pid)
	if err == nil {
		a.handles[handle] = pid
	}
	return handle, err
}

func (a *disposableNativeProcessAPI) terminateProcess(handle windows.Handle) error {
	err := windows.TerminateProcess(handle, 1)
	if err == nil {
		a.terminated[a.handles[handle]] = true
	}
	return err
}
func (a *disposableNativeProcessAPI) createSnapshot() (windows.Handle, error) {
	a.nextSnapshotID++
	handle := windows.Handle(0x70000000 + a.nextSnapshotID)
	a.snapshots[handle] = 0
	return handle, nil
}

func (a *disposableNativeProcessAPI) processFirst(snapshot windows.Handle, entry *windows.ProcessEntry32) error {
	index, ok := a.snapshots[snapshot]
	if !ok || len(a.pids) == 0 {
		return windows.ERROR_NO_MORE_FILES
	}
	entry.ProcessID = a.pids[index]
	entry.ExeFile = [windows.MAX_PATH]uint16{}
	copy(entry.ExeFile[:], windows.StringToUTF16("fixture.exe"))
	a.snapshots[snapshot] = 1
	return nil
}

func (a *disposableNativeProcessAPI) processNext(snapshot windows.Handle, entry *windows.ProcessEntry32) error {
	index, ok := a.snapshots[snapshot]
	if !ok || index >= len(a.pids) {
		return windows.ERROR_NO_MORE_FILES
	}
	entry.ProcessID = a.pids[index]
	entry.ExeFile = [windows.MAX_PATH]uint16{}
	copy(entry.ExeFile[:], windows.StringToUTF16("fixture.exe"))
	a.snapshots[snapshot] = index + 1
	return nil
}

func TestWindowsDisposableScopedProcessCleanup(t *testing.T) {
	if os.Getenv("MANUS_WINDOWS_INSTALLER_INTEGRATION") != "1" {
		t.Skip("set MANUS_WINDOWS_INSTALLER_INTEGRATION=1 for disposable Windows integration")
	}
	root := t.TempDir()
	if filepath.VolumeName(root) == "" || filepath.Dir(root) == root {
		t.Fatal("integration fixture is not a disposable TEMP path")
	}
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
	start := func(exe string) *exec.Cmd {
		cmd := exec.Command(exe, "-test.run=TestDisposablePOSChild", "-test.v=false")
		cmd.Env = append(os.Environ(), "MANUS_DISPOSABLE_CHILD=1")
		if err := cmd.Start(); err != nil {
			t.Fatal(err)
		}
		return cmd
	}
	scopedOne := start(scopedExe)
	scopedTwo := start(scopedExe)
	unrelated := start(unrelatedExe)
	nativeAPI := &disposableNativeProcessAPI{snapshots: make(map[windows.Handle]int), handles: make(map[windows.Handle]uint32), terminated: make(map[uint32]bool)}
	nativeAPI.pids = []uint32{uint32(scopedOne.Process.Pid), uint32(scopedTwo.Process.Pid), uint32(unrelated.Process.Pid)}
	previousNativeAPI := nativeProcessAPIs
	nativeProcessAPIs = nativeAPI.boundary()
	t.Cleanup(func() { nativeProcessAPIs = previousNativeAPI })
	defer func() {
		for _, cmd := range []*exec.Cmd{scopedOne, scopedTwo, unrelated} {
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
				_, _ = cmd.Process.Wait()
			}
		}
	}()
	waitForDisposableProcesses(t, scopedRoot, 2)
	if err := closeScopedPOSProcesses(scopedRoot, nil); err != nil {
		t.Fatalf("scoped disposable cleanup failed: %v", err)
	}
	remaining, err := (nativePOSProcessOperations{}).Discover(scopedRoot)
	if err != nil || len(remaining) != 0 {
		t.Fatalf("scoped processes remain count=%d err=%v", len(remaining), err)
	}
	if unrelated.ProcessState != nil {
		t.Fatal("unrelated disposable process exited unexpectedly")
	}
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(unrelated.Process.Pid))
	if err != nil {
		t.Fatalf("unrelated disposable process was not preserved: %v", err)
	}
	_ = windows.CloseHandle(handle)
}
