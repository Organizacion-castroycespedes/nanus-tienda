//go:build windows

package main

import (
	"errors"
	"testing"

	"golang.org/x/sys/windows"
)

func withR10ProcessImageAPIs(t *testing.T, nativePath string, nativeErr error) {
	t.Helper()
	previous := processImagePathAPIs
	processImagePathAPIs = processImagePathAPIBoundary{
		queryFull: func(windows.Handle) (string, error) {
			return "", windows.ERROR_GEN_FAILURE
		},
		queryFullNative: func(windows.Handle) (string, error) {
			return ``, windows.ERROR_GEN_FAILURE
		},
		queryNative: func(windows.Handle) (string, error) {
			return nativePath, nativeErr
		},
		queryDosDevice: func(device string) (string, error) {
			if device == "C:" {
				return `\Device\HarddiskVolume3`, nil
			}
			return "", errors.New("unmapped drive")
		},
		windowsDirectory: func() (string, error) {
			return `C:\Windows`, nil
		},
	}
	t.Cleanup(func() { processImagePathAPIs = previous })
}

func withR10ProductionImageQuery(t *testing.T, fixture *r8NativeFixture) {
	t.Helper()
	previous := nativeProcessAPIs
	previousLegacyDiscovery := legacyPOSProcessDiscoveryOverride
	api := fixture.boundary()
	api.queryImagePath = processImagePath
	api.queryImagePathForRoot = processImagePathForRoot
	nativeProcessAPIs = api
	legacyPOSProcessDiscoveryOverride = discoverLegacyPOSProcesses
	t.Cleanup(func() {
		nativeProcessAPIs = previous
		legacyPOSProcessDiscoveryOverride = previousLegacyDiscovery
	})
}

func TestR10GetProcessImageFileNameZeroLengthSuccessIsFailure(t *testing.T) {
	previous := processImageFileNameAPI
	processImageFileNameAPI = processImageFileNameAPIBoundary{
		call: func(windows.Handle, *uint16, uint32) (uintptr, error) {
			return 0, windows.ERROR_SUCCESS
		},
	}
	t.Cleanup(func() { processImageFileNameAPI = previous })

	if _, err := queryNativeProcessImagePath(123); err == nil {
		t.Fatal(`zero-length image result with ERROR_SUCCESS must remain an observation error`)
	}
}

func TestR10NativeDiscoveryUsesOSBackedFallbackForKnownSystemPath(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(4, "System")})
	withR10ProcessImageAPIs(t, `\Device\HarddiskVolume3\Windows\System32\ntoskrnl.exe`, nil)
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err != nil || len(processes) != 0 {
		t.Fatalf("known out-of-scope system image should be excluded by verified path: processes=%v err=%v", processes, err)
	}
}

func TestR10NativeDiscoveryUsesNativeQueryFullBeforePSAPI(t *testing.T) {
	previous := processImagePathAPIs
	processImagePathAPIs = processImagePathAPIBoundary{
		queryFull: func(windows.Handle) (string, error) {
			return ``, windows.ERROR_GEN_FAILURE
		},
		queryFullNative: func(windows.Handle) (string, error) {
			return `\Device\HarddiskVolume3\Program Files\Manus\POS\Manus POS.exe`, nil
		},
		queryNative: func(windows.Handle) (string, error) {
			return ``, errors.New(`PSAPI should not be used when native QueryFull succeeds`)
		},
		queryDosDevice: func(device string) (string, error) {
			if device == `C:` {
				return `\Device\HarddiskVolume3`, nil
			}
			return ``, errors.New(`unmapped drive`)
		},
		windowsDirectory: func() (string, error) {
			return `C:\Windows`, nil
		},
	}
	t.Cleanup(func() { processImagePathAPIs = previous })

	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(2376, `Manus POS.exe`)})
	withR10ProductionImageQuery(t, fixture)
	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err != nil || len(processes) != 1 {
		t.Fatalf(`native QueryFull fallback should identify the scoped process: processes=%v err=%v`, processes, err)
	}
}

func TestR10NativeDiscoveryFallbackRecognizesScopedPOSPath(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(2376, "Manus POS.exe")})
	fixture.identities[2376] = 7
	withR10ProcessImageAPIs(t, `\Device\HarddiskVolume3\Program Files\Manus\POS\versions\0.1.0\Manus POS.exe`, nil)
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err != nil || len(processes) != 1 {
		t.Fatalf("verified scoped image must remain a cleanup candidate: processes=%v err=%v", processes, err)
	}
	if processes[0].path != `C:\Program Files\Manus\POS\versions\0.1.0\Manus POS.exe` {
		t.Fatalf("unexpected normalized scoped path: %q", processes[0].path)
	}
}

func TestR10NativeDiscoveryKeepsAmbiguousImageFailureFailClosed(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(124, "System")})
	withR10ProcessImageAPIs(t, "", errors.New("fallback image query denied"))
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err == nil || processes != nil {
		t.Fatalf("ambiguous image failure must not become known zero: processes=%v err=%v", processes, err)
	}
}

func TestR10NativeDiscoveryExcludesUnknownDifferentNativeDevice(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(2376, "System")})
	withR10ProcessImageAPIs(t, `\Device\UnknownVolume\Windows\System32\svchost.exe`, nil)
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err != nil || len(processes) != 0 {
		t.Fatalf("unmapped native path must remain unknown: processes=%v err=%v", processes, err)
	}
}

func TestR10NativeDiscoveryUsesManagedRootMapping(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(2376, "Manus POS.exe")})
	withR10ProcessImageAPIs(t, `\Device\HarddiskVolume3\Program Files\Manus\POS\Manus POS.exe`, nil)
	processImagePathAPIs.queryDosDevice = func(device string) (string, error) {
		if device == "C:" || device == "D:" {
			return `\Device\HarddiskVolume3`, nil
		}
		return "", errors.New("unmapped drive")
	}
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err != nil || len(processes) != 1 {
		t.Fatalf("ambiguous device mapping must remain unknown: processes=%v err=%v", processes, err)
	}
}

func TestR10NativeDiscoveryExcludesVerifiedDifferentNativeDevice(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(124, `System`)})
	withR10ProcessImageAPIs(t, `\Device\HarddiskVolume99\Windows\System32\svchost.exe`, nil)
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err != nil || len(processes) != 0 {
		t.Fatalf(`verified different device must be excluded without false scope: processes=%v err=%v`, processes, err)
	}
}

func TestR10NativeDiscoveryDoesNotIgnoreInaccessibleUserProcessByName(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(2376, `Electron Like.exe`)})
	fixture.openErrors[2376] = errors.New(`image access denied`)
	withR10ProcessImageAPIs(t, ``, errors.New(`not reached`))
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err == nil || processes != nil {
		t.Fatalf(`inaccessible user process must remain ambiguous: processes=%v err=%v`, processes, err)
	}
}

func TestR10NativeDiscoveryRejectsMalformedFallbackPath(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(2376, "System")})
	withR10ProcessImageAPIs(t, `relative\svchost.exe`, nil)
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err == nil || processes != nil {
		t.Fatalf("malformed fallback path must remain unknown: processes=%v err=%v", processes, err)
	}
}

func TestR10NativeDiscoveryNormalizesSystemRootFallback(t *testing.T) {
	fixture := newR8NativeFixture([]windows.ProcessEntry32{r8Entry(4, "System")})
	withR10ProcessImageAPIs(t, `\SystemRoot\System32\ntoskrnl.exe`, nil)
	withR10ProductionImageQuery(t, fixture)

	processes, err := (nativePOSProcessOperations{}).Discover(`C:\Program Files\Manus\POS`)
	if err != nil || len(processes) != 0 {
		t.Fatalf("SystemRoot fallback should prove out of scope: processes=%v err=%v", processes, err)
	}
}
