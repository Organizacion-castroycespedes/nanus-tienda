//go:build windows

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/windows"
)

const (
	uninstallExitSuccess    = 0
	uninstallExitFailure    = 1
	uninstallExitPending    = 2
	uninstallResultSchema   = 1
	uninstallPendingTimeout = 2 * time.Minute
)

type uninstallOutcome string

const (
	uninstallPending  uninstallOutcome = "pending"
	uninstallComplete uninstallOutcome = "completed"
	uninstallPartial  uninstallOutcome = "partial"
	uninstallFailed   uninstallOutcome = "failed"
	uninstallTimedOut uninstallOutcome = "timed_out"
	uninstallCrashed  uninstallOutcome = "crashed"
)

const uninstallReasonLegacyUnownedScope = "legacy_unowned_scope"

type uninstallResult struct {
	SchemaVersion       int              `json:"schemaVersion"`
	OperationID         string           `json:"operationId"`
	ParentPID           int              `json:"parentPid,omitempty"`
	Mode                string           `json:"mode"`
	Outcome             uninstallOutcome `json:"outcome"`
	Phase               string           `json:"phase"`
	StartedAt           string           `json:"startedAt"`
	UpdatedAt           string           `json:"updatedAt"`
	RetryCount          int              `json:"retryCount"`
	InstallRoot         string           `json:"installRoot"`
	POSRoot             string           `json:"posRoot"`
	CompletedPhases     []string         `json:"completedPhases,omitempty"`
	ErrorCode           uint32           `json:"errorCode,omitempty"`
	Error               string           `json:"error,omitempty"`
	ReasonCode          string           `json:"reasonCode,omitempty"`
	RemainingPOSProcess int              `json:"remainingPosProcesses,omitempty"`
	RemainingPOSKnown   bool             `json:"remainingPosProcessesKnown"`
	RemainingRoots      []string         `json:"remainingRoots,omitempty"`
	RegistryPresent     bool             `json:"registryPresent,omitempty"`
	RegistryKnown       bool             `json:"registryPresenceKnown"`
}

var uninstallPhaseOrder = []string{
	"handoff",
	"service",
	"pos_processes",
	"pos_processes_verified",
	"pos_payload",
	"agent_payload",
	"managed_data",
	"managed_data_preserved",
	"registry",
	"temp_cleanup",
	"complete",
}

var uninstallTerminalOutcomes = map[uninstallOutcome]bool{
	uninstallComplete: true,
	uninstallPartial:  true,
	uninstallFailed:   true,
	uninstallTimedOut: true,
	uninstallCrashed:  true,
}

func uninstallPhaseRank(phase string) int {
	for index, known := range uninstallPhaseOrder {
		if known == phase {
			return index
		}
	}
	return -1
}

func validateUninstallPhaseTransition(result *uninstallResult, next string) error {
	if result == nil {
		return errors.New("uninstall result is required")
	}
	if uninstallPhaseRank(next) < 0 && next != "recovery" {
		return fmt.Errorf("unknown uninstall phase %q", next)
	}
	if next == "recovery" {
		if result.Outcome != uninstallPending {
			return fmt.Errorf("cannot recover terminal uninstall result")
		}
		return nil
	}
	if result.Phase == next {
		if result.Outcome != uninstallPending {
			return fmt.Errorf("cannot re-enter terminal uninstall phase %q", next)
		}
		return nil
	}
	if result.Phase == "recovery" || uninstallPhaseRank(result.Phase) < 0 {
		return fmt.Errorf("cannot advance uninstall result from phase %q", result.Phase)
	}
	if uninstallPhaseRank(next) < uninstallPhaseRank(result.Phase) {
		return fmt.Errorf("uninstall phase regression from %q to %q", result.Phase, next)
	}
	if result.Outcome != uninstallPending {
		return fmt.Errorf("cannot advance terminal uninstall result from outcome %q", result.Outcome)
	}
	if next == "managed_data" || next == "managed_data_preserved" {
		if result.Phase != "agent_payload" {
			return fmt.Errorf("managed data phase requires agent payload completion")
		}
		return nil
	}
	if result.Phase == "managed_data" || result.Phase == "managed_data_preserved" {
		if next == "registry" || next == "temp_cleanup" || next == "complete" {
			return nil
		}
		return fmt.Errorf("invalid phase after managed data: %q", next)
	}
	if next == "complete" {
		if result.Phase == "temp_cleanup" {
			return nil
		}
		return fmt.Errorf("complete phase requires TEMP cleanup")
	}
	if uninstallPhaseRank(next) != uninstallPhaseRank(result.Phase)+1 {
		return fmt.Errorf("invalid uninstall phase transition from %q to %q", result.Phase, next)
	}
	return nil
}

func validateUninstallResult(result *uninstallResult) error {
	if result == nil {
		return errors.New("uninstall result is required")
	}
	if result.SchemaVersion != uninstallResultSchema {
		return fmt.Errorf("unsupported uninstall result schema %d", result.SchemaVersion)
	}
	if result.OperationID == "" {
		return errors.New("uninstall result operation identity is required")
	}
	if result.Mode != "standard" && result.Mode != "remove-data" {
		return fmt.Errorf("invalid uninstall mode %q", result.Mode)
	}
	if result.StartedAt == "" || result.UpdatedAt == "" {
		return errors.New("uninstall result timestamps are required")
	}
	if _, err := time.Parse(time.RFC3339Nano, result.StartedAt); err != nil {
		return fmt.Errorf("invalid uninstall start timestamp: %w", err)
	}
	if _, err := time.Parse(time.RFC3339Nano, result.UpdatedAt); err != nil {
		return fmt.Errorf("invalid uninstall update timestamp: %w", err)
	}
	if result.Outcome != uninstallPending && !uninstallTerminalOutcomes[result.Outcome] {
		return fmt.Errorf("invalid uninstall outcome %q", result.Outcome)
	}
	if result.RetryCount < 0 {
		return errors.New("uninstall retry count cannot be negative")
	}
	if result.RemainingPOSKnown && result.RemainingPOSProcess < 0 {
		return errors.New("uninstall remaining POS process count cannot be negative")
	}
	if uninstallPhaseRank(result.Phase) < 0 && result.Phase != "recovery" {
		return fmt.Errorf("invalid uninstall phase %q", result.Phase)
	}
	seen := make(map[string]bool, len(result.CompletedPhases))
	lastPhase := ""
	lastRank := -1
	hasDataPhase := false
	for _, phase := range result.CompletedPhases {
		if seen[phase] {
			return fmt.Errorf("duplicate completed uninstall phase %q", phase)
		}
		seen[phase] = true
		rank := uninstallPhaseRank(phase)
		if rank < 0 {
			return fmt.Errorf("invalid completed uninstall phase %q", phase)
		}
		if rank < lastRank {
			return errors.New("completed uninstall phases are out of order")
		}
		lastRank = rank
		lastPhase = phase
		if phase == "managed_data" || phase == "managed_data_preserved" {
			hasDataPhase = true
		}
	}
	if len(result.CompletedPhases) > 0 && result.Phase != lastPhase && result.Phase != "recovery" {
		return fmt.Errorf("uninstall phase %q does not match completed phase %q", result.Phase, lastPhase)
	}
	if result.Outcome == uninstallPending {
		if result.Phase == "complete" || result.Phase == "recovery" {
			return errors.New("pending uninstall result has terminal phase")
		}
		return nil
	}
	if result.Error == "" && result.Outcome != uninstallComplete {
		return fmt.Errorf("incomplete uninstall outcome %q has no error", result.Outcome)
	}
	if result.ReasonCode != "" && result.ReasonCode != uninstallReasonLegacyUnownedScope {
		return fmt.Errorf("invalid uninstall reason code %q", result.ReasonCode)
	}
	if result.Outcome == uninstallComplete {
		for _, required := range []string{"service", "pos_processes", "pos_processes_verified", "pos_payload", "agent_payload", "registry", "temp_cleanup", "complete"} {
			if !seen[required] {
				return fmt.Errorf("completed uninstall result is missing phase %q", required)
			}
		}
		if !hasDataPhase {
			return errors.New("completed uninstall result is missing managed data phase")
		}
		if result.Phase != "complete" {
			return fmt.Errorf("completed uninstall result has phase %q", result.Phase)
		}
	}
	if result.Outcome == uninstallCrashed && result.Phase != "recovery" {
		return fmt.Errorf("crashed uninstall result has phase %q", result.Phase)
	}
	if result.Phase == "recovery" && result.Outcome != uninstallCrashed {
		return fmt.Errorf("recovery uninstall result must be crashed")
	}
	if result.Outcome == uninstallComplete {
		if !result.RemainingPOSKnown || result.RemainingPOSProcess != 0 {
			return errors.New("completed uninstall result lacks a verified empty POS process scan")
		}
		if !result.RegistryKnown || result.RegistryPresent {
			return errors.New("completed uninstall result lacks verified absent uninstall registration")
		}
	}
	return nil
}

type uninstallPendingError struct {
	OperationID string
	ResultPath  string
}

func (e *uninstallPendingError) Error() string {
	return fmt.Sprintf("uninstall cleanup pending operation=%s result=%s", e.OperationID, e.ResultPath)
}

func newUninstallResult(operationID, mode string, parentPID, retryCount int, layout runtimeLayout) *uninstallResult {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	return &uninstallResult{
		SchemaVersion:   uninstallResultSchema,
		OperationID:     operationID,
		ParentPID:       parentPID,
		Mode:            mode,
		Outcome:         uninstallPending,
		Phase:           "handoff",
		StartedAt:       now,
		UpdatedAt:       now,
		RetryCount:      retryCount,
		InstallRoot:     layout.InstallRoot,
		POSRoot:         layout.POSInstallRoot,
		CompletedPhases: []string{},
	}
}

func uninstallResultPath(layout runtimeLayout) string {
	return filepath.Join(layout.StateRoot, "uninstall-result.json")
}

func newUninstallOperationID() string {
	return strconv.FormatInt(time.Now().UTC().UnixNano(), 10) + "-" + strconv.Itoa(os.Getpid())
}

func loadUninstallResult(path string) (*uninstallResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var result uninstallResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decode uninstall result: %w", err)
	}
	if result.SchemaVersion != uninstallResultSchema || result.OperationID == "" || result.Outcome == "" {
		return nil, errors.New("invalid uninstall result schema")
	}
	if err := validateUninstallResult(&result); err != nil {
		if legacyErr := validateLegacyCompletedUninstallResult(&result); legacyErr != nil {
			return nil, err
		}
		// Older installers persisted a terminal result through temp_cleanup but
		// omitted the final complete phase and final observation fields. Normalize
		// that shape in memory only. It is historical retry evidence, not proof of
		// the current uninstall state.
		result.CompletedPhases = append(result.CompletedPhases, "complete")
	}
	return &result, nil
}

func validateLegacyCompletedUninstallResult(result *uninstallResult) error {
	if result == nil {
		return errors.New("uninstall result is required")
	}
	if result.SchemaVersion != uninstallResultSchema {
		return fmt.Errorf("unsupported uninstall result schema %d", result.SchemaVersion)
	}
	if result.OperationID == "" {
		return errors.New("uninstall result operation identity is required")
	}
	if result.Mode != "standard" && result.Mode != "remove-data" {
		return fmt.Errorf("invalid uninstall mode %q", result.Mode)
	}
	if result.Outcome != uninstallComplete || result.Phase != "complete" || result.Error != "" {
		return errors.New("not a legacy completed uninstall result")
	}
	if _, err := time.Parse(time.RFC3339Nano, result.StartedAt); err != nil {
		return fmt.Errorf("invalid uninstall start timestamp: %w", err)
	}
	if _, err := time.Parse(time.RFC3339Nano, result.UpdatedAt); err != nil {
		return fmt.Errorf("invalid uninstall update timestamp: %w", err)
	}
	expected := []string{
		"service",
		"pos_processes",
		"pos_processes_verified",
		"pos_payload",
		"agent_payload",
	}
	if result.Mode == "remove-data" {
		expected = append(expected, "managed_data")
	} else {
		expected = append(expected, "managed_data_preserved")
	}
	expected = append(expected, "registry", "temp_cleanup")
	if len(result.CompletedPhases) != len(expected) {
		return fmt.Errorf("legacy completed uninstall phase count %d does not match %d", len(result.CompletedPhases), len(expected))
	}
	for index, phase := range expected {
		if result.CompletedPhases[index] != phase {
			return fmt.Errorf("legacy completed uninstall phase %q does not match %q", result.CompletedPhases[index], phase)
		}
	}
	return nil
}

func writeUninstallResult(path string, result *uninstallResult) error {
	if path == "" || result == nil {
		return errors.New("uninstall result path and value are required")
	}
	if result.SchemaVersion == 0 {
		result.SchemaVersion = uninstallResultSchema
	}
	result.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	if err := validateUninstallResult(result); err != nil {
		return fmt.Errorf("validate uninstall result: %w", err)
	}
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("encode uninstall result: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create uninstall result directory: %w", err)
	}
	tempPath := path + ".tmp-" + result.OperationID
	if err := os.WriteFile(tempPath, append(data, '\n'), 0o600); err != nil {
		return fmt.Errorf("write uninstall result temporary file: %w", err)
	}
	from, fromErr := windows.UTF16PtrFromString(tempPath)
	to, toErr := windows.UTF16PtrFromString(path)
	if fromErr != nil || toErr != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("encode uninstall result paths: %v %v", fromErr, toErr)
	}
	if err := windows.MoveFileEx(from, to, windows.MOVEFILE_REPLACE_EXISTING|windows.MOVEFILE_WRITE_THROUGH); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("replace uninstall result: %w", err)
	}
	return nil
}

func markUninstallPhase(result *uninstallResult, phase string) error {
	if err := validateUninstallPhaseTransition(result, phase); err != nil {
		return err
	}
	result.Phase = phase
	for _, completed := range result.CompletedPhases {
		if completed == phase {
			return nil
		}
	}
	result.CompletedPhases = append(result.CompletedPhases, phase)
	return nil
}

func markUninstallFailure(result *uninstallResult, err error) error {
	var legacyScopeErr *legacyUnownedScopeError
	if errors.As(err, &legacyScopeErr) {
		return markUninstallFailureWithReason(result, err, uninstallReasonLegacyUnownedScope)
	}
	return markUninstallFailureWithReason(result, err, "")
}

func markUninstallFailureWithReason(result *uninstallResult, err error, reasonCode string) error {
	if result == nil {
		return errors.New("uninstall result is required")
	}
	if result.Outcome != uninstallPending {
		return fmt.Errorf("cannot replace terminal uninstall outcome %q", result.Outcome)
	}
	result.Outcome = uninstallFailed
	if len(result.CompletedPhases) > 0 || reasonCode == uninstallReasonLegacyUnownedScope {
		result.Outcome = uninstallPartial
	}
	if reasonCode != "" {
		result.ReasonCode = reasonCode
	}
	result.Error = sanitizeUninstallError(err)
	if errors.Is(err, windows.ERROR_SEM_TIMEOUT) || strings.Contains(strings.ToLower(result.Error), "timeout") {
		result.Outcome = uninstallTimedOut
	}
	return nil
}

func sanitizeUninstallError(err error) string {
	if err == nil {
		return ""
	}
	message := err.Error()
	for _, secret := range []string{"password", "token", "credential", "authorization", "bearer"} {
		if strings.Contains(strings.ToLower(message), secret) {
			return "sanitized uninstall error"
		}
	}
	return message
}

func recoverStaleUninstallResult(path string, now time.Time) (*uninstallResult, error) {
	result, err := loadUninstallResult(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("recover uninstall result: %w", err)
	}
	if result.Outcome != uninstallPending {
		return result, nil
	}
	updated, parseErr := time.Parse(time.RFC3339Nano, result.UpdatedAt)
	if parseErr != nil {
		return nil, fmt.Errorf("recover uninstall result timestamp: %w", parseErr)
	}
	if now.Sub(updated) < uninstallPendingTimeout {
		return nil, fmt.Errorf("uninstall operation %s is still pending", result.OperationID)
	}
	result.Outcome = uninstallCrashed
	result.Phase = "recovery"
	result.Error = "previous uninstall operation exceeded pending timeout"
	if err := writeUninstallResult(path, result); err != nil {
		return nil, err
	}
	return result, nil
}
