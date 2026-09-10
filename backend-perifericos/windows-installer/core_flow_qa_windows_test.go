//go:build windows

package main

import (
	"testing"
	"time"
)

func TestCoreFlowQAScenariosAreDeterministicAndNonDestructive(t *testing.T) {
	for _, scenario := range []string{"success", "rollback-success", "rollback-fail"} {
		events := coreFlowEvents(scenario)
		if len(events) == 0 || events[0].Type != eventInstallStarted {
			t.Fatalf("%s missing start", scenario)
		}
		for i := 1; i < len(events); i++ {
			if events[i].Sequence <= events[i-1].Sequence {
				t.Fatalf("%s sequence not monotonic", scenario)
			}
		}
		if scenario == "success" && events[len(events)-1].Type != eventInstallSuccess {
			t.Fatal("success scenario must finish with install success")
		}
		if scenario != "success" && events[len(events)-1].Type != eventRollbackSuccess && events[len(events)-1].Type != eventRollbackFailed {
			t.Fatalf("%s must finish rollback", scenario)
		}
	}
}

func TestInstallerElevationPolicyRelaunchesInteractiveInstallOnly(t *testing.T) {
	if !requiresElevation(nil) || !requiresElevation([]string{"install"}) || !requiresElevation([]string{"repair"}) {
		t.Fatal("install and default UI must require elevation")
	}
	for _, args := range [][]string{{"service"}, {"status"}, {"inspect"}, {"--help"}} {
		if requiresElevation(args) {
			t.Fatalf("%v must not relaunch for elevation", args)
		}
	}
}

func TestPreflightFailureDoesNotClaimRollbackFailure(t *testing.T) {
	state := newCoreFlowState()
	if !applyInstallerCoreEvent(&state, newCoreEvent(1, eventInstallStarted, "")) {
		t.Fatal("install start rejected")
	}
	started := newCoreEvent(2, eventStepStarted, stepVerifyRequirements)
	if !applyInstallerCoreEvent(&state, started) {
		t.Fatal("preflight step start rejected")
	}
	failure := newCoreEvent(3, eventStepFailed, stepVerifyRequirements)
	failure.SafeError = "No pudimos completar la instalaciÃ³n."
	failure.Message = "administrator privileges required"
	if !applyInstallerCoreEvent(&state, failure) {
		t.Fatal("preflight failure rejected")
	}
	if state.TechnicalError != "administrator privileges required" {
		t.Fatalf("technical error lost: %#v", state)
	}
	if len(state.Steps) != 7 {
		t.Fatalf("preflight failure must not append rollback step: %d", len(state.Steps))
	}
}

func TestPostMutationRollbackStateIsExplicit(t *testing.T) {
	state := newCoreFlowState()
	if !applyInstallerCoreEvent(&state, newCoreEvent(1, eventInstallStarted, "")) {
		t.Fatal("install start rejected")
	}
	if !applyInstallerCoreEvent(&state, newCoreEvent(2, eventRollbackStarted, stepRollback)) {
		t.Fatal("rollback start rejected")
	}
	if !applyInstallerCoreEvent(&state, newCoreEvent(3, eventRollbackSuccess, stepRollback)) {
		t.Fatal("rollback success rejected")
	}
	if state.Phase != coreFailedSafe || len(state.Steps) != 8 || state.Steps[len(state.Steps)-1].ID != stepRollback {
		t.Fatalf("rollback state = %#v", state)
	}
}

func TestCoreFlowArgumentsFailClosedBeforeProductiveRoute(t *testing.T) {
	for _, arg := range []string{"--ui-core-flow-qa", "--ui-core-flow-qa=success", "--ui-core-flow-qa=rollback-success", "--ui-core-flow-qa=rollback-fail"} {
		if _, ok := coreFlowScenarioArg(arg); !ok {
			t.Fatalf("QA arg not routed: %s", arg)
		}
	}
	if _, ok := coreFlowScenarioArg("--ui-core-flow-qa=unknown"); ok {
		t.Fatal("unknown QA scenario must fail closed")
	}
	if _, ok := coreFlowScenarioArg("install"); ok {
		t.Fatal("install must use productive route")
	}
}

func TestCoreFlowGuardBlocksProductiveInstallEntry(t *testing.T) {
	coreFlowHarnessActive.Store(true)
	defer coreFlowHarnessActive.Store(false)
	if err := installWithObserver(installerManifest{}, nil); err == nil {
		t.Fatal("QA guard must block productive install")
	}
}

func TestCoreFlowRuntimeRendererUsesInitialSnapshotAndCoreSteps(t *testing.T) {
	html := appendCoreFlowHarness("<body><section class='install'><div class='steps'></div></section></body>")
	for _, marker := range []string{"data-manus-core-flow", "window.manusInstaller.onState", "window.uiReady", "window.requestClose", "snapshot.steps", "Progreso", "Instalación del servicio completada.", "La versión anterior de Manus fue restaurada correctamente.", "No pudimos restaurar automáticamente la versión anterior.", "cancel.disabled=false", "CTA_CLOSE_ALLOWED", "Cerrar"} {
		if !contains(html, marker) {
			t.Fatalf("runtime renderer missing %q", marker)
		}
	}
	if contains(html, "window.close()") {
		t.Fatal("CoreFlow must close through host binding")
	}
	if len(newCoreFlowState().Steps) != 7 {
		t.Fatal("core flow must use only the seven installer core steps")
	}
}

func TestCoreClosePolicy(t *testing.T) {
	if !coreCloseAllowed(installerCoreState{Phase: coreNotStarted}) || !coreCloseAllowed(installerCoreState{Phase: coreCompleted}) || !coreCloseAllowed(installerCoreState{Phase: coreFailedSafe}) {
		t.Fatal("terminal states must allow close")
	}
	if coreCloseAllowed(installerCoreState{Phase: coreRunning, CanCancel: false}) {
		t.Fatal("non-cancelable running state must deny close")
	}
}

func TestCoreFlowQADelaysOnlyExtendCriticalCloseWindows(t *testing.T) {
	if got := coreFlowQADelay(installerCoreEvent{Type: eventStepStarted, StepID: stepInstallAgent}); got != 8*time.Second {
		t.Fatalf("install delay=%v", got)
	}
	if got := coreFlowQADelay(installerCoreEvent{Type: eventRollbackStarted}); got != 8*time.Second {
		t.Fatalf("rollback delay=%v", got)
	}
	if got := coreFlowQADelay(installerCoreEvent{Type: eventStepSucceeded, StepID: stepInstallAgent}); got != 500*time.Millisecond {
		t.Fatalf("normal delay=%v", got)
	}
}

func contains(value, needle string) bool {
	for i := 0; i+len(needle) <= len(value); i++ {
		if value[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}
