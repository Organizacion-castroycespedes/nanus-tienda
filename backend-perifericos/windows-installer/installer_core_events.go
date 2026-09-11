//go:build windows

package main

import (
	"fmt"
	"os"
	"time"
)

type installerCoreEventSink interface {
	Emit(installerCoreEvent)
}

type installerCoreEventRecorder struct {
	Events []installerCoreEvent
}

func (r *installerCoreEventRecorder) Emit(event installerCoreEvent) {
	r.Events = append(r.Events, event)
}

func emitCoreStep(sink installerCoreEventSink, sequence *uint64, eventType installerCoreEventType, step installerCoreStepID, err error) {
	if sink == nil {
		return
	}
	(*sequence)++
	event := newCoreEvent(*sequence, eventType, step)
	if err != nil {
		event.ErrorCode, event.SafeError, event.Retryable = string(step)+"_FAILED", safeCoreError(step), false
		event.Message = err.Error()
	}
	sink.Emit(event)
}

func runCoreStep(sink installerCoreEventSink, sequence *uint64, step installerCoreStepID, operation func() error) error {
	emitCoreStep(sink, sequence, eventStepStarted, step, nil)
	err := operation()
	if err != nil {
		emitCoreStep(sink, sequence, eventStepFailed, step, err)
		return err
	}
	emitCoreStep(sink, sequence, eventStepSucceeded, step, nil)
	return nil
}

func safeCoreError(step installerCoreStepID) string {
	switch step {
	case stepConfigureService:
		return "No pudimos configurar el servicio Manus."
	case stepStartService:
		return "No pudimos iniciar el servicio Manus."
	case stepVerifyService:
		return "No pudimos verificar el servicio Manus."
	default:
		return "No pudimos completar la instalación."
	}
}

func emitRollback(sink installerCoreEventSink, sequence *uint64, manifest installerManifest, layout runtimeLayout, rollbackPath, existingVersion string, logger *installLogger) error {
	if logger != nil {
		logger.Printf("rollback start reason=install failure path=%s expectedVersion=%s", rollbackPath, existingVersion)
	}
	if sink != nil {
		emitCoreStep(sink, sequence, eventRollbackStarted, stepRollback, nil)
	}
	err := rollbackToPreviousVersion(manifest, layout, rollbackPath, existingVersion, logger)
	if err == nil {
		if posErr := rollbackPOSPayload(layout); posErr != nil {
			err = posErr
		}
	}
	if sink != nil {
		if err != nil {
			emitCoreStep(sink, sequence, eventRollbackFailed, stepRollback, err)
		} else {
			emitCoreStep(sink, sequence, eventRollbackSuccess, stepRollback, nil)
		}
	}
	if logger != nil {
		if err != nil {
			logger.Printf("rollback failure error=%v", err)
		} else {
			logger.Printf("rollback success version=%s", existingVersion)
		}
	}
	return err
}

func rollbackPOSPayload(layout runtimeLayout) error {
	if layout.POSInstallRoot == "" || layout.POSPreviousPresent {
		return nil
	}
	if err := os.RemoveAll(layout.POSInstallRoot); err != nil {
		return fmt.Errorf("rollback POS payload: %w", err)
	}
	if exists(layout.POSInstallRoot) {
		return fmt.Errorf("rollback POS payload remains: %s", layout.POSInstallRoot)
	}
	return nil
}

func coreCloseAllowed(state installerCoreState) bool {
	switch state.Phase {
	case coreNotStarted, coreCompleted, coreFailedSafe:
		return true
	case coreRunning:
		return state.CanCancel
	default:
		return false
	}
}

// applyInstallerCoreEvent is the single state reducer shared by real event
// publication and the non-destructive QA harness. It rejects out-of-order
// terminal events instead of fabricating progress.
func applyInstallerCoreEvent(state *installerCoreState, event installerCoreEvent) bool {
	if state == nil || event.Sequence == 0 {
		return false
	}
	if event.Sequence <= state.lastSequence {
		return false
	}
	state.lastSequence = event.Sequence
	state.Sequence = event.Sequence
	if event.Type == eventInstallStarted {
		if state.Phase != coreNotStarted {
			return false
		}
		state.Phase = coreRunning
		return true
	}
	if event.Type == eventInstallSuccess {
		for _, step := range state.Steps {
			if step.State != coreStepSuccess && step.State != coreStepWarning && step.State != coreStepSkipped {
				return false
			}
		}
		state.Phase, state.Progress, state.CurrentStep = coreCompleted, 100, ""
		return true
	}
	if event.Type == eventInstallFailed {
		state.Phase, state.Error, state.CurrentStep = coreFailedSafe, event.SafeError, ""
		return true
	}
	if event.Type == eventRollbackStarted {
		state.Phase = coreRunning
		state.CurrentStep = string(stepRollback)
		state.CanCancel = false
		state.Steps = append(state.Steps, installerCoreStep{ID: stepRollback, Name: "Restaurando version anterior", State: coreStepRunning})
		return true
	}
	if event.Type == eventRollbackSuccess || event.Type == eventRollbackFailed {
		if len(state.Steps) == 0 || state.Steps[len(state.Steps)-1].ID != stepRollback || state.Steps[len(state.Steps)-1].State != coreStepRunning {
			return false
		}
		step := &state.Steps[len(state.Steps)-1]
		if event.Type == eventRollbackSuccess {
			step.State = coreStepSuccess
		} else {
			step.State = coreStepError
			state.Error = event.SafeError
		}
		state.CurrentStep = ""
		state.Phase = coreFailedSafe
		state.CanCancel = true
		state.Progress = completedProgress(state.Steps)
		return true
	}

	var target *installerCoreStep
	for i := range state.Steps {
		if state.Steps[i].ID == event.StepID {
			target = &state.Steps[i]
			break
		}
	}
	if target == nil {
		return false
	}
	switch event.Type {
	case eventStepStarted:
		if target.State != coreStepPending {
			return false
		}
		target.State = coreStepRunning
		state.Phase, state.CurrentStep = coreRunning, string(target.ID)
		state.CanCancel = false
	case eventStepSucceeded, eventStepWarning, eventStepFailed:
		if target.State != coreStepRunning {
			return false
		}
		target.State = mapEventState(event.Type)
		target.Message, target.DurationMs = event.Message, 0
		if event.Type == eventStepFailed {
			state.Error = event.SafeError
			state.TechnicalError = event.Message
			state.Phase = coreFailedSafe
		} else if event.Type == eventStepWarning {
			state.Warning = event.Message
		}
		state.Progress = completedProgress(state.Steps)
		state.CurrentStep = ""
		state.CanCancel = true
	default:
		return false
	}
	state.Progress = completedProgress(state.Steps)
	return true
}

func mapEventState(event installerCoreEventType) installerCoreStepState {
	switch event {
	case eventStepSucceeded:
		return coreStepSuccess
	case eventStepWarning:
		return coreStepWarning
	default:
		return coreStepError
	}
}

func completedProgress(steps []installerCoreStep) int {
	if len(steps) == 0 {
		return 0
	}
	completed := 0
	for _, step := range steps {
		if step.State == coreStepSuccess || step.State == coreStepWarning || step.State == coreStepSkipped {
			completed++
		}
	}
	return completed * 100 / len(steps)
}

func newCoreEvent(sequence uint64, eventType installerCoreEventType, step installerCoreStepID) installerCoreEvent {
	return installerCoreEvent{Sequence: sequence, Timestamp: time.Now().UTC().Format(time.RFC3339Nano), Type: eventType, StepID: step}
}
