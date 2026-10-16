//go:build windows

package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestUninstallResultRoundTripIsAtomicAndDurable(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "state", "uninstall-result.json")
	layout := runtimeLayout{InstallRoot: filepath.Join(root, "install"), POSInstallRoot: filepath.Join(root, "pos")}
	result := newUninstallResult("op-1", "standard", 123, 0, layout)
	if err := writeUninstallResult(path, result); err != nil {
		t.Fatalf("write pending result: %v", err)
	}
	loaded, err := loadUninstallResult(path)
	if err != nil {
		t.Fatalf("load pending result: %v", err)
	}
	if loaded.OperationID != "op-1" || loaded.Outcome != uninstallPending {
		t.Fatalf("unexpected pending result: %+v", loaded)
	}
	phases := []string{"service", "pos_processes", "pos_processes_verified", "pos_payload", "agent_payload", "managed_data_preserved", "registry", "temp_cleanup", "complete"}
	for _, phase := range phases {
		if err := markUninstallPhase(loaded, phase); err != nil {
			t.Fatalf("advance phase %s: %v", phase, err)
		}
	}
	loaded.RemainingPOSKnown = true
	loaded.RegistryKnown = true
	loaded.RegistryPresent = false
	loaded.Outcome = uninstallComplete
	if err := writeUninstallResult(path, loaded); err != nil {
		t.Fatalf("write completed result: %v", err)
	}
	loaded, err = loadUninstallResult(path)
	if err != nil {
		t.Fatalf("load completed result: %v", err)
	}
	if loaded.Outcome != uninstallComplete || len(loaded.CompletedPhases) != len(phases) {
		t.Fatalf("unexpected completed result: %+v", loaded)
	}
	if _, err := os.Stat(path + ".tmp-op-1"); !os.IsNotExist(err) {
		t.Fatalf("temporary result was not removed: %v", err)
	}
}

func TestRecoverStaleUninstallResultMarksCrash(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "uninstall-result.json")
	result := newUninstallResult("op-stale", "standard", 123, 0, runtimeLayout{})
	updated := time.Now().UTC().Add(-uninstallPendingTimeout * 2).Format(time.RFC3339Nano)
	result.UpdatedAt = updated
	data, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	recovered, err := recoverStaleUninstallResult(path, time.Now().UTC())
	if err != nil {
		t.Fatalf("recover stale result: %v", err)
	}
	if recovered.Outcome != uninstallCrashed || recovered.Phase != "recovery" {
		t.Fatalf("unexpected recovery result: %+v", recovered)
	}
}

func TestRecoverStaleUninstallResultAcceptsLegacyCompletedTempCleanupRecord(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "uninstall-result.json")
	raw := []byte(`{
  "schemaVersion": 1,
  "operationId": "1792018780372615000-18196",
  "parentPid": 18196,
  "mode": "standard",
  "outcome": "completed",
  "phase": "complete",
  "startedAt": "2026-10-14T22:59:40.372615Z",
  "updatedAt": "2026-10-14T22:59:54.1665569Z",
  "retryCount": 0,
  "installRoot": "C:\\Program Files\\Manus\\PeripheralAgent",
  "posRoot": "C:\\Program Files\\Manus\\POS",
  "completedPhases": [
    "service",
    "pos_processes",
    "pos_processes_verified",
    "pos_payload",
    "agent_payload",
    "managed_data_preserved",
    "registry",
    "temp_cleanup"
  ]
}`)
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}

	recovered, err := recoverStaleUninstallResult(path, time.Now().UTC())
	if err != nil {
		t.Fatalf("legacy completed result must be recoverable for retry bookkeeping: %v", err)
	}
	if recovered.OperationID != "1792018780372615000-18196" || recovered.Outcome != uninstallComplete {
		t.Fatalf("unexpected recovered legacy result: %+v", recovered)
	}
	if recovered.Phase != "complete" || recovered.CompletedPhases[len(recovered.CompletedPhases)-1] != "complete" {
		t.Fatalf("legacy result was not normalized in memory: %+v", recovered)
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(raw) {
		t.Fatal("legacy result was rewritten while being recovered")
	}
}

func TestRecoverStaleUninstallResultRejectsIncompleteLegacyCompletedRecord(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "uninstall-result.json")
	result := newUninstallResult("op-incomplete-legacy", "standard", 1, 0, runtimeLayout{})
	result.Outcome = uninstallComplete
	result.Phase = "complete"
	result.CompletedPhases = []string{"service", "pos_processes", "pos_processes_verified", "pos_payload", "agent_payload", "managed_data_preserved", "registry"}
	raw, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := recoverStaleUninstallResult(path, time.Now().UTC()); err == nil {
		t.Fatal("incomplete legacy terminal record must remain blocked")
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(raw) {
		t.Fatal("incomplete legacy record was rewritten")
	}
}
func TestUninstallCleanupArgsCarryOperationIdentity(t *testing.T) {
	layout := runtimeLayout{InstallRoot: "C:\\Install", ProgramDataRoot: "C:\\Data", POSInstallRoot: "C:\\POS"}
	args := uninstallCleanupArgsWithResult(321, layout, false, "C:\\Data\\state\\uninstall-result.json", "op-2", 4)
	path, operation, retry := parseUninstallResultArgs(args)
	if path != "C:\\Data\\state\\uninstall-result.json" || operation != "op-2" || retry != 4 {
		t.Fatalf("unexpected result args path=%q operation=%q retry=%d", path, operation, retry)
	}
}

func TestUninstallFailureOutcomesAreDurableAndDistinct(t *testing.T) {
	failed := newUninstallResult("op-failed", "standard", 1, 0, runtimeLayout{})
	markUninstallFailure(failed, errors.New("access denied"))
	if failed.Outcome != uninstallFailed {
		t.Fatalf("expected failed outcome, got %q", failed.Outcome)
	}
	partial := newUninstallResult("op-partial", "standard", 1, 0, runtimeLayout{})
	markUninstallPhase(partial, "service")
	markUninstallFailure(partial, errors.New("payload locked"))
	if partial.Outcome != uninstallPartial {
		t.Fatalf("expected partial outcome, got %q", partial.Outcome)
	}
	timedOut := newUninstallResult("op-timeout", "standard", 1, 0, runtimeLayout{})
	markUninstallFailure(timedOut, errors.New("cleanup timeout"))
	if timedOut.Outcome != uninstallTimedOut {
		t.Fatalf("expected timed_out outcome, got %q", timedOut.Outcome)
	}
}

func TestLegacyUnownedScopeIsDurablePartialWithOperationCorrelation(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "uninstall-result.json")
	layout := runtimeLayout{InstallRoot: filepath.Join(root, "install"), POSInstallRoot: filepath.Join(root, "pos")}
	result := newUninstallResult("legacy-op-1", "standard", 7, 3, layout)
	if err := markUninstallPhase(result, "service"); err != nil {
		t.Fatal(err)
	}
	if err := markUninstallFailure(result, &legacyUnownedScopeError{cause: errors.New("installation has no POS ownership Job Object")}); err != nil {
		t.Fatal(err)
	}
	if result.Outcome != uninstallPartial || result.ReasonCode != uninstallReasonLegacyUnownedScope {
		t.Fatalf("unexpected legacy ownership result: %+v", result)
	}
	if result.OperationID != "legacy-op-1" || result.RetryCount != 3 {
		t.Fatalf("operation correlation changed: %+v", result)
	}
	if err := writeUninstallResult(path, result); err != nil {
		t.Fatal(err)
	}
	loaded, err := loadUninstallResult(path)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Outcome != uninstallPartial || loaded.ReasonCode != uninstallReasonLegacyUnownedScope || loaded.OperationID != result.OperationID || loaded.RetryCount != result.RetryCount {
		t.Fatalf("legacy ownership reason was not durable: %+v", loaded)
	}
	if len(loaded.CompletedPhases) != 1 || loaded.CompletedPhases[0] != "service" {
		t.Fatalf("legacy ownership result advanced destructive phases: %+v", loaded.CompletedPhases)
	}
}

func TestUninstallResultRejectsInvalidTransitionsAndIncompleteTerminal(t *testing.T) {
	result := newUninstallResult("op-transition", "standard", 1, 0, runtimeLayout{})
	if err := markUninstallPhase(result, "registry"); err == nil {
		t.Fatal("expected invalid phase transition to fail")
	}
	if err := markUninstallPhase(result, "service"); err != nil {
		t.Fatalf("service transition failed: %v", err)
	}
	result.Outcome = uninstallComplete
	if err := validateUninstallResult(result); err == nil {
		t.Fatal("expected incomplete completed result to fail validation")
	}
	result.Outcome = uninstallPending
	result.Phase = "complete"
	if err := validateUninstallResult(result); err == nil {
		t.Fatal("expected pending terminal phase to fail validation")
	}
}
func TestUninstallExitCodeContractKeepsPendingNonSuccess(t *testing.T) {
	if uninstallExitSuccess != 0 || uninstallExitFailure != 1 || uninstallExitPending != 2 {
		t.Fatalf("unexpected uninstall exit contract: success=%d failure=%d pending=%d", uninstallExitSuccess, uninstallExitFailure, uninstallExitPending)
	}
	var err error = &uninstallPendingError{OperationID: "op-pending", ResultPath: "result.json"}
	if err == nil || err.Error() == "" {
		t.Fatal("pending handoff must remain an explicit non-success error")
	}
}

func TestUninstallResultRejectsTerminalReentryAndUnknownObservation(t *testing.T) {
	result := newUninstallResult("op-terminal", "standard", 1, 0, runtimeLayout{})
	result.Outcome = uninstallComplete
	if err := validateUninstallPhaseTransition(result, "handoff"); err == nil {
		t.Fatal("expected terminal phase transition rejection")
	}
	result.Outcome = uninstallComplete
	result.Phase = "complete"
	result.CompletedPhases = []string{"service", "pos_processes", "pos_processes_verified", "pos_payload", "agent_payload", "managed_data_preserved", "registry", "temp_cleanup", "complete"}
	result.RemainingPOSKnown = false
	result.RegistryKnown = false
	if err := validateUninstallResult(result); err == nil {
		t.Fatal("expected completed result with unknown observations to fail")
	}
}

func TestRecoverStaleResultRejectsFreshPendingOperation(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "uninstall-result.json")
	result := newUninstallResult("op-fresh", "standard", 1, 0, runtimeLayout{})
	if err := writeUninstallResult(path, result); err != nil {
		t.Fatal(err)
	}
	if _, err := recoverStaleUninstallResult(path, time.Now().UTC()); err == nil {
		t.Fatal("expected active pending operation to block a second operation")
	}
}

func TestRunUninstallCleanupRejectsCorruptAndForeignResults(t *testing.T) {
	root, data, install, pos, f := fakeCleanupFixture(t)
	previous := uninstallCleanupOps
	uninstallCleanupOps = f
	defer func() { uninstallCleanupOps = previous }()
	manifest := installerManifest{InstallRoot: install, ProgramDataRoot: data, PosRoot: pos}
	resultPath := filepath.Join(root, "uninstall-result.json")
	args := fakeCleanupArgs(root, install, data, pos, "op-current", false)
	if err := os.WriteFile(resultPath, []byte("{not-json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := runUninstallCleanupWithResult(manifest, args); err == nil {
		t.Fatal("expected corrupt durable result rejection")
	}
	foreign := newUninstallResult("op-foreign", "standard", 1, 0, runtimeLayout{InstallRoot: install, POSInstallRoot: pos})
	if err := writeUninstallResult(resultPath, foreign); err != nil {
		t.Fatal(err)
	}
	if err := runUninstallCleanupWithResult(manifest, args); err == nil {
		t.Fatal("expected foreign operation rejection")
	}
}

func TestRunUninstallCleanupReportsTerminalPersistenceFailure(t *testing.T) {
	root, data, install, pos, f := fakeCleanupFixture(t)
	previousOps := uninstallCleanupOps
	previousWriter := persistUninstallResult
	uninstallCleanupOps = f
	persistUninstallResult = func(string, *uninstallResult) error {
		return errors.New("simulated result store failure")
	}
	defer func() {
		uninstallCleanupOps = previousOps
		persistUninstallResult = previousWriter
	}()
	manifest := installerManifest{InstallRoot: install, ProgramDataRoot: data, PosRoot: pos}
	resultPath := filepath.Join(root, "uninstall-result.json")
	pending := newUninstallResult("op-write-failure", "standard", 1, 0, runtimeLayout{InstallRoot: install, POSInstallRoot: pos})
	if err := markUninstallPhase(pending, "service"); err != nil {
		t.Fatal(err)
	}
	if err := writeUninstallResult(resultPath, pending); err != nil {
		t.Fatal(err)
	}
	err := runUninstallCleanupWithResult(manifest, fakeCleanupArgs(root, install, data, pos, "op-write-failure", false))
	if err == nil {
		t.Fatal("expected durable persistence failure")
	}
	if !strings.Contains(err.Error(), "durable result persistence failed") {
		t.Fatalf("unexpected persistence error: %v", err)
	}
	loaded, loadErr := loadUninstallResult(resultPath)
	if loadErr != nil {
		t.Fatal(loadErr)
	}
	if loaded.Outcome != uninstallPending {
		t.Fatalf("last valid durable record was not preserved: %+v", loaded)
	}
}
