//go:build windows

package main

import (
	"errors"
	"testing"
)

func TestProductiveCoreStateDoesNotClaimUnexecutedSuccess(t *testing.T) {
	state := newInstallerCoreState()
	if state.Phase != coreNotStarted || state.Progress != 0 || len(state.Steps) != 9 {
		t.Fatalf("unexpected initial state: %#v", state)
	}
	for _, step := range state.Steps {
		if step.State != coreStepPending {
			t.Fatalf("step %q is not pending", step.Name)
		}
	}
}

func TestInstallerCoreEventsDeriveProgressAndRejectDuplicates(t *testing.T) {
	state := newInstallerCoreState()
	if !applyInstallerCoreEvent(&state, newCoreEvent(1, eventInstallStarted, "")) {
		t.Fatal("install start should be accepted")
	}
	if !applyInstallerCoreEvent(&state, newCoreEvent(2, eventStepStarted, stepVerifyRequirements)) {
		t.Fatal("step start should be accepted")
	}
	if state.CanCancel {
		t.Fatal("critical running step must deny close")
	}
	if !applyInstallerCoreEvent(&state, newCoreEvent(3, eventStepSucceeded, stepVerifyRequirements)) {
		t.Fatal("step success should be accepted")
	}
	if state.Steps[0].State != coreStepSuccess || state.Progress == 0 {
		t.Fatalf("unexpected state: %#v", state)
	}
	if !state.CanCancel {
		t.Fatal("terminal step must allow close")
	}
	if applyInstallerCoreEvent(&state, newCoreEvent(3, eventStepSucceeded, stepVerifyRequirements)) {
		t.Fatal("duplicate event should be rejected")
	}
	if state.Steps[1].State != coreStepPending {
		t.Fatal("future step must remain pending")
	}
}

func TestInstallerCoreRollbackEventsAreVisible(t *testing.T) {
	state := newInstallerCoreState()
	if !applyInstallerCoreEvent(&state, newCoreEvent(1, eventInstallStarted, "")) || !applyInstallerCoreEvent(&state, newCoreEvent(2, eventRollbackStarted, "")) {
		t.Fatal("rollback start should be accepted")
	}
	if state.CurrentStep != string(stepRollback) {
		t.Fatalf("rollback step not visible: %#v", state)
	}
	if !applyInstallerCoreEvent(&state, newCoreEvent(3, eventRollbackSuccess, "")) || state.Phase != coreFailedSafe {
		t.Fatalf("rollback success state unexpected: %#v", state)
	}
}

func TestCoreOperationWrapperEmitsStartAndSuccessOrFailure(t *testing.T) {
	for _, wantErr := range []bool{false, true} {
		recorder := &installerCoreEventRecorder{}
		seq := uint64(0)
		err := runCoreStep(recorder, &seq, stepStartService, func() error {
			if wantErr {
				return errors.New("technical failure")
			}
			return nil
		})
		if (err != nil) != wantErr || len(recorder.Events) != 2 || recorder.Events[0].Type != eventStepStarted {
			t.Fatalf("unexpected wrapper result: err=%v events=%#v", err, recorder.Events)
		}
	}
}
