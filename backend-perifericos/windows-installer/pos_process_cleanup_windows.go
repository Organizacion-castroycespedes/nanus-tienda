//go:build windows

package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const posProcessTerminationTimeout = 10 * time.Second

type scopedPOSProcess struct {
	pid  uint32
	path string
}

func pathWithinRoot(path, root string) bool {
	path = strings.TrimRight(strings.ToLower(filepath.Clean(path)), `\\/`)
	root = strings.TrimRight(strings.ToLower(filepath.Clean(root)), `\\/`)
	if path == "" || root == "" || path == root {
		return false
	}
	return strings.HasPrefix(path, root+string(filepath.Separator)) || strings.HasPrefix(path, root+"\\") || strings.HasPrefix(path, root+"/")
}

func discoverScopedPOSProcesses(posRoot string) ([]scopedPOSProcess, error) {
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil, err
	}
	defer windows.CloseHandle(snapshot)

	entry := windows.ProcessEntry32{Size: uint32(unsafe.Sizeof(windows.ProcessEntry32{}))}
	processes := make([]scopedPOSProcess, 0)
	for err := windows.Process32First(snapshot, &entry); err == nil; err = windows.Process32Next(snapshot, &entry) {
		handle, openErr := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION|windows.PROCESS_TERMINATE|windows.SYNCHRONIZE, false, entry.ProcessID)
		if openErr != nil {
			continue
		}
		path, pathErr := processImagePath(handle)
		windows.CloseHandle(handle)
		if pathErr == nil && pathWithinRoot(path, posRoot) {
			processes = append(processes, scopedPOSProcess{pid: entry.ProcessID, path: path})
		}
	}
	return processes, nil
}

func processImagePath(handle windows.Handle) (string, error) {
	buf := make([]uint16, windows.MAX_PATH)
	size := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(handle, 0, &buf[0], &size); err != nil {
		return "", err
	}
	return windows.UTF16ToString(buf[:size]), nil
}

func closeScopedPOSProcesses(posRoot string, logger *installLogger) error {
	processes, err := discoverScopedPOSProcesses(posRoot)
	if err != nil {
		return fmt.Errorf("discover POS processes: %w", err)
	}
	if logger != nil {
		logger.Printf("POS process discovery root=%s count=%d", posRoot, len(processes))
		for _, process := range processes {
			logger.Printf("POS process pid=%d path=%s", process.pid, process.path)
		}
	}
	if len(processes) == 0 {
		return nil
	}
	for _, process := range processes {
		handle, openErr := windows.OpenProcess(windows.PROCESS_TERMINATE|windows.SYNCHRONIZE, false, process.pid)
		if openErr != nil {
			return fmt.Errorf("open POS process %d: %w", process.pid, openErr)
		}
		if logger != nil {
			logger.Printf("POS process forced scoped termination pid=%d", process.pid)
			logger.Printf("POS process bounded wait pid=%d timeout=%s", process.pid, posProcessTerminationTimeout)
		}
		terminateErr := windows.TerminateProcess(handle, 1)
		if terminateErr != nil && terminateErr != windows.ERROR_ACCESS_DENIED {
			windows.CloseHandle(handle)
			return fmt.Errorf("terminate POS process %d: %w", process.pid, terminateErr)
		}
		result, waitErr := windows.WaitForSingleObject(handle, uint32(posProcessTerminationTimeout/time.Millisecond))
		windows.CloseHandle(handle)
		if waitErr != nil || result != windows.WAIT_OBJECT_0 {
			if waitErr != nil {
				return fmt.Errorf("wait for POS process %d: %w", process.pid, waitErr)
			}
			return fmt.Errorf("POS process %d did not exit within %s", process.pid, posProcessTerminationTimeout)
		}
	}
	remaining, err := discoverScopedPOSProcesses(posRoot)
	if err != nil {
		return fmt.Errorf("verify POS process exit: %w", err)
	}
	if len(remaining) != 0 {
		return fmt.Errorf("%d scoped POS processes remain", len(remaining))
	}
	if logger != nil {
		logger.Printf("all POS processes exited")
	}
	return nil
}
