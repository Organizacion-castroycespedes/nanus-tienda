//go:build windows

package main

import (
	"errors"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const (
	uninstallRegistryPath = `Software\Microsoft\Windows\CurrentVersion\Uninstall\ManusPeripheralAgent`
	uninstallRegistryView = uint32(registry.WOW64_64KEY)
)

type uninstallRegistryKey interface {
	Close() error
	SetStringValue(string, string) error
	SetDWordValue(string, uint32) error
}

type uninstallRegistryStore interface {
	Create(string, uint32) (uninstallRegistryKey, error)
	Open(string, uint32) (uninstallRegistryKey, error)
	Delete(string, uint32) error
}

type nativeUninstallRegistryKey struct{ key registry.Key }

func (k nativeUninstallRegistryKey) Close() error { return k.key.Close() }
func (k nativeUninstallRegistryKey) SetStringValue(name, value string) error {
	return k.key.SetStringValue(name, value)
}
func (k nativeUninstallRegistryKey) SetDWordValue(name string, value uint32) error {
	return k.key.SetDWordValue(name, value)
}

type nativeUninstallRegistryStore struct{}

func (nativeUninstallRegistryStore) Create(path string, access uint32) (uninstallRegistryKey, error) {
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, path, access)
	if err != nil {
		return nil, err
	}
	return nativeUninstallRegistryKey{key: key}, nil
}

func (nativeUninstallRegistryStore) Open(path string, access uint32) (uninstallRegistryKey, error) {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, path, access)
	if err != nil {
		return nil, err
	}
	return nativeUninstallRegistryKey{key: key}, nil
}

func (nativeUninstallRegistryStore) Delete(path string, view uint32) error {
	return deleteRegistryKeyInView(path, view)
}

var uninstallRegistryOps uninstallRegistryStore = nativeUninstallRegistryStore{}

var regDeleteKeyExW = windows.NewLazySystemDLL("advapi32.dll").NewProc("RegDeleteKeyExW")

func uninstallRegistryWriteAccess() uint32 { return registry.ALL_ACCESS | uninstallRegistryView }
func uninstallRegistryQueryAccess() uint32 { return registry.QUERY_VALUE | uninstallRegistryView }

func deleteRegistryKeyInView(path string, view uint32) error {
	pathPointer, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return err
	}
	status, _, _ := regDeleteKeyExW.Call(uintptr(registry.LOCAL_MACHINE), uintptr(unsafe.Pointer(pathPointer)), uintptr(view), 0)
	if status != 0 {
		return syscall.Errno(status)
	}
	return nil
}

func isMissingUninstallRegistryKeyError(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, windows.ERROR_FILE_NOT_FOUND) ||
		errors.Is(err, windows.ERROR_PATH_NOT_FOUND) ||
		strings.Contains(strings.ToLower(err.Error()), "the system cannot find the file specified")
}
