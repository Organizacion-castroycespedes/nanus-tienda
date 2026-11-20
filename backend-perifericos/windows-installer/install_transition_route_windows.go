package main

import (
	"fmt"
	"path/filepath"
)

// routeInstallTransition is the single lifecycle call site for UPDATE. P0-B
// classification is unchanged: only an UNKNOWN/transition_unproven rejection is
// considered, and while installTransitionExecutionEnabled is false or
// approvedInstallTransitions is empty the original rejection is returned
// unchanged, with no observation and no effect.
//
// When enabled, the path observes native evidence twice, confirms it against the
// exact allowlist (14.4a), builds the plan and runs the executor through the
// production gate requireInstallTransitionExecution. Any failure keeps the
// original rejection and adds the reason. 14.4c must certify this whole path in
// a disposable VM before any allowlist entry is added.
func routeInstallTransition(m installerManifest, l runtimeLayout, admission installAdmissionDecision, admissionErr error) error {
	if admissionErr == nil || admission.State != installAdmissionUnknown || admission.Reason != "transition_unproven" {
		return admissionErr
	}
	if !installTransitionExecutionEnabled || len(approvedInstallTransitions) == 0 {
		return admissionErr
	}
	return runInstallTransition(m, l, admissionErr, approvedInstallTransitions,
		func() (installTransitionEvidence, error) { return observeNativeInstallTransitionEvidence(m, l) },
		requireInstallTransitionExecution)
}

func runInstallTransition(m installerManifest, l runtimeLayout, admissionErr error, approvals []installTransitionApproval,
	observe func() (installTransitionEvidence, error), gate func(installTransitionDecision) error) error {
	decision, err := confirmInstallTransition(approvals, m, l, observe)
	if err != nil {
		return fmt.Errorf("%w; update_not_admitted: %v", admissionErr, err)
	}
	plan, err := buildInstallTransitionPlan(decision, approvals, l)
	if err != nil {
		return fmt.Errorf("%w; update_plan_invalid: %v", admissionErr, err)
	}
	var source string
	for _, approval := range approvals {
		if approval.ID == decision.ApprovalID {
			source = approval.SourceAgent.Version
		}
	}
	target := installTransitionTarget{AgentCurrent: l.CurrentRoot, POSCurrent: l.POSCurrentRoot,
		SourceAgentVersion: source, TargetAgentVersion: m.Version}
	// The gate is checked before any native seam is created.
	if err := gate(decision); err != nil {
		return fmt.Errorf("%w; update_execution_disabled: %v", admissionErr, err)
	}
	system, err := newNativeInstallTransitionSystem(m, plan.RetainedPayloads)
	if err != nil {
		return fmt.Errorf("%w; update_system_unavailable: %v", admissionErr, err)
	}
	store, err := newFileInstallTransitionJournalStore(filepath.Join(l.StateRoot, "update"))
	if err != nil {
		return fmt.Errorf("%w; update_journal_unavailable: %v", admissionErr, err)
	}
	result, err := executeInstallTransition(decision, plan, target, system, store, gate)
	if err != nil {
		return fmt.Errorf("%w; update_%s: %s", admissionErr, result.State, result.Reason)
	}
	return nil
}
