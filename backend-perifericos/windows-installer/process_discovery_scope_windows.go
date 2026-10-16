//go:build windows

package main

import (
	"fmt"
	"time"

	"golang.org/x/sys/windows"
)

type nativeProcessAPIBoundary struct {
	createSnapshot        func() (windows.Handle, error)
	closeHandle           func(windows.Handle) error
	processFirst          func(windows.Handle, *windows.ProcessEntry32) error
	processNext           func(windows.Handle, *windows.ProcessEntry32) error
	openProcess           func(uint32, bool, uint32) (windows.Handle, error)
	queryImagePath        func(windows.Handle) (string, error)
	queryImagePathForRoot func(windows.Handle, string) (string, error)
	queryIdentity         func(windows.Handle) (uint64, error)
	terminateProcess      func(windows.Handle) error
	waitForSingleObject   func(windows.Handle, time.Duration) (bool, error)
}

var nativeProcessAPIs = nativeProcessAPIBoundary{
	createSnapshot: func() (windows.Handle, error) {
		return windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	},
	closeHandle: windows.CloseHandle,
	processFirst: func(snapshot windows.Handle, entry *windows.ProcessEntry32) error {
		return windows.Process32First(snapshot, entry)
	},
	processNext: func(snapshot windows.Handle, entry *windows.ProcessEntry32) error {
		return windows.Process32Next(snapshot, entry)
	},
	openProcess: func(access uint32, inheritHandle bool, pid uint32) (windows.Handle, error) {
		return windows.OpenProcess(access, inheritHandle, pid)
	},
	queryImagePath:        processImagePath,
	queryImagePathForRoot: processImagePathForRoot,
	queryIdentity:         processStartIdentity,
	terminateProcess: func(handle windows.Handle) error {
		return windows.TerminateProcess(handle, 1)
	},
	waitForSingleObject: func(handle windows.Handle, timeout time.Duration) (bool, error) {
		result, err := windows.WaitForSingleObject(handle, uint32(timeout/time.Millisecond))
		if err != nil {
			return false, err
		}
		if result == windows.WAIT_OBJECT_0 {
			return true, nil
		}
		if result == uint32(windows.WAIT_TIMEOUT) {
			return false, nil
		}
		return false, fmt.Errorf("unexpected process wait result %d", result)
	},
}
