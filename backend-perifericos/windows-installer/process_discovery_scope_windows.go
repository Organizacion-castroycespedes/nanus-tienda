//go:build windows

package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

type nativeProcessAPIBoundary struct {
	createSnapshot      func() (windows.Handle, error)
	closeHandle         func(windows.Handle) error
	processFirst        func(windows.Handle, *windows.ProcessEntry32) error
	processNext         func(windows.Handle, *windows.ProcessEntry32) error
	openProcess         func(uint32, bool, uint32) (windows.Handle, error)
	queryImagePath      func(windows.Handle) (string, error)
	queryIdentity       func(windows.Handle) (uint64, error)
	proveOwnership      func(windows.Handle, uint32, string, string, uint64) (bool, error)
	terminateProcess    func(windows.Handle) error
	waitForSingleObject func(windows.Handle, time.Duration) (bool, error)
}

type nativePOSProcessOperations struct {
	api nativeProcessAPIBoundary
}

type nativePOSProcessHandle struct {
	api    nativeProcessAPIBoundary
	handle windows.Handle
	pid    uint32
	mu     sync.Mutex
	closed bool
}

type nativePOSObservationHandle struct {
	*nativePOSProcessHandle
}

type nativePOSTerminationHandle struct {
	*nativePOSProcessHandle
}

func newNativePOSProcessOperations() *nativePOSProcessOperations {
	return &nativePOSProcessOperations{api: nativeProcessAPIBoundary{
		createSnapshot: func() (windows.Handle, error) {
			return windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
		},
		closeHandle:    windows.CloseHandle,
		processFirst:   windows.Process32First,
		processNext:    windows.Process32Next,
		openProcess:    windows.OpenProcess,
		queryImagePath: processImagePath,
		queryIdentity:  processStartIdentity,
		proveOwnership: func(windows.Handle, uint32, string, string, uint64) (bool, error) {
			// The current baseline has no trusted POS Job or equivalent ownership authority.
			return false, nil
		},
		terminateProcess: func(handle windows.Handle) error {
			return windows.TerminateProcess(handle, 1)
		},
		waitForSingleObject: func(handle windows.Handle, timeout time.Duration) (bool, error) {
			result, err := windows.WaitForSingleObject(handle, uint32(timeout/time.Millisecond))
			if err != nil {
				return false, err
			}
			switch result {
			case windows.WAIT_OBJECT_0:
				return true, nil
			case uint32(windows.WAIT_TIMEOUT):
				return false, nil
			default:
				return false, fmt.Errorf("unexpected process wait result %d", result)
			}
		},
	}}
}

func (operations *nativePOSProcessOperations) Discover(posRoot string) (processes []scopedPOSProcess, resultErr error) {
	if operations == nil {
		return nil, errors.New("native POS process operations are required")
	}
	root := filepath.Clean(posRoot)
	if posRoot == "" || !filepath.IsAbs(root) {
		return nil, errors.New("POS process root must be an absolute path")
	}

	snapshot, err := operations.api.createSnapshot()
	if err != nil {
		return nil, fmt.Errorf("create process snapshot: %w", err)
	}
	defer func() {
		if closeErr := operations.api.closeHandle(snapshot); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close process snapshot: %w", closeErr))
		}
	}()

	entry := windows.ProcessEntry32{Size: uint32(unsafe.Sizeof(windows.ProcessEntry32{}))}
	if err := operations.api.processFirst(snapshot, &entry); err != nil {
		if errors.Is(err, windows.ERROR_NO_MORE_FILES) {
			return nil, nil
		}
		return nil, fmt.Errorf("enumerate first process: %w", err)
	}

	processes = make([]scopedPOSProcess, 0)
	closeRetained := func() error {
		var closeErrors []error
		for _, process := range processes {
			if process.handle != nil {
				if closeErr := process.handle.Close(); closeErr != nil {
					closeErrors = append(closeErrors, fmt.Errorf("close POS process %d observation handle: %w", process.pid, closeErr))
				}
			}
		}
		return errors.Join(closeErrors...)
	}
	for {
		process, include, observeErr := operations.observe(entry.ProcessID, root)
		if observeErr != nil {
			return nil, errors.Join(observeErr, closeRetained())
		}
		if include {
			processes = append(processes, process)
		}

		nextErr := operations.api.processNext(snapshot, &entry)
		if nextErr == nil {
			continue
		}
		if errors.Is(nextErr, windows.ERROR_NO_MORE_FILES) {
			break
		}
		return nil, errors.Join(fmt.Errorf("enumerate next process: %w", nextErr), closeRetained())
	}
	return processes, nil
}

func (operations *nativePOSProcessOperations) observe(pid uint32, root string) (process scopedPOSProcess, include bool, resultErr error) {
	handleValue, err := operations.api.openProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		if isDefinitivelyGoneProcessError(err) {
			return scopedPOSProcess{}, false, nil
		}
		return scopedPOSProcess{}, false, fmt.Errorf("open process %d for observation: %w", pid, err)
	}
	handle := &nativePOSObservationHandle{nativePOSProcessHandle: &nativePOSProcessHandle{api: operations.api, handle: handleValue, pid: pid}}
	closeOnFailure := true
	defer func() {
		if closeOnFailure {
			if closeErr := handle.Close(); closeErr != nil {
				resultErr = errors.Join(resultErr, fmt.Errorf("close process %d observation handle: %w", pid, closeErr))
			}
		}
	}()

	imagePath, err := handle.ImagePath()
	if err != nil {
		if errors.Is(err, errPOSProcessGone) {
			return scopedPOSProcess{}, false, nil
		}
		return scopedPOSProcess{}, false, fmt.Errorf("query process %d image: %w", pid, err)
	}
	if !pathWithinRoot(imagePath, root) {
		return scopedPOSProcess{}, false, nil
	}
	identity, err := handle.Identity()
	if err != nil {
		if errors.Is(err, errPOSProcessGone) {
			return scopedPOSProcess{}, false, nil
		}
		return scopedPOSProcess{}, false, fmt.Errorf("query process %d creation identity: %w", pid, err)
	}
	owned, err := handle.ProveOwnership(root, imagePath, identity)
	if err != nil {
		return scopedPOSProcess{}, false, fmt.Errorf("query process %d ownership: %w", pid, err)
	}
	class := posProcessLegacy
	if owned {
		class = posProcessManaged
	}
	closeOnFailure = false
	return scopedPOSProcess{pid: pid, path: imagePath, identity: identity, class: class, handle: handle}, true, nil
}

func (operations *nativePOSProcessOperations) AcquireTermination(process scopedPOSProcess) (scopedPOSTerminationHandle, error) {
	if operations == nil {
		return nil, errors.New("native POS process operations are required")
	}
	handleValue, err := operations.api.openProcess(
		windows.PROCESS_QUERY_LIMITED_INFORMATION|windows.PROCESS_TERMINATE|windows.SYNCHRONIZE,
		false,
		process.pid,
	)
	if err != nil {
		if isDefinitivelyGoneProcessError(err) {
			return nil, errPOSProcessGone
		}
		return nil, err
	}
	return &nativePOSTerminationHandle{nativePOSProcessHandle: &nativePOSProcessHandle{api: operations.api, handle: handleValue, pid: process.pid}}, nil
}

func (handle *nativePOSProcessHandle) ImagePath() (string, error) {
	return handle.api.queryImagePath(handle.handle)
}

func (handle *nativePOSProcessHandle) Identity() (uint64, error) {
	return handle.api.queryIdentity(handle.handle)
}

func (handle *nativePOSProcessHandle) ProveOwnership(root, imagePath string, identity uint64) (bool, error) {
	return handle.api.proveOwnership(handle.handle, handle.pid, root, imagePath, identity)
}

func (handle *nativePOSTerminationHandle) Terminate() error {
	return handle.api.terminateProcess(handle.handle)
}

func (handle *nativePOSTerminationHandle) Wait(timeout time.Duration) (bool, error) {
	return handle.api.waitForSingleObject(handle.handle, timeout)
}

func (handle *nativePOSProcessHandle) Close() error {
	handle.mu.Lock()
	defer handle.mu.Unlock()
	if handle.closed {
		return nil
	}
	handle.closed = true
	return handle.api.closeHandle(handle.handle)
}

func processImagePath(handle windows.Handle) (string, error) {
	for size := uint32(windows.MAX_PATH); size <= 32768; size *= 2 {
		buffer := make([]uint16, size)
		length := size
		err := windows.QueryFullProcessImageName(handle, 0, &buffer[0], &length)
		if err == nil {
			if length == 0 {
				return "", errors.New("process image query returned an empty path")
			}
			return windows.UTF16ToString(buffer[:length]), nil
		}
		if !errors.Is(err, windows.ERROR_INSUFFICIENT_BUFFER) {
			return "", err
		}
	}
	return "", windows.ERROR_INSUFFICIENT_BUFFER
}

func processStartIdentity(handle windows.Handle) (uint64, error) {
	var creationTime windows.Filetime
	var exitTime windows.Filetime
	var kernelTime windows.Filetime
	var userTime windows.Filetime
	if err := windows.GetProcessTimes(handle, &creationTime, &exitTime, &kernelTime, &userTime); err != nil {
		return 0, err
	}
	return uint64(creationTime.HighDateTime)<<32 | uint64(creationTime.LowDateTime), nil
}

func isDefinitivelyGoneProcessError(err error) bool {
	return errors.Is(err, windows.ERROR_INVALID_PARAMETER) || errors.Is(err, windows.ERROR_NOT_FOUND)
}
