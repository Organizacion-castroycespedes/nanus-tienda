//go:build windows

package main

import (
	"errors"
	"path/filepath"
	"testing"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

type r8NativeFixture struct {
	snapshotEntries [][]windows.ProcessEntry32
	snapshotIndex   int
	snapshotPos     map[windows.Handle]int
	handlePIDs      map[windows.Handle]uint32
	openErrors      map[uint32]error
	imageErrors     map[uint32]error
	identityErrors  map[uint32]error
	paths           map[uint32]string
	identities      map[uint32]uint64
}

func newR8NativeFixture(entries ...[]windows.ProcessEntry32) *r8NativeFixture {
	return &r8NativeFixture{
		snapshotEntries: entries,
		snapshotPos:     make(map[windows.Handle]int),
		handlePIDs:      make(map[windows.Handle]uint32),
		openErrors:      make(map[uint32]error),
		imageErrors:     make(map[uint32]error),
		identityErrors:  make(map[uint32]error),
		paths:           make(map[uint32]string),
		identities:      make(map[uint32]uint64),
	}
}

func (f *r8NativeFixture) boundary() nativeProcessAPIBoundary {
	return nativeProcessAPIBoundary{
		createSnapshot: func() (windows.Handle, error) {
			f.snapshotIndex++
			handle := windows.Handle(0x71000000 + f.snapshotIndex)
			f.snapshotPos[handle] = 0
			return handle, nil
		},
		closeHandle: func(windows.Handle) error { return nil },
		processFirst: func(snapshot windows.Handle, entry *windows.ProcessEntry32) error {
			index := int(snapshot - 0x71000000)
			if index <= 0 || index > len(f.snapshotEntries) || len(f.snapshotEntries[index-1]) == 0 {
				return windows.ERROR_NO_MORE_FILES
			}
			entries := f.snapshotEntries[index-1]
			*entry = entries[0]
			f.snapshotPos[snapshot] = 1
			return nil
		},
		processNext: func(snapshot windows.Handle, entry *windows.ProcessEntry32) error {
			index := int(snapshot - 0x71000000)
			position := f.snapshotPos[snapshot]
			if index <= 0 || index > len(f.snapshotEntries) || position >= len(f.snapshotEntries[index-1]) {
				return windows.ERROR_NO_MORE_FILES
			}
			*entry = f.snapshotEntries[index-1][position]
			f.snapshotPos[snapshot] = position + 1
			return nil
		},
		openProcess: func(_ uint32, _ bool, pid uint32) (windows.Handle, error) {
			if err := f.openErrors[pid]; err != nil {
				return 0, err
			}
			handle := windows.Handle(0x72000000 + pid)
			f.handlePIDs[handle] = pid
			return handle, nil
		},
		queryImagePath: func(handle windows.Handle) (string, error) {
			pid := f.handlePIDs[handle]
			if err := f.imageErrors[pid]; err != nil {
				return "", err
			}
			return f.paths[pid], nil
		},
		queryIdentity: func(handle windows.Handle) (uint64, error) {
			pid := f.handlePIDs[handle]
			if err := f.identityErrors[pid]; err != nil {
				return 0, err
			}
			return f.identities[pid], nil
		},
		terminateProcess:    func(windows.Handle) error { return nil },
		waitForSingleObject: func(windows.Handle, time.Duration) (bool, error) { return true, nil },
	}
}

func r8Entry(pid uint32, name string) windows.ProcessEntry32 {
	entry := windows.ProcessEntry32{Size: uint32(unsafe.Sizeof(windows.ProcessEntry32{})), ProcessID: pid}
	copy(entry.ExeFile[:], windows.StringToUTF16(name))
	return entry
}

func withR8NativeFixture(t *testing.T, fixture *r8NativeFixture) {
	t.Helper()
	previous := nativeProcessAPIs
	previousLegacyDiscovery := legacyPOSProcessDiscoveryOverride
	nativeProcessAPIs = fixture.boundary()
	legacyPOSProcessDiscoveryOverride = discoverLegacyPOSProcesses
	t.Cleanup(func() {
		nativeProcessAPIs = previous
		legacyPOSProcessDiscoveryOverride = previousLegacyDiscovery
	})
}

func TestR8NativeDiscoveryAccessDeniedFailsClosed(t *testing.T) {
	root := filepath.Join(t.TempDir(), "POS")
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(101, "renamed.exe")})
	fixture.openErrors[101] = errors.New("access denied")
	withR8NativeFixture(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(root)
	if err == nil || processes != nil {
		t.Fatalf("access denied discovery must be unknown/error, processes=%v err=%v", processes, err)
	}
}

func TestR8NativeDiscoveryQueryFailuresFailClosed(t *testing.T) {
	tests := []struct {
		name   string
		config func(*r8NativeFixture)
	}{
		{
			name: "image path",
			config: func(f *r8NativeFixture) {
				f.imageErrors[102] = errors.New("image path denied")
			},
		},
		{
			name: "identity",
			config: func(f *r8NativeFixture) {
				f.paths[103] = "C:\\POS\\Manus POS.exe"
				f.identityErrors[103] = errors.New("identity denied")
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			pid := uint32(102)
			if test.name == "identity" {
				pid = 103
			}
			fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(pid, "mismatched.exe")})
			test.config(fixture)
			withR8NativeFixture(t, fixture)
			processes, err := (nativePOSProcessOperations{}).Discover("C:\\POS")
			if err == nil || processes != nil {
				t.Fatalf("query failure must fail closed, processes=%v err=%v", processes, err)
			}
		})
	}
}

func TestR8NativeDiscoveryDisappearedPIDIsBenign(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(104, "gone.exe")})
	fixture.openErrors[104] = windows.ERROR_INVALID_PARAMETER
	withR8NativeFixture(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover("C:\\POS")
	if err != nil || len(processes) != 0 {
		t.Fatalf("definitively vanished PID should be benign, processes=%v err=%v", processes, err)
	}
}

func TestR8NativeDiscoveryOutOfScopeIdentityIsNotCandidate(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(105, "Electron Like.exe")})
	fixture.paths[105] = "C:\\Other\\Electron Like.exe"
	withR8NativeFixture(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover("C:\\POS")
	if err != nil || len(processes) != 0 {
		t.Fatalf("confirmed out-of-scope process should be skipped, processes=%v err=%v", processes, err)
	}
}

func TestR8NativeDiscoveryEmptyOrMissingRootDoesNotSuppressUnknownCandidate(t *testing.T) {
	for _, root := range []string{filepath.Join(t.TempDir(), "missing"), t.TempDir()} {
		fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(106, "deleted.exe")})
		fixture.openErrors[106] = errors.New("access denied")
		withR8NativeFixture(t, fixture)
		processes, err := (nativePOSProcessOperations{}).Discover(root)
		if err == nil || processes != nil {
			t.Fatalf("root %q allowed false zero: processes=%v err=%v", root, processes, err)
		}
	}
}

func TestR8NativeDiscoveryEnumerationFailureFailsClosed(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(107, "one.exe")})
	previous := nativeProcessAPIs
	previousLegacyDiscovery := legacyPOSProcessDiscoveryOverride
	api := fixture.boundary()
	api.processNext = func(windows.Handle, *windows.ProcessEntry32) error {
		return errors.New("snapshot enumeration interrupted")
	}
	nativeProcessAPIs = api
	legacyPOSProcessDiscoveryOverride = discoverLegacyPOSProcesses
	t.Cleanup(func() {
		nativeProcessAPIs = previous
		legacyPOSProcessDiscoveryOverride = previousLegacyDiscovery
	})

	processes, err := (nativePOSProcessOperations{}).Discover("C:\\POS")
	if err == nil || processes != nil {
		t.Fatalf("enumeration failure must fail closed, processes=%v err=%v", processes, err)
	}
}

func TestR8NativeFinalRescanFailureBlocksCleanup(t *testing.T) {
	root := filepath.Join(t.TempDir(), "POS")
	fixture := newR8NativeFixture(
		[]windows.ProcessEntry32{r8Entry(108, "Manus POS.exe")},
		[]windows.ProcessEntry32{r8Entry(109, "unknown.exe")},
	)
	fixture.paths[108] = filepath.Join(root, "Manus POS.exe")
	fixture.identities[108] = 1
	fixture.openErrors[109] = errors.New("final scan denied")
	withR8NativeFixture(t, fixture)

	if err := closeScopedPOSProcessesWith(root, nil, nativePOSProcessOperations{}); err == nil {
		t.Fatal("native final scan failure must block cleanup completion")
	}
}

func TestR8CleanupRegistryErrorsCannotComplete(t *testing.T) {
	tests := []struct {
		name string
		err  error
	}{
		{name: "service domain error", err: windows.ERROR_SERVICE_DOES_NOT_EXIST},
		{name: "generic registry error", err: errors.New("registry access denied")},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			root, data, install, pos, fixture := fakeCleanupFixture(t)
			fixture.deleteMetadataErr = test.err
			result, runErr := runFakeCleanup(t, fixture, root, data, install, pos, "r8-"+test.name, false)
			if runErr == nil || result.Outcome == uninstallComplete {
				t.Fatalf("registry error became success: result=%+v err=%v", result, runErr)
			}
			if !fixture.registryPresent || !result.RegistryKnown || !result.RegistryPresent {
				t.Fatalf("registry evidence was not retained: result=%+v present=%t", result, fixture.registryPresent)
			}
		})
	}
}
