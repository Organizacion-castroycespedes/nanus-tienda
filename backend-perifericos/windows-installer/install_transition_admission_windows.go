package main

// Task 14.4a (windows-uninstall-process-lifecycle, design 5.2): pure,
// fail-closed A-to-B UPDATE admission policy and typed transition-plan model.
//
// This file performs no I/O and has no product caller. Eligibility is not
// permission to execute: execution stays disabled until 14.4b (native executor)
// and 14.4c (isolated VM certification) pass. The production allowlist is
// intentionally empty while C-2 (per-build POS versioning) is unresolved, so no
// real qa.16-to-qa.17 transition is approved here.

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"time"

	"golang.org/x/sys/windows/svc"
)

// installTransitionExecutionEnabled is the single execution switch for 14.4a.
// It must stay false until 14.4b and 14.4c evidence exists.
const installTransitionExecutionEnabled = false

// approvedInstallTransitions is the production allowlist. Adding an entry
// requires resolved C-2, recorded artifact SHA-256 values and 14.4c evidence.
var approvedInstallTransitions []installTransitionApproval

// installTransitionArtifact pins a payload by version label and canonical digest.
type installTransitionArtifact struct {
	Version       string
	PayloadDigest string
}

// installTransitionApproval is one exact, explicitly approved source/target pair.
type installTransitionApproval struct {
	ID                      string
	CandidateArtifactSHA256 string
	SourceAgent             installTransitionArtifact
	TargetAgent             installTransitionArtifact
	SourcePOS               installTransitionArtifact
	TargetPOS               installTransitionArtifact
	ServiceAccount          string
	QAEnvironment           string // digest of non-secret endpoint/audience/key-id tuple
}

type installTransitionProtectedKind string

const (
	installTransitionProtectedInstallationID installTransitionProtectedKind = "installation_id"
	installTransitionProtectedDeviceRegistry installTransitionProtectedKind = "device_registry"
	installTransitionProtectedAgentConfig    installTransitionProtectedKind = "agent_config"
	installTransitionProtectedDPAPISet       installTransitionProtectedKind = "dpapi_secret_set"
	installTransitionProtectedACLBaseline    installTransitionProtectedKind = "acl_baseline"
)

var installTransitionRequiredProtected = []installTransitionProtectedKind{
	installTransitionProtectedInstallationID,
	installTransitionProtectedDeviceRegistry,
	installTransitionProtectedAgentConfig,
	installTransitionProtectedDPAPISet,
	installTransitionProtectedACLBaseline,
}

// installTransitionProtectedItem carries only presence and a digest. Contents,
// plaintext secrets and DPAPI-decrypted values never enter this model.
type installTransitionProtectedItem struct {
	Kind     installTransitionProtectedKind
	Presence installAdmissionPresence
	SHA256   string
}

// installTransitionEvidence is an observation supplied by a future native
// observer (14.4b). The policy trusts none of it without cross-checks.
type installTransitionEvidence struct {
	CandidateArtifactSHA256 string
	InstalledAgent          installTransitionArtifact
	CandidateAgent          installTransitionArtifact
	InstalledPOS            installTransitionArtifact
	CandidatePOS            installTransitionArtifact
	Service                 installAdmissionService
	AgentCurrent            installAdmissionPath
	POSCurrent              installAdmissionPath
	TargetAgentRoot         installAdmissionPath
	TargetPOSRoot           installAdmissionPath
	Registration            installAdmissionRegistration
	QAEnvironment           string
	ProtectedState          []installTransitionProtectedItem
}

type installTransitionDecision struct {
	State              installAdmissionState
	Reason             string
	ApprovalID         string
	Eligible           bool
	ExecutionPermitted bool
}

func rejectInstallTransition(state installAdmissionState, reason string, cause error) (installTransitionDecision, error) {
	return installTransitionDecision{State: state, Reason: reason}, &installAdmissionError{State: state, Reason: reason, Cause: cause}
}

func installTransitionHex64(value string) bool {
	return len(value) == 64 && strings.Trim(value, "0123456789abcdef") == ""
}

func installTransitionArtifactValid(a installTransitionArtifact) bool {
	return validInstallAdmissionVersion(a.Version) && installTransitionHex64(a.PayloadDigest)
}

func installTransitionSamePath(left, right string) bool {
	if strings.TrimSpace(left) == "" || strings.TrimSpace(right) == "" {
		return false
	}
	return strings.EqualFold(filepath.Clean(left), filepath.Clean(right))
}

// installTransitionFile is one payload file for canonical digest computation.
type installTransitionFile struct {
	RelativePath string
	Size         int64
	SHA256       string
}

// installTransitionPayloadDigest computes an order- and case-independent digest
// of a payload file list. Malformed, absolute, escaping or duplicate paths fail.
func installTransitionPayloadDigest(files []installTransitionFile) (string, error) {
	if len(files) == 0 {
		return "", errors.New("payload_empty")
	}
	type entry struct {
		key, sha string
		size     int64
	}
	entries := make([]entry, 0, len(files))
	seen := map[string]bool{}
	for _, file := range files {
		path := strings.ReplaceAll(file.RelativePath, `\`, "/")
		if path == "" || strings.HasPrefix(path, "/") || filepath.VolumeName(file.RelativePath) != "" || strings.Contains(path, ":") {
			return "", errors.New("payload_path_invalid")
		}
		for _, part := range strings.Split(path, "/") {
			if part == "" || part == "." || part == ".." {
				return "", errors.New("payload_path_invalid")
			}
		}
		key := strings.ToLower(path)
		if seen[key] {
			return "", errors.New("payload_path_duplicate")
		}
		seen[key] = true
		if file.Size < 0 || !installTransitionHex64(file.SHA256) {
			return "", errors.New("payload_entry_invalid")
		}
		entries = append(entries, entry{key: key, sha: file.SHA256, size: file.Size})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].key < entries[j].key })
	h := sha256.New()
	for _, e := range entries {
		fmt.Fprintf(h, "%s\x00%d\x00%s\n", e.key, e.size, e.sha)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// validateInstallTransitionApprovals rejects the whole allowlist when any entry is
// malformed or ambiguous; a partially trusted allowlist is never used.
func validateInstallTransitionApprovals(approvals []installTransitionApproval) error {
	ids := map[string]bool{}
	sources := map[string]bool{}
	for _, a := range approvals {
		if strings.TrimSpace(a.ID) == "" || ids[a.ID] {
			return errors.New("approval_id_invalid")
		}
		ids[a.ID] = true
		if !installTransitionHex64(a.CandidateArtifactSHA256) || !installTransitionHex64(a.QAEnvironment) {
			return errors.New("approval_provenance_invalid")
		}
		for _, artifact := range []installTransitionArtifact{a.SourceAgent, a.TargetAgent, a.SourcePOS, a.TargetPOS} {
			if !installTransitionArtifactValid(artifact) {
				return errors.New("approval_artifact_invalid")
			}
		}
		if a.SourceAgent.Version == a.TargetAgent.Version || a.SourceAgent.PayloadDigest == a.TargetAgent.PayloadDigest {
			return errors.New("approval_agent_not_distinct")
		}
		// C-2: source and target POS identities must be distinct labels and bytes.
		if strings.EqualFold(a.SourcePOS.Version, a.TargetPOS.Version) || a.SourcePOS.PayloadDigest == a.TargetPOS.PayloadDigest {
			return errors.New("approval_pos_not_distinct")
		}
		if !sameWindowsIdentity(a.ServiceAccount, "NT AUTHORITY\\LocalService") {
			return errors.New("approval_service_account_invalid")
		}
		if sources[a.SourceAgent.Version] {
			return errors.New("approval_source_ambiguous")
		}
		sources[a.SourceAgent.Version] = true
	}
	return nil
}

// classifyInstallTransition decides UPDATE eligibility for an exact approved pair.
// It is pure: it reads only its arguments and never performs effects. Every
// non-eligible result returns an error; FRESH and REPAIR remain decided solely by
// classifyInstallAdmission, which this function never consults or changes.
func classifyInstallTransition(approvals []installTransitionApproval, m installerManifest, l runtimeLayout, ev installTransitionEvidence) (installTransitionDecision, error) {
	if err := validateInstallTransitionApprovals(approvals); err != nil {
		return rejectInstallTransition(installAdmissionUnknown, "transition_policy_invalid", err)
	}
	if !validInstallAdmissionVersion(m.Version) || !validInstallAdmissionVersion(m.PosVersion) || m.ServiceName != serviceName || !sameWindowsIdentity(m.ServiceAccount, "NT AUTHORITY\\LocalService") || l.VersionsRoot == "" || l.CurrentRoot == "" || l.POSVersionsRoot == "" || l.POSCurrentRoot == "" {
		return rejectInstallTransition(installAdmissionUnknown, "candidate_unproven", nil)
	}
	known := func(p installAdmissionPresence) bool {
		return p == installEvidencePresent || p == installEvidenceAbsent
	}
	for _, artifact := range []installTransitionArtifact{ev.InstalledAgent, ev.CandidateAgent, ev.InstalledPOS, ev.CandidatePOS} {
		if !installTransitionArtifactValid(artifact) {
			return rejectInstallTransition(installAdmissionUnknown, "transition_evidence_incomplete", nil)
		}
	}
	if !installTransitionHex64(ev.CandidateArtifactSHA256) || !installTransitionHex64(ev.QAEnvironment) {
		return rejectInstallTransition(installAdmissionUnknown, "transition_evidence_incomplete", nil)
	}
	for _, p := range []installAdmissionPath{ev.AgentCurrent, ev.POSCurrent, ev.TargetAgentRoot, ev.TargetPOSRoot} {
		if !known(p.Presence) || p.Fingerprint == "" {
			return rejectInstallTransition(installAdmissionUnknown, "path_observation_incomplete", nil)
		}
	}
	if !known(ev.Service.Presence) || !known(ev.Registration.Presence) {
		return rejectInstallTransition(installAdmissionUnknown, "system_observation_incomplete", nil)
	}
	if ev.Service.Presence != installEvidencePresent || ev.Registration.Presence != installEvidencePresent || ev.AgentCurrent.Presence != installEvidencePresent || ev.POSCurrent.Presence != installEvidencePresent {
		return rejectInstallTransition(installAdmissionPartial, "incomplete_footprints", nil)
	}
	if ev.CandidateAgent.Version != m.Version || ev.CandidatePOS.Version != m.PosVersion {
		return rejectInstallTransition(installAdmissionUnknown, "candidate_metadata_mismatch", nil)
	}
	// Same-version installations are REPAIR territory under P0-B, never UPDATE.
	if ev.InstalledAgent.Version == ev.CandidateAgent.Version {
		return rejectInstallTransition(installAdmissionUnknown, "transition_not_update", nil)
	}
	// C-2: a reused POS label is never an update, whatever its bytes.
	if strings.EqualFold(ev.InstalledPOS.Version, ev.CandidatePOS.Version) {
		if ev.InstalledPOS.PayloadDigest != ev.CandidatePOS.PayloadDigest {
			return rejectInstallTransition(installAdmissionUnknown, "pos_label_collision", nil)
		}
		return rejectInstallTransition(installAdmissionUnknown, "pos_identity_unchanged", nil)
	}
	var approval *installTransitionApproval
	for index := range approvals {
		if approvals[index].SourceAgent.Version == ev.InstalledAgent.Version {
			approval = &approvals[index]
			break
		}
	}
	if approval == nil {
		return rejectInstallTransition(installAdmissionUnknown, "transition_unproven", nil)
	}
	switch {
	case approval.SourceAgent.PayloadDigest != ev.InstalledAgent.PayloadDigest:
		return rejectInstallTransition(installAdmissionUnknown, "source_bytes_differ", nil)
	case approval.TargetAgent.Version != ev.CandidateAgent.Version:
		return rejectInstallTransition(installAdmissionUnknown, "target_unapproved", nil)
	case approval.TargetAgent.PayloadDigest != ev.CandidateAgent.PayloadDigest:
		return rejectInstallTransition(installAdmissionUnknown, "candidate_bytes_differ", nil)
	case approval.SourcePOS.Version != ev.InstalledPOS.Version:
		return rejectInstallTransition(installAdmissionUnknown, "pos_source_mismatch", nil)
	case approval.SourcePOS.PayloadDigest != ev.InstalledPOS.PayloadDigest:
		return rejectInstallTransition(installAdmissionUnknown, "pos_source_bytes_differ", nil)
	case approval.TargetPOS.Version != ev.CandidatePOS.Version:
		return rejectInstallTransition(installAdmissionUnknown, "pos_target_unapproved", nil)
	case approval.TargetPOS.PayloadDigest != ev.CandidatePOS.PayloadDigest:
		return rejectInstallTransition(installAdmissionUnknown, "pos_candidate_bytes_differ", nil)
	case approval.CandidateArtifactSHA256 != ev.CandidateArtifactSHA256:
		return rejectInstallTransition(installAdmissionUnknown, "artifact_provenance_mismatch", nil)
	case approval.QAEnvironment != ev.QAEnvironment:
		return rejectInstallTransition(installAdmissionUnknown, "qa_environment_mismatch", nil)
	}
	sourceRoot := filepath.Join(l.VersionsRoot, approval.SourceAgent.Version)
	sourcePOSRoot := filepath.Join(l.POSVersionsRoot, approval.SourcePOS.Version)
	args := m.ServiceArgs
	if len(args) == 0 {
		args = []string{"service"}
	}
	if !sameWindowsIdentity(ev.Service.Account, approval.ServiceAccount) || !sameWindowsIdentity(ev.Service.Account, m.ServiceAccount) {
		return rejectInstallTransition(installAdmissionPartial, "service_identity_changed", nil)
	}
	if !strings.EqualFold(ev.Service.Binary, buildServiceBinaryPath(filepath.Join(sourceRoot, "ManusTerminalSetup.exe"), args...)) {
		return rejectInstallTransition(installAdmissionPartial, "service_registration_mismatch", nil)
	}
	if (ev.Service.State != svc.Running && ev.Service.State != svc.Stopped) || (ev.Service.State == svc.Running && ev.Service.PID == 0) || (ev.Service.State == svc.Stopped && ev.Service.PID != 0) {
		return rejectInstallTransition(installAdmissionUnknown, "service_state_uncertain", nil)
	}
	if !ev.AgentCurrent.Directory || !installTransitionSamePath(ev.AgentCurrent.Target, sourceRoot) {
		return rejectInstallTransition(installAdmissionPartial, "activation_mismatch", nil)
	}
	if !ev.POSCurrent.Directory || !installTransitionSamePath(ev.POSCurrent.Target, sourcePOSRoot) {
		return rejectInstallTransition(installAdmissionPartial, "pos_activation_mismatch", nil)
	}
	if ev.Registration.Version != approval.SourceAgent.Version || !installTransitionSamePath(ev.Registration.Location, l.CurrentRoot) {
		return rejectInstallTransition(installAdmissionPartial, "registration_mismatch", nil)
	}
	expectedCommand := buildUninstallMetadata(l, m, time.Time{})["UninstallString"]
	if !strings.EqualFold(ev.Registration.Uninstall, expectedCommand) || (!strings.EqualFold(ev.Registration.Quiet, expectedCommand) && !strings.EqualFold(ev.Registration.Quiet, expectedCommand+" --remove-data")) {
		return rejectInstallTransition(installAdmissionPartial, "registration_command_mismatch", nil)
	}
	if ev.TargetAgentRoot.Presence != installEvidenceAbsent || ev.TargetPOSRoot.Presence != installEvidenceAbsent {
		return rejectInstallTransition(installAdmissionPartial, "target_root_present", nil)
	}
	if err := validateInstallTransitionProtectedState(ev.ProtectedState); err != nil {
		return rejectInstallTransition(installAdmissionUnknown, "protected_state_incomplete", err)
	}
	return installTransitionDecision{
		State:              installAdmissionUpdate,
		Reason:             "approved_exact_pair",
		ApprovalID:         approval.ID,
		Eligible:           true,
		ExecutionPermitted: installTransitionExecutionEnabled,
	}, nil
}

func validateInstallTransitionProtectedState(items []installTransitionProtectedItem) error {
	required := map[installTransitionProtectedKind]bool{}
	for _, kind := range installTransitionRequiredProtected {
		required[kind] = true
	}
	seen := map[installTransitionProtectedKind]bool{}
	for _, item := range items {
		if !required[item.Kind] {
			return errors.New("protected_kind_unsupported")
		}
		if seen[item.Kind] {
			return errors.New("protected_kind_duplicate")
		}
		seen[item.Kind] = true
		if item.Presence != installEvidencePresent || !installTransitionHex64(item.SHA256) {
			return fmt.Errorf("protected_%s_unproven", item.Kind)
		}
	}
	for _, kind := range installTransitionRequiredProtected {
		if !seen[kind] {
			return fmt.Errorf("protected_%s_missing", kind)
		}
	}
	return nil
}

func normalizeInstallTransitionEvidence(ev installTransitionEvidence) installTransitionEvidence {
	items := append([]installTransitionProtectedItem(nil), ev.ProtectedState...)
	sort.SliceStable(items, func(i, j int) bool { return items[i].Kind < items[j].Kind })
	ev.ProtectedState = items
	return ev
}

// confirmInstallTransition observes twice around classification. Any observer
// failure or any difference between observations rejects as UNKNOWN.
func confirmInstallTransition(approvals []installTransitionApproval, m installerManifest, l runtimeLayout, observe func() (installTransitionEvidence, error)) (installTransitionDecision, error) {
	if observe == nil {
		return rejectInstallTransition(installAdmissionUnknown, "observer_missing", nil)
	}
	first, err := observe()
	if err != nil {
		return rejectInstallTransition(installAdmissionUnknown, "observation_failed", err)
	}
	decision, err := classifyInstallTransition(approvals, m, l, first)
	if err != nil {
		return decision, err
	}
	second, err := observe()
	if err != nil {
		return rejectInstallTransition(installAdmissionUnknown, "revalidation_failed", err)
	}
	if !reflect.DeepEqual(normalizeInstallTransitionEvidence(first), normalizeInstallTransitionEvidence(second)) {
		return rejectInstallTransition(installAdmissionUnknown, "evidence_changed", nil)
	}
	return decision, nil
}

// requireInstallTransitionExecution is the only gate a future caller may use
// before effects. In 14.4a it always refuses, including for eligible pairs.
func requireInstallTransitionExecution(d installTransitionDecision) error {
	if d.State != installAdmissionUpdate || !d.Eligible {
		return &installAdmissionError{State: installAdmissionUnknown, Reason: "update_not_eligible"}
	}
	if !installTransitionExecutionEnabled || !d.ExecutionPermitted {
		return &installAdmissionError{State: d.State, Reason: "update_execution_disabled"}
	}
	return nil
}

type installTransitionStepKind string

const (
	txStepRecordPlan             installTransitionStepKind = "record_durable_plan"
	txStepRecordProtectedDigests installTransitionStepKind = "record_protected_state_digests"
	txStepVerifyRecord           installTransitionStepKind = "verify_durable_record"
	txStepPreflightPOSClosed     installTransitionStepKind = "preflight_pos_closed"
	txStepStageAgent             installTransitionStepKind = "stage_target_agent"
	txStepStagePOS               installTransitionStepKind = "stage_target_pos"
	txStepValidateStaging        installTransitionStepKind = "validate_staging"
	txStepStopService            installTransitionStepKind = "stop_service"
	txStepConfirmStopped         installTransitionStepKind = "confirm_service_stopped"
	txStepConfirmPortReleased    installTransitionStepKind = "confirm_port_released"
	txStepSwitchPOSJunction      installTransitionStepKind = "switch_pos_junction"
	txStepSwitchAgentJunction    installTransitionStepKind = "switch_agent_junction"
	txStepSetServiceBinary       installTransitionStepKind = "set_service_binary"
	txStepStartService           installTransitionStepKind = "start_service"
	txStepPostcheck              installTransitionStepKind = "postcheck"
	txStepWriteUninstallMetadata installTransitionStepKind = "write_uninstall_metadata"

	txStepRestoreServiceBinary  installTransitionStepKind = "restore_service_binary"
	txStepRestoreAgentJunction  installTransitionStepKind = "restore_agent_junction"
	txStepRestorePOSJunction    installTransitionStepKind = "restore_pos_junction"
	txStepVerifySourceHealth    installTransitionStepKind = "verify_source_health"
	txStepVerifyProtectedState  installTransitionStepKind = "verify_protected_state"
	txStepVerifyACLBaseline     installTransitionStepKind = "verify_acl_baseline"
	txStepVerifyRetainedPayload installTransitionStepKind = "verify_retained_payloads"
)

// installTransitionStep is a modeled step. Nothing in this file executes it.
type installTransitionStep struct {
	Kind    installTransitionStepKind
	Target  string
	Mutates bool
}

type installTransitionPlan struct {
	ApprovalID       string
	SourceAgentRoot  string
	TargetAgentRoot  string
	SourcePOSRoot    string
	TargetPOSRoot    string
	Forward          []installTransitionStep
	Rollback         []installTransitionStep
	RetainedPayloads []string
}

func buildInstallTransitionPlan(d installTransitionDecision, approvals []installTransitionApproval, l runtimeLayout) (installTransitionPlan, error) {
	if d.State != installAdmissionUpdate || !d.Eligible || d.ApprovalID == "" {
		return installTransitionPlan{}, errors.New("plan_requires_eligible_update")
	}
	if err := validateInstallTransitionApprovals(approvals); err != nil {
		return installTransitionPlan{}, err
	}
	var approval *installTransitionApproval
	for index := range approvals {
		if approvals[index].ID == d.ApprovalID {
			approval = &approvals[index]
		}
	}
	if approval == nil {
		return installTransitionPlan{}, errors.New("plan_approval_missing")
	}
	p := installTransitionPlan{
		ApprovalID:      approval.ID,
		SourceAgentRoot: filepath.Join(l.VersionsRoot, approval.SourceAgent.Version),
		TargetAgentRoot: filepath.Join(l.VersionsRoot, approval.TargetAgent.Version),
		SourcePOSRoot:   filepath.Join(l.POSVersionsRoot, approval.SourcePOS.Version),
		TargetPOSRoot:   filepath.Join(l.POSVersionsRoot, approval.TargetPOS.Version),
	}
	p.RetainedPayloads = []string{p.SourceAgentRoot, p.SourcePOSRoot}
	p.Forward = []installTransitionStep{
		{Kind: txStepRecordPlan},
		{Kind: txStepRecordProtectedDigests},
		{Kind: txStepVerifyRecord},
		{Kind: txStepPreflightPOSClosed},
		{Kind: txStepStageAgent, Target: p.TargetAgentRoot, Mutates: true},
		{Kind: txStepStagePOS, Target: p.TargetPOSRoot, Mutates: true},
		{Kind: txStepValidateStaging},
		{Kind: txStepStopService, Mutates: true},
		{Kind: txStepConfirmStopped},
		{Kind: txStepConfirmPortReleased},
		{Kind: txStepSwitchPOSJunction, Target: p.TargetPOSRoot, Mutates: true},
		{Kind: txStepSwitchAgentJunction, Target: p.TargetAgentRoot, Mutates: true},
		{Kind: txStepSetServiceBinary, Target: filepath.Join(p.TargetAgentRoot, "ManusTerminalSetup.exe"), Mutates: true},
		{Kind: txStepStartService, Mutates: true},
		{Kind: txStepPostcheck},
		{Kind: txStepWriteUninstallMetadata, Mutates: true},
	}
	p.Rollback = []installTransitionStep{
		{Kind: txStepStopService, Mutates: true},
		{Kind: txStepConfirmStopped},
		{Kind: txStepConfirmPortReleased},
		{Kind: txStepRestoreServiceBinary, Target: filepath.Join(p.SourceAgentRoot, "ManusTerminalSetup.exe"), Mutates: true},
		{Kind: txStepRestoreAgentJunction, Target: p.SourceAgentRoot, Mutates: true},
		{Kind: txStepRestorePOSJunction, Target: p.SourcePOSRoot, Mutates: true},
		{Kind: txStepStartService, Mutates: true},
		{Kind: txStepVerifySourceHealth},
		{Kind: txStepVerifyProtectedState},
		{Kind: txStepVerifyACLBaseline},
		{Kind: txStepVerifyRetainedPayload},
	}
	return p, validateInstallTransitionPlan(p)
}

func installTransitionStepIndex(steps []installTransitionStep, kind installTransitionStepKind) int {
	for index, step := range steps {
		if step.Kind == kind {
			return index
		}
	}
	return -1
}

// validateInstallTransitionPlan enforces the design 5.2 ordering, retention and
// rollback-completeness invariants on a modeled plan.
func validateInstallTransitionPlan(p installTransitionPlan) error {
	if p.ApprovalID == "" || p.SourceAgentRoot == "" || p.TargetAgentRoot == "" || p.SourcePOSRoot == "" || p.TargetPOSRoot == "" {
		return errors.New("plan_identity_incomplete")
	}
	if installTransitionSamePath(p.SourceAgentRoot, p.TargetAgentRoot) || installTransitionSamePath(p.SourcePOSRoot, p.TargetPOSRoot) {
		return errors.New("plan_roots_not_distinct")
	}
	seen := map[installTransitionStepKind]bool{}
	for _, step := range p.Forward {
		if seen[step.Kind] {
			return fmt.Errorf("plan_step_duplicate_%s", step.Kind)
		}
		seen[step.Kind] = true
	}
	order := []installTransitionStepKind{
		txStepRecordPlan, txStepRecordProtectedDigests, txStepVerifyRecord, txStepPreflightPOSClosed,
		txStepStageAgent, txStepStagePOS, txStepValidateStaging,
		txStepStopService, txStepConfirmStopped, txStepConfirmPortReleased,
		txStepSwitchPOSJunction, txStepSwitchAgentJunction, txStepSetServiceBinary, txStepStartService,
		txStepPostcheck, txStepWriteUninstallMetadata,
	}
	if len(p.Forward) != len(order) {
		return errors.New("plan_forward_incomplete")
	}
	for index, kind := range order {
		if p.Forward[index].Kind != kind {
			return fmt.Errorf("plan_forward_order_%s", kind)
		}
	}
	for _, step := range p.Forward {
		switch step.Kind {
		case txStepStageAgent, txStepSwitchAgentJunction:
			if !installTransitionSamePath(step.Target, p.TargetAgentRoot) {
				return errors.New("plan_agent_target_invalid")
			}
		case txStepStagePOS, txStepSwitchPOSJunction:
			if !installTransitionSamePath(step.Target, p.TargetPOSRoot) {
				return errors.New("plan_pos_target_invalid")
			}
		}
		for _, retained := range []string{p.SourceAgentRoot, p.SourcePOSRoot} {
			if step.Mutates && step.Target != "" && (installTransitionSamePath(step.Target, retained) || pathWithinRoot(step.Target, retained)) {
				return errors.New("plan_mutates_source_payload")
			}
		}
	}
	retained := 0
	for _, path := range p.RetainedPayloads {
		if installTransitionSamePath(path, p.SourceAgentRoot) || installTransitionSamePath(path, p.SourcePOSRoot) {
			retained++
		}
	}
	if retained != 2 || len(p.RetainedPayloads) != 2 {
		return errors.New("plan_retention_incomplete")
	}
	rollbackOrder := []installTransitionStepKind{
		txStepStopService, txStepConfirmStopped, txStepConfirmPortReleased,
		txStepRestoreServiceBinary, txStepRestoreAgentJunction, txStepRestorePOSJunction, txStepStartService,
		txStepVerifySourceHealth, txStepVerifyProtectedState, txStepVerifyACLBaseline, txStepVerifyRetainedPayload,
	}
	if len(p.Rollback) != len(rollbackOrder) {
		return errors.New("plan_rollback_incomplete")
	}
	for index, kind := range rollbackOrder {
		if p.Rollback[index].Kind != kind {
			return fmt.Errorf("plan_rollback_order_%s", kind)
		}
	}
	for _, step := range p.Rollback {
		switch step.Kind {
		case txStepRestoreAgentJunction:
			if !installTransitionSamePath(step.Target, p.SourceAgentRoot) {
				return errors.New("plan_rollback_agent_target_invalid")
			}
		case txStepRestorePOSJunction:
			if !installTransitionSamePath(step.Target, p.SourcePOSRoot) {
				return errors.New("plan_rollback_pos_target_invalid")
			}
		case txStepRestoreServiceBinary:
			if !installTransitionSamePath(step.Target, filepath.Join(p.SourceAgentRoot, "ManusTerminalSetup.exe")) {
				return errors.New("plan_rollback_binary_target_invalid")
			}
		}
	}
	return nil
}
