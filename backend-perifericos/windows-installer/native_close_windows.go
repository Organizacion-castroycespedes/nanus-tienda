//go:build windows

package main

import (
	"fmt"
	"sync"
	"syscall"
	"unsafe"
)

const (
	wmClose          = 0x0010
	gwlpWndProcIndex = ^uintptr(3)
)

var (
	user32Native     = syscall.NewLazyDLL("user32.dll")
	setWindowLongPtr = user32Native.NewProc("SetWindowLongPtrW")
	callWindowProcW  = user32Native.NewProc("CallWindowProcW")
)

type nativeCloseHook struct {
	hwnd        uintptr
	previous    uintptr
	callback    uintptr
	policy      func() bool
	allowed     func()
	denied      func()
	cleanupOnce sync.Once
}

func installNativeCloseProtection(hwnd unsafe.Pointer, policy func() bool, allowed func(), denied func()) (*nativeCloseHook, error) {
	if hwnd == nil {
		return nil, fmt.Errorf("missing WebView window handle")
	}
	hook := &nativeCloseHook{hwnd: uintptr(hwnd), policy: policy, allowed: allowed, denied: denied}
	hook.callback = syscall.NewCallback(func(window, message, wParam, lParam uintptr) uintptr {
		if message == wmClose {
			if hook.policy != nil && hook.policy() {
				if hook.allowed != nil {
					hook.allowed()
				}
				return 0
			}
			if hook.denied != nil {
				hook.denied()
			}
			return 0
		}
		return hook.forward(window, message, wParam, lParam)
	})
	previous, _, callErr := setWindowLongPtr.Call(hook.hwnd, gwlpWndProcIndex, hook.callback)
	if previous == 0 && callErr != syscall.Errno(0) {
		return nil, fmt.Errorf("SetWindowLongPtrW: %w", callErr)
	}
	hook.previous = previous
	return hook, nil
}

func (hook *nativeCloseHook) forward(hwnd, message, wParam, lParam uintptr) uintptr {
	result, _, _ := callWindowProcW.Call(hook.previous, hwnd, message, wParam, lParam)
	return result
}

func (hook *nativeCloseHook) cleanup() {
	if hook == nil {
		return
	}
	hook.cleanupOnce.Do(func() {
		if hook.previous != 0 {
			_, _, _ = setWindowLongPtr.Call(hook.hwnd, gwlpWndProcIndex, hook.previous)
		}
		hook.callback = 0
	})
}
