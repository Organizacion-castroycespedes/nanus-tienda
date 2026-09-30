//go:build windows

package main

import (
	"errors"
	"testing"

	"golang.org/x/sys/windows"
)

func TestWaitForSingleObjectClosedHandleReturnsWaitFailed(t *testing.T) {
	handle, err := windows.CreateMutex(nil, false, nil)
	if err != nil {
		t.Fatalf("CreateMutex: %v", err)
	}
	if err := windows.CloseHandle(handle); err != nil {
		t.Fatalf("CloseHandle: %v", err)
	}

	result, _, callErr := waitForSingleObject.Call(uintptr(handle), 0)
	if uint32(result) != waitFailed {
		t.Fatalf("WaitForSingleObject result = %#x, want WAIT_FAILED", result)
	}
	if callErr == nil || !errors.Is(callErr, windows.ERROR_INVALID_HANDLE) {
		t.Fatalf("WaitForSingleObject error = %v, want ERROR_INVALID_HANDLE", callErr)
	}
}
