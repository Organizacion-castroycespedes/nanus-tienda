//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"runtime"
	"sync"
	"time"

	webview "github.com/jchv/go-webview2"
)

type productiveCoreWebViewSink struct {
	webview webview.WebView
	stateMu sync.Mutex
	state   installerCoreState
}

func (sink *productiveCoreWebViewSink) Emit(event installerCoreEvent) {
	sink.stateMu.Lock()
	if !applyInstallerCoreEvent(&sink.state, event) {
		sink.stateMu.Unlock()
		return
	}
	payload, _ := json.Marshal(sink.state)
	sink.stateMu.Unlock()
	sink.webview.Dispatch(func() { sink.webview.Eval("window.manusInstaller.onState(" + string(payload) + ")") })
}

func (sink *productiveCoreWebViewSink) closeAllowed() bool {
	sink.stateMu.Lock()
	defer sink.stateMu.Unlock()
	return coreCloseAllowed(sink.state)
}

func runProductiveInstallerUI(manifest installerManifest) error {
	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" {
		return fmt.Errorf("productive UI requires Windows x64")
	}
	html, err := embeddedAssets.ReadFile("assets/ui/index.runtime.productive.html")
	if err != nil {
		return fmt.Errorf("missing installer UI asset: %w", err)
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
	uiReady := make(chan struct{})
	if err := w.Bind("uiReady", func() {
		select {
		case <-uiReady:
		default:
			close(uiReady)
		}
	}); err != nil {
		showWebViewFallback(err)
		return nil
	}
	sink := &productiveCoreWebViewSink{webview: w, state: newCoreFlowState()}
	if err := w.Bind("requestClose", func() bool {
		if !sink.closeAllowed() {
			w.Dispatch(func() { w.Eval("window.manusInstaller.onCloseDenied()") })
			return false
		}
		w.Dispatch(func() { w.Terminate() })
		return true
	}); err != nil {
		showWebViewFallback(err)
		return nil
	}
	html = []byte(appendCoreFlowHarness(string(html)))
	w.SetHtml(string(html))
	cleanup, err := installNativeCloseProtection(w.Window(), sink.closeAllowed, func() { w.Dispatch(func() { w.Terminate() }) }, func() { w.Dispatch(func() { w.Eval("window.manusInstaller.onCloseDenied()") }) })
	if err != nil {
		showWebViewFallback(err)
		return nil
	}
	defer cleanup.cleanup()
	go func() {
		select {
		case <-uiReady:
		case <-time.After(5 * time.Second):
			return
		}
		initial, _ := json.Marshal(sink.state)
		w.Dispatch(func() { w.Eval("window.manusInstaller.onState(" + string(initial) + ")") })
		time.Sleep(100 * time.Millisecond)
		_ = installWithObserver(manifest, sink)
	}()
	w.Run()
	return nil
}
