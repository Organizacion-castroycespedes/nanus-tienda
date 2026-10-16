//go:build windows

package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

type fakeUninstallCleanupOperations struct {
	waitErr             error
	closeErr            error
	removeAllErr        map[string]error
	existing            map[string]bool
	removeDataCalls     []string
	removeDataFunc      func(string) error
	deleteMetadataCalls int
	deleteMetadataErr   error
	remainingProcesses  int
	observeProcessesErr error
	registryPresent     bool
	observeRegistryErr  error
}

func (f *fakeUninstallCleanupOperations) WaitForParentExit(int) error { return f.waitErr }
func (f *fakeUninstallCleanupOperations) CloseScopedPOSProcesses(string, *installLogger) error {
	return f.closeErr
}
func (f *fakeUninstallCleanupOperations) RemovePOSShortcuts() error { return nil }
func (f *fakeUninstallCleanupOperations) RemoveAll(path string) error {
	if err := f.removeAllErr[path]; err != nil {
		return err
	}
	f.existing[path] = false
	return nil
}
func (f *fakeUninstallCleanupOperations) Exists(path string) bool { return f.existing[path] }
func (f *fakeUninstallCleanupOperations) ObserveScopedPOSProcesses(string) (int, error) {
	if f.observeProcessesErr != nil {
		return 0, f.observeProcessesErr
	}
	return f.remainingProcesses, nil
}
func (f *fakeUninstallCleanupOperations) UninstallMetadataPresent(installerManifest) (bool, error) {
	if f.observeRegistryErr != nil {
		return false, f.observeRegistryErr
	}
	return f.registryPresent, nil
}
func (f *fakeUninstallCleanupOperations) RemoveRequestedAgentData(root string) error {
	f.removeDataCalls = append(f.removeDataCalls, root)
	if f.removeDataFunc != nil {
		return f.removeDataFunc(root)
	}
	return nil
}
func (f *fakeUninstallCleanupOperations) DeleteUninstallMetadata(installerManifest) error {
	f.deleteMetadataCalls++
	if f.deleteMetadataErr == nil {
		f.registryPresent = false
	}
	return f.deleteMetadataErr
}
func (f *fakeUninstallCleanupOperations) ScheduleTempCleanup(string, string, bool) (int, error) {
	return 0, nil
}

func fakeCleanupFixture(t *testing.T) (root, data, install, pos string, f *fakeUninstallCleanupOperations) {
	t.Helper()
	root = t.TempDir()
	data = filepath.Join(root, "program-data")
	install = filepath.Join(root, "agent-install")
	pos = filepath.Join(root, "pos-install")
	for _, path := range []string{filepath.Join(data, "state"), filepath.Join(data, "logs"), install, pos} {
		if err := os.MkdirAll(path, 0o700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(data, "state", "config.json"), []byte("retained"), 0o600); err != nil {
		t.Fatal(err)
	}
	f = &fakeUninstallCleanupOperations{existing: map[string]bool{install: true, pos: true}, removeAllErr: map[string]error{}, registryPresent: true}
	return
}

func fakeCleanupArgs(root, install, data, pos, operationID string, removeData bool) []string {
	layout := runtimeLayout{InstallRoot: install, ProgramDataRoot: data, POSInstallRoot: pos}
	args := uninstallCleanupArgs(1, layout, removeData)
	return append(args, "--result-path="+filepath.Join(root, "uninstall-result.json"), "--operation-id="+operationID, "--retry-count=0")
}

func runFakeCleanup(t *testing.T, f *fakeUninstallCleanupOperations, root, data, install, pos, operationID string, removeData bool) (*uninstallResult, error) {
	t.Helper()
	previous := uninstallCleanupOps
	uninstallCleanupOps = f
	defer func() { uninstallCleanupOps = previous }()
	resultPath := filepath.Join(root, "uninstall-result.json")
	layout := runtimeLayout{InstallRoot: install, POSInstallRoot: pos}
	pending := newUninstallResult(operationID, func() string {
		if removeData {
			return "remove-data"
		}
		return "standard"
	}(), 1, 0, layout)
	if err := markUninstallPhase(pending, "service"); err != nil {
		t.Fatal(err)
	}
	if err := writeUninstallResult(resultPath, pending); err != nil {
		t.Fatal(err)
	}
	manifest := installerManifest{InstallRoot: install, ProgramDataRoot: data, PosRoot: pos}
	err := runUninstallCleanupWithResult(manifest, fakeCleanupArgs(root, install, data, pos, operationID, removeData))
	result, loadErr := loadUninstallResult(resultPath)
	if loadErr != nil {
		return nil, fmt.Errorf("load durable result: %w", loadErr)
	}
	return result, err
}

func TestDisposableStandardCleanupPreservesState(t *testing.T) {
	root, data, install, pos, f := fakeCleanupFixture(t)
	statePath := filepath.Join(data, "state", "config.json")
	before := sha256.Sum256(mustReadFile(t, statePath))
	aclBefore := fixtureSDDL(t, statePath)
	result, err := runFakeCleanup(t, f, root, data, install, pos, "standard-1", false)
	if err != nil || result.Outcome != uninstallComplete || f.deleteMetadataCalls != 1 {
		t.Fatalf("unexpected standard result=%+v err=%v registryCalls=%d", result, err, f.deleteMetadataCalls)
	}
	if len(f.removeDataCalls) != 0 {
		t.Fatalf("standard uninstall invoked remove-data for %q", f.removeDataCalls)
	}
	if after := sha256.Sum256(mustReadFile(t, statePath)); after != before {
		t.Fatal("standard uninstall changed retained state")
	}
	if aclAfter := fixtureSDDL(t, statePath); aclAfter != aclBefore {
		t.Fatalf("standard uninstall changed retained ACL: before=%s after=%s", aclBefore, aclAfter)
	}
	if f.existing[install] || f.existing[pos] {
		t.Fatal("standard uninstall did not remove disposable payload roots")
	}
}

func TestDisposableRemoveDataUsesOnlyApprovedRoot(t *testing.T) {
	root, data, install, pos, f := fakeCleanupFixture(t)
	owned := filepath.Join(data, "agent-owned-test-root")
	sibling := filepath.Join(data, "unrelated-sibling")
	if err := os.MkdirAll(owned, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(sibling, 0o700); err != nil {
		t.Fatal(err)
	}
	f.removeDataFunc = func(actual string) error {
		if actual != data {
			return fmt.Errorf("unexpected remove-data root %q", actual)
		}
		return os.RemoveAll(owned)
	}
	result, err := runFakeCleanup(t, f, root, data, install, pos, "remove-data-1", true)
	if err != nil || result.Outcome != uninstallComplete || len(f.removeDataCalls) != 1 || f.removeDataCalls[0] != data {
		t.Fatalf("unexpected remove-data result=%+v err=%v calls=%q", result, err, f.removeDataCalls)
	}
	if _, err := os.Stat(owned); !os.IsNotExist(err) {
		t.Fatalf("approved disposable root was not removed: %v", err)
	}
	if _, err := os.Stat(sibling); err != nil {
		t.Fatalf("unrelated sibling changed: %v", err)
	}
}

func TestDisposablePartialRetryRetainsRegistryUntilComplete(t *testing.T) {
	root, data, install, pos, f := fakeCleanupFixture(t)
	f.closeErr = errors.New("locked POS child")
	first, firstErr := runFakeCleanup(t, f, root, data, install, pos, "retry-1", false)
	if firstErr == nil || first.Outcome != uninstallPartial || f.deleteMetadataCalls != 0 {
		t.Fatalf("expected partial first attempt result=%+v err=%v registryCalls=%d", first, firstErr, f.deleteMetadataCalls)
	}
	f.closeErr = nil
	second, secondErr := runFakeCleanup(t, f, root, data, install, pos, "retry-2", false)
	if secondErr != nil || second.Outcome != uninstallComplete || f.deleteMetadataCalls != 1 {
		t.Fatalf("expected completed retry result=%+v err=%v registryCalls=%d", second, secondErr, f.deleteMetadataCalls)
	}
}

func TestDisposableLegacyUnownedScopeRetainsPayloadAndRegistry(t *testing.T) {
	root, data, install, pos, f := fakeCleanupFixture(t)
	f.closeErr = &legacyUnownedScopeError{cause: errors.New("historical installation has no ownership Job Object")}
	result, err := runFakeCleanup(t, f, root, data, install, pos, "legacy-unowned-1", false)
	if err == nil || result.Outcome != uninstallPartial || result.ReasonCode != uninstallReasonLegacyUnownedScope {
		t.Fatalf("expected durable legacy ownership partial result=%+v err=%v", result, err)
	}
	if f.deleteMetadataCalls != 0 || !f.existing[pos] || !f.existing[install] || !f.registryPresent {
		t.Fatalf("legacy ownership failure did not retain cleanup gates: result=%+v existing=%v registry=%t", result, f.existing, f.registryPresent)
	}
}

func TestDisposableTimeoutRetainsRegistryAndDurableFailure(t *testing.T) {
	root, data, install, pos, f := fakeCleanupFixture(t)
	f.waitErr = errors.New("cleanup timeout")
	result, err := runFakeCleanup(t, f, root, data, install, pos, "timeout-1", false)
	if err == nil || result.Outcome != uninstallTimedOut || f.deleteMetadataCalls != 0 {
		t.Fatalf("expected durable timeout result=%+v err=%v registryCalls=%d", result, err, f.deleteMetadataCalls)
	}
}

func mustReadFile(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

type fakeUninstallServiceOperations struct {
	calls []string
}

func (f *fakeUninstallServiceOperations) Stop(installerManifest) error {
	f.calls = append(f.calls, "stop")
	return nil
}
func (f *fakeUninstallServiceOperations) WaitStopped(installerManifest) error {
	f.calls = append(f.calls, "wait")
	return nil
}
func (f *fakeUninstallServiceOperations) Delete(installerManifest) error {
	f.calls = append(f.calls, "delete")
	return nil
}
func TestDisposableLifecycleHarnessUsesServiceSeam(t *testing.T) {
	fake := &fakeUninstallServiceOperations{}
	previous := uninstallServiceOps
	uninstallServiceOps = fake
	t.Cleanup(func() { uninstallServiceOps = previous })
	manifest := installerManifest{ServiceName: "disposable-test-service"}
	if err := uninstallServiceOps.Stop(manifest); err != nil {
		t.Fatal(err)
	}
	if err := uninstallServiceOps.WaitStopped(manifest); err != nil {
		t.Fatal(err)
	}
	if err := uninstallServiceOps.Delete(manifest); err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprint(fake.calls); got != "[stop wait delete]" {
		t.Fatalf("unexpected disposable service seam calls: %s", got)
	}
}
func TestDisposableLockedPayloadRetainsRegistry(t *testing.T) {
	root, data, install, pos, f := fakeCleanupFixture(t)
	f.removeAllErr[pos] = errors.New("file in use")
	result, err := runFakeCleanup(t, f, root, data, install, pos, "locked-payload-1", false)
	if err == nil || result.Outcome != uninstallPartial || f.deleteMetadataCalls != 0 {
		t.Fatalf("expected locked payload partial result=%+v err=%v registryCalls=%d", result, err, f.deleteMetadataCalls)
	}
}
