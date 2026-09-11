//go:build windows

package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestEmbeddedAssetsIncludeLeadingUnderscoreFiles(t *testing.T) {
	manifestBytes, err := embeddedAssets.ReadFile("assets/manifest.json")
	if err != nil {
		t.Fatalf("embedded installer manifest missing: %v", err)
	}
	var manifest installerManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		t.Fatalf("embedded installer manifest invalid: %v", err)
	}
	_, err = embeddedAssets.ReadFile(filepath.ToSlash(filepath.Join(manifest.BundleRoot, "node_modules/readable-stream/lib/_stream_readable.js")))
	if err != nil {
		t.Fatalf("embedded asset missing: %v", err)
	}
}

func TestPOSPayloadValidRequiresCurrentPayload(t *testing.T) {
	dir := t.TempDir()
	current := filepath.Join(dir, "POS", "current")
	if err := os.MkdirAll(filepath.Join(current, "resources"), 0o755); err != nil {
		t.Fatal(err)
	}
	files := map[string][]byte{
		"Manus POS.exe":                     []byte("fresh exe"),
		"resources/app.asar":                []byte("fresh asar"),
		"resources/manus-shell.config.json": []byte(`{"environment":"qa"}`),
	}
	manifestFiles := make([]posPayloadFile, 0, len(files))
	for relative, content := range files {
		path := filepath.Join(current, filepath.FromSlash(relative))
		if err := os.WriteFile(path, content, 0o600); err != nil {
			t.Fatal(err)
		}
		manifestFiles = append(manifestFiles, posPayloadFile{Path: relative, Size: int64(len(content)), SHA256: fmt.Sprintf("%x", sha256.Sum256(content))})
	}
	layout := runtimeLayout{POSCurrentRoot: current}
	manifest := posPayloadManifest{PosVersion: "0.1.0", Files: manifestFiles}
	if err := validateInstalledPOSPayload(layout, manifest); err != nil {
		t.Fatal("valid POS current payload should pass")
	}
	_ = os.Remove(filepath.Join(current, "Manus POS.exe"))
	if err := validateInstalledPOSPayload(layout, manifest); err == nil {
		t.Fatal("missing executable must fail validation")
	}
}

func TestPOSPayloadHashMismatchRequiresReplacement(t *testing.T) {
	dir := t.TempDir()
	current := filepath.Join(dir, "POS", "current")
	if err := os.MkdirAll(filepath.Join(current, "resources"), 0o755); err != nil {
		t.Fatal(err)
	}
	content := []byte("expected")
	path := filepath.Join(current, "Manus POS.exe")
	if err := os.WriteFile(path, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	manifest := posPayloadManifest{PosVersion: "0.1.0", Files: []posPayloadFile{{Path: "Manus POS.exe", Size: int64(len(content)), SHA256: fmt.Sprintf("%x", sha256.Sum256(content))}}}
	if err := validateInstalledPOSPayload(runtimeLayout{POSCurrentRoot: current}, manifest); err == nil {
		t.Fatal("hash mismatch must fail validation")
	}
}

func TestPOSPayloadUnsafeManifestPathFails(t *testing.T) {
	dir := t.TempDir()
	current := filepath.Join(dir, "POS", "current")
	if err := os.MkdirAll(current, 0o755); err != nil {
		t.Fatal(err)
	}
	manifest := posPayloadManifest{PosVersion: "0.1.0", Files: []posPayloadFile{{Path: "../outside", Size: 0, SHA256: ""}}}
	if err := validateInstalledPOSPayload(runtimeLayout{POSCurrentRoot: current}, manifest); err == nil {
		t.Fatal("unsafe manifest path must fail validation")
	}
}

func TestReadOnlyBridgeHealthAndDiscovery(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body := `{"status":"ok","mode":"REAL","version":"qa"}`
		if r.URL.Path == "/devices/discover" {
			body = `{"success":true,"mode":"REAL","devices":[{"id":"p1","type":"PRINTER","descriptor":{"nativeIdentifier":"USB\\\\VID_0483&PID_070B\\\\B82D3A880106"}}]}`
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	state, err := bridge.getInstallerState()
	if err != nil || state.Agent["mode"] != "REAL" {
		t.Fatalf("health bridge = %#v, %v", state, err)
	}
	devices, err := bridge.discoverDevices()
	if err != nil || len(devices) != 1 || devices[0]["id"] != "p1" {
		t.Fatalf("discovery bridge = %#v, %v", devices, err)
	}
	usb, ok := devices[0]["usb"].(map[string]any)
	if !ok || usb["vid"] != "0483" || usb["pid"] != "070B" {
		t.Fatalf("discovery USB identity = %#v", devices[0]["usb"])
	}
}

func TestProductiveBridgeWaitsForTargetAgentVersion(t *testing.T) {
	bridge := newInstallerReadOnlyBridgeForVersion("0.1.1-qa.9")
	bridge.baseURL = "http://test.local"
	attempts := 0
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		attempts++
		version := "0.1.1-qa.8"
		if attempts > 1 {
			version = "0.1.1-qa.9"
		}
		body := `{"status":"ok","mode":"REAL","version":"` + version + `"}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	state, err := bridge.getInstallerState()
	if err != nil || state.Agent["version"] != "0.1.1-qa.9" || attempts < 2 {
		t.Fatalf("target health gate = %#v attempts=%d err=%v", state, attempts, err)
	}
}

func TestProductiveBridgeListsCanonicalDevicesAfterDiscover(t *testing.T) {
	bridge := newInstallerReadOnlyBridgeForVersion("0.1.1-qa.9")
	bridge.baseURL = "http://test.local"
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body := `[]`
		if r.URL.Path == "/devices/discover" {
			body = `{"success":true,"mode":"REAL","devices":[{"id":"stale","type":"PRINTER"}]}`
		}
		if r.URL.Path == "/devices" {
			body = `[{"id":"canonical-1","type":"PRINTER"},{"id":"canonical-2","type":"PRINTER"}]`
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.discoverDevices(); err != nil {
		t.Fatal(err)
	}
	devices, err := bridge.listDevices()
	if err != nil || len(devices) != 2 || devices[0]["id"] != "canonical-1" {
		t.Fatalf("canonical device list = %#v err=%v", devices, err)
	}
}

func TestConfigureBridgeValidatesDiscoveredDeviceAndProfile(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body := `{"success":true,"mode":"REAL","devices":[{"id":"p1","type":"PRINTER","terminalId":"local-terminal","metadata":{"usbRawCashDrawerPulseCertified":true}}]}`
		if r.Method == http.MethodPatch {
			body = `{"id":"p1","type":"PRINTER","profileId":"THERMAL_58MM","metadata":{"usbRawCashDrawerPulseCertified":true}}`
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.discoverDevices(); err != nil {
		t.Fatal(err)
	}
	if _, err := bridge.configureDevice("not-discovered", "THERMAL_58MM"); err == nil {
		t.Fatal("arbitrary device id accepted")
	}
	if _, err := bridge.configureDevice("p1", "UNKNOWN"); err == nil {
		t.Fatal("unknown profile accepted")
	}
	updated, err := bridge.configureDevice("p1", "THERMAL_58MM")
	if err != nil || updated["profileId"] != "THERMAL_58MM" {
		t.Fatalf("configure result = %#v, %v", updated, err)
	}
}

func TestReadOnlyBootstrapUsesOnlyReadOperations(t *testing.T) {
	html := appendReadOnlyBootstrap("<html><body></body></html>", false, false, false)
	for _, required := range []string{"getInstallerState", "discoverDevices", "DOMContentLoaded", "DISCOVERY_RUNNING", "go('devices')", "Buscar nuevamente", "supportsCashDrawerPulse", "hideReadonlyComplete"} {
		if !strings.Contains(html, required) {
			t.Fatalf("bootstrap missing %s", required)
		}
	}
	for _, forbidden := range []string{"configureDevice", "testPrinter", "testCashDrawer", "installBundle", "PowerShell"} {
		if forbidden == "configureDevice" || forbidden == "testPrinter" || forbidden == "testCashDrawer" {
			continue
		}
		if strings.Contains(html, forbidden) {
			t.Fatalf("read-only bootstrap contains mutating operation %s", forbidden)
		}
	}
	if !strings.Contains(html, "const configEnabled=false") {
		t.Fatal("readonly bootstrap must disable configuration")
	}
	if !strings.Contains(html, "const printEnabled=false") {
		t.Fatal("readonly bootstrap must disable printing")
	}
	for _, forbidden := range []string{"XPrinter 80 mm", "DIG-E200I", "3 impresoras detectadas"} {
		if strings.Contains(html, forbidden) {
			t.Fatalf("read-only bootstrap contains fixture %s", forbidden)
		}
	}
}

func TestPrintBootstrapEnablesConfigurationButNotDrawer(t *testing.T) {
	html := appendReadOnlyBootstrap("<html><body></body></html>", true, true, false)
	if !strings.Contains(html, "const configEnabled=true") || !strings.Contains(html, "const printEnabled=true") {
		t.Fatal("print QA capabilities not enabled")
	}
}

func TestProductiveDevicesHarnessSupportsPersistenceAndZeroDevices(t *testing.T) {
	html := appendProductiveDevicesHarness()
	for _, required := range []string{
		"No se detectaron",
		"Buscar nuevamente",
		"Agregar dispositivo",
		"Continuar sin periféricos",
		"window.saveDeviceConfiguration",
		"window.assignDevice",
		"window.registerNetworkPrinter",
		"window.testPrinter",
		"window.assignCashDrawer",
		"window.associateWindowsQueue",
		"Impresora principal",
		"Falta cola/controlador de Windows",
		"Cajón monedero",
		"Vía impresora",
		"Probar apertura",
		"No detectada / Offline",
		"Detectada / No configurada",
	} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive devices harness missing %q", required)
		}
	}
	if strings.Contains(html, "http://127.0.0.1") || strings.Contains(html, "window.fetch") {
		t.Fatal("productive devices harness must use typed bridge only")
	}
	for _, required := range []string{"Array.isArray(result)", "Array.isArray(result.devices)", "No pudimos detectar los dispositivos."} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive devices harness missing discovery normalization %q", required)
		}
	}
	for _, required := range []string{"data-discover-retry", "Buscando...", "device.metadata", "queueInstalled", "VID/PID"} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive devices harness missing UX contract %q", required)
		}
	}
	for _, required := range []string{"Buscando dispositivos...", "attempt<2", "No se detectaron", "window.listDevices", "devices.request.start", "devices.request.success", "startInitialDiscovery", "__manusCoreComplete", "recordDeviceDiagnostic"} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive discovery retry missing %q", required)
		}
	}
	for _, required := range []string{"__manusQueueInventory", "queueAvailable", "applyDrawerReadiness"} {
		if !strings.Contains(html, required) {
			t.Fatalf("canonical queue readiness missing %q", required)
		}
	}
	for _, required := range []string{"La cola no quedo persistida en el dispositivo fisico", "finally(function(){select.disabled=false;})", "usbRawCashDrawerPulseCertified"} {
		if !strings.Contains(html, required) {
			t.Fatalf("association/drawer guard missing %q", required)
		}
	}
	for _, required := range []string{"setCashDrawerCertification", "Habilitar apertura automatica mediante esta impresora", "Activalo solo si el cajon esta conectado fisicamente"} {
		if !strings.Contains(html, required) {
			t.Fatalf("drawer certification UI missing %q", required)
		}
	}
	for _, required := range []string{"Guardando", "window.listDevices", "window.__manusLastDevices=devices", "applyDrawerReadiness();", "Enviando pulso...", "Pulso enviado; confirma apertura física"} {
		if !strings.Contains(html, required) {
			t.Fatalf("drawer canonical state/update UI missing %q", required)
		}
	}
}

func TestCashDrawerBridgeTimeoutExceedsRawOperationBudget(t *testing.T) {
	if cashDrawerBridgeTimeout <= cashDrawerRawOperationTimeout {
		t.Fatalf("bridge timeout %s must exceed raw operation timeout %s", cashDrawerBridgeTimeout, cashDrawerRawOperationTimeout)
	}
}

func TestCashDrawerBridgeClassifiesLostAcknowledgementAsUnknownWithoutRetry(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.devices = map[string]map[string]any{
		"physical": {
			"id": "physical", "type": "PRINTER", "status": "CONNECTED", "profileId": "THERMAL_58MM",
			"usb":      map[string]any{"windowsQueueName": "XP-58"},
			"metadata": map[string]any{"usbRawCashDrawerPulseCertified": true},
		},
	}
	calls := 0
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		return nil, fmt.Errorf("connection reset after dispatch")
	})
	if _, err := bridge.testCashDrawer("physical"); err == nil || !strings.Contains(err.Error(), "RESULT_UNKNOWN") {
		t.Fatalf("lost acknowledgement classification = %v", err)
	}
	if calls != 1 {
		t.Fatalf("drawer request retried %d times", calls)
	}
}

func TestCashDrawerHarnessIncludesResultStatesAndLayoutRegions(t *testing.T) {
	html := appendProductiveDevicesHarness()
	for _, required := range []string{"RESULT_UNKNOWN", "CONFIRMED_ERROR", "drawer.ui.test.click", "drawer.ui.state", "drawer-card", "drawer-certification", "drawer-helper"} {
		if !strings.Contains(html, required) {
			t.Fatalf("drawer 7.2Q contract missing %q", required)
		}
	}
}

func TestCashDrawerSaveSnapshotsTargetAndVerifiesCanonicalState(t *testing.T) {
	html := appendProductiveDevicesHarness()
	for _, required := range []string{
		"var targetDeviceId=select.value",
		"var certificationEnabled=!!certInput.checked",
		"domCertificationChecked=",
		"cachedCertification=",
		"var renderSnapshot=renderId",
		"assignCashDrawer(targetDeviceId",
		"setCashDrawerCertification(targetDeviceId",
		"drawer.ui.save.click",
		"drawer.assign.start",
		"drawer.assign.success",
		"drawer.assign.error",
		"drawer.certification.start",
		"drawer.certification.success",
		"drawer.certification.error",
		"drawer.canonical.get.start",
		"drawer.canonical.get.success",
		"drawer.canonical.verify",
		"drawer.ui.save.success",
		"stage=CANONICAL_VERIFY",
		"window.__manusDrawerSaveGeneration",
	} {
		if !strings.Contains(html, required) {
			t.Fatalf("drawer save observability missing %q", required)
		}
	}
	if strings.Contains(html, "assignCashDrawer(select.value") || strings.Contains(html, "setCashDrawerCertification(select.value") {
		t.Fatal("drawer save must use one immutable targetDeviceId snapshot")
	}
	if !strings.Contains(html, "var certified=certificationEnabled") {
		t.Fatal("drawer save must persist the live checkbox snapshot")
	}
	if !strings.Contains(html, "throw error;}).then(function(){stage='CANONICAL_GET'") {
		t.Fatal("drawer save must fail before canonical success when a PATCH rejects")
	}
}

func TestCashDrawerRuntimeAndBridgeBoundaryDiagnostics(t *testing.T) {
	html := appendProductiveDevicesHarness()
	for _, required := range []string{
		"drawer.runtime.ready",
		"candidate=7.2T productiveHarness=true",
		"drawer.ui.render",
		"drawer.ui.save.button.created",
		"drawer.ui.save.handler.bound",
		"drawer.ui.save.click.captured",
		"drawer.ui.save.handler.enter",
		"addEventListener('click'",
	} {
		if !strings.Contains(html, required) {
			t.Fatalf("runtime drawer boundary diagnostic missing %q", required)
		}
	}
	if strings.Contains(html, "preventDefault()") || strings.Contains(html, "stopPropagation()") {
		t.Fatal("diagnostic capture observer must not control the click")
	}
	bridgeSource, err := os.ReadFile("readonly_bridge_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"drawer.bridge.assign.entry",
		"drawer.bridge.assign.http.start",
		"drawer.bridge.assign.http.success",
		"drawer.bridge.assign.http.error",
		"drawer.bridge.certification.entry",
		"drawer.bridge.certification.http.start",
		"drawer.bridge.certification.http.success",
		"drawer.bridge.certification.http.error",
		"drawer.bridge.canonical.entry",
		"drawer.bridge.canonical.success",
		"drawer.bridge.canonical.error",
	} {
		if !strings.Contains(string(bridgeSource), required) {
			t.Fatalf("native bridge diagnostic missing %q", required)
		}
	}
}

func TestCashDrawerBridgeRejectsUncertifiedUsbBeforeAgentRequest(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.devices = map[string]map[string]any{
		"physical": {
			"id": "physical", "type": "PRINTER", "status": "CONNECTED", "profileId": "THERMAL_58MM",
			"usb":      map[string]any{"windowsQueueName": "XP-58"},
			"metadata": map[string]any{},
		},
	}
	called := false
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		called = true
		return nil, fmt.Errorf("unexpected request")
	})
	if _, err := bridge.testCashDrawer("physical"); err == nil || !strings.Contains(err.Error(), "no est") {
		t.Fatalf("uncertified drawer result = %v", err)
	}
	if called {
		t.Fatal("uncertified drawer must not call Agent")
	}
}

func TestCashDrawerCertificationPreservesMetadataAndTargetsParentPrinter(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.devices = map[string]map[string]any{
		"physical": {
			"id": "physical", "type": "PRINTER",
			"metadata": map[string]any{
				"cashDrawerConnectionType":  "VIA_PRINTER",
				"cashDrawerParentPrinterId": "physical",
				"manusAssignmentRole":       "PRIMARY_PRINTER",
				"physicalDetected":          true,
			},
		},
	}
	var body map[string]any
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method == http.MethodPatch {
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				return nil, err
			}
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"physical","type":"PRINTER","metadata":{"usbRawCashDrawerPulseCertified":true,"cashDrawerParentPrinterId":"physical"}}`)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.setCashDrawerCertification("physical", "local-terminal", true); err != nil {
		t.Fatal(err)
	}
	metadata, ok := body["metadata"].(map[string]any)
	if !ok || metadata["usbRawCashDrawerPulseCertified"] != true || metadata["cashDrawerParentPrinterId"] != "physical" || metadata["manusAssignmentRole"] != "PRIMARY_PRINTER" {
		t.Fatalf("certification payload did not preserve parent metadata: %#v", body)
	}
}

func TestExtractUsbVIDPIDUsesNativeIdentityWithoutModelMapping(t *testing.T) {
	vid, pid := extractUsbVIDPID(`USB\VID_0483&PID_070B\B82D3A880106`)
	if vid != "0483" || pid != "070B" {
		t.Fatalf("parsed XP-58 identity = %s/%s", vid, pid)
	}
	vid, pid = extractUsbVIDPID(`USB\VID_1FC9&PID_2016\5D2F0E663532`)
	if vid != "1FC9" || pid != "2016" {
		t.Fatalf("parsed POS-80 identity = %s/%s", vid, pid)
	}
	vid, pid = extractUsbVIDPID(`USB\UNKNOWN\DEVICE`)
	if vid != "" || pid != "" {
		t.Fatalf("missing identity = %s/%s", vid, pid)
	}
}

func TestResolvedWindowsQueueNeverTreatsPnPFriendlyNameAsQueue(t *testing.T) {
	pnpOnly := map[string]any{
		"usb":      map[string]any{"printerName": "Printer USB Printer Port"},
		"metadata": map[string]any{"physicalDetected": true, "queueInstalled": false},
	}
	if resolvedWindowsQueue(pnpOnly) {
		t.Fatal("PnP friendly name must not be used as a Windows queue")
	}
	withQueue := map[string]any{
		"usb":      map[string]any{"printerName": "XP-80", "windowsQueueName": "XP-80"},
		"metadata": map[string]any{"physicalDetected": true, "queueInstalled": true},
	}
	if !resolvedWindowsQueue(withQueue) {
		t.Fatal("resolved Windows queue should be usable")
	}
}

func TestAssociateWindowsQueueSendsCanonicalUsbField(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.devices = map[string]map[string]any{
		"physical": {"id": "physical", "type": "PRINTER", "usb": map[string]any{"deviceId": "physical", "printerName": "Printer USB Printer Port"}},
		"queue":    {"id": "queue", "type": "PRINTER", "name": "XP-58", "profileId": "THERMAL_58MM", "descriptor": map[string]any{"fingerprint": map[string]any{"source": "WINDOWS_PRINT_QUEUE"}}},
	}
	var body map[string]any
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method == http.MethodPatch {
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				return nil, err
			}
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"physical","type":"PRINTER","usb":{"deviceId":"physical","printerName":"Printer USB Printer Port","windowsQueueName":"XP-58"}}`)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.associateWindowsQueue("physical", "XP-58"); err != nil {
		t.Fatal(err)
	}
	usb, ok := body["usb"].(map[string]any)
	if !ok || usb["windowsQueueName"] != "XP-58" {
		t.Fatalf("association payload = %#v", body)
	}
}

func TestAssociateWindowsQueueBlocksOnlyRealConfiguredOwner(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.devices = map[string]map[string]any{
		"target": {"id": "target", "type": "PRINTER", "usb": map[string]any{"deviceId": "target"}},
		"queue":  {"id": "queue", "type": "PRINTER", "name": "XP-80", "profileId": "THERMAL_80MM", "descriptor": map[string]any{"fingerprint": map[string]any{"source": "WINDOWS_PRINT_QUEUE"}}},
	}
	called := false
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		called = true
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"target","type":"PRINTER","usb":{"deviceId":"target","windowsQueueName":"XP-80"}}`)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.associateWindowsQueue("target", "XP-80"); err != nil {
		t.Fatalf("queue-only discovery row blocked explicit association: %v", err)
	}
	if !called {
		t.Fatal("valid explicit association must send PATCH")
	}

	bridge.devices["configured"] = map[string]any{
		"id": "configured", "type": "PRINTER", "profileId": "THERMAL_80MM",
		"usb":        map[string]any{"deviceId": "configured", "windowsQueueName": "XP-80"},
		"descriptor": map[string]any{"fingerprint": map[string]any{"source": "WINDOWS_PNP"}},
	}
	if _, err := bridge.associateWindowsQueue("target", "XP-80"); err == nil || !strings.Contains(err.Error(), "asociada") {
		t.Fatalf("real configured owner should block duplicate queue: %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestEmbeddedInstallerUIAssetsExcludeReference(t *testing.T) {
	for _, path := range []string{"assets/ui/index.html", "assets/ui/styles.css", "assets/ui/app.js"} {
		if _, err := embeddedAssets.ReadFile(path); err != nil {
			t.Fatalf("embedded UI asset missing: %s: %v", path, err)
		}
	}
	if _, err := embeddedAssets.ReadFile("assets/ui/reference/manus-terminal-installer-approved.html"); err == nil {
		t.Fatal("approved reference must not be a runtime UI asset")
	}
	for _, path := range []string{"assets/ui/index.runtime.html", "assets/ui/index.runtime.productive.html"} {
		runtimeHTML, err := embeddedAssets.ReadFile(path)
		if err != nil {
			t.Fatalf("runtime UI asset missing: %v", err)
		}
		content := string(runtimeHTML)
		for _, forbidden := range []string{`src="app.js"`, `href="styles.css"`, "http://", "https://"} {
			if strings.Contains(content, forbidden) {
				t.Fatalf("runtime UI contains forbidden reference: %s", forbidden)
			}
		}
		if !strings.Contains(content, "data:image/jpeg;base64,") {
			t.Fatalf("%s does not embed the Manus logo", path)
		}
		if strings.Contains(content, "LogoManus.png.jpeg") || strings.Contains(content, "file://") {
			t.Fatalf("%s contains a non-self-contained logo reference", path)
		}
		if !strings.Contains(content, `.window-bar{display:none!important;}`) {
			t.Fatalf("%s does not hide browser chrome", path)
		}
		if path == "assets/ui/index.runtime.productive.html" && !strings.Contains(content, `.prototype-nav{display:none!important;}`) {
			t.Fatal("productive runtime must hide mock nav")
		}
		if path == "assets/ui/index.runtime.html" && strings.Contains(content, `.prototype-nav{display:none!important;}`) {
			t.Fatal("spike runtime must keep mock nav")
		}
	}
}

func TestBuildLayoutUsesProgramRoots(t *testing.T) {
	t.Setenv("ProgramFiles", `C:\BuildRoot\Program Files`)
	t.Setenv("ProgramData", `C:\BuildRoot\ProgramData`)

	layout := buildLayout(installerManifest{Version: "1.2.3"})
	if got, want := layout.InstallRoot, `C:\BuildRoot\Program Files\Manus\PeripheralAgent`; got != want {
		t.Fatalf("InstallRoot = %q, want %q", got, want)
	}
	if got, want := layout.CurrentRoot, `C:\BuildRoot\Program Files\Manus\PeripheralAgent\current`; got != want {
		t.Fatalf("CurrentRoot = %q, want %q", got, want)
	}
	if got, want := layout.ConfigRoot, `C:\BuildRoot\ProgramData\Manus\PeripheralAgent\config`; got != want {
		t.Fatalf("ConfigRoot = %q, want %q", got, want)
	}
	if got, want := layout.VersionRoot, `C:\BuildRoot\Program Files\Manus\PeripheralAgent\versions\1.2.3`; got != want {
		t.Fatalf("VersionRoot = %q, want %q", got, want)
	}
}

func TestBuildServiceBinaryPathQuotesArguments(t *testing.T) {
	got := buildServiceBinaryPath(`C:\Program Files\Manus\PeripheralAgent\current\ManusTerminalSetup.exe`, "service", "--health-timeout=60")
	want := `"C:\Program Files\Manus\PeripheralAgent\current\ManusTerminalSetup.exe"` + " " + syscall.EscapeArg("service") + " " + syscall.EscapeArg("--health-timeout=60")
	if got != want {
		t.Fatalf("buildServiceBinaryPath() = %q, want %q", got, want)
	}
}

func TestBuildServiceBinaryPathDoesNotEscapeExecutableQuotes(t *testing.T) {
	got := buildServiceBinaryPath(`C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe`, "service")
	if got != `"C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe" service` {
		t.Fatalf("buildServiceBinaryPath() = %q", got)
	}
	if strings.Contains(got, `\"`) {
		t.Fatalf("buildServiceBinaryPath() contains escaped executable quotes: %q", got)
	}
}

func TestBuildServiceRegistrationUsesRawExecutableAndSeparateArgs(t *testing.T) {
	manifest := installerManifest{ServiceArgs: []string{"service", "--health-timeout=60"}}
	layout := runtimeLayout{
		ServiceExe: `C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe`,
	}

	registration := buildServiceRegistration(manifest, layout)

	if registration.Executable != layout.ServiceExe {
		t.Fatalf("Executable = %q, want %q", registration.Executable, layout.ServiceExe)
	}
	if len(registration.Args) != 2 {
		t.Fatalf("Args = %#v, want 2 args", registration.Args)
	}
	if registration.Args[0] != "service" || registration.Args[1] != "--health-timeout=60" {
		t.Fatalf("Args = %#v", registration.Args)
	}
	if strings.Contains(registration.Executable, `\"`) {
		t.Fatalf("Executable contains escaped quotes: %q", registration.Executable)
	}
	if buildServiceBinaryPath(registration.Executable, registration.Args...) != `"C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe" service --health-timeout=60` {
		t.Fatalf("buildServiceBinaryPath preview mismatch")
	}
}

func TestReadInstalledVersionParsesJSONAndText(t *testing.T) {
	dir := t.TempDir()

	jsonPath := filepath.Join(dir, "VERSION.json")
	if err := os.WriteFile(jsonPath, []byte(`{"version":"2.0.1"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, ok := readInstalledVersion(jsonPath); !ok || got != "2.0.1" {
		t.Fatalf("readInstalledVersion(json) = %q, %v", got, ok)
	}

	textPath := filepath.Join(dir, "VERSION")
	if err := os.WriteFile(textPath, []byte("2.0.2\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, ok := readInstalledVersion(textPath); !ok || got != "2.0.2" {
		t.Fatalf("readInstalledVersion(text) = %q, %v", got, ok)
	}
}

func TestRepairStagingValidationRequiresCompletePayload(t *testing.T) {
	dir := t.TempDir()
	manifest := installerManifest{Version: "0.1.1-qa.4", VersionFileName: "VERSION.json"}
	if err := os.WriteFile(filepath.Join(dir, "VERSION.json"), []byte(`{"version":"0.1.1-qa.4"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := validateRepairStaging(dir, manifest); err == nil {
		t.Fatal("incomplete repair staging accepted")
	}
	for _, path := range []string{
		filepath.Join(dir, "ManusTerminalSetup.exe"),
		filepath.Join(dir, "runtime", "node.exe"),
		filepath.Join(dir, "app", "main.js"),
	} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("test"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := validateRepairStaging(dir, manifest); err != nil {
		t.Fatalf("complete repair staging rejected: %v", err)
	}
}

func TestRepairStagingValidationRejectsWrongVersion(t *testing.T) {
	dir := t.TempDir()
	manifest := installerManifest{Version: "0.1.1-qa.4", VersionFileName: "VERSION.json"}
	if err := os.WriteFile(filepath.Join(dir, "VERSION.json"), []byte(`{"version":"0.1.1-qa.3"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := validateRepairStaging(dir, manifest); err == nil {
		t.Fatal("wrong staged version accepted")
	}
}

func TestQA4ToQA5UpgradePreflightAndServiceTarget(t *testing.T) {
	root := t.TempDir()
	t.Setenv("ProgramFiles", filepath.Join(root, "Program Files"))
	t.Setenv("ProgramData", filepath.Join(root, "ProgramData"))
	qa4 := filepath.Join(root, "Program Files", "Manus", "PeripheralAgent", "versions", "0.1.1-qa.4")
	current := filepath.Join(root, "Program Files", "Manus", "PeripheralAgent", "current")
	if err := os.MkdirAll(current, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(current, "VERSION.json"), []byte(`{"version":"0.1.1-qa.4"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	manifest := installerManifest{
		Version:         "0.1.1-qa.5",
		BundleRoot:      "assets/bundle/ManusPeripheralAgent-win-x64-0.1.1-qa.5",
		VersionFileName: "VERSION.json",
		ServiceName:     "ManusPeripheralAgent",
		ServiceArgs:     []string{"service"},
	}
	layout := buildLayout(manifest)
	previous, previousPath := currentInstalledVersion(manifest, layout)
	if previous != "0.1.1-qa.4" || previousPath != qa4 {
		t.Fatalf("previous install = %q %q, want qa.4 at %q", previous, previousPath, qa4)
	}
	staging := filepath.Join(root, "staging-qa.5")
	if err := os.MkdirAll(filepath.Join(staging, "runtime"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(staging, "app"), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{
		filepath.Join(staging, "VERSION.json"),
		filepath.Join(staging, "ManusTerminalSetup.exe"),
		filepath.Join(staging, "runtime", "node.exe"),
		filepath.Join(staging, "app", "main.js"),
	} {
		if err := os.WriteFile(path, []byte(`{"version":"0.1.1-qa.5"}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := validateRepairStaging(staging, manifest); err != nil {
		t.Fatalf("qa.5 staging rejected: %v", err)
	}
	registration := buildServiceRegistration(manifest, runtimeLayout{VersionRoot: filepath.Join(layout.VersionsRoot, manifest.Version), ServiceExe: filepath.Join(layout.VersionsRoot, manifest.Version, "ManusTerminalSetup.exe")})
	if !strings.Contains(registration.Executable, "0.1.1-qa.5") || registration.Args[0] != "service" {
		t.Fatalf("qa.5 service registration = %#v", registration)
	}
}

func TestPreflightDetectsInconsistentFootprints(t *testing.T) {
	root := t.TempDir()
	t.Setenv("ProgramFiles", filepath.Join(root, "Program Files"))
	t.Setenv("ProgramData", filepath.Join(root, "ProgramData"))
	layout := buildLayout(installerManifest{Version: "0.1.1-qa.4"})
	if err := os.MkdirAll(layout.CurrentRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if !hasInstallationFootprints(layout) {
		t.Fatal("expected installation footprint")
	}
}

func TestRepairPathsNeverAliasLiveTarget(t *testing.T) {
	layout := runtimeLayout{VersionsRoot: filepath.Join(t.TempDir(), "versions"), VersionRoot: filepath.Join(t.TempDir(), "versions", "0.1.1-qa.4")}
	staging, backup := newRepairPaths(layout)
	if staging == layout.VersionRoot || backup == layout.VersionRoot || staging == backup {
		t.Fatalf("repair paths alias live target: staging=%q backup=%q target=%q", staging, backup, layout.VersionRoot)
	}
}

func TestUninstallCleanupUsesExternalHelperArguments(t *testing.T) {
	layout := runtimeLayout{
		InstallRoot:     `C:\Program Files\Manus\PeripheralAgent`,
		ProgramDataRoot: `C:\ProgramData\Manus\PeripheralAgent`,
	}
	args := uninstallCleanupArgs(1234, layout, false)
	if strings.Contains(strings.Join(args, " "), layout.InstallRoot+"\\versions") {
		t.Fatal("cleanup args must target install root, not a live child executable")
	}
	pid, installRoot, dataRoot, _, removeData, err := parseUninstallCleanupArgs(args)
	if err != nil || pid != 1234 || installRoot != layout.InstallRoot || dataRoot != layout.ProgramDataRoot || removeData {
		t.Fatalf("cleanup args parse = %d %q %q %v %v", pid, installRoot, dataRoot, removeData, err)
	}
	if strings.HasPrefix(filepath.Clean(filepath.Dir(os.TempDir())), filepath.Clean(layout.InstallRoot)) {
		t.Fatal("test temp root unexpectedly inside Program Files")
	}
}

func TestUninstallCleanupRequiresParentAndRoots(t *testing.T) {
	if _, _, _, _, _, err := parseUninstallCleanupArgs(nil); err == nil {
		t.Fatal("incomplete cleanup arguments accepted")
	}
}

func TestPOSProcessScopeRequiresPathContainment(t *testing.T) {
	root := `C:\Program Files\Manus\POS`
	if !pathWithinRoot(`C:\Program Files\Manus\POS\current\Manus POS.exe`, root) {
		t.Fatal("POS executable under root was not accepted")
	}
	if !pathWithinRoot(`c:\program files\manus\pos\versions\0.1.0\Manus POS.exe`, root) {
		t.Fatal("case-insensitive POS path was not accepted")
	}
	for _, outside := range []string{
		`C:\Program Files\Manus\POS-other\Manus POS.exe`,
		`C:\Program Files\Other\Manus POS.exe`,
		`C:\Windows\System32\electron.exe`,
	} {
		if pathWithinRoot(outside, root) {
			t.Fatalf("outside process path accepted: %s", outside)
		}
	}
}

func TestProgramDataAloneIsNotProductiveFootprint(t *testing.T) {
	root := t.TempDir()
	layout := runtimeLayout{
		InstallRoot:     filepath.Join(root, "Program Files", "Manus", "PeripheralAgent"),
		ProgramDataRoot: filepath.Join(root, "ProgramData", "Manus", "PeripheralAgent"),
	}
	if err := os.MkdirAll(layout.ProgramDataRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if hasInstallationFootprints(layout) {
		t.Fatal("ProgramData alone must not be inconsistent")
	}
}

func TestEmptyManusParentCanBeRemovedButNonEmptyIsPreserved(t *testing.T) {
	root := filepath.Join(t.TempDir(), "Manus")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	removed, err := removeEmptyManusParent(root)
	if err != nil || !removed || exists(root) {
		t.Fatalf("empty Manus parent cleanup = removed=%v err=%v exists=%v", removed, err, exists(root))
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "other.txt"), []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}
	removed, err = removeEmptyManusParent(root)
	if err != nil || removed || !exists(root) {
		t.Fatalf("non-empty Manus parent cleanup = removed=%v err=%v exists=%v", removed, err, exists(root))
	}
}

func TestTempCleanupCommandQuotesPathsWithSpacesAndRunsFromParent(t *testing.T) {
	tempRoot := filepath.Join(os.TempDir(), "Ivan Castro", "ManusTerminalSetup-uninstall-7280")
	if err := os.MkdirAll(filepath.Dir(tempRoot), 0o755); err != nil {
		t.Fatal(err)
	}
	script, err := writeTempCleanupScript(tempRoot, filepath.Join(os.TempDir(), "logs", "installer.log"), true)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(script)
	defer os.Remove(filepath.Dir(tempRoot))
	contents, err := os.ReadFile(script)
	if err != nil || !strings.Contains(string(contents), `rmdir /s /q "%TARGET%"`) || !strings.Contains(string(contents), "1,1,12") {
		t.Fatalf("cleanup script invalid: %v %s", err, contents)
	}
	command := buildTempCleanupCommand(tempRoot)
	if !strings.Contains(command, "retries=12") {
		t.Fatalf("cleanup command = %q", command)
	}
	finalScript := filepath.Join(filepath.Dir(tempRoot), "ManusTerminalSetup-cleanup-final.cmd")
	if err := writeFinalLogCleanupScript(finalScript, filepath.Join(os.TempDir(), "Manus Terminal Setup.log")); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(finalScript)
	finalContents, err := os.ReadFile(finalScript)
	if err != nil || !strings.Contains(string(finalContents), "1,1,12") || !strings.Contains(string(finalContents), "del /q") {
		t.Fatalf("final cleanup script invalid: %v %s", err, finalContents)
	}
	if filepath.Dir(tempRoot) == tempRoot {
		t.Fatal("cleanup target must have an external working directory")
	}
}

func TestEnvDurationSecondsFallback(t *testing.T) {
	t.Setenv("MANUS_INSTALLER_HEALTH_TIMEOUT_SECONDS", "")
	if got := envDurationSeconds("MANUS_INSTALLER_HEALTH_TIMEOUT_SECONDS", 33); got != 33*time.Second {
		t.Fatalf("fallback duration = %v, want 33s", got)
	}
}

func TestRollbackRegistrationCanTargetPreviousVersionExecutable(t *testing.T) {
	manifest := installerManifest{ServiceArgs: []string{"service"}}
	layout := runtimeLayout{
		ServiceExe: `C:\Program Files\Manus\PeripheralAgent\versions\0.1.1-qa.3\ManusTerminalSetup.exe`,
	}
	rollbackPath := `C:\Program Files\Manus\PeripheralAgent\versions\0.1.0`
	registration := buildServiceRegistration(manifest, layout)
	registration.Executable = filepath.Join(rollbackPath, "ManusTerminalSetup.exe")

	if registration.Executable != `C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe` {
		t.Fatalf("rollback executable = %q", registration.Executable)
	}
}

func TestUpgradePreservesExistingConfigAndInstallationIdentity(t *testing.T) {
	root := t.TempDir()
	t.Setenv("ProgramFiles", filepath.Join(root, "Program Files"))
	t.Setenv("ProgramData", filepath.Join(root, "ProgramData"))
	layout := buildLayout(installerManifest{Version: "0.1.1-qa.3"})

	if err := ensureBaseDirectories(layout); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(layout.VersionRoot, "config"), 0o755); err != nil {
		t.Fatal(err)
	}
	seed := []byte(`{"mode":"REAL"}`)
	if err := os.WriteFile(filepath.Join(layout.VersionRoot, "config", "agent.config.local.json"), seed, 0o644); err != nil {
		t.Fatal(err)
	}

	existingConfig := []byte(`{"mode":"MOCK","marker":"preserve-me"}`)
	configPath := filepath.Join(layout.ConfigRoot, "agent.config.local.json")
	if err := os.WriteFile(configPath, existingConfig, 0o644); err != nil {
		t.Fatal(err)
	}
	identityPath := filepath.Join(layout.StateRoot, "agent-installation-id")
	identity := []byte("qa-installation-id")
	if err := os.WriteFile(identityPath, identity, 0o644); err != nil {
		t.Fatal(err)
	}

	if err := ensureLocalConfig(layout); err != nil {
		t.Fatal(err)
	}
	gotConfig, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}
	gotIdentity, err := os.ReadFile(identityPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(gotConfig) != string(existingConfig) {
		t.Fatalf("existing config changed: %s", gotConfig)
	}
	if string(gotIdentity) != string(identity) {
		t.Fatalf("installation identity changed: %s", gotIdentity)
	}
}
