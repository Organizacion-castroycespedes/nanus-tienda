//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	webview "github.com/jchv/go-webview2"
)

var coreFlowHarnessActive atomic.Bool

func coreFlowScenarioArg(arg string) (string, bool) {
	lower := strings.ToLower(arg)
	if lower == "--ui-core-flow-qa" {
		return "success", true
	}
	if !strings.HasPrefix(lower, "--ui-core-flow-qa=") {
		return "", false
	}
	scenario := strings.TrimPrefix(lower, "--ui-core-flow-qa=")
	switch scenario {
	case "success", "rollback-success", "rollback-fail":
		return scenario, true
	default:
		return "", false
	}
}

// runInstallerCoreFlowQA is deliberately isolated from install(). It only
// reduces deterministic fake events and pushes snapshots to WebView2.
func runInstallerCoreFlowQA(scenario string) error {
	if scenario != "success" && scenario != "rollback-success" && scenario != "rollback-fail" {
		return fmt.Errorf("unsupported CoreFlow QA scenario")
	}
	coreFlowHarnessActive.Store(true)
	defer coreFlowHarnessActive.Store(false)
	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" {
		return fmt.Errorf("Core flow QA requires Windows x64")
	}
	html, err := embeddedAssets.ReadFile("assets/ui/index.runtime.productive.html")
	if err != nil {
		return fmt.Errorf("missing installer UI asset: %w", err)
	}
	var w webview.WebView
	uiReady := make(chan struct{})
	state := newCoreFlowState()
	var stateMu sync.RWMutex
	func() {
		defer func() {
			if recovered := recover(); recovered != nil {
				err = fmt.Errorf("WebView2 initialization failed: %v", recovered)
			}
		}()
		w = webview.New(false)
	}()
	if err != nil || w == nil {
		showWebViewFallback(err)
		return nil
	}
	defer w.Destroy()
	w.SetTitle(installerWindowTitle)
	w.SetSize(1180, 760, webview.HintNone)
	if err := w.Bind("uiReady", func() {
		select {
		case <-uiReady:
		default:
			close(uiReady)
		}
	}); err != nil {
		w.Destroy()
		showWebViewFallback(err)
		return nil
	}
	if err := w.Bind("requestClose", func() bool {
		stateMu.RLock()
		allowed := coreCloseAllowed(state)
		stateMu.RUnlock()
		if allowed {
			w.Dispatch(func() { w.Terminate() })
		}
		return allowed
	}); err != nil {
		w.Destroy()
		showWebViewFallback(err)
		return nil
	}
	cleanup, err := installNativeCloseProtection(w.Window(), func() bool {
		stateMu.RLock()
		allowed := coreCloseAllowed(state)
		phase, step, canCancel := state.Phase, state.CurrentStep, state.CanCancel
		stateMu.RUnlock()
		fmt.Printf("NATIVE_HOOK_CLOSE phase=%s currentStep=%s canCancel=%t allowed=%t\n", phase, step, canCancel, allowed)
		return allowed
	}, func() {
		fmt.Println("WM_CLOSE_ALLOWED")
		w.Dispatch(func() { w.Terminate() })
	}, func() {
		fmt.Println("WM_CLOSE_DENIED")
		w.Dispatch(func() { w.Eval("window.manusInstaller.onCloseDenied()") })
	})
	if err != nil {
		showWebViewFallback(err)
		return nil
	}
	defer cleanup.cleanup()
	fmt.Printf("NATIVE_HOOK_INSTALLED hwnd=%p\n", w.Window())
	html = []byte(appendCoreFlowHarness(string(html)))
	w.SetHtml(string(html))
	go func() {
		select {
		case <-uiReady:
		case <-time.After(5 * time.Second):
			return
		}
		stateMu.RLock()
		initial, _ := json.Marshal(state)
		stateMu.RUnlock()
		w.Dispatch(func() { w.Eval("window.manusInstaller.onState(" + string(initial) + ")") })
		time.Sleep(200 * time.Millisecond)
		for _, event := range coreFlowEvents(scenario) {
			stateMu.Lock()
			applied := applyInstallerCoreEvent(&state, event)
			stateMu.Unlock()
			if !applied {
				continue
			}
			stateMu.RLock()
			snapshot, _ := json.Marshal(state)
			stateMu.RUnlock()
			w.Dispatch(func() { w.Eval("window.manusInstaller.onState(" + string(snapshot) + ")") })
			time.Sleep(coreFlowQADelay(event))
		}
	}()
	w.Run()
	return nil
}

// coreFlowQADelay exists only in the non-destructive visual harness. It makes
// native close testing deterministic without affecting the real Installer Core.
func coreFlowQADelay(event installerCoreEvent) time.Duration {
	if event.Type == eventRollbackStarted || (event.Type == eventStepStarted && event.StepID == stepInstallAgent) {
		return 8 * time.Second
	}
	return 500 * time.Millisecond
}

func newCoreFlowState() installerCoreState {
	state := newInstallerCoreState()
	state.Steps = state.Steps[:6]
	state.Steps = append(state.Steps, installerCoreStep{ID: stepFinalize, Name: "Finalizando instalacion", State: coreStepPending})
	return state
}

func coreFlowEvents(scenario string) []installerCoreEvent {
	events := []installerCoreEvent{}
	seq := uint64(1)
	events = append(events, newCoreEvent(seq, eventInstallStarted, ""))
	seq++
	ids := []installerCoreStepID{stepVerifyRequirements, stepPrepareFiles, stepInstallAgent, stepConfigureService, stepStartService, stepVerifyService, stepFinalize}
	for i, id := range ids {
		events = append(events, newCoreEvent(seq, eventStepStarted, id))
		seq++
		if (scenario == "rollback-success" || scenario == "rollback-fail") && id == stepStartService {
			event := newCoreEvent(seq, eventStepFailed, id)
			event.SafeError = "No pudimos iniciar el servicio Manus."
			event.ErrorCode = "SERVICE_START_FAILED"
			events = append(events, event)
			seq++
			events = append(events, newCoreEvent(seq, eventRollbackStarted, ""))
			seq++
			rollback := newCoreEvent(seq, eventRollbackSuccess, "")
			if scenario == "rollback-fail" {
				rollback.Type = eventRollbackFailed
				rollback.SafeError = "No pudimos restaurar automaticamente la version anterior."
			}
			events = append(events, rollback)
			return events
		}
		events = append(events, newCoreEvent(seq, eventStepSucceeded, id))
		seq++
		_ = i
	}
	events = append(events, newCoreEvent(seq, eventInstallSuccess, ""))
	return events
}

func appendCoreFlowHarness(html string) string {
	script := `<script data-manus-core-flow="true">(function(){
window.manusInstaller=window.manusInstaller||{};
var closeBusy=false;
window.manusInstaller.onCloseDenied=function(){var note=document.querySelector('[data-core-close-message]');if(!note){note=document.createElement('p');note.dataset.coreCloseMessage='true';note.className='core-terminal-message';var heading=document.querySelector('[data-screen="install"] .heading');if(heading)heading.append(note);}if(note)note.textContent='Manus está completando una operación que no puede interrumpirse.';};
function requestHostClose(button){if(closeBusy)return;closeBusy=true;if(button)button.disabled=true;Promise.resolve(typeof window.requestClose==='function'?window.requestClose():false).then(function(allowed){if(!allowed){closeBusy=false;if(button)button.disabled=false;var note=document.querySelector('[data-core-close-message]');if(!note){note=document.createElement('p');note.dataset.coreCloseMessage='true';note.className='core-terminal-message';document.querySelector('[data-screen="install"] .heading').append(note);}note.textContent='Manus está completando una operación que no puede interrumpirse.';}}).catch(function(){closeBusy=false;if(button)button.disabled=false;});}
window.manusInstaller.onState=function(snapshot){
  console.info('CORE_EVENT sequence='+String(snapshot.sequence||0)+' phase='+String(snapshot.phase||'')+' currentStep='+String(snapshot.currentStep||'')+' canCancel='+String(snapshot.canCancel));
  var section=document.querySelector('[data-screen="install"]'); if(!section)return;
  var list=section.querySelector('.steps');
  if(list){list.replaceChildren();(snapshot.steps||[]).forEach(function(step){var row=document.createElement('div');row.className='step '+String(step.state||'PENDING').toLowerCase();row.dataset.stepId=step.id;var icon=document.createElement('span');icon.className='step-icon';icon.textContent=step.state==='SUCCESS'?'✓':step.state==='ERROR'?'!':step.state==='RUNNING'?'◌':'○';var name=document.createElement('span');name.className='step-title';name.textContent=step.name;var status=document.createElement('span');status.className='step-status';status.textContent=step.state;row.append(icon,name,status);list.append(row);});}
  var progress=section.querySelector('[data-core-progress]');if(!progress){progress=document.createElement('div');progress.dataset.coreProgress='true';progress.className='core-progress';section.insertBefore(progress,list||section.firstChild);}progress.textContent='Progreso '+String(snapshot.progress||0)+'%';
  var copy=section.querySelector('.heading p');if(copy)copy.textContent='Instalamos y verificamos los componentes necesarios para ejecutar Manus.';
  var actions=section.querySelector('.install-actions');var cancel=actions&&actions.querySelector('.btn-danger');var details=actions&&actions.querySelector('.btn-ghost');
  if(snapshot.phase==='COMPLETED'){var success=section.querySelector('[data-core-terminal-message]');if(!success){success=document.createElement('p');success.dataset.coreTerminalMessage='true';success.className='core-terminal-message';section.querySelector('.heading').append(success);}success.textContent='Instalación del servicio completada.';if(cancel){cancel.disabled=false;cancel.title='';cancel.textContent='Cerrar';cancel.classList.remove('btn-danger');cancel.classList.add('btn-primary');cancel.onclick=function(){console.info('CTA_CLOSE_ALLOWED');requestHostClose(cancel);};}if(details)details.hidden=true;}
  if(snapshot.phase==='FAILED_SAFE'){var rollback=(snapshot.steps||[]).find(function(step){return step.id==='ROLLBACK';});var message=section.querySelector('[data-core-terminal-message]');if(!message){message=document.createElement('p');message.dataset.coreTerminalMessage='true';message.className='core-terminal-message';section.querySelector('.heading').append(message);}message.textContent=rollback&&rollback.state==='SUCCESS'?'La versión anterior de Manus fue restaurada correctamente.':'No pudimos restaurar automáticamente la versión anterior. Se requiere revisión técnica.';var heading=section.querySelector('h2');if(heading)heading.textContent='No pudimos completar la instalación.';if(cancel){cancel.disabled=false;cancel.title='';cancel.textContent='Cerrar';cancel.classList.remove('btn-danger');cancel.classList.add('btn-primary');cancel.onclick=function(){console.info('CTA_CLOSE_ALLOWED');requestHostClose(cancel);};}if(details)details.hidden=false;}
  if(snapshot.phase==='RUNNING'&&cancel){cancel.disabled=snapshot.canCancel===false;cancel.title=snapshot.canCancel===false?'Manus está completando una operación que no puede interrumpirse.':'';}
  if(snapshot.phase==='FAILED_SAFE'){document.body.dataset.coreError=snapshot.error||'FAILED_SAFE';}
  if(snapshot.phase==='COMPLETED'){document.body.dataset.coreComplete='true';}
  if(typeof go==='function')go('install');
};
function signalReady(){if(typeof window.uiReady==='function')window.uiReady();}
window.addEventListener('DOMContentLoaded',signalReady);if(document.readyState!=='loading')signalReady();
})();</script>`
	return strings.Replace(html, "</body>", script+"</body>", 1)
}
