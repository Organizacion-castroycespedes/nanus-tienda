package main

// 14.4b UPDATE executor (stage 1): a journaled, recoverable interpreter for the
// 14.4a transition plan. It performs effects only through the injected
// installTransitionSystem and installTransitionJournalStore seams; this file
// imports no effect-capable package and has no product caller. The production
// gate is requireInstallTransitionExecution, which refuses every decision while
// installTransitionExecutionEnabled is false and approvedInstallTransitions is
// empty, so no real installation can run through this code.

import (
	"errors"
	"fmt"
	"path/filepath"
)

const installTransitionJournalSchema = 1

type installTransitionJournalState string

const (
	txJournalInProgress installTransitionJournalState = "IN_PROGRESS"
	txJournalCommitted  installTransitionJournalState = "COMMITTED"
	txJournalAborted    installTransitionJournalState = "ABORTED_NO_ACTIVATION"
	txJournalRolledBack installTransitionJournalState = "ROLLED_BACK"
	txJournalPartial    installTransitionJournalState = "PARTIAL"
)

// installTransitionJournal is the durable update record. It holds paths,
// versions and digests only; never secret contents.
type installTransitionJournal struct {
	Schema             int
	ApprovalID         string
	SourceAgentVersion string
	TargetAgentVersion string
	State              installTransitionJournalState
	Completed          []installTransitionStepKind
	RollbackCompleted  []installTransitionStepKind
	PriorServiceBinary string
	PriorAgentJunction string
	PriorPOSJunction   string
	InstallationID     string
	ProtectedState     []installTransitionProtectedItem
	Failure            string
}

// installTransitionJournalStore persists the journal outside every payload the
// update replaces. Lock is exclusive and non-blocking; Save must be durable.
type installTransitionJournalStore interface {
	Lock() (func() error, error)
	Load() (installTransitionJournal, bool, error)
	Save(installTransitionJournal) error
}

// installTransitionSystem is the seam for every native effect and observation.
type installTransitionSystem interface {
	POSProcessRunning() (bool, error)
	ProtectedState() ([]installTransitionProtectedItem, error)
	InstallationID() (string, error)
	ServiceBinary() (string, error)
	JunctionTarget(link string) (string, error)
	PathAbsent(path string) (bool, error)
	StagePayload(kind, target string) error
	ValidateStaged(kind, target string) error
	StopService() error
	ServiceStopped() (bool, error)
	PortReleased() (bool, error)
	SetJunction(link, target string) error
	SetServiceBinary(path string) error
	StartService() error
	Health() (version, installationID string, err error)
	WriteUninstallMetadata(version string) error
	PayloadIntact(root string) error
}

// installTransitionTarget names the live links and versions for one plan.
type installTransitionTarget struct {
	AgentCurrent       string
	POSCurrent         string
	SourceAgentVersion string
	TargetAgentVersion string
}

type installTransitionResult struct {
	State  installTransitionJournalState
	Step   installTransitionStepKind
	Reason string
}

func (r installTransitionResult) Error() string {
	return fmt.Sprintf("install transition %s at %s: %s", r.State, r.Step, r.Reason)
}

func txServiceBinary(root string) string {
	return filepath.Join(root, "ManusTerminalSetup.exe")
}

func txProtectedItem(items []installTransitionProtectedItem, kind installTransitionProtectedKind) installTransitionProtectedItem {
	for _, item := range items {
		if item.Kind == kind {
			return item
		}
	}
	return installTransitionProtectedItem{}
}

func txProtectedEqual(a, b []installTransitionProtectedItem) bool {
	if len(a) != len(b) {
		return false
	}
	index := map[installTransitionProtectedKind]installTransitionProtectedItem{}
	for _, item := range a {
		index[item.Kind] = item
	}
	for _, item := range b {
		if prior, ok := index[item.Kind]; !ok || prior != item {
			return false
		}
	}
	return true
}

// executeInstallTransition runs one admitted UPDATE. gate must be
// requireInstallTransitionExecution in production; tests inject a permissive
// gate to exercise the executor against fakes only.
func executeInstallTransition(d installTransitionDecision, p installTransitionPlan, t installTransitionTarget,
	sys installTransitionSystem, store installTransitionJournalStore,
	gate func(installTransitionDecision) error) (installTransitionResult, error) {
	if gate == nil {
		return refuseInstallTransition("execution_gate_missing")
	}
	if err := gate(d); err != nil {
		return refuseInstallTransition("execution_not_permitted: " + err.Error())
	}
	if err := validateInstallTransitionPlan(p); err != nil {
		return refuseInstallTransition("plan_invalid: " + err.Error())
	}
	if t.AgentCurrent == "" || t.POSCurrent == "" || t.SourceAgentVersion == "" || t.TargetAgentVersion == "" ||
		t.SourceAgentVersion == t.TargetAgentVersion ||
		!installTransitionSamePath(p.SourceAgentRoot, filepath.Join(filepath.Dir(p.SourceAgentRoot), t.SourceAgentVersion)) ||
		!installTransitionSamePath(p.TargetAgentRoot, filepath.Join(filepath.Dir(p.TargetAgentRoot), t.TargetAgentVersion)) {
		return refuseInstallTransition("target_invalid")
	}
	unlock, err := store.Lock()
	if err != nil {
		return refuseInstallTransition("transition_lock_held")
	}
	defer unlock()
	if _, exists, err := store.Load(); err != nil {
		return refuseInstallTransition("journal_unreadable")
	} else if exists {
		return refuseInstallTransition("journal_present_requires_recovery_or_review")
	}
	x := &txRun{p: p, t: t, sys: sys, store: store, j: installTransitionJournal{
		Schema: installTransitionJournalSchema, ApprovalID: p.ApprovalID, State: txJournalInProgress,
		SourceAgentVersion: t.SourceAgentVersion, TargetAgentVersion: t.TargetAgentVersion,
	}}
	return x.forward()
}

// recoverInstallTransition resolves an interrupted journal. An IN_PROGRESS
// journal is never resumed forward: if activation began it is rolled back,
// otherwise it is closed as aborted. Terminal journals are left for review.
func recoverInstallTransition(p installTransitionPlan, t installTransitionTarget,
	sys installTransitionSystem, store installTransitionJournalStore) (installTransitionResult, error) {
	if err := validateInstallTransitionPlan(p); err != nil {
		return refuseInstallTransition("plan_invalid: " + err.Error())
	}
	unlock, err := store.Lock()
	if err != nil {
		return refuseInstallTransition("transition_lock_held")
	}
	defer unlock()
	j, exists, err := store.Load()
	if err != nil {
		return refuseInstallTransition("journal_unreadable")
	}
	if !exists {
		return refuseInstallTransition("journal_absent")
	}
	if j.Schema != installTransitionJournalSchema || j.ApprovalID != p.ApprovalID ||
		j.SourceAgentVersion != t.SourceAgentVersion || j.TargetAgentVersion != t.TargetAgentVersion {
		return refuseInstallTransition("journal_does_not_match_plan")
	}
	if j.State != txJournalInProgress {
		return installTransitionResult{State: j.State, Reason: "journal_terminal"}, nil
	}
	x := &txRun{p: p, t: t, sys: sys, store: store, j: j}
	if !x.activationStarted() {
		x.j.State, x.j.Failure = txJournalAborted, "recovered_before_activation"
		if err := x.save(); err != nil {
			return x.partial("", "journal_save_failed_during_recovery")
		}
		return installTransitionResult{State: txJournalAborted, Reason: "recovered_before_activation"}, nil
	}
	if x.j.PriorServiceBinary == "" || x.j.PriorAgentJunction == "" || x.j.PriorPOSJunction == "" {
		return x.partial("", "recovery_prior_state_unrecorded")
	}
	return x.rollback("recovered_after_interruption")
}

func refuseInstallTransition(reason string) (installTransitionResult, error) {
	r := installTransitionResult{State: "REFUSED", Reason: reason}
	return r, r
}

type txRun struct {
	p     installTransitionPlan
	t     installTransitionTarget
	sys   installTransitionSystem
	store installTransitionJournalStore
	j     installTransitionJournal
}

func (x *txRun) save() error { return x.store.Save(x.j) }

func (x *txRun) done(kind installTransitionStepKind) bool {
	for _, completed := range x.j.Completed {
		if completed == kind {
			return true
		}
	}
	return false
}

// activationStarted reports whether the service stop may have been attempted.
// Staging validation is the last checkpoint before the stop, so an interruption
// after it is treated as activation in progress and is rolled back.
func (x *txRun) activationStarted() bool {
	return x.done(txStepValidateStaging)
}

func (x *txRun) partial(step installTransitionStepKind, reason string) (installTransitionResult, error) {
	x.j.State, x.j.Failure = txJournalPartial, reason
	_ = x.save() // best effort; PARTIAL is reported either way.
	r := installTransitionResult{State: txJournalPartial, Step: step, Reason: reason}
	return r, r
}

func (x *txRun) forward() (installTransitionResult, error) {
	stopIndex := installTransitionStepIndex(x.p.Forward, txStepStopService)
	for index, step := range x.p.Forward {
		if err := x.forwardStep(step); err != nil {
			reason := fmt.Sprintf("%s: %v", step.Kind, err)
			if index < stopIndex {
				// Nothing live changed: the source service, junctions and payloads are untouched.
				x.j.State, x.j.Failure = txJournalAborted, reason
				if saveErr := x.save(); saveErr != nil && step.Kind != txStepRecordPlan {
					return x.partial(step.Kind, reason+"; journal_save_failed")
				}
				r := installTransitionResult{State: txJournalAborted, Step: step.Kind, Reason: reason}
				return r, r
			}
			return x.rollback(reason)
		}
		x.j.Completed = append(x.j.Completed, step.Kind)
		if err := x.save(); err != nil {
			if index < stopIndex {
				r := installTransitionResult{State: txJournalAborted, Step: step.Kind, Reason: "journal_save_failed"}
				return r, r
			}
			return x.rollback(fmt.Sprintf("%s: journal_save_failed: %v", step.Kind, err))
		}
	}
	x.j.State = txJournalCommitted
	if err := x.save(); err != nil {
		return x.partial(txStepWriteUninstallMetadata, "commit_record_failed")
	}
	return installTransitionResult{State: txJournalCommitted, Reason: "committed"}, nil
}

func (x *txRun) forwardStep(step installTransitionStep) error {
	sys := x.sys
	switch step.Kind {
	case txStepRecordPlan:
		binary, err := sys.ServiceBinary()
		if err != nil {
			return err
		}
		agent, err := sys.JunctionTarget(x.t.AgentCurrent)
		if err != nil {
			return err
		}
		pos, err := sys.JunctionTarget(x.t.POSCurrent)
		if err != nil {
			return err
		}
		if !installTransitionSamePath(binary, txServiceBinary(x.p.SourceAgentRoot)) ||
			!installTransitionSamePath(agent, x.p.SourceAgentRoot) || !installTransitionSamePath(pos, x.p.SourcePOSRoot) {
			return errors.New("source_activation_mismatch")
		}
		x.j.PriorServiceBinary, x.j.PriorAgentJunction, x.j.PriorPOSJunction = binary, agent, pos
		return x.save()
	case txStepRecordProtectedDigests:
		items, err := sys.ProtectedState()
		if err != nil {
			return err
		}
		if err := validateInstallTransitionProtectedState(items); err != nil {
			return err
		}
		id, err := sys.InstallationID()
		if err != nil || id == "" {
			return errors.New("installation_id_unavailable")
		}
		x.j.ProtectedState, x.j.InstallationID = append([]installTransitionProtectedItem(nil), items...), id
		return x.save()
	case txStepVerifyRecord:
		stored, exists, err := x.store.Load()
		if err != nil || !exists {
			return errors.New("durable_record_unreadable")
		}
		if stored.ApprovalID != x.j.ApprovalID || stored.PriorServiceBinary != x.j.PriorServiceBinary ||
			stored.PriorAgentJunction != x.j.PriorAgentJunction || stored.PriorPOSJunction != x.j.PriorPOSJunction ||
			stored.InstallationID != x.j.InstallationID || !txProtectedEqual(stored.ProtectedState, x.j.ProtectedState) {
			return errors.New("durable_record_mismatch")
		}
		return nil
	case txStepPreflightPOSClosed:
		running, err := sys.POSProcessRunning()
		if err != nil {
			return errors.New("pos_process_scope_unknown")
		}
		if running {
			return errors.New("pos_running")
		}
		return nil
	case txStepStageAgent, txStepStagePOS:
		kind := "agent"
		if step.Kind == txStepStagePOS {
			kind = "pos"
		}
		absent, err := sys.PathAbsent(step.Target)
		if err != nil || !absent {
			return errors.New("staging_target_not_absent")
		}
		return sys.StagePayload(kind, step.Target)
	case txStepValidateStaging:
		if err := sys.ValidateStaged("agent", x.p.TargetAgentRoot); err != nil {
			return err
		}
		return sys.ValidateStaged("pos", x.p.TargetPOSRoot)
	case txStepStopService:
		return sys.StopService()
	case txStepConfirmStopped:
		stopped, err := sys.ServiceStopped()
		if err != nil || !stopped {
			return errors.New("service_not_stopped")
		}
		return nil
	case txStepConfirmPortReleased:
		released, err := sys.PortReleased()
		if err != nil || !released {
			return errors.New("port_not_released")
		}
		return nil
	case txStepSwitchPOSJunction:
		return sys.SetJunction(x.t.POSCurrent, x.p.TargetPOSRoot)
	case txStepSwitchAgentJunction:
		return sys.SetJunction(x.t.AgentCurrent, x.p.TargetAgentRoot)
	case txStepSetServiceBinary:
		return sys.SetServiceBinary(txServiceBinary(x.p.TargetAgentRoot))
	case txStepStartService:
		return sys.StartService()
	case txStepPostcheck:
		return x.verifyActive(x.p.TargetAgentRoot, x.p.TargetPOSRoot, x.t.TargetAgentVersion)
	case txStepWriteUninstallMetadata:
		return sys.WriteUninstallMetadata(x.t.TargetAgentVersion)
	}
	return fmt.Errorf("unknown_forward_step_%s", step.Kind)
}

// verifyActive checks version, identity, protected state and activation links.
func (x *txRun) verifyActive(agentRoot, posRoot, version string) error {
	healthVersion, id, err := x.sys.Health()
	if err != nil {
		return errors.New("health_unavailable")
	}
	if healthVersion != version {
		return errors.New("health_version_mismatch")
	}
	if id != x.j.InstallationID {
		return errors.New("installation_id_changed")
	}
	items, err := x.sys.ProtectedState()
	if err != nil || !txProtectedEqual(items, x.j.ProtectedState) {
		return errors.New("protected_state_changed")
	}
	binary, err := x.sys.ServiceBinary()
	if err != nil || !installTransitionSamePath(binary, txServiceBinary(agentRoot)) {
		return errors.New("service_binary_mismatch")
	}
	agent, err := x.sys.JunctionTarget(x.t.AgentCurrent)
	if err != nil || !installTransitionSamePath(agent, agentRoot) {
		return errors.New("agent_junction_mismatch")
	}
	pos, err := x.sys.JunctionTarget(x.t.POSCurrent)
	if err != nil || !installTransitionSamePath(pos, posRoot) {
		return errors.New("pos_junction_mismatch")
	}
	return nil
}

// rollback restores the recorded source activation and re-verifies it. Every
// restore step is idempotent; the first failure records PARTIAL and stops, so a
// rollback never reports success it has not proven.
func (x *txRun) rollback(cause string) (installTransitionResult, error) {
	x.j.Failure = cause
	_ = x.save()
	for _, step := range x.p.Rollback {
		if err := x.rollbackStep(step); err != nil {
			return x.partial(step.Kind, fmt.Sprintf("rollback %s failed: %v (cause: %s)", step.Kind, err, cause))
		}
		x.j.RollbackCompleted = append(x.j.RollbackCompleted, step.Kind)
		if err := x.save(); err != nil {
			return x.partial(step.Kind, "journal_save_failed_during_rollback (cause: "+cause+")")
		}
	}
	x.j.State = txJournalRolledBack
	if err := x.save(); err != nil {
		return x.partial("", "rollback_record_failed (cause: "+cause+")")
	}
	r := installTransitionResult{State: txJournalRolledBack, Reason: cause}
	return r, r
}

func (x *txRun) rollbackStep(step installTransitionStep) error {
	sys := x.sys
	switch step.Kind {
	case txStepStopService:
		if stopped, err := sys.ServiceStopped(); err == nil && stopped {
			return nil
		}
		return sys.StopService()
	case txStepConfirmStopped:
		stopped, err := sys.ServiceStopped()
		if err != nil || !stopped {
			return errors.New("service_not_stopped")
		}
		return nil
	case txStepConfirmPortReleased:
		released, err := sys.PortReleased()
		if err != nil || !released {
			return errors.New("port_not_released")
		}
		return nil
	case txStepRestoreServiceBinary:
		if current, err := sys.ServiceBinary(); err == nil && installTransitionSamePath(current, x.j.PriorServiceBinary) {
			return nil
		}
		return sys.SetServiceBinary(x.j.PriorServiceBinary)
	case txStepRestoreAgentJunction:
		if current, err := sys.JunctionTarget(x.t.AgentCurrent); err == nil && installTransitionSamePath(current, x.j.PriorAgentJunction) {
			return nil
		}
		return sys.SetJunction(x.t.AgentCurrent, x.j.PriorAgentJunction)
	case txStepRestorePOSJunction:
		if current, err := sys.JunctionTarget(x.t.POSCurrent); err == nil && installTransitionSamePath(current, x.j.PriorPOSJunction) {
			return nil
		}
		return sys.SetJunction(x.t.POSCurrent, x.j.PriorPOSJunction)
	case txStepStartService:
		return sys.StartService()
	case txStepVerifySourceHealth:
		return x.verifyActive(x.j.PriorAgentJunction, x.j.PriorPOSJunction, x.j.SourceAgentVersion)
	case txStepVerifyProtectedState:
		items, err := sys.ProtectedState()
		if err != nil || !txProtectedEqual(items, x.j.ProtectedState) {
			return errors.New("protected_state_changed")
		}
		return nil
	case txStepVerifyACLBaseline:
		// The ACL baseline is a required protected item; verify it explicitly.
		items, err := sys.ProtectedState()
		if err != nil {
			return errors.New("acl_baseline_unavailable")
		}
		if txProtectedItem(items, installTransitionProtectedACLBaseline) != txProtectedItem(x.j.ProtectedState, installTransitionProtectedACLBaseline) ||
			txProtectedItem(items, installTransitionProtectedACLBaseline) == (installTransitionProtectedItem{}) {
			return errors.New("acl_baseline_changed")
		}
		return nil
	case txStepVerifyRetainedPayload:
		for _, root := range x.p.RetainedPayloads {
			if err := sys.PayloadIntact(root); err != nil {
				return fmt.Errorf("retained_payload_damaged %s", root)
			}
		}
		return nil
	}
	return fmt.Errorf("unknown_rollback_step_%s", step.Kind)
}
