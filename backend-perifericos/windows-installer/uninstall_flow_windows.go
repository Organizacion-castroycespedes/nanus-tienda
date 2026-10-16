//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type uninstallServiceOperations interface {
	Stop(installerManifest) error
	WaitStopped(installerManifest) error
	Delete(installerManifest) error
}

type nativeUninstallServiceOperations struct{}

func (nativeUninstallServiceOperations) Stop(manifest installerManifest) error {
	return stopServiceIfRunning(manifest)
}
func (nativeUninstallServiceOperations) WaitStopped(manifest installerManifest) error {
	return waitForServiceStopped(manifest)
}
func (nativeUninstallServiceOperations) Delete(manifest installerManifest) error {
	return deleteService(manifest)
}

var uninstallServiceOps uninstallServiceOperations = nativeUninstallServiceOperations{}

type uninstallCleanupOperations interface {
	WaitForParentExit(int) error
	CloseScopedPOSProcesses(string, *installLogger) error
	RemovePOSShortcuts() error
	RemoveAll(string) error
	Exists(string) bool
	ObserveScopedPOSProcesses(string) (int, error)
	UninstallMetadataPresent(installerManifest) (bool, error)
	RemoveRequestedAgentData(string) error
	DeleteUninstallMetadata(installerManifest) error
	ScheduleTempCleanup(string, string, bool) (int, error)
}

type nativeUninstallCleanupOperations struct{}

func (nativeUninstallCleanupOperations) WaitForParentExit(parentPID int) error {
	return waitForParentExit(parentPID)
}

func (nativeUninstallCleanupOperations) CloseScopedPOSProcesses(root string, logger *installLogger) error {
	return closeScopedPOSProcesses(root, logger)
}

func (nativeUninstallCleanupOperations) RemovePOSShortcuts() error {
	return removePOSShortcuts()
}

func (nativeUninstallCleanupOperations) RemoveAll(path string) error {
	return os.RemoveAll(path)
}

func (nativeUninstallCleanupOperations) Exists(path string) bool {
	return exists(path)
}

func (nativeUninstallCleanupOperations) ObserveScopedPOSProcesses(root string) (int, error) {
	processes, err := posProcessOperations.Discover(root)
	if err != nil {
		return 0, err
	}
	return len(processes), nil
}

func (nativeUninstallCleanupOperations) UninstallMetadataPresent(manifest installerManifest) (bool, error) {
	return uninstallMetadataPresent(manifest)
}

func (nativeUninstallCleanupOperations) RemoveRequestedAgentData(programDataRoot string) error {
	return removeRequestedAgentData(programDataRoot)
}

func (nativeUninstallCleanupOperations) DeleteUninstallMetadata(manifest installerManifest) error {
	return deleteUninstallMetadata(manifest)
}

func (nativeUninstallCleanupOperations) ScheduleTempCleanup(tempRoot, logPath string, removeLog bool) (int, error) {
	return scheduleTempCleanup(tempRoot, logPath, removeLog)
}

var uninstallCleanupOps uninstallCleanupOperations = nativeUninstallCleanupOperations{}
var persistUninstallResult = writeUninstallResult

func uninstallWithResult(manifest installerManifest, removeData bool) error {
	if err := ensureSupportedHost(); err != nil {
		return err
	}
	if err := ensureElevated(); err != nil {
		return err
	}
	layout := buildLayout(manifest)
	resultPath := uninstallResultPath(layout)
	operationID := newUninstallOperationID()
	retryCount := 0
	previous, err := recoverStaleUninstallResult(resultPath, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("recover previous uninstall result: %w", err)
	}
	if previous != nil {
		retryCount = previous.RetryCount + 1
	}
	if removeData {
		resultPath = filepath.Join(os.TempDir(), "ManusTerminalSetup-uninstall-result-"+operationID+".json")
	}
	result := newUninstallResult(operationID, func() string {
		if removeData {
			return "remove-data"
		}
		return "standard"
	}(), os.Getpid(), retryCount, layout)
	if err := writeUninstallResult(resultPath, result); err != nil {
		return fmt.Errorf("write uninstall pending result: %w", err)
	}

	logger, err := newInstallLogger(layout.InstallLog)
	if err == nil {
		defer logger.Close()
		logger.Printf("uninstall start removeData=%t operation=%s", removeData, operationID)
	}
	if err := uninstallStopResult(uninstallServiceOps.Stop(manifest)); err != nil {
		return recordUninstallFailure(resultPath, result, err)
	}
	if err := uninstallServiceOps.WaitStopped(manifest); err != nil {
		err = fmt.Errorf("uninstall service stop confirmation: %w", err)
		return recordUninstallFailure(resultPath, result, err)
	}
	if err := uninstallServiceOps.Delete(manifest); err != nil && !isMissingServiceError(err) {
		return recordUninstallFailure(resultPath, result, err)
	}
	if err := markUninstallPhase(result, "service"); err != nil {
		return err
	}
	if err := writeUninstallResult(resultPath, result); err != nil {
		return fmt.Errorf("write uninstall service result: %w", err)
	}

	helperPath, err := prepareUninstallCleanupHelper(layout, removeData)
	if err != nil {
		return recordUninstallFailure(resultPath, result, err)
	}
	cmd := execCommandForUninstall(helperPath, uninstallCleanupArgsWithResult(os.Getpid(), layout, removeData, resultPath, operationID, retryCount))
	cmd.Dir = filepath.Dir(helperPath)
	if err := cmd.Start(); err != nil {
		_ = os.Remove(helperPath)
		return recordUninstallFailure(resultPath, result, fmt.Errorf("launch uninstall cleanup helper: %w", err))
	}
	if logger != nil {
		logger.Printf("uninstall cleanup helper launched pid=%d path=%s operation=%s", cmd.Process.Pid, helperPath, operationID)
	}
	fmt.Printf("UNINSTALL CLEANUP PENDING operation=%s result=%s exitCode=%d\n", operationID, resultPath, uninstallExitPending)
	return &uninstallPendingError{OperationID: operationID, ResultPath: resultPath}
}

func recordUninstallFailure(path string, result *uninstallResult, cause error) error {
	if markErr := markUninstallFailure(result, cause); markErr != nil {
		return fmt.Errorf("uninstall failure state: %w; original error: %v", markErr, cause)
	}
	if persistErr := persistUninstallResult(path, result); persistErr != nil {
		return fmt.Errorf("%w; durable result persistence failed: %v", cause, persistErr)
	}
	return cause
}

func execCommandForUninstall(path string, args []string) *exec.Cmd {
	return exec.Command(path, args...)
}

func uninstallCleanupArgsWithResult(parentPID int, layout runtimeLayout, removeData bool, resultPath, operationID string, retryCount int) []string {
	args := uninstallCleanupArgs(parentPID, layout, removeData)
	args = append(args, "--result-path="+resultPath, "--operation-id="+operationID, fmt.Sprintf("--retry-count=%d", retryCount))
	return args
}

func parseUninstallResultArgs(args []string) (resultPath, operationID string, retryCount int) {
	for _, arg := range args {
		switch {
		case strings.HasPrefix(arg, "--result-path="):
			resultPath = strings.TrimPrefix(arg, "--result-path=")
		case strings.HasPrefix(arg, "--operation-id="):
			operationID = strings.TrimPrefix(arg, "--operation-id=")
		case strings.HasPrefix(arg, "--retry-count="):
			_, _ = fmt.Sscanf(strings.TrimPrefix(arg, "--retry-count="), "%d", &retryCount)
		}
	}
	return
}

func runUninstallCleanupWithResult(manifest installerManifest, args []string) (err error) {
	parentPID, installRoot, programDataRoot, posRoot, removeData, parseErr := parseUninstallCleanupArgs(args)
	if parseErr != nil {
		return parseErr
	}
	resultPath, operationID, _ := parseUninstallResultArgs(args)
	if operationID == "" || resultPath == "" {
		return fmt.Errorf("uninstall cleanup requires a durable result path and operation identity")
	}
	result, resultErr := loadUninstallResult(resultPath)
	if resultErr != nil {
		return fmt.Errorf("load uninstall result: %w", resultErr)
	}
	if result.OperationID != operationID {
		return fmt.Errorf("uninstall result operation identity mismatch: expected %s", operationID)
	}
	expectedMode := "standard"
	if removeData {
		expectedMode = "remove-data"
	}
	if result.Mode != expectedMode {
		return fmt.Errorf("uninstall result mode mismatch: expected %s", expectedMode)
	}
	if result.Outcome != uninstallPending {
		return fmt.Errorf("uninstall result is not pending: %s", result.Outcome)
	}
	cleanupLogPath := filepath.Join(programDataRoot, "logs", "installer.log")
	logger, _ := newInstallLogger(cleanupLogPath)
	defer func() {
		if err == nil {
			if observationErr := observeUninstallState(result, posRoot, manifest); observationErr != nil {
				err = observationErr
			}
		}
		if err == nil {
			if phaseErr := markUninstallPhase(result, "complete"); phaseErr != nil {
				err = phaseErr
			}
		}
		if err != nil {
			if observationErr := observeUninstallState(result, posRoot, manifest); observationErr != nil {
				err = fmt.Errorf("%w; state observation failed: %v", err, observationErr)
			}
			_ = markUninstallFailure(result, err)
			result.RemainingRoots = nil
			for _, root := range []string{posRoot, installRoot} {
				if root != "" && uninstallCleanupOps.Exists(root) {
					result.RemainingRoots = append(result.RemainingRoots, root)
				}
			}
			persistErr := persistUninstallResult(resultPath, result)
			if persistErr != nil {
				err = fmt.Errorf("%w; durable result persistence failed: %v", err, persistErr)
			}
		} else {
			result.Outcome = uninstallComplete
			if persistErr := persistUninstallResult(resultPath, result); persistErr != nil {
				err = fmt.Errorf("uninstall completed but durable result persistence failed: %w", persistErr)
			}
		}
		if logger != nil {
			_ = logger.Close()
		}
	}()
	if err = uninstallCleanupOps.WaitForParentExit(parentPID); err != nil {
		return err
	}
	if logger != nil {
		logger.Printf("cleanup helper start parent pid=%d operation=%s", parentPID, operationID)
		logger.Printf("cleanup parent exit confirmed")
	}
	if posRoot != "" {
		if err = markUninstallPhase(result, "pos_processes"); err != nil {
			return err
		}
		if err = persistUninstallResult(resultPath, result); err != nil {
			return err
		}
		if err = uninstallCleanupOps.CloseScopedPOSProcesses(posRoot, logger); err != nil {
			if logger != nil {
				logger.Printf("POS process cleanup failure error=%v", err)
			}
			return fmt.Errorf("uninstall cleanup POS processes: %w", err)
		}
		if err = markUninstallPhase(result, "pos_processes_verified"); err != nil {
			return err
		}
		if err = persistUninstallResult(resultPath, result); err != nil {
			return err
		}
		if logger != nil {
			logger.Printf("POS delete start root=%s", posRoot)
		}
		if err = uninstallCleanupOps.RemovePOSShortcuts(); err != nil {
			return fmt.Errorf("uninstall cleanup shortcuts: %w", err)
		}
		if err = uninstallCleanupOps.RemoveAll(posRoot); err != nil {
			return fmt.Errorf("uninstall cleanup POS: %w", err)
		}
		if uninstallCleanupOps.Exists(posRoot) {
			return fmt.Errorf("uninstall cleanup POS still exists: %s", posRoot)
		}
		_, _ = removeEmptyManusParent(filepath.Dir(posRoot))
		if err = markUninstallPhase(result, "pos_payload"); err != nil {
			return err
		}
		if err = persistUninstallResult(resultPath, result); err != nil {
			return err
		}
	}
	if err = markUninstallPhase(result, "agent_payload"); err != nil {
		return err
	}
	if err = persistUninstallResult(resultPath, result); err != nil {
		return err
	}
	if err = uninstallCleanupOps.RemoveAll(installRoot); err != nil {
		return fmt.Errorf("uninstall cleanup Program Files: %w", err)
	}
	if uninstallCleanupOps.Exists(installRoot) {
		return fmt.Errorf("uninstall cleanup Program Files still exists: %s", installRoot)
	}
	_, _ = removeEmptyManusParent(filepath.Dir(installRoot))
	if removeData {
		if err = markUninstallPhase(result, "managed_data"); err != nil {
			return err
		}
		if err = persistUninstallResult(resultPath, result); err != nil {
			return err
		}
		if err = uninstallCleanupOps.RemoveRequestedAgentData(programDataRoot); err != nil {
			return fmt.Errorf("uninstall cleanup managed data: %w", err)
		}
	} else {
		if err = markUninstallPhase(result, "managed_data_preserved"); err != nil {
			return err
		}
		if err = persistUninstallResult(resultPath, result); err != nil {
			return err
		}
	}
	if err = markUninstallPhase(result, "registry"); err != nil {
		return err
	}
	if err = persistUninstallResult(resultPath, result); err != nil {
		return err
	}
	if err = uninstallCleanupOps.DeleteUninstallMetadata(manifest); err != nil && !isMissingUninstallRegistryKeyError(err) {
		return fmt.Errorf("uninstall cleanup registry: %w", err)
	}
	if logger != nil {
		logger.Printf("registry removal success")
	}
	if err = markUninstallPhase(result, "temp_cleanup"); err != nil {
		return err
	}
	if err = persistUninstallResult(resultPath, result); err != nil {
		return err
	}
	if err = observeUninstallState(result, posRoot, manifest); err != nil {
		return fmt.Errorf("uninstall final state observation: %w", err)
	}
	tempRoot := filepath.Dir(os.Args[0])
	cleanupPID, cleanupErr := uninstallCleanupOps.ScheduleTempCleanup(tempRoot, cleanupLogPath, removeData)
	if cleanupErr != nil {
		return fmt.Errorf("uninstall cleanup TEMP: %w", cleanupErr)
	}
	if logger != nil {
		logger.Printf("TEMP cleanup launched pid=%d workingDir=%s", cleanupPID, filepath.Dir(tempRoot))
	}
	return nil
}

func observeUninstallState(result *uninstallResult, posRoot string, manifest installerManifest) error {
	if result == nil {
		return fmt.Errorf("uninstall result is required for state observation")
	}
	if posRoot == "" {
		result.RemainingPOSProcess = 0
		result.RemainingPOSKnown = true
	} else {
		count, err := uninstallCleanupOps.ObserveScopedPOSProcesses(posRoot)
		if err != nil {
			result.RemainingPOSKnown = false
			return fmt.Errorf("observe scoped POS processes: %w", err)
		}
		result.RemainingPOSProcess = count
		result.RemainingPOSKnown = true
	}
	registryPresent, err := uninstallCleanupOps.UninstallMetadataPresent(manifest)
	if err != nil {
		result.RegistryKnown = false
		return fmt.Errorf("observe uninstall registration: %w", err)
	}
	result.RegistryPresent = registryPresent
	result.RegistryKnown = true
	return nil
}
