//go:build windows

package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

func TestMissingPOSJobIsNotOwnershipProof(t *testing.T) {
	root := filepath.Join(t.TempDir(), "POS")
	processes, owned, err := discoverPOSJobProcesses(root)
	if err != nil {
		t.Fatal(err)
	}
	if owned {
		t.Fatal("missing Job Object was reported as owned")
	}
	if processes != nil {
		t.Fatalf("missing Job Object returned process evidence: %v", processes)
	}
}

func TestMissingPOSJobBlocksGlobalFallbackAsLegacyUnownedScope(t *testing.T) {
	root := filepath.Join(t.TempDir(), "POS")
	processes, err := (nativePOSProcessOperations{}).Discover(root)
	if processes != nil {
		t.Fatalf("legacy unowned discovery returned process evidence: %v", processes)
	}
	var legacyErr *legacyUnownedScopeError
	if !errors.As(err, &legacyErr) {
		t.Fatalf("missing Job Object must produce legacy ownership error, processes=%v err=%v", processes, err)
	}
}

func TestPOSJobSecurityBoundaryDeniedAccessFailsClosed(t *testing.T) {
	previous := posJobSecurity
	posJobSecurity = posJobSecurityBoundary{
		Open: func(string, uint32) (windows.Handle, error) {
			return 0, windows.ERROR_ACCESS_DENIED
		},
		Query: queryPOSJobMembersNative,
	}
	t.Cleanup(func() { posJobSecurity = previous })

	_, owned, err := discoverPOSJobProcesses(filepath.Join(t.TempDir(), "POS"))
	if !owned || err == nil {
		t.Fatalf("denied Job Object access must remain an ownership observation error: owned=%t err=%v", owned, err)
	}
	var legacyErr *legacyUnownedScopeError
	if errors.As(err, &legacyErr) {
		t.Fatal("denied access to an existing Job Object must not be mislabeled as legacy unowned scope")
	}
}

func TestPOSJobSecurityBoundaryAllowedQueryPreservesOwnedScope(t *testing.T) {
	previous := posJobSecurity
	posJobSecurity = posJobSecurityBoundary{
		Open: func(root string, access uint32) (windows.Handle, error) {
			if access != posJobObjectQuery || root == "" {
				return 0, errors.New("unexpected Job Object access request")
			}
			return 0, nil
		},
		Query: func(windows.Handle) ([]uint32, error) { return nil, nil },
	}
	t.Cleanup(func() { posJobSecurity = previous })

	processes, owned, err := discoverPOSJobProcesses(filepath.Join(t.TempDir(), "POS"))
	if err != nil || !owned || len(processes) != 0 {
		t.Fatalf("allowed empty Job Object query lost ownership proof: processes=%v owned=%t err=%v", processes, owned, err)
	}
}

func TestPOSJobMembershipQueryFailureFailsClosed(t *testing.T) {
	previous := posJobSecurity
	posJobSecurity = posJobSecurityBoundary{
		Open:  func(string, uint32) (windows.Handle, error) { return 0, nil },
		Query: func(windows.Handle) ([]uint32, error) { return nil, errors.New("membership is ambiguous") },
	}
	t.Cleanup(func() { posJobSecurity = previous })

	processes, owned, err := discoverPOSJobProcesses(filepath.Join(t.TempDir(), "POS"))
	if err == nil || !owned || processes != nil {
		t.Fatalf("ambiguous membership must fail closed: processes=%v owned=%t err=%v", processes, owned, err)
	}
}

func TestPOSJobLauncherKeepsNoBreakawayAssignmentContract(t *testing.T) {
	source, err := os.ReadFile("pos_job_ownership_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, required := range []string{"windows.CREATE_SUSPENDED", "windows.AssignProcessToJobObject", "windows.ResumeThread", "windows.SetInformationJobObject"} {
		if !strings.Contains(text, required) {
			t.Fatalf("POS launcher contract missing %q", required)
		}
	}
	if strings.Contains(text, "windows.JOB_OBJECT_LIMIT_BREAKAWAY_OK") {
		t.Fatal("POS Job Object contract must not allow breakaway")
	}
}

func TestSupportedPOSLaunchUsesControlledLauncher(t *testing.T) {
	ui, err := os.ReadFile("productive_ui_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(ui), "explorer.exe") {
		t.Fatal("productive POS UI still contains a direct explorer.exe launch")
	}
	if !strings.Contains(string(ui), "launchManagedPOS(layout)") {
		t.Fatal("productive POS UI does not call the controlled launcher")
	}

	mainSource, err := os.ReadFile("main_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(mainSource)
	if !strings.Contains(source, "case \"launch-pos\", \"/launch-pos\":") {
		t.Fatal("launch-pos CLI dispatch is missing")
	}
	if !strings.Contains(source, "MANUS_POS_ARGS=launch-pos") {
		t.Fatal("POS shortcuts do not invoke launch-pos")
	}
	if strings.Contains(source, "MANUS_POS_TARGET=\"+layout.POSExecutable") || strings.Contains(source, "MANUS_POS_TARGET=layout.POSExecutable") {
		t.Fatal("POS shortcut must not target the raw POS executable")
	}
}

func TestRawPOSExecutableIsUnsupportedAndNotAnInstallerDispatch(t *testing.T) {
	mainSource, err := os.ReadFile("main_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	productiveUI, err := os.ReadFile("productive_ui_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	mainText := string(mainSource)
	uiText := string(productiveUI)
	if strings.Contains(mainText, "case \"Manus POS.exe\"") || strings.Contains(uiText, "Manus POS.exe") {
		t.Fatal("raw Manus POS.exe must not be an installer or UI dispatch command")
	}
	if !strings.Contains(mainText, "case \"launch-pos\", \"/launch-pos\":") || !strings.Contains(uiText, "launchManagedPOS(layout)") {
		t.Fatal("supported POS paths do not converge on the controlled launcher")
	}
}

func TestPOSOwnershipDoesNotTrustForgeableLaunchMarkers(t *testing.T) {
	source, err := os.ReadFile("pos_supervisor_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, marker := range []string{"MANUS_POS_AUTH", "MANUS_POS_SUPERVISOR", "--owned", "--supervised"} {
		if strings.Contains(text, marker) {
			t.Fatalf("ownership must not trust forgeable launch marker %q", marker)
		}
	}
	for _, required := range []string{"createOrOpenPOSJob", "launchPOSProcessInJob", "writePOSOwnershipJournal", "refusing adoption"} {
		if !strings.Contains(text, required) {
			t.Fatalf("supervisor lacks OS-backed ownership boundary %q", required)
		}
	}
}
