//go:build windows

package main

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	posJobObjectAssignProcess uint32 = 0x0001
	posJobObjectSetAttributes uint32 = 0x0002
	posJobObjectQuery         uint32 = 0x0004
	posJobObjectTerminate     uint32 = 0x0008
	posJobMemberHeaderSize           = 8
)

var openJobObjectW = windows.NewLazySystemDLL("kernel32.dll").NewProc("OpenJobObjectW")

type posJobSecurityBoundary struct {
	Open  func(string, uint32) (windows.Handle, error)
	Query func(windows.Handle) ([]uint32, error)
}

var posJobSecurity = posJobSecurityBoundary{
	Open:  openNamedPOSJobNative,
	Query: queryPOSJobMembersNative,
}

type legacyUnownedScopeError struct {
	cause error
}

func (e *legacyUnownedScopeError) Error() string {
	if e == nil || e.cause == nil {
		return "legacy POS ownership scope is unavailable"
	}
	return "legacy POS ownership scope is unavailable: " + e.cause.Error()
}

func (e *legacyUnownedScopeError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.cause
}

func posJobObjectName(root string) string {
	normalized := strings.ToLower(filepath.Clean(root))
	sum := sha256.Sum256([]byte(normalized))
	return "Local\\ManusPOS-" + hex.EncodeToString(sum[:16])
}

func openNamedPOSJob(root string, access uint32) (windows.Handle, error) {
	return posJobSecurity.Open(root, access)
}

func openNamedPOSJobNative(root string, access uint32) (windows.Handle, error) {
	name, err := windows.UTF16PtrFromString(posJobObjectName(root))
	if err != nil {
		return 0, err
	}
	result, _, callErr := openJobObjectW.Call(
		uintptr(access),
		0,
		uintptr(unsafe.Pointer(name)),
	)
	if result == 0 {
		if callErr == nil {
			callErr = windows.ERROR_INVALID_HANDLE
		}
		return 0, callErr
	}
	return windows.Handle(result), nil
}

func createOrOpenPOSJob(root string) (windows.Handle, error) {
	name, err := windows.UTF16PtrFromString(posJobObjectName(root))
	if err != nil {
		return 0, err
	}
	job, createErr := windows.CreateJobObject(nil, name)
	if job == 0 {
		if createErr == nil {
			createErr = windows.ERROR_INVALID_HANDLE
		}
		return 0, createErr
	}

	// Zero breakaway flags means CREATE_BREAKAWAY_FROM_JOB is not permitted.
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	if _, err := windows.SetInformationJobObject(
		job,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	); err != nil {
		_ = windows.CloseHandle(job)
		return 0, err
	}
	return job, nil
}

func queryPOSJobMembers(job windows.Handle) ([]uint32, error) {
	return posJobSecurity.Query(job)
}

func queryPOSJobMembersNative(job windows.Handle) ([]uint32, error) {
	ptrSize := int(unsafe.Sizeof(uintptr(0)))
	for capacity := 16; capacity <= 4096; capacity *= 2 {
		buffer := make([]byte, posJobMemberHeaderSize+capacity*ptrSize)
		var returned uint32
		err := windows.QueryInformationJobObject(
			job,
			windows.JobObjectBasicProcessIdList,
			uintptr(unsafe.Pointer(&buffer[0])),
			uint32(len(buffer)),
			&returned,
		)
		if err != nil {
			if errors.Is(err, windows.ERROR_INSUFFICIENT_BUFFER) {
				continue
			}
			return nil, err
		}
		count := int(binary.LittleEndian.Uint32(buffer[4:8]))
		if count > capacity {
			continue
		}
		members := make([]uint32, 0, count)
		for index := 0; index < count; index++ {
			offset := posJobMemberHeaderSize + index*ptrSize
			var pid uint64
			if ptrSize == 8 {
				pid = binary.LittleEndian.Uint64(buffer[offset : offset+8])
			} else {
				pid = uint64(binary.LittleEndian.Uint32(buffer[offset : offset+4]))
			}
			if pid != 0 && pid <= uint64(^uint32(0)) {
				members = append(members, uint32(pid))
			}
		}
		return members, nil
	}
	return nil, errors.New("POS Job Object membership list exceeds supported size")
}

func containsPOSJobMember(members []uint32, pid uint32) bool {
	for _, member := range members {
		if member == pid {
			return true
		}
	}
	return false
}

func discoverPOSJobProcesses(root string) ([]scopedPOSProcess, bool, error) {
	job, err := openNamedPOSJob(root, posJobObjectQuery)
	if err != nil {
		if errors.Is(err, windows.ERROR_FILE_NOT_FOUND) || errors.Is(err, windows.ERROR_INVALID_NAME) {
			return nil, false, nil
		}
		return nil, true, fmt.Errorf("open POS Job Object: %w", err)
	}
	defer windows.CloseHandle(job)

	members, err := queryPOSJobMembers(job)
	if err != nil {
		return nil, true, fmt.Errorf("query POS Job Object members: %w", err)
	}
	processes := make([]scopedPOSProcess, 0, len(members))
	for _, pid := range members {
		handle, openErr := nativeProcessAPIs.openProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
		if openErr != nil {
			if isPOSProcessGoneError(openErr) {
				continue
			}
			return nil, true, fmt.Errorf("inspect POS Job Object member %d: %w", pid, openErr)
		}
		path, pathErr := processImagePathForRoot(handle, root)
		if pathErr != nil {
			_ = nativeProcessAPIs.closeHandle(handle)
			return nil, true, fmt.Errorf("inspect POS Job Object member %d image path: %w", pid, pathErr)
		}
		if !pathWithinRoot(path, root) {
			_ = nativeProcessAPIs.closeHandle(handle)
			return nil, true, fmt.Errorf("POS Job Object member %d is outside the managed root", pid)
		}
		identity, identityErr := nativeProcessAPIs.queryIdentity(handle)
		_ = nativeProcessAPIs.closeHandle(handle)
		if identityErr != nil {
			if isPOSProcessGoneError(identityErr) {
				continue
			}
			return nil, true, fmt.Errorf("inspect POS Job Object member %d start identity: %w", pid, identityErr)
		}
		processes = append(processes, scopedPOSProcess{
			pid:      pid,
			path:     path,
			identity: identity,
			root:     root,
			jobName:  posJobObjectName(root),
		})
	}
	return processes, true, nil
}

func buildPOSCommandLine(executable string, args []string) ([]uint16, error) {
	command := quoteWindowsServiceExecutable(executable)
	for _, arg := range args {
		command += " " + syscall.EscapeArg(arg)
	}
	return windows.UTF16FromString(command)
}

func launchPOSProcessInJob(job windows.Handle, executable string, args []string, workingDirectory string) (windows.ProcessInformation, error) {
	var processInfo windows.ProcessInformation
	appName, err := windows.UTF16PtrFromString(executable)
	if err != nil {
		return processInfo, err
	}
	commandLine, err := buildPOSCommandLine(executable, args)
	if err != nil {
		return processInfo, err
	}
	var currentDirectory *uint16
	if workingDirectory != "" {
		currentDirectory, err = windows.UTF16PtrFromString(workingDirectory)
		if err != nil {
			return processInfo, err
		}
	}
	startupInfo := windows.StartupInfo{Cb: uint32(unsafe.Sizeof(windows.StartupInfo{}))}
	if err := windows.CreateProcess(
		appName,
		&commandLine[0],
		nil,
		nil,
		false,
		windows.CREATE_SUSPENDED|windows.CREATE_UNICODE_ENVIRONMENT,
		nil,
		currentDirectory,
		&startupInfo,
		&processInfo,
	); err != nil {
		return processInfo, err
	}
	closeOnFailure := true
	defer func() {
		if closeOnFailure {
			_ = windows.TerminateProcess(processInfo.Process, 1)
			_ = windows.CloseHandle(processInfo.Thread)
			_ = windows.CloseHandle(processInfo.Process)
		}
	}()

	if err := windows.AssignProcessToJobObject(job, processInfo.Process); err != nil {
		return windows.ProcessInformation{}, fmt.Errorf("assign POS process to Job Object: %w", err)
	}
	if _, err := windows.ResumeThread(processInfo.Thread); err != nil {
		return windows.ProcessInformation{}, fmt.Errorf("resume POS process: %w", err)
	}
	closeOnFailure = false
	return processInfo, nil
}
