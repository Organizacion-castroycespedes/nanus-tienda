//go:build windows

package main

import (
	"errors"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

type fakeProcessObservation[T any] struct {
	value T
	err   error
}

type fakePOSProcessHandle struct {
	paths          []fakeProcessObservation[string]
	identities     []fakeProcessObservation[uint64]
	ownership      []fakeProcessObservation[bool]
	pathCalls      int
	identityCalls  int
	ownershipCalls int
	terminateErr   error
	waitExited     bool
	waitErr        error
	terminateCalls int
	waitCalls      int
	closeCalls     int
	closeErr       error
	termination    *fakePOSProcessHandle
	acquireErr     error
}

func nextFakeObservation[T any](observations []fakeProcessObservation[T], call *int) (T, error) {
	var zero T
	if len(observations) == 0 {
		return zero, errors.New("missing fake observation")
	}
	index := *call
	*call = *call + 1
	if index >= len(observations) {
		index = len(observations) - 1
	}
	return observations[index].value, observations[index].err
}

func (handle *fakePOSProcessHandle) ImagePath() (string, error) {
	return nextFakeObservation(handle.paths, &handle.pathCalls)
}

func (handle *fakePOSProcessHandle) Identity() (uint64, error) {
	return nextFakeObservation(handle.identities, &handle.identityCalls)
}

func (handle *fakePOSProcessHandle) ProveOwnership(string, string, uint64) (bool, error) {
	return nextFakeObservation(handle.ownership, &handle.ownershipCalls)
}

func (handle *fakePOSProcessHandle) Terminate() error {
	handle.terminateCalls++
	return handle.terminateErr
}

func (handle *fakePOSProcessHandle) Wait(time.Duration) (bool, error) {
	handle.waitCalls++
	return handle.waitExited, handle.waitErr
}

func (handle *fakePOSProcessHandle) Close() error {
	handle.closeCalls++
	return handle.closeErr
}

type fakePOSDiscovery struct {
	results      [][]scopedPOSProcess
	errors       []error
	calls        int
	acquireCalls int
}

func (discovery *fakePOSDiscovery) Discover(string) ([]scopedPOSProcess, error) {
	index := discovery.calls
	discovery.calls++
	if index < len(discovery.errors) && discovery.errors[index] != nil {
		return nil, discovery.errors[index]
	}
	if index >= len(discovery.results) {
		return nil, nil
	}
	return append([]scopedPOSProcess(nil), discovery.results[index]...), nil
}

func (discovery *fakePOSDiscovery) AcquireTermination(process scopedPOSProcess) (scopedPOSTerminationHandle, error) {
	discovery.acquireCalls++
	handle, ok := process.handle.(*fakePOSProcessHandle)
	if !ok || handle == nil {
		return nil, errors.New("missing fake observation handle")
	}
	if handle.acquireErr != nil {
		return nil, handle.acquireErr
	}
	if handle.termination == nil {
		return nil, errors.New("missing fake termination handle")
	}
	return handle.termination, nil
}

func managedFakeProcess(pid uint32, handle *fakePOSProcessHandle) scopedPOSProcess {
	return scopedPOSProcess{
		pid:      pid,
		path:     `C:\POS\versions\1\Manus POS.exe`,
		identity: 100,
		class:    posProcessManaged,
		handle:   handle,
	}
}

func managedFakeHandle() *fakePOSProcessHandle {
	termination := &fakePOSProcessHandle{
		paths:      []fakeProcessObservation[string]{{value: `C:\POS\versions\1\Manus POS.exe`}},
		identities: []fakeProcessObservation[uint64]{{value: 100}},
		ownership:  []fakeProcessObservation[bool]{{value: true}},
		waitExited: true,
	}
	return &fakePOSProcessHandle{
		paths:       []fakeProcessObservation[string]{{value: `C:\POS\versions\1\Manus POS.exe`}},
		identities:  []fakeProcessObservation[uint64]{{value: 100}},
		ownership:   []fakeProcessObservation[bool]{{value: true}},
		termination: termination,
	}
}

func requireNoDestructiveCalls(t *testing.T, handle *fakePOSProcessHandle) {
	t.Helper()
	terminationCalls, waitCalls := handle.terminateCalls, handle.waitCalls
	if handle.termination != nil {
		terminationCalls += handle.termination.terminateCalls
		waitCalls += handle.termination.waitCalls
	}
	if terminationCalls != 0 || waitCalls != 0 {
		t.Fatalf("destructive calls: terminate=%d wait=%d", terminationCalls, waitCalls)
	}
}

func TestHUWIN002BManagedOwnershipUsesRetainedHandle(t *testing.T) {
	handle := managedFakeHandle()
	discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{{managedFakeProcess(10, handle)}, {}}}
	if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err != nil {
		t.Fatalf("managed cleanup failed: %v", err)
	}
	if handle.terminateCalls != 0 || handle.waitCalls != 0 {
		t.Fatalf("observation handle used destructively: terminate=%d wait=%d", handle.terminateCalls, handle.waitCalls)
	}
	if handle.termination.terminateCalls != 1 || handle.termination.waitCalls != 1 {
		t.Fatalf("termination handle calls: terminate=%d wait=%d", handle.termination.terminateCalls, handle.termination.waitCalls)
	}
	if handle.closeCalls != 1 || handle.termination.closeCalls != 1 {
		t.Fatalf("retained handle close counts observation=%d termination=%d, want 1 each", handle.closeCalls, handle.termination.closeCalls)
	}
	if discovery.calls != 2 || discovery.acquireCalls != 1 {
		t.Fatalf("discovery calls=%d acquire calls=%d", discovery.calls, discovery.acquireCalls)
	}
}

func TestHUWIN002BLegacyForeignAndUnknownNeverTerminate(t *testing.T) {
	cases := []struct {
		name      string
		class     posProcessClass
		wantError bool
	}{
		{name: "legacy", class: posProcessLegacy, wantError: true},
		{name: "foreign", class: posProcessForeign, wantError: false},
		{name: "unknown", class: posProcessUnknown, wantError: true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			handle := managedFakeHandle()
			process := managedFakeProcess(20, handle)
			process.class = testCase.class
			discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{{process}, {}}}
			err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery)
			if (err != nil) != testCase.wantError {
				t.Fatalf("error=%v, wantError=%v", err, testCase.wantError)
			}
			requireNoDestructiveCalls(t, handle)
			if handle.closeCalls != 1 {
				t.Fatalf("close count=%d, want 1", handle.closeCalls)
			}
		})
	}
}

func TestHUWIN002BLegacyReturnsReasonCodeAndNoFalseCompletion(t *testing.T) {
	handle := managedFakeHandle()
	process := managedFakeProcess(21, handle)
	process.class = posProcessLegacy
	err := closeScopedPOSProcessesWith(`C:\POS`, nil, &fakePOSDiscovery{results: [][]scopedPOSProcess{{process}}})
	if !errors.Is(err, errLegacyUnownedPOSScope) {
		t.Fatalf("error=%v, want legacy_unowned_scope", err)
	}
	requireNoDestructiveCalls(t, handle)
}

func TestHUWIN002BIdentityAndImageChangesFailClosed(t *testing.T) {
	cases := []struct {
		name     string
		path     string
		identity uint64
	}{
		{name: "PID reused with new creation identity", path: `C:\POS\versions\1\Manus POS.exe`, identity: 101},
		{name: "image changed outside root", path: `C:\Other\electron.exe`, identity: 100},
		{name: "image changed inside root", path: `C:\POS\versions\1\other.exe`, identity: 100},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			handle := managedFakeHandle()
			handle.paths = []fakeProcessObservation[string]{{value: testCase.path}}
			handle.identities = []fakeProcessObservation[uint64]{{value: testCase.identity}}
			discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{{managedFakeProcess(30, handle)}}}
			if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err == nil {
				t.Fatal("changed identity must block cleanup")
			}
			requireNoDestructiveCalls(t, handle)
		})
	}
}

func TestHUWIN002BObservationFailuresFailClosed(t *testing.T) {
	cases := []struct {
		name      string
		configure func(*fakePOSProcessHandle)
	}{
		{name: "QueryFullProcessImageName failed", configure: func(handle *fakePOSProcessHandle) {
			handle.paths = []fakeProcessObservation[string]{{err: errors.New("image denied")}}
		}},
		{name: "GetProcessTimes failed", configure: func(handle *fakePOSProcessHandle) {
			handle.identities = []fakeProcessObservation[uint64]{{err: errors.New("times denied")}}
		}},
		{name: "ownership unknown", configure: func(handle *fakePOSProcessHandle) {
			handle.ownership = []fakeProcessObservation[bool]{{err: errors.New("job query denied")}}
		}},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			handle := managedFakeHandle()
			testCase.configure(handle)
			err := closeScopedPOSProcessesWith(`C:\POS`, nil, &fakePOSDiscovery{results: [][]scopedPOSProcess{{managedFakeProcess(40, handle)}}})
			if err == nil {
				t.Fatal("incomplete observation must block cleanup")
			}
			requireNoDestructiveCalls(t, handle)
		})
	}
}

func TestHUWIN002BDemonstrablyVanishedProcessIsBenign(t *testing.T) {
	handle := managedFakeHandle()
	handle.paths = []fakeProcessObservation[string]{{err: errPOSProcessGone}}
	discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{{managedFakeProcess(50, handle)}, {}}}
	if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err != nil {
		t.Fatalf("vanished process should be benign: %v", err)
	}
	requireNoDestructiveCalls(t, handle)
}

func TestHUWIN002BTerminationAndWaitFailuresRemainErrors(t *testing.T) {
	cases := []struct {
		name      string
		configure func(*fakePOSProcessHandle)
	}{
		{name: "TerminateProcess rejected", configure: func(handle *fakePOSProcessHandle) {
			handle.termination.terminateErr = errors.New("access denied")
		}},
		{name: "bounded wait timeout", configure: func(handle *fakePOSProcessHandle) {
			handle.termination.waitExited = false
		}},
		{name: "unexpected wait result", configure: func(handle *fakePOSProcessHandle) {
			handle.termination.waitErr = errors.New("unexpected process wait result 7")
		}},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			handle := managedFakeHandle()
			testCase.configure(handle)
			discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{{managedFakeProcess(60, handle)}, {}}}
			if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err == nil {
				t.Fatal("termination/wait failure must fail cleanup")
			}
			if handle.closeCalls != 1 || handle.termination.closeCalls != 1 {
				t.Fatalf("close counts observation=%d termination=%d, want 1 each", handle.closeCalls, handle.termination.closeCalls)
			}
		})
	}
}

func TestHUWIN002BFinalScanFailureAndRemainingProcessBlockCompletion(t *testing.T) {
	t.Run("scan error", func(t *testing.T) {
		handle := managedFakeHandle()
		discovery := &fakePOSDiscovery{
			results: [][]scopedPOSProcess{{managedFakeProcess(70, handle)}},
			errors:  []error{nil, errors.New("enumeration interrupted")},
		}
		if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err == nil {
			t.Fatal("failed final scan must block completion")
		}
	})

	t.Run("remaining process", func(t *testing.T) {
		initial := managedFakeHandle()
		remaining := managedFakeHandle()
		discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{
			{managedFakeProcess(71, initial)},
			{managedFakeProcess(72, remaining)},
		}}
		if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err == nil {
			t.Fatal("remaining process must block completion")
		}
		if initial.closeCalls != 1 || initial.termination.closeCalls != 1 || remaining.closeCalls != 1 {
			t.Fatalf("close counts initial observation=%d termination=%d remaining=%d", initial.closeCalls, initial.termination.closeCalls, remaining.closeCalls)
		}
	})
}

func TestHUWIN002BInitialDiscoveryErrorsAreNotKnownZero(t *testing.T) {
	for _, name := range []string{"access denied", "enumeration incomplete"} {
		t.Run(name, func(t *testing.T) {
			discovery := &fakePOSDiscovery{errors: []error{errors.New(name)}}
			if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err == nil {
				t.Fatal("incomplete discovery must not be interpreted as zero processes")
			}
		})
	}
}

func TestHUWIN002BNativeDiscoverySeamNeverUsesRealProcesses(t *testing.T) {
	t.Run("production ownership default is fail closed", func(t *testing.T) {
		owned, err := newNativePOSProcessOperations().api.proveOwnership(0, 1, `C:\POS`, `C:\POS\Manus POS.exe`, 1)
		if err != nil || owned {
			t.Fatalf("default ownership owned=%v error=%v", owned, err)
		}
	})

	t.Run("foreign process is observed and closed", func(t *testing.T) {
		closeCalls := 0
		terminateCalls := 0
		var requestedAccess uint32
		operations := &nativePOSProcessOperations{api: nativeProcessAPIBoundary{
			openProcess: func(access uint32, inherit bool, pid uint32) (windows.Handle, error) {
				requestedAccess = access
				if inherit || pid != 80 {
					t.Fatalf("unexpected open request inherit=%v pid=%d", inherit, pid)
				}
				return windows.Handle(101), nil
			},
			queryImagePath: func(windows.Handle) (string, error) { return `C:\Other\foreign.exe`, nil },
			queryIdentity:  func(windows.Handle) (uint64, error) { return 1, nil },
			proveOwnership: func(windows.Handle, uint32, string, string, uint64) (bool, error) { return false, nil },
			terminateProcess: func(windows.Handle) error {
				terminateCalls++
				return nil
			},
			closeHandle: func(windows.Handle) error { closeCalls++; return nil },
		}}
		_, include, err := operations.observe(80, `C:\POS`)
		if err != nil || include {
			t.Fatalf("foreign observation include=%v error=%v", include, err)
		}
		if closeCalls != 1 || terminateCalls != 0 {
			t.Fatalf("close=%d terminate=%d", closeCalls, terminateCalls)
		}
		if requestedAccess != windows.PROCESS_QUERY_LIMITED_INFORMATION {
			t.Fatalf("foreign observation access=%#x, want query-only %#x", requestedAccess, uint32(windows.PROCESS_QUERY_LIMITED_INFORMATION))
		}
	})

	t.Run("interrupted enumeration closes retained handles", func(t *testing.T) {
		processCloseCalls := 0
		snapshotCloseCalls := 0
		terminateCalls := 0
		operations := &nativePOSProcessOperations{api: nativeProcessAPIBoundary{
			createSnapshot: func() (windows.Handle, error) { return windows.Handle(201), nil },
			closeHandle: func(handle windows.Handle) error {
				if handle == windows.Handle(201) {
					snapshotCloseCalls++
				} else {
					processCloseCalls++
				}
				return nil
			},
			processFirst: func(_ windows.Handle, entry *windows.ProcessEntry32) error {
				entry.ProcessID = 90
				return nil
			},
			processNext:    func(windows.Handle, *windows.ProcessEntry32) error { return errors.New("enumeration interrupted") },
			openProcess:    func(uint32, bool, uint32) (windows.Handle, error) { return windows.Handle(202), nil },
			queryImagePath: func(windows.Handle) (string, error) { return `C:\POS\Manus POS.exe`, nil },
			queryIdentity:  func(windows.Handle) (uint64, error) { return 1, nil },
			proveOwnership: func(windows.Handle, uint32, string, string, uint64) (bool, error) { return false, nil },
			terminateProcess: func(windows.Handle) error {
				terminateCalls++
				return nil
			},
		}}
		if _, err := operations.Discover(`C:\POS`); err == nil {
			t.Fatal("interrupted enumeration must fail")
		}
		if processCloseCalls != 1 || snapshotCloseCalls != 1 || terminateCalls != 0 {
			t.Fatalf("processClose=%d snapshotClose=%d terminate=%d", processCloseCalls, snapshotCloseCalls, terminateCalls)
		}
	})

	t.Run("access denied is unknown", func(t *testing.T) {
		var requestedAccess uint32
		operations := &nativePOSProcessOperations{api: nativeProcessAPIBoundary{
			openProcess: func(access uint32, _ bool, _ uint32) (windows.Handle, error) {
				requestedAccess = access
				return 0, windows.ERROR_ACCESS_DENIED
			},
		}}
		_, _, err := operations.observe(81, `C:\POS`)
		if err == nil || !errors.Is(err, windows.ERROR_ACCESS_DENIED) {
			t.Fatalf("access denial must propagate: %v", err)
		}
		if requestedAccess != windows.PROCESS_QUERY_LIMITED_INFORMATION {
			t.Fatalf("denied foreign observation access=%#x, want query-only", requestedAccess)
		}
	})

	t.Run("image and creation failures close once", func(t *testing.T) {
		for _, testCase := range []struct {
			name     string
			imageErr error
			timeErr  error
		}{
			{name: "image", imageErr: errors.New("image failure")},
			{name: "creation", timeErr: errors.New("creation failure")},
		} {
			t.Run(testCase.name, func(t *testing.T) {
				closeCalls := 0
				operations := &nativePOSProcessOperations{api: nativeProcessAPIBoundary{
					openProcess:    func(uint32, bool, uint32) (windows.Handle, error) { return windows.Handle(102), nil },
					queryImagePath: func(windows.Handle) (string, error) { return `C:\POS\Manus POS.exe`, testCase.imageErr },
					queryIdentity:  func(windows.Handle) (uint64, error) { return 1, testCase.timeErr },
					proveOwnership: func(windows.Handle, uint32, string, string, uint64) (bool, error) { return false, nil },
					closeHandle:    func(windows.Handle) error { closeCalls++; return nil },
				}}
				_, _, err := operations.observe(82, `C:\POS`)
				if err == nil {
					t.Fatal("observation failure must propagate")
				}
				if closeCalls != 1 {
					t.Fatalf("close count=%d, want 1", closeCalls)
				}
			})
		}
	})
}

func TestHUWIN002BR1NativeObservationAndTerminationRightsAreSeparated(t *testing.T) {
	var masks []uint32
	snapshotCalls := 0
	firstCalls := 0
	closeCalls := map[windows.Handle]int{}
	terminateCalls := 0
	waitCalls := 0
	operations := &nativePOSProcessOperations{api: nativeProcessAPIBoundary{
		createSnapshot: func() (windows.Handle, error) {
			snapshotCalls++
			return windows.Handle(200 + snapshotCalls), nil
		},
		closeHandle: func(handle windows.Handle) error {
			closeCalls[handle]++
			return nil
		},
		processFirst: func(_ windows.Handle, entry *windows.ProcessEntry32) error {
			firstCalls++
			if firstCalls == 2 {
				return windows.ERROR_NO_MORE_FILES
			}
			entry.ProcessID = 501
			return nil
		},
		processNext: func(windows.Handle, *windows.ProcessEntry32) error { return windows.ERROR_NO_MORE_FILES },
		openProcess: func(access uint32, inherit bool, pid uint32) (windows.Handle, error) {
			if inherit || pid != 501 {
				t.Fatalf("unexpected OpenProcess inherit=%v pid=%d", inherit, pid)
			}
			masks = append(masks, access)
			if len(masks) == 1 {
				return windows.Handle(301), nil
			}
			return windows.Handle(302), nil
		},
		queryImagePath: func(windows.Handle) (string, error) {
			return `C:\POS\versions\1\Manus POS.exe`, nil
		},
		queryIdentity:  func(windows.Handle) (uint64, error) { return 9001, nil },
		proveOwnership: func(windows.Handle, uint32, string, string, uint64) (bool, error) { return true, nil },
		terminateProcess: func(handle windows.Handle) error {
			terminateCalls++
			if handle != windows.Handle(302) {
				t.Fatalf("TerminateProcess handle=%d, want destructive handle 302", handle)
			}
			return nil
		},
		waitForSingleObject: func(handle windows.Handle, _ time.Duration) (bool, error) {
			waitCalls++
			if handle != windows.Handle(302) {
				t.Fatalf("Wait handle=%d, want destructive handle 302", handle)
			}
			return true, nil
		},
	}}
	if err := closeScopedPOSProcessesWith(`C:\POS`, nil, operations); err != nil {
		t.Fatalf("separated native cleanup failed: %v", err)
	}
	wantTermination := uint32(windows.PROCESS_QUERY_LIMITED_INFORMATION | windows.PROCESS_TERMINATE | windows.SYNCHRONIZE)
	if len(masks) != 2 || masks[0] != windows.PROCESS_QUERY_LIMITED_INFORMATION || masks[1] != wantTermination {
		t.Fatalf("OpenProcess masks=%#v, want query-only then %#x", masks, wantTermination)
	}
	if terminateCalls != 1 || waitCalls != 1 {
		t.Fatalf("terminate=%d wait=%d", terminateCalls, waitCalls)
	}
	for _, handle := range []windows.Handle{201, 202, 301, 302} {
		if closeCalls[handle] != 1 {
			t.Fatalf("handle %d close count=%d, want 1", handle, closeCalls[handle])
		}
	}
}

func TestHUWIN002BR1BaselineNegativeOwnershipNeverAcquiresTerminationRights(t *testing.T) {
	handle := managedFakeHandle()
	process := managedFakeProcess(510, handle)
	process.class = posProcessLegacy
	discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{{process}}}
	err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery)
	if !errors.Is(err, errLegacyUnownedPOSScope) {
		t.Fatalf("error=%v, want legacy_unowned_scope", err)
	}
	if discovery.acquireCalls != 0 {
		t.Fatalf("termination acquisition calls=%d, want 0", discovery.acquireCalls)
	}
	requireNoDestructiveCalls(t, handle)
}

func TestHUWIN002BR1IdentityChangesDuringHandleTransitionFailClosed(t *testing.T) {
	for _, testCase := range []struct {
		name      string
		configure func(*fakePOSProcessHandle)
	}{
		{name: "PID reused with different creation identity", configure: func(handle *fakePOSProcessHandle) {
			handle.termination.identities = []fakeProcessObservation[uint64]{{value: 9002}}
		}},
		{name: "image changed on destructive handle", configure: func(handle *fakePOSProcessHandle) {
			handle.termination.paths = []fakeProcessObservation[string]{{value: `C:\POS\versions\1\other.exe`}}
		}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			observation := managedFakeHandle()
			testCase.configure(observation)
			discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{{managedFakeProcess(520, observation)}}}
			if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err == nil {
				t.Fatal("identity change during handle transition must block cleanup")
			}
			requireNoDestructiveCalls(t, observation)
			if observation.closeCalls != 1 || observation.termination.closeCalls != 1 {
				t.Fatalf("close counts observation=%d termination=%d", observation.closeCalls, observation.termination.closeCalls)
			}
		})
	}
}

func TestHUWIN002BR1TerminationHandleObservationFailuresFailClosed(t *testing.T) {
	for _, testCase := range []struct {
		name      string
		configure func(*fakePOSProcessHandle)
	}{
		{name: "OpenProcess denied", configure: func(handle *fakePOSProcessHandle) {
			handle.acquireErr = windows.ERROR_ACCESS_DENIED
		}},
		{name: "QueryFullProcessImageName failed", configure: func(handle *fakePOSProcessHandle) {
			handle.termination.paths = []fakeProcessObservation[string]{{err: errors.New("image denied")}}
		}},
		{name: "GetProcessTimes failed", configure: func(handle *fakePOSProcessHandle) {
			handle.termination.identities = []fakeProcessObservation[uint64]{{err: errors.New("times denied")}}
		}},
		{name: "ownership changed", configure: func(handle *fakePOSProcessHandle) {
			handle.termination.ownership = []fakeProcessObservation[bool]{{value: false}}
		}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			handle := managedFakeHandle()
			testCase.configure(handle)
			discovery := &fakePOSDiscovery{results: [][]scopedPOSProcess{{managedFakeProcess(530, handle)}}}
			if err := closeScopedPOSProcessesWith(`C:\POS`, nil, discovery); err == nil {
				t.Fatal("incomplete destructive authorization must block cleanup")
			}
			requireNoDestructiveCalls(t, handle)
		})
	}
}

func TestHUWIN002BR1CloseFailuresPreservePrimaryErrors(t *testing.T) {
	t.Run("native observation", func(t *testing.T) {
		primaryErr := errors.New("image observation failed")
		closeErr := errors.New("observation close failed")
		operations := &nativePOSProcessOperations{api: nativeProcessAPIBoundary{
			openProcess:    func(uint32, bool, uint32) (windows.Handle, error) { return windows.Handle(601), nil },
			queryImagePath: func(windows.Handle) (string, error) { return "", primaryErr },
			closeHandle:    func(windows.Handle) error { return closeErr },
		}}
		_, _, err := operations.observe(601, `C:\POS`)
		if !errors.Is(err, primaryErr) || !errors.Is(err, closeErr) {
			t.Fatalf("joined error=%v, want primary and close errors", err)
		}
	})

	t.Run("cleanup result", func(t *testing.T) {
		closeErr := errors.New("retained close failed")
		handle := managedFakeHandle()
		handle.closeErr = closeErr
		process := managedFakeProcess(602, handle)
		process.class = posProcessLegacy
		err := closeScopedPOSProcessesWith(`C:\POS`, nil, &fakePOSDiscovery{results: [][]scopedPOSProcess{{process}}})
		if !errors.Is(err, errLegacyUnownedPOSScope) || !errors.Is(err, closeErr) {
			t.Fatalf("joined error=%v, want legacy and close errors", err)
		}
	})
}

func TestHUWIN002BPublicCleanupSignatureRemainsCompatible(t *testing.T) {
	var cleanup func(string, *installLogger) error = closeScopedPOSProcesses
	if cleanup == nil {
		t.Fatal("cleanup function is nil")
	}
}
