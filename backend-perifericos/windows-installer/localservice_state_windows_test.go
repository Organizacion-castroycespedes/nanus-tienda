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

func TestDeriveLocalServiceAgentDataRootRequiresExactWindowsProfile(t *testing.T) {
	got, err := deriveLocalServiceAgentDataRoot(`C:\Windows\ServiceProfiles\LocalService`, `C:\Windows`)
	if err != nil || got != `C:\Windows\ServiceProfiles\LocalService\AppData\Local\Manus\PeripheralAgent` {
		t.Fatalf("LocalService Agent root = %q err=%v", got, err)
	}
	for _, malicious := range []string{"", `C:\`, `C:\Windows\System32`, `C:\Users\Other`, `C:\Windows\ServiceProfiles\LocalService\..\NetworkService`} {
		if _, err := deriveLocalServiceAgentDataRoot(malicious, `C:\Windows`); err == nil {
			t.Fatalf("unexpected LocalService profile accepted: %q", malicious)
		}
	}
}

func TestExpandLocalServiceProfilePathUsesWindowsAPIRoot(t *testing.T) {
	got := expandLocalServiceProfilePath(`%SystemRoot%\ServiceProfiles\LocalService`, `C:\Windows`)
	if got != `C:\Windows\ServiceProfiles\LocalService` {
		t.Fatalf("expanded profile = %q", got)
	}
	if got := expandLocalServiceProfilePath(`%UnexpectedVariable%\ServiceProfiles\LocalService`, `C:\Windows`); filepath.IsAbs(got) {
		t.Fatalf("unexpected environment variable must not resolve to an absolute path: %q", got)
	}
}

func TestRemoveExactAgentDataRootIsIdempotentAndPreservesParentAndSibling(t *testing.T) {
	root := t.TempDir()
	manusRoot := filepath.Join(root, "LocalService", "AppData", "Local", "Manus")
	target := filepath.Join(manusRoot, "PeripheralAgent")
	sibling := filepath.Join(manusRoot, "OtherComponent")
	if err := os.MkdirAll(filepath.Join(target, "state"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(sibling, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(target, "state", "device-registry.state.json"), []byte("fixture"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := removeExactAgentDataRoot(target, target); err != nil {
		t.Fatal(err)
	}
	if exists(target) || !exists(manusRoot) || !exists(sibling) {
		t.Fatalf("target=%v parent=%v sibling=%v", exists(target), exists(manusRoot), exists(sibling))
	}
	if err := removeExactAgentDataRoot(target, target); err != nil {
		t.Fatalf("missing target must be idempotent: %v", err)
	}
}

func TestRemoveExactAgentDataRootRejectsUnexpectedTargets(t *testing.T) {
	root := t.TempDir()
	expected := filepath.Join(root, "Manus", "PeripheralAgent")
	for _, target := range []string{root, filepath.Join(root, "Manus"), filepath.Join(root, "Other", "PeripheralAgent"), filepath.Join(root, "Manus", "PeripheralAgent", "..")} {
		if err := removeExactAgentDataRoot(target, expected); err == nil {
			t.Fatalf("unexpected target accepted: %q", target)
		}
	}
}

func TestRemoveExactAgentDataRootRejectsReparsePoint(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "Manus", "PeripheralAgent")
	outside := filepath.Join(root, "outside")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(target, "escape")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlink fixture requires Windows developer mode or elevation: %v", err)
	}
	if err := removeExactAgentDataRoot(target, target); err == nil || !strings.Contains(strings.ToLower(err.Error()), "reparse") {
		t.Fatalf("reparse point was not rejected: %v", err)
	}
	if !exists(outside) {
		t.Fatal("outside target was removed")
	}
}

func TestRemoveExactAgentDataRootRejectsReparsePointsInEveryAncestor(t *testing.T) {
	root := t.TempDir()
	profileRoot := filepath.Join(root, "ServiceProfiles", "LocalService")
	target := filepath.Join(profileRoot, "AppData", "Local", "Manus", "PeripheralAgent")
	outside := filepath.Join(root, "outside")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	sentinel := filepath.Join(outside, "must-survive.txt")
	if err := os.WriteFile(sentinel, []byte("outside"), 0o600); err != nil {
		t.Fatal(err)
	}

	ancestors := []struct {
		name string
		path string
	}{
		{name: "target", path: target},
		{name: "Manus", path: filepath.Dir(target)},
		{name: "Local", path: filepath.Dir(filepath.Dir(target))},
		{name: "AppData", path: filepath.Dir(filepath.Dir(filepath.Dir(target)))},
		{name: "LocalService profile", path: profileRoot},
	}
	originalAttributes := readManagedPathAttributes
	originalRemove := removeManagedDataTree
	t.Cleanup(func() {
		readManagedPathAttributes = originalAttributes
		removeManagedDataTree = originalRemove
	})

	for _, ancestor := range ancestors {
		t.Run(ancestor.name, func(t *testing.T) {
			attributesPath := filepath.Clean(ancestor.path)
			readManagedPathAttributes = func(path string) (uint32, error) {
				if strings.EqualFold(filepath.Clean(path), attributesPath) {
					return windows.FILE_ATTRIBUTE_REPARSE_POINT, nil
				}
				return originalAttributes(path)
			}
			removeCalled := false
			removeManagedDataTree = func(string) error {
				removeCalled = true
				return nil
			}

			err := removeExactAgentDataRoot(target, target)
			if err == nil || !strings.Contains(strings.ToLower(err.Error()), "reparse") {
				t.Fatalf("reparse ancestor was not rejected: %v", err)
			}
			if removeCalled || !exists(target) || !exists(sentinel) {
				t.Fatalf("unsafe deletion attempted: removeCalled=%v targetExists=%v outsideSentinelExists=%v", removeCalled, exists(target), exists(sentinel))
			}
		})
	}
}

func TestRemoveExactAgentDataRootPropagatesDeletionFailure(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "Manus", "PeripheralAgent")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	originalRemove := removeManagedDataTree
	originalRepair := repairManagedDataRemovalPermissions
	t.Cleanup(func() {
		removeManagedDataTree = originalRemove
		repairManagedDataRemovalPermissions = originalRepair
	})
	removeManagedDataTree = func(string) error { return errors.New("access denied") }
	repairManagedDataRemovalPermissions = func(string) error { return errors.New("ACL repair failed") }
	if err := removeExactAgentDataRoot(target, target); err == nil || !strings.Contains(err.Error(), "ACL repair failed") {
		t.Fatalf("deletion failure was hidden: %v", err)
	}
}

func TestRemoveExactAgentDataRootRepairsAccessBeforeRetry(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "Manus", "PeripheralAgent")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	originalRemove := removeManagedDataTree
	originalRepair := repairManagedDataRemovalPermissions
	t.Cleanup(func() {
		removeManagedDataTree = originalRemove
		repairManagedDataRemovalPermissions = originalRepair
	})
	attempts := 0
	removeManagedDataTree = func(path string) error {
		attempts++
		if attempts == 1 {
			return errors.New("access denied")
		}
		return os.RemoveAll(path)
	}
	repaired := false
	repairManagedDataRemovalPermissions = func(path string) error {
		repaired = path == target
		return nil
	}
	if err := removeExactAgentDataRoot(target, target); err != nil {
		t.Fatal(err)
	}
	if !repaired || attempts != 2 || exists(target) {
		t.Fatalf("repaired=%v attempts=%d target=%v", repaired, attempts, exists(target))
	}
}

func TestRemoveRequestedAgentDataRemovesOnlyBothManagedRoots(t *testing.T) {
	root := t.TempDir()
	windowsRoot := filepath.Join(root, "Windows")
	profileRoot := filepath.Join(windowsRoot, "ServiceProfiles", "LocalService")
	programDataBase := filepath.Join(root, "ProgramData")
	localServiceAgentRoot := filepath.Join(profileRoot, "AppData", "Local", "Manus", "PeripheralAgent")
	programDataAgentRoot := filepath.Join(programDataBase, "Manus", "PeripheralAgent")
	localSibling := filepath.Join(profileRoot, "AppData", "Local", "Manus", "OtherComponent")
	programDataSibling := filepath.Join(programDataBase, "Manus", "OtherComponent")
	for _, path := range []string{localServiceAgentRoot, programDataAgentRoot, localSibling, programDataSibling} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	oldIdentity := []byte("opaque-old-installation-identity")
	if err := os.WriteFile(filepath.Join(localServiceAgentRoot, "agent-installation-id"), oldIdentity, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(localServiceAgentRoot, "device-registry.state.json"), []byte("old-config"), 0o600); err != nil {
		t.Fatal(err)
	}
	originalRead := readLocalServiceProfilePath
	originalWindowsRoot := resolveWindowsRoot
	originalProgramData := os.Getenv("ProgramData")
	t.Cleanup(func() {
		readLocalServiceProfilePath = originalRead
		resolveWindowsRoot = originalWindowsRoot
		_ = os.Setenv("ProgramData", originalProgramData)
	})
	readLocalServiceProfilePath = func() (string, error) { return profileRoot, nil }
	resolveWindowsRoot = func() (string, error) { return windowsRoot, nil }
	if err := os.Setenv("ProgramData", programDataBase); err != nil {
		t.Fatal(err)
	}
	if err := removeRequestedAgentData(programDataAgentRoot); err != nil {
		t.Fatal(err)
	}
	if exists(localServiceAgentRoot) || exists(programDataAgentRoot) || !exists(localSibling) || !exists(programDataSibling) {
		t.Fatalf("LocalService=%v ProgramData=%v localSibling=%v programDataSibling=%v", exists(localServiceAgentRoot), exists(programDataAgentRoot), exists(localSibling), exists(programDataSibling))
	}
	if err := os.MkdirAll(localServiceAgentRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	newIdentity := []byte("opaque-new-installation-identity")
	if string(oldIdentity) == string(newIdentity) {
		t.Fatal("test fixture identities must differ")
	}
	if err := os.WriteFile(filepath.Join(localServiceAgentRoot, "agent-installation-id"), newIdentity, 0o600); err != nil {
		t.Fatal(err)
	}
	if exists(filepath.Join(localServiceAgentRoot, "device-registry.state.json")) {
		t.Fatal("old device registry resurrected")
	}
}

func TestNormalUninstallContractDoesNotResolveOrDeleteLocalServiceData(t *testing.T) {
	original := readLocalServiceProfilePath
	t.Cleanup(func() { readLocalServiceProfilePath = original })
	called := false
	readLocalServiceProfilePath = func() (string, error) {
		called = true
		return "", errors.New("must not be called")
	}
	layout := runtimeLayout{InstallRoot: `C:\Program Files\Manus\PeripheralAgent`, ProgramDataRoot: `C:\ProgramData\Manus\PeripheralAgent`}
	args := uninstallCleanupArgs(1234, layout, false)
	_, _, _, _, removeData, err := parseUninstallCleanupArgs(args)
	if err != nil || removeData || called {
		t.Fatalf("normal uninstall changed data semantics: removeData=%v called=%v err=%v", removeData, called, err)
	}
}
