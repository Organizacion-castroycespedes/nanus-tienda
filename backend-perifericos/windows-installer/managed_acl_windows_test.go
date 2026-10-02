package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

func aclFixtureIntegration(t *testing.T) {
	t.Helper()
	if os.Getenv("MANUS_INSTALLER_ACL_INTEGRATION") != "1" {
		t.Skip("requires authorized elevated Windows ACL integration")
	}
}

func fixtureSetDACL(t *testing.T, path, sddl string) {
	t.Helper()
	sd, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		t.Fatal(err)
	}
	dacl, _, err := sd.DACL()
	if err != nil {
		t.Fatal(err)
	}
	if err := windows.SetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION|windows.PROTECTED_DACL_SECURITY_INFORMATION, nil, nil, dacl, nil); err != nil {
		t.Fatal(err)
	}
}

func fixtureSDDL(t *testing.T, path string) string {
	t.Helper()
	sd, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	return sd.String()
}

func TestInstalledPayloadACLRecoversProtectedEmptyFiles(t *testing.T) {
	aclFixtureIntegration(t)
	root := t.TempDir()
	source := filepath.Join(root, "source", "payload.exe")
	if err := os.MkdirAll(filepath.Dir(source), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("synthetic payload"), 0600); err != nil {
		t.Fatal(err)
	}
	// Protected empty source parent cannot leak its descriptor through copyFile;
	// the file itself remains readable by the administrator for the copy.
	fixtureSetDACL(t, source, "D:P(A;;FA;;;BA)(A;;FA;;;SY)")
	fixtureSetDACL(t, filepath.Dir(source), "D:P")
	t.Cleanup(func() {
		if err := applyManagedAcl(filepath.Dir(source), "RX", false, false); err != nil {
			t.Error(err)
		}
	})
	version := filepath.Join(root, "version")
	paths := []string{"ManusTerminalSetup.exe", "runtime/node.exe", "VERSION.json", "app/main.js"}
	for _, relative := range paths {
		target := filepath.Join(version, filepath.FromSlash(relative))
		if err := copyFile(source, target); err != nil {
			t.Fatal(err)
		}
		fixtureSetDACL(t, target, "D:P")
		if verifyManagedPathACL(target, "RX", true) == nil {
			t.Fatal("protected empty file must fail validation")
		}
	}
	if err := applyManagedAcl(version, "RX", true, true); err != nil {
		t.Fatal(err)
	}
	for _, relative := range paths {
		t.Run(relative, func(t *testing.T) {
			target := filepath.Join(version, filepath.FromSlash(relative))
			if err := verifyManagedPathACL(target, "RX", true); err != nil {
				t.Fatal(err)
			}
			t.Logf("valid executable/payload ACL: %s", fixtureSDDL(t, target))
		})
	}
	// Let TempDir cleanup traverse the deliberately empty source parent again.
	if err := applyManagedAcl(filepath.Dir(source), "RX", false, false); err != nil {
		t.Fatal(err)
	}
}

func TestManagedACLRejectsUnexpectedWriterAndInvalidPermission(t *testing.T) {
	aclFixtureIntegration(t)
	path := filepath.Join(t.TempDir(), "payload.exe")
	if err := os.WriteFile(path, []byte("fixture"), 0600); err != nil {
		t.Fatal(err)
	}
	fixtureSetDACL(t, path, "D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;0x1200a9;;;LS)(A;;FA;;;WD)")
	if verifyManagedPathACL(path, "RX", false) == nil {
		t.Fatal("Everyone write must fail closed")
	}
	before := fixtureSDDL(t, path)
	if applyManagedAcl(path, "INVALID", false, false) == nil {
		t.Fatal("invalid policy must fail")
	}
	if fixtureSDDL(t, path) != before {
		t.Fatal("invalid policy must not mutate ACL")
	}
}

func TestManagedACLFailureRollsBackEachFileAndPreservesSecrets(t *testing.T) {
	aclFixtureIntegration(t)
	root := t.TempDir()
	layout := runtimeLayout{InstallRoot: filepath.Join(root, "Agent"), VersionRoot: filepath.Join(root, "Agent", "versions", "qa"), ProgramDataRoot: filepath.Join(root, "Data")}
	layout.ConfigRoot = filepath.Join(layout.ProgramDataRoot, "config")
	layout.LogsRoot = filepath.Join(layout.ProgramDataRoot, "logs")
	layout.StateRoot = filepath.Join(layout.ProgramDataRoot, "state")
	for _, path := range []string{layout.VersionRoot, layout.ConfigRoot, layout.LogsRoot, layout.StateRoot} {
		if err := os.MkdirAll(path, 0755); err != nil {
			t.Fatal(err)
		}
	}
	exe := filepath.Join(layout.VersionRoot, "ManusTerminalSetup.exe")
	other := filepath.Join(layout.VersionRoot, "VERSION.json")
	for _, path := range []string{exe, other} {
		if err := os.WriteFile(path, []byte("fixture"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	secret := filepath.Join(layout.StateRoot, "secrets")
	if err := os.Mkdir(secret, 0700); err != nil {
		t.Fatal(err)
	}
	fixtureSetDACL(t, secret, "D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;0x1301bf;;;LS)")
	secretBefore := fixtureSDDL(t, secret)
	before := map[string]string{exe: fixtureSDDL(t, exe), other: fixtureSDDL(t, other)}
	original := setManagedPathACL
	t.Cleanup(func() { setManagedPathACL = original })
	setManagedPathACL = func(path, permission string, broadRead bool) error {
		if err := original(path, permission, broadRead); err != nil {
			return err
		}
		if path == other {
			return windows.ERROR_ACCESS_DENIED
		} // failure after change
		return nil
	}
	if err := ensureServicePermissions(layout); err == nil {
		t.Fatal("partial failure must fail closed")
	}
	setManagedPathACL = original
	for path, want := range before {
		if got := fixtureSDDL(t, path); got != want {
			t.Fatalf("ACL rollback mismatch for %s: got %s want %s", path, got, want)
		}
	}
	if got := fixtureSDDL(t, secret); got != secretBefore {
		t.Fatal("rollback changed restrictive secret ACL")
	}
	if err := ensureServicePermissions(layout); err != nil {
		t.Fatal(err)
	}
	if err := verifyManagedPathACL(exe, "RX", true); err != nil {
		t.Fatal(err)
	}
	if fixtureSDDL(t, secret) != secretBefore {
		t.Fatal("successful hardening changed secret policy")
	}
}

func TestUninstallStopResultIsIdempotentAndFailClosed(t *testing.T) {
	for _, err := range []error{nil, windows.ERROR_SERVICE_NOT_ACTIVE, windows.ERROR_SERVICE_DOES_NOT_EXIST, fmt.Errorf("wrapped: %w", windows.ERROR_SERVICE_NOT_ACTIVE)} {
		if uninstallStopResult(err) != nil {
			t.Fatalf("stopped/absent rejected: %v", err)
		}
	}
	for _, err := range []error{windows.ERROR_ACCESS_DENIED, windows.ERROR_INVALID_FUNCTION, errors.New("query failed"), errors.New("The service has not been started.")} {
		result := uninstallStopResult(err)
		if result == nil || !strings.Contains(result.Error(), "uninstall stop service") {
			t.Fatalf("real/unknown error accepted: %v", err)
		}
	}
}
