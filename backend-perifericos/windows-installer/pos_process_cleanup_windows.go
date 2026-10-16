//go:build windows

package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const posProcessTerminationTimeout = 10 * time.Second

var errPOSProcessGone = errors.New("POS process already exited")

type scopedPOSProcess struct {
	pid      uint32
	path     string
	identity uint64
	root     string
	jobName  string
}
type scopedPOSProcessHandle interface {
	ImagePath() (string, error)
	Identity() (uint64, error)
	Terminate() error
	Wait(time.Duration) (bool, error)
	Close()
}
type scopedPOSProcessOperations interface {
	Discover(string) ([]scopedPOSProcess, error)
	Open(scopedPOSProcess) (scopedPOSProcessHandle, error)
}

var posProcessOperations scopedPOSProcessOperations = nativePOSProcessOperations{}
var legacyPOSProcessDiscoveryOverride func(string) ([]scopedPOSProcess, error)

type nativePOSProcessOperations struct{}
type nativePOSProcessHandle struct {
	handle windows.Handle
	root   string
	job    windows.Handle
}

func pathWithinRoot(path, root string) bool {
	path = strings.TrimRight(strings.ToLower(filepath.Clean(path)), `\\/`)
	root = strings.TrimRight(strings.ToLower(filepath.Clean(root)), `\\/`)
	if path == "" || root == "" || path == root {
		return false
	}
	return strings.HasPrefix(path, root+string(filepath.Separator)) || strings.HasPrefix(path, root+"\\") || strings.HasPrefix(path, root+"/")
}

// placeholder

func (nativePOSProcessOperations) Discover(root string) ([]scopedPOSProcess, error) {
	processes, owned, err := discoverPOSJobProcesses(root)
	if owned {
		return processes, err
	}
	if err != nil {
		return nil, err
	}
	if legacyPOSProcessDiscoveryOverride != nil {
		return legacyPOSProcessDiscoveryOverride(root)
	}
	return nil, &legacyUnownedScopeError{cause: errors.New("installation has no POS ownership Job Object")}
}

func discoverLegacyPOSProcesses(root string) ([]scopedPOSProcess, error) {
	snap, err := nativeProcessAPIs.createSnapshot()
	if err != nil {
		return nil, err
	}
	defer func() { _ = nativeProcessAPIs.closeHandle(snap) }()

	entry := windows.ProcessEntry32{Size: uint32(unsafe.Sizeof(windows.ProcessEntry32{}))}
	out := make([]scopedPOSProcess, 0)
	var inspectionFailures []error

	err = nativeProcessAPIs.processFirst(snap, &entry)
	if errors.Is(err, windows.ERROR_NO_MORE_FILES) {
		return out, nil
	}
	if err != nil {
		return nil, fmt.Errorf("enumerate processes: %w", err)
	}
	for {
		h, openErr := nativeProcessAPIs.openProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, entry.ProcessID)
		if openErr != nil {
			if !isPOSProcessGoneError(openErr) {
				inspectionFailures = append(inspectionFailures, fmt.Errorf("inspect process %d: %w", entry.ProcessID, openErr))
			}
		} else {
			queryImagePath := nativeProcessAPIs.queryImagePath
			if nativeProcessAPIs.queryImagePathForRoot != nil {
				queryImagePath = func(handle windows.Handle) (string, error) {
					return nativeProcessAPIs.queryImagePathForRoot(handle, root)
				}
			}
			path, pathErr := queryImagePath(h)
			if pathErr != nil {
				_ = nativeProcessAPIs.closeHandle(h)
				if !isPOSProcessGoneError(pathErr) {
					inspectionFailures = append(inspectionFailures, fmt.Errorf("inspect process %d image path: %w", entry.ProcessID, pathErr))
				}
			} else if !pathWithinRoot(path, root) {
				_ = nativeProcessAPIs.closeHandle(h)
			} else {
				identity, identityErr := nativeProcessAPIs.queryIdentity(h)
				_ = nativeProcessAPIs.closeHandle(h)
				if identityErr != nil {
					if !isPOSProcessGoneError(identityErr) {
						inspectionFailures = append(inspectionFailures, fmt.Errorf("inspect process %d start identity: %w", entry.ProcessID, identityErr))
					}
				} else {
					out = append(out, scopedPOSProcess{pid: entry.ProcessID, path: path, identity: identity, root: root})
				}
			}
		}

		nextErr := nativeProcessAPIs.processNext(snap, &entry)
		if errors.Is(nextErr, windows.ERROR_NO_MORE_FILES) {
			break
		}
		if nextErr != nil {
			inspectionFailures = append(inspectionFailures, fmt.Errorf("enumerate processes: %w", nextErr))
			break
		}
	}
	if len(inspectionFailures) > 0 {
		return nil, errors.Join(inspectionFailures...)
	}
	return out, nil
}
func (nativePOSProcessOperations) Open(p scopedPOSProcess) (scopedPOSProcessHandle, error) {
	h, err := nativeProcessAPIs.openProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION|windows.PROCESS_TERMINATE|windows.SYNCHRONIZE, false, p.pid)
	if err != nil {
		if isPOSProcessGoneError(err) {
			return nil, errPOSProcessGone
		}
		return nil, err
	}
	var job windows.Handle
	if p.jobName != "" {
		job, err = openNamedPOSJob(p.root, posJobObjectQuery)
		if err != nil {
			_ = nativeProcessAPIs.closeHandle(h)
			return nil, fmt.Errorf("open POS ownership Job Object: %w", err)
		}
		members, membersErr := queryPOSJobMembers(job)
		if membersErr != nil || !containsPOSJobMember(members, p.pid) {
			_ = windows.CloseHandle(job)
			_ = nativeProcessAPIs.closeHandle(h)
			if membersErr != nil {
				return nil, fmt.Errorf("revalidate POS ownership Job Object: %w", membersErr)
			}
			return nil, fmt.Errorf("POS process %d is no longer a member of its ownership Job Object", p.pid)
		}
	}
	return &nativePOSProcessHandle{handle: h, root: p.root, job: job}, nil
}
func (h *nativePOSProcessHandle) ImagePath() (string, error) {
	if h.root != `` && nativeProcessAPIs.queryImagePathForRoot != nil {
		return nativeProcessAPIs.queryImagePathForRoot(h.handle, h.root)
	}
	return nativeProcessAPIs.queryImagePath(h.handle)
}
func (h *nativePOSProcessHandle) Identity() (uint64, error) {
	return nativeProcessAPIs.queryIdentity(h.handle)
}
func (h *nativePOSProcessHandle) Terminate() error {
	return nativeProcessAPIs.terminateProcess(h.handle)
}
func (h *nativePOSProcessHandle) Wait(timeout time.Duration) (bool, error) {
	return nativeProcessAPIs.waitForSingleObject(h.handle, timeout)
}
func (h *nativePOSProcessHandle) Close() {
	if h != nil && h.handle != 0 {
		_ = nativeProcessAPIs.closeHandle(h.handle)
		h.handle = 0
	}
	if h != nil && h.job != 0 {
		_ = windows.CloseHandle(h.job)
		h.job = 0
	}
}

type processImagePathAPIBoundary struct {
	queryFull        func(windows.Handle) (string, error)
	queryFullNative  func(windows.Handle) (string, error)
	queryNative      func(windows.Handle) (string, error)
	queryDosDevice   func(string) (string, error)
	windowsDirectory func() (string, error)
}

var processImagePathAPIs = processImagePathAPIBoundary{
	queryFull:        queryFullProcessImagePath,
	queryFullNative:  queryFullProcessImagePathNative,
	queryNative:      queryNativeProcessImagePath,
	queryDosDevice:   queryDosDevicePath,
	windowsDirectory: windows.GetWindowsDirectory,
}

var getProcessImageFileNameW = windows.NewLazySystemDLL("psapi.dll").NewProc("GetProcessImageFileNameW")

type processImageFileNameAPIBoundary struct {
	call func(windows.Handle, *uint16, uint32) (uintptr, error)
}

var processImageFileNameAPI = processImageFileNameAPIBoundary{
	call: func(handle windows.Handle, buffer *uint16, size uint32) (uintptr, error) {
		result, _, callErr := getProcessImageFileNameW.Call(
			uintptr(handle),
			uintptr(unsafe.Pointer(buffer)),
			uintptr(size),
		)
		return result, callErr
	},
}

func processImagePath(h windows.Handle) (string, error) {
	path, err := processImagePathAPIs.queryFull(h)
	if err == nil {
		if path == `` {
			return ``, errors.New(`QueryFullProcessImageNameW returned an empty path`)
		}
		return path, nil
	}

	nativePath, fallbackErr := processImagePathAPIs.queryNative(h)
	if fallbackErr != nil {
		return "", fmt.Errorf("QueryFullProcessImageNameW: %w; GetProcessImageFileNameW: %v", err, fallbackErr)
	}
	normalizedPath, normalizeErr := normalizeNativeProcessImagePath(nativePath)
	if normalizeErr != nil {
		return "", fmt.Errorf("QueryFullProcessImageNameW: %w; native image path normalization: %v", err, normalizeErr)
	}
	return normalizedPath, nil
}

func processImagePathForRoot(h windows.Handle, root string) (string, error) {
	path, fullErr := processImagePathAPIs.queryFull(h)
	if fullErr == nil && path != `` {
		return path, nil
	}
	if fullErr == nil {
		fullErr = errors.New(`QueryFullProcessImageNameW returned an empty path`)
	}

	if processImagePathAPIs.queryFullNative != nil {
		nativePath, nativeFullErr := processImagePathAPIs.queryFullNative(h)
		if nativeFullErr == nil {
			if normalizedPath, normalizeErr := normalizeNativeProcessImagePathForRoot(nativePath, root); normalizeErr == nil {
				return normalizedPath, nil
			}
		}
	}

	nativePath, nativeErr := processImagePathAPIs.queryNative(h)
	if nativeErr != nil {
		return ``, fmt.Errorf(`QueryFullProcessImageNameW: %w; native image query: %v`, fullErr, nativeErr)
	}
	normalizedPath, normalizeErr := normalizeNativeProcessImagePathForRoot(nativePath, root)
	if normalizeErr != nil {
		return ``, fmt.Errorf(`QueryFullProcessImageNameW: %w; native image path normalization: %v`, fullErr, normalizeErr)
	}
	return normalizedPath, nil
}

func queryFullProcessImagePath(h windows.Handle) (string, error) {
	return queryFullProcessImagePathWithFlags(h, 0)
}

func queryFullProcessImagePathNative(h windows.Handle) (string, error) {
	return queryFullProcessImagePathWithFlags(h, 1)
}

func queryFullProcessImagePathWithFlags(h windows.Handle, flags uint32) (string, error) {
	buf := make([]uint16, windows.MAX_PATH)
	size := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(h, flags, &buf[0], &size); err != nil {
		return "", err
	}
	return windows.UTF16ToString(buf[:size]), nil
}

func queryNativeProcessImagePath(h windows.Handle) (string, error) {
	for size := uint32(windows.MAX_PATH); size <= 32768; size *= 2 {
		buf := make([]uint16, size)
		result, callErr := processImageFileNameAPI.call(h, &buf[0], size)
		if result != 0 {
			if result >= uintptr(size) {
				return ``, errors.New(`native process image path length exceeds buffer`)
			}
			return windows.UTF16ToString(buf[:result]), nil
		}
		if callErr == nil || errors.Is(callErr, windows.ERROR_SUCCESS) {
			return ``, errors.New(`GetProcessImageFileNameW returned zero length without an error`)
		}
		if !errors.Is(callErr, windows.ERROR_INSUFFICIENT_BUFFER) {
			return "", callErr
		}
	}
	return "", errors.New("native process image path exceeds supported length")
}

func queryDosDevicePath(device string) (string, error) {
	name, err := windows.UTF16PtrFromString(device)
	if err != nil {
		return "", err
	}
	for size := uint32(256); size <= 32768; size *= 2 {
		buf := make([]uint16, size)
		count, queryErr := windows.QueryDosDevice(name, &buf[0], size)
		if queryErr == nil {
			return windows.UTF16ToString(buf[:count]), nil
		}
		if !errors.Is(queryErr, windows.ERROR_INSUFFICIENT_BUFFER) {
			return "", queryErr
		}
	}
	return "", errors.New("DOS device mapping exceeds supported length")
}

func normalizeNativeProcessImagePath(nativePath string) (string, error) {
	nativePath = strings.TrimSpace(nativePath)
	if nativePath == "" {
		return "", errors.New("empty native process image path")
	}
	for _, prefix := range []string{`\DosDevices\`, `\GLOBAL??\`} {
		if strings.HasPrefix(nativePath, prefix) {
			nativePath = `\??\` + strings.TrimPrefix(nativePath, prefix)
			break
		}
	}
	if strings.HasPrefix(nativePath, `\??\`) {
		normalizedPath := strings.TrimPrefix(nativePath, `\??\`)
		if strings.HasPrefix(normalizedPath, `UNC\`) {
			normalizedPath = `\\` + strings.TrimPrefix(normalizedPath, `UNC\`)
		}
		if !isAbsoluteWindowsProcessPath(normalizedPath) {
			return "", errors.New("unsupported DOS process image path")
		}
		return normalizedPath, nil
	}
	if strings.HasPrefix(nativePath, `\SystemRoot\`) {
		windowsDirectory, err := processImagePathAPIs.windowsDirectory()
		if err != nil {
			return "", err
		}
		normalizedPath := filepath.Join(windowsDirectory, strings.TrimPrefix(nativePath, `\SystemRoot\`))
		if !isAbsoluteWindowsProcessPath(normalizedPath) {
			return "", errors.New("unsupported SystemRoot process image path")
		}
		return normalizedPath, nil
	}
	if !strings.HasPrefix(nativePath, `\Device\`) {
		if !isAbsoluteWindowsProcessPath(nativePath) {
			return "", errors.New("unsupported native process image path")
		}
		return nativePath, nil
	}

	var matches []string
	for drive := byte('A'); drive <= byte('Z'); drive++ {
		deviceName := fmt.Sprintf("%c:", drive)
		mappedDevice, err := processImagePathAPIs.queryDosDevice(deviceName)
		if err != nil {
			continue
		}
		mappedDevice = strings.TrimRight(mappedDevice, "\x00")
		if strings.EqualFold(nativePath, mappedDevice) {
			matches = append(matches, deviceName)
			continue
		}
		prefix := strings.TrimRight(mappedDevice, `\`)
		if prefix != "" && strings.HasPrefix(strings.ToLower(nativePath), strings.ToLower(prefix+`\`)) {
			matches = append(matches, deviceName+nativePath[len(prefix):])
		}
	}
	if len(matches) == 1 {
		return matches[0], nil
	}
	if len(matches) > 1 {
		return "", errors.New("ambiguous DOS drive mapping for native process image path")
	}
	return "", errors.New("no DOS drive mapping for native process image path")
}

func isAbsoluteWindowsProcessPath(path string) bool {
	if len(path) >= 3 && ((path[0] >= 'A' && path[0] <= 'Z') || (path[0] >= 'a' && path[0] <= 'z')) && path[1] == ':' && (path[2] == '\\' || path[2] == '/') {
		return true
	}
	return strings.HasPrefix(path, `\\`)
}

func normalizeNativeProcessImagePathForRoot(nativePath, root string) (string, error) {
	if normalizedPath, err := normalizeNativeProcessImagePath(nativePath); err == nil {
		return normalizedPath, nil
	}

	nativePath = strings.TrimSpace(nativePath)
	if strings.HasPrefix(nativePath, `\??\Volume{`) {
		volumePath := strings.TrimPrefix(nativePath, `\??\`)
		separator := strings.IndexByte(volumePath, `\`[0])
		volumeName := volumePath
		suffix := ``
		if separator >= 0 {
			volumeName = volumePath[:separator]
			suffix = volumePath[separator:]
		}
		mappedVolume, err := processImagePathAPIs.queryDosDevice(volumeName)
		if err != nil {
			return ``, fmt.Errorf(`resolve volume mapping: %w`, err)
		}
		nativePath = strings.TrimRight(mappedVolume, string(rune(0))) + suffix
	}
	if !strings.HasPrefix(nativePath, `\Device\`) {
		return ``, errors.New(`unsupported native process image path`)
	}
	root = filepath.Clean(root)
	if len(root) < 3 || root[1] != `:`[0] {
		return ``, errors.New(`managed process root is not a local drive path`)
	}
	rootDevice, err := processImagePathAPIs.queryDosDevice(root[:2])
	if err != nil {
		return ``, fmt.Errorf(`resolve managed root device mapping: %w`, err)
	}
	rootDevice = strings.TrimRight(rootDevice, string(rune(0))+`\`)
	if rootDevice == `` {
		return ``, errors.New(`managed root device mapping is empty`)
	}
	if strings.EqualFold(nativePath, rootDevice) || strings.HasPrefix(strings.ToLower(nativePath), strings.ToLower(rootDevice+`\`)) {
		return root[:2] + nativePath[len(rootDevice):], nil
	}
	return `\\?\GLOBALROOT` + nativePath, nil
}

func processStartIdentity(h windows.Handle) (uint64, error) {
	var creation, exit, kernel, user windows.Filetime
	if err := windows.GetProcessTimes(h, &creation, &exit, &kernel, &user); err != nil {
		return 0, err
	}
	return uint64(creation.HighDateTime)<<32 | uint64(creation.LowDateTime), nil
}
func isPOSProcessGoneError(err error) bool {
	return errors.Is(err, windows.ERROR_INVALID_PARAMETER) || errors.Is(err, windows.ERROR_INVALID_HANDLE) || errors.Is(err, windows.ERROR_FILE_NOT_FOUND) || errors.Is(err, windows.ERROR_NOT_FOUND)
}
func closeScopedPOSProcesses(root string, logger *installLogger) error {
	return closeScopedPOSProcessesWith(root, logger, posProcessOperations)
}

func closeScopedPOSProcessesWith(root string, logger *installLogger, ops scopedPOSProcessOperations) error {
	processes, err := ops.Discover(root)
	if err != nil {
		return fmt.Errorf("discover POS processes: %w", err)
	}
	if logger != nil {
		logger.Printf("POS process discovery root=%s count=%d", root, len(processes))
		for _, p := range processes {
			logger.Printf("POS process pid=%d path=%s", p.pid, p.path)
		}
	}
	var failures []error
	for _, p := range processes {
		h, err := ops.Open(p)
		if err != nil {
			if errors.Is(err, errPOSProcessGone) || isPOSProcessGoneError(err) {
				if logger != nil {
					logger.Printf("POS process already exited pid=%d", p.pid)
				}
				continue
			}
			failures = append(failures, fmt.Errorf("open POS process %d: %w", p.pid, err))
			continue
		}
		actualPath, pathErr := h.ImagePath()
		actualID, idErr := h.Identity()
		if pathErr != nil || idErr != nil {
			h.Close()
			if pathErr != nil {
				failures = append(failures, fmt.Errorf("revalidate POS process %d path: %w", p.pid, pathErr))
			} else {
				failures = append(failures, fmt.Errorf("revalidate POS process %d identity: %w", p.pid, idErr))
			}
			continue
		}
		inScope := pathWithinRoot(actualPath, root)
		idMatch := p.identity == 0 || actualID == p.identity
		if !inScope || !idMatch {
			h.Close()
			if logger != nil {
				logger.Printf("POS process revalidation skipped pid=%d pathInScope=%t identityMatch=%t", p.pid, inScope, idMatch)
			}
			continue
		}
		if logger != nil {
			logger.Printf("POS process forced scoped termination pid=%d", p.pid)
			logger.Printf("POS process bounded wait pid=%d timeout=%s", p.pid, posProcessTerminationTimeout)
		}
		termErr := h.Terminate()
		if termErr != nil {
			h.Close()
			if errors.Is(termErr, errPOSProcessGone) || isPOSProcessGoneError(termErr) {
				if logger != nil {
					logger.Printf("POS process exited during termination pid=%d", p.pid)
				}
				continue
			}
			failures = append(failures, fmt.Errorf("terminate POS process %d: %w", p.pid, termErr))
			continue
		}
		exited, waitErr := h.Wait(posProcessTerminationTimeout)
		h.Close()
		if waitErr != nil {
			failures = append(failures, fmt.Errorf("wait for POS process %d: %w", p.pid, waitErr))
		} else if !exited {
			failures = append(failures, fmt.Errorf("POS process %d did not exit within %s", p.pid, posProcessTerminationTimeout))
		}
	}
	remaining, err := ops.Discover(root)
	if err != nil {
		failures = append(failures, fmt.Errorf("verify POS process exit: %w", err))
	} else if len(remaining) > 0 {
		failures = append(failures, fmt.Errorf("%d scoped POS processes remain", len(remaining)))
	}
	if len(failures) > 0 {
		return errors.Join(failures...)
	}
	if logger != nil {
		logger.Printf("all POS processes exited")
	}
	return nil
}
