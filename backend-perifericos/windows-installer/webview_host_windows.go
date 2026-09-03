//go:build windows

package main

import (
	"fmt"
	"runtime"
	"strings"
	"syscall"
	"unsafe"

	webview "github.com/jchv/go-webview2"
)

const installerWindowTitle = "MANUS TERMINAL SETUP"

// runInstallerUI hosts only embedded installer assets. No privileged bridge
// is exposed in this spike; runtime operations remain in Installer Core.
func runInstallerUI(showMockNav bool, realReadonly bool, configMode bool, printMode bool, drawerMode bool) error {
	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" {
		return fmt.Errorf("WebView2 host requires Windows x64")
	}
	assetName := "assets/ui/index.runtime.productive.html"
	if showMockNav {
		assetName = "assets/ui/index.runtime.html"
	}
	html, err := embeddedAssets.ReadFile(assetName)
	if err != nil {
		return fmt.Errorf("missing installer UI asset: %w", err)
	}
	if strings.Contains(string(html), "http://") || strings.Contains(string(html), "https://") {
		return fmt.Errorf("installer UI contains remote content")
	}
	var w webview.WebView
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
	bridge := newInstallerReadOnlyBridge()
	if err := w.Bind("getInstallerState", bridge.getInstallerState); err != nil {
		w.Destroy()
		showWebViewFallback(err)
		return nil
	}
	if err := w.Bind("discoverDevices", bridge.discoverDevices); err != nil {
		w.Destroy()
		showWebViewFallback(err)
		return nil
	}
	if realReadonly {
		if configMode || printMode {
			if err := w.Bind("configureDevice", bridge.configureDevice); err != nil {
				w.Destroy()
				showWebViewFallback(err)
				return nil
			}
		}
		if printMode {
			if err := w.Bind("testPrinter", bridge.testPrinter); err != nil {
				w.Destroy()
				showWebViewFallback(err)
				return nil
			}
		}
		if drawerMode {
			if err := w.Bind("testCashDrawer", bridge.testCashDrawer); err != nil {
				w.Destroy()
				showWebViewFallback(err)
				return nil
			}
		}
		html = []byte(appendReadOnlyBootstrap(string(html), configMode || printMode, printMode, drawerMode))
	}
	w.SetHtml(string(html))
	w.Run()
	return nil
}

func appendReadOnlyBootstrap(html string, configMode bool, printMode bool, drawerMode bool) string {
	script := `<script data-manus-readonly-bridge="true">
(function(){
  let discoveryPromise;
  let phase='BOOTING';
  let realState={agent:{},devices:[]};
  const setPhase=(next)=>{phase=next;document.body.dataset.installerPhase=next;};
  const configEnabled=__CONFIG_ENABLED__;
  const printEnabled=__PRINT_ENABLED__;
  const drawerEnabled=__DRAWER_ENABLED__;
  const text=(value,fallback)=>String(value ?? fallback);
  const renderDevices=(devices,message)=>{
    const list=document.querySelector('.device-list'); if(!list)return;
    list.replaceChildren();
    if(!devices.length){ const empty=document.createElement('div'); empty.className='device-card'; empty.textContent=message||'No encontramos dispositivos conectados.'; list.append(empty); ensureRetryButton(); return; }
    devices.forEach((device)=>{if(device.metadata && device.metadata.usbRawCashDrawerPulseCertified===true && !device.capabilities){device.capabilities={supportsCashDrawerPulse:true};}});
    devices.forEach((device)=>{
      const card=document.createElement('article'); card.className='device-card';
      const main=document.createElement('div'); main.className='device-main';
      const icon=document.createElement('div'); icon.className='device-icon'; icon.textContent='▣'; main.append(icon);
      const title=document.createElement('div');
      const name=document.createElement('div'); name.className='device-name'; name.textContent=text(device.name,'Dispositivo');
      const model=document.createElement('div'); model.className='device-model'; model.textContent=text(device.type,'Periférico');
      const status=document.createElement('div'); status.className='status ok'; status.style.marginTop='7px'; status.textContent=text(device.status,'Desconocido');
      title.append(name,model,status); main.append(title); card.append(main);
      const meta=document.createElement('div'); meta.className='device-meta';
      const addMeta=(label,value)=>{const item=document.createElement('div');item.className='meta';const l=document.createElement('label');l.textContent=label;const v=document.createElement('strong');v.textContent=value;item.append(l,v);meta.append(item)};
      addMeta('Conexión',text(device.connectionType,'—'));
      if(device.connectionType==='USB' && device.usb){addMeta('Puerto',text(device.usb.port ?? device.usb.printerName,'—'));}
      if(device.connectionType==='NETWORK' && device.network){addMeta('Host',text(device.network.host,'—'));addMeta('Puerto',text(device.network.port,'—'));}
      addMeta('Perfil',text(device.profileId,'Configurar tamaño de papel')); card.append(meta);
      const actions=document.createElement('div'); actions.className='device-actions';
      ['Probar impresión','Configurar'].forEach((label)=>{const b=document.createElement('button');b.className='btn btn-sm btn-ghost';b.textContent=label;b.disabled=true;b.title='Disponible en la siguiente fase';actions.append(b)}); card.append(actions); list.append(card);
    });
    devices.forEach((device)=>{
      if(!(device.capabilities && device.capabilities.supportsCashDrawerPulse && device.metadata && device.metadata.usbRawCashDrawerPulseCertified)) return;
      const drawer=document.createElement('article'); drawer.className='device-card'; drawer.dataset.drawerPrinterId=device.id;
      const head=document.createElement('div'); head.className='device-main'; const copy=document.createElement('div');
      const title=document.createElement('div'); title.className='device-name'; title.textContent='Cajon monedero';
      const via=document.createElement('div'); via.className='device-model'; via.textContent='Via: '+text(device.usb && (device.usb.printerName||device.usb.port),device.name);
      const cert=document.createElement('div'); cert.className='status info'; cert.style.marginTop='7px'; cert.textContent='Compatible / Pulso certificado'; copy.append(title,via,cert); head.append(copy); drawer.append(head);
      const actions=document.createElement('div'); actions.className='device-actions'; const button=document.createElement('button'); button.className='btn btn-sm btn-ghost'; button.textContent='Probar apertura'; button.disabled=true; button.title='Disponible en la siguiente fase'; actions.append(button); drawer.append(actions); list.append(drawer);
    });
    document.querySelectorAll('.device-list>.device-card').forEach((card,index)=>{const device=devices[index];if(device&&device.connectionType==='USB'&&device.usb&&device.usb.printerName&&!device.usb.port){card.querySelectorAll('.meta label').forEach(label=>{if(label.textContent==='Puerto')label.textContent='Cola de impresion';});}});
    ensureRetryButton(); wireConfigButtons(devices); wireDrawerButtons(devices);
  };
  const updateTechnical=()=>{
    const agent=realState.agent||{}; const values=[text(agent.version,'—'),text(agent.mode,'—'),text(agent.status,'—'),text(agent.serviceAccount||agent.service_account,'—'),text(agent.platform,'—')+' '+text(agent.architecture,''),text(agent.installationId||agent.agentInstallationId,'—')];
    document.querySelectorAll('#techDrawer .diag strong').forEach((el,i)=>{if(values[i]!==undefined)el.textContent=values[i];});
    const log=document.querySelector('#techDrawer .log-box'); if(log){log.replaceChildren(); const lines=['[INFO] Health real recibido','[INFO] '+realState.devices.length+' dispositivo(s) descubierto(s)']; realState.devices.forEach(d=>lines.push('[INFO] '+text(d.name,'Dispositivo')+' / '+text(d.connectionType,'—')+' / '+text(d.profileId,'sin perfil')+' / '+text(d.status,'—'))); lines.forEach(line=>{const row=document.createElement('div');row.textContent=line;log.append(row);});}
  };
	const hideReadonlyComplete=()=>{document.querySelectorAll('[data-go="complete"],.device-footer .btn-primary').forEach((el)=>{el.hidden=true;el.disabled=true;});};
  const ensureRetryButton=()=>{
    const footer=document.querySelector('.device-footer'); if(!footer||footer.querySelector('[data-readonly-retry]'))return;
    const button=document.createElement('button'); button.className='btn btn-ghost'; button.dataset.readonlyRetry='true'; button.textContent='Buscar nuevamente'; button.addEventListener('click',runDiscovery); footer.insertBefore(button,footer.firstChild);
  };
  const wireConfigButtons=(devices)=>{
    if(!configEnabled && !printEnabled)return;
    const cards=[...document.querySelectorAll('.device-list>.device-card')].slice(0,devices.length);
    cards.forEach((card,index)=>{const buttons=card.querySelectorAll('button'); const printer=devices[index]; if(printEnabled && buttons[0]){buttons[0].disabled=false; buttons[0].addEventListener('click',()=>runPrint(printer,buttons[0]));} if(configEnabled && buttons[1]){buttons[1].disabled=false; buttons[1].addEventListener('click',()=>openConfig(printer));}});
  };
  const drawerBusy=new Set();
  const wireDrawerButtons=(devices)=>{if(!drawerEnabled)return; document.querySelectorAll('[data-drawer-printer-id]').forEach(card=>{const device=devices.find(d=>d.id===card.dataset.drawerPrinterId);const button=card.querySelector('button');if(!device||!button)return;button.disabled=false;button.addEventListener('click',()=>runDrawer(device,button));});};
  const runDrawer=async(device,button)=>{if(drawerBusy.has(device.id))return;drawerBusy.add(device.id);button.disabled=true;button.textContent='Enviando pulso...';try{await window.testCashDrawer(device.id);button.textContent='Pulso enviado';const opened=window.confirm('Confirma que el cajon se abrio?');const status=document.createElement('div');status.className='status '+(opened?'ok':'danger');status.style.marginTop='7px';status.textContent=opened?'Apertura confirmada por operador':'Revisa la conexion del cajon a la impresora.';button.parentElement.parentElement.append(status);}catch(error){button.textContent='Reintentar';button.title='No pudimos enviar el pulso al cajon.';console.warn('Peripheral Agent cash drawer error',error);}finally{drawerBusy.delete(device.id);setTimeout(()=>{button.disabled=false;button.textContent='Probar apertura';},1400);}};
  const printBusy=new Set();
  const runPrint=async(device,button)=>{
    if(printBusy.has(device.id))return; printBusy.add(device.id); button.disabled=true; const old=button.textContent; button.textContent='Imprimiendo...';
    try{const result=await window.testPrinter(device.id); button.textContent='Trabajo enviado'; button.title='Impresión de prueba enviada correctamente'; console.info('Test print sent',result);}
    catch(error){button.textContent='Reintentar'; button.title='No pudimos imprimir la prueba.'; console.warn('Peripheral Agent test print error',error);}
    finally{printBusy.delete(device.id); setTimeout(()=>{button.disabled=false; button.textContent=old;},1400);}
  };
  const openConfig=(device)=>{
    document.querySelector('.manus-config-overlay')?.remove();
    const overlay=document.createElement('div'); overlay.className='manus-config-overlay'; overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.62);display:grid;place-items:center;z-index:20;padding:24px';
    const panel=document.createElement('div'); panel.className='card'; panel.style.cssText='width:min(460px,100%);padding:24px';
    const heading=document.createElement('h3'); heading.textContent='Configurar impresora'; const label=document.createElement('p'); label.textContent=text(device.name,'Impresora');
    const select=document.createElement('select'); select.style.cssText='width:100%;min-height:44px;margin:12px 0 20px'; ['THERMAL_58MM','THERMAL_80MM'].forEach(profile=>{const option=document.createElement('option');option.value=profile;option.textContent=profile;option.selected=device.profileId===profile;select.append(option)});
    const actions=document.createElement('div'); actions.className='device-actions'; const cancel=document.createElement('button'); cancel.className='btn btn-sm btn-ghost'; cancel.textContent='Cancelar'; cancel.onclick=()=>overlay.remove(); const save=document.createElement('button'); save.className='btn btn-sm'; save.textContent='Guardar configuracion';
    save.onclick=async()=>{save.disabled=true; try{const updated=await window.configureDevice(device.id,select.value); device.profileId=updated.profileId||select.value; overlay.remove(); renderDevices(realState.devices); updateTechnical();}catch(error){save.disabled=false; const failure=document.createElement('p');failure.className='status danger';failure.textContent='No pudimos guardar la configuracion de la impresora.';panel.append(failure);console.warn('Peripheral Agent configuration error',error);}};
    actions.append(cancel,save); panel.append(heading,label,select,actions); overlay.append(panel); document.body.append(overlay); select.focus();
  };
  async function runDiscovery(){
    if(discoveryPromise)return;
    setPhase('DISCOVERY_RUNNING');
    const button=document.querySelector('[data-readonly-retry]'); if(button)button.disabled=true;
    discoveryPromise=window.discoverDevices();
    try{
      const devices=await discoveryPromise; realState.devices=devices||[]; setPhase(realState.devices.length?'DISCOVERY_SUCCESS':'DISCOVERY_EMPTY'); renderDevices(realState.devices); updateTechnical(); go('devices');
    }catch(error){ realState.devices=[]; setPhase('DISCOVERY_ERROR'); renderDevices([], 'No pudimos detectar los dispositivos.'); updateTechnical(); go('devices'); console.warn('Peripheral Agent discovery error',error); }
    finally{discoveryPromise=undefined; const retry=document.querySelector('[data-readonly-retry]'); if(retry)retry.disabled=false;}
  }
  async function load(){
    setPhase('HEALTH_CHECKING');
    try{
      const state=await window.getInstallerState();
      realState=state||{agent:{},devices:[]}; updateTechnical(); hideReadonlyComplete();
      document.body.dataset.agentStatus=state.agent && state.agent.status==='ok'?'available':'unavailable';
      if(document.body.dataset.agentStatus==='unavailable'){ setPhase('HEALTH_ERROR'); renderDevices([], 'No pudimos conectar con el servicio Manus.'); go('devices'); return; }
      setPhase('HEALTH_SUCCESS'); await runDiscovery();
    }catch(error){ document.body.dataset.agentStatus='unavailable'; setPhase('HEALTH_ERROR'); renderDevices([], 'No pudimos conectar con el servicio Manus.'); go('devices'); console.warn('Peripheral Agent read-only error',error); }
  }
  document.addEventListener('DOMContentLoaded',load,{once:true});
})();

</script>`
	script = strings.Replace(script, "__CONFIG_ENABLED__", fmt.Sprintf("%t", configMode), 1)
	script = strings.Replace(script, "__PRINT_ENABLED__", fmt.Sprintf("%t", printMode), 1)
	script = strings.Replace(script, "__DRAWER_ENABLED__", fmt.Sprintf("%t", drawerMode), 1)
	return strings.Replace(html, "</body>", script+"</body>", 1)
}

func showWebViewFallback(err error) {
	message := "No se pudo iniciar la interfaz de Manus Terminal Setup.\n\nMicrosoft Edge WebView2 Runtime no está disponible o no pudo inicializarse.\n\nInstala o repara Microsoft Edge WebView2 Runtime y vuelve a intentarlo."
	if err != nil {
		message += "\n\nDetalle: " + err.Error()
	}
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")
	title, _ := syscall.UTF16PtrFromString(installerWindowTitle)
	text, _ := syscall.UTF16PtrFromString(message)
	_, _, _ = proc.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
}
