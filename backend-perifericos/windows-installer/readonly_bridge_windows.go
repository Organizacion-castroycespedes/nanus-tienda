//go:build windows

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const peripheralAgentBaseURL = "http://127.0.0.1:4050"

const (
	cashDrawerRawOperationTimeout = 15 * time.Second
	cashDrawerBridgeTimeout       = cashDrawerRawOperationTimeout + 2*time.Second
)

// installerReadOnlyBridge is the typed WebView2 bridge. It exposes only
// bounded device operations; it never exposes an arbitrary HTTP proxy.
type installerReadOnlyBridge struct {
	client               *http.Client
	baseURL              string
	mu                   sync.Mutex
	devices              map[string]map[string]any
	expectedAgentVersion string
	diagnosticPath       string
	drawerRequestID      uint64
	drawerSaveRequestID  uint64
}

type installerStatePayload struct {
	Agent   map[string]any   `json:"agent"`
	Devices []map[string]any `json:"devices"`
	Error   string           `json:"error,omitempty"`
}

func newInstallerReadOnlyBridge() *installerReadOnlyBridge {
	return &installerReadOnlyBridge{client: &http.Client{Timeout: 5 * time.Second}, baseURL: peripheralAgentBaseURL, devices: map[string]map[string]any{}}
}

func newInstallerReadOnlyBridgeForVersion(expectedVersion string) *installerReadOnlyBridge {
	bridge := newInstallerReadOnlyBridge()
	bridge.expectedAgentVersion = strings.TrimSpace(expectedVersion)
	return bridge
}

func (b *installerReadOnlyBridge) recordDeviceDiagnostic(event, detail string) bool {
	return b.recordInstallerDiagnostic("devices."+strings.TrimSpace(event), detail)
}

func (b *installerReadOnlyBridge) recordInstallerDiagnostic(event, detail string) bool {
	if strings.TrimSpace(event) == "" || strings.TrimSpace(b.diagnosticPath) == "" {
		return false
	}
	file, err := os.OpenFile(b.diagnosticPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return false
	}
	defer file.Close()
	_, err = fmt.Fprintf(file, "%s %s %s\n", time.Now().Format(time.RFC3339Nano), strings.TrimSpace(event), strings.TrimSpace(detail))
	return err == nil
}

func (b *installerReadOnlyBridge) getInstallerState() (installerStatePayload, error) {
	var health map[string]any
	var err error
	if b.expectedAgentVersion != "" {
		health, err = b.waitForExpectedHealth()
	} else {
		health, err = b.getHealth()
	}
	if err != nil {
		return installerStatePayload{Agent: map[string]any{"status": "unavailable"}, Error: err.Error()}, nil
	}
	return installerStatePayload{Agent: health, Devices: []map[string]any{}}, nil
}

func (b *installerReadOnlyBridge) waitForExpectedHealth() (map[string]any, error) {
	deadline := time.Now().Add(45 * time.Second)
	started := time.Now()
	var lastErr error
	for attempt := 1; time.Now().Before(deadline); attempt++ {
		health, err := b.getHealth()
		if err == nil && stringValue(health["status"]) == "ok" &&
			stringValue(health["mode"]) == "REAL" &&
			stringValue(health["version"]) == b.expectedAgentVersion {
			log.Printf("agent readiness expectedAgentVersion=%s actualAgentVersion=%s attempt=%d elapsedMs=%d", b.expectedAgentVersion, stringValue(health["version"]), attempt, time.Since(started).Milliseconds())
			return health, nil
		}
		if err != nil {
			lastErr = err
		} else {
			lastErr = fmt.Errorf("agent health version=%s mode=%s status=%s expectedVersion=%s attempt=%d", stringValue(health["version"]), stringValue(health["mode"]), stringValue(health["status"]), b.expectedAgentVersion, attempt)
		}
		log.Printf("agent readiness expectedAgentVersion=%s actualAgentVersion=%s attempt=%d elapsedMs=%d error=%v", b.expectedAgentVersion, stringValue(health["version"]), attempt, time.Since(started).Milliseconds(), lastErr)
		time.Sleep(500 * time.Millisecond)
	}
	if lastErr == nil {
		lastErr = errors.New("agent target health timeout")
	}
	return nil, lastErr
}

func (b *installerReadOnlyBridge) discoverDevices() ([]map[string]any, error) {
	var payload struct {
		Success bool             `json:"success"`
		Mode    string           `json:"mode"`
		Devices []map[string]any `json:"devices"`
		Error   string           `json:"error"`
		Message string           `json:"message"`
	}
	if err := b.requestJSON(http.MethodPost, b.baseURL+"/devices/discover", []byte(`{}`), &payload); err != nil {
		return nil, err
	}
	if payload.Error != "" || payload.Message != "" && !payload.Success {
		return nil, errors.New(firstNonEmpty(payload.Error, payload.Message))
	}
	b.mu.Lock()
	b.devices = map[string]map[string]any{}
	for _, device := range payload.Devices {
		enrichUsbIdentity(device)
		if id, ok := device["id"].(string); ok && strings.TrimSpace(id) != "" {
			b.devices[id] = device
		}
	}
	b.mu.Unlock()
	return payload.Devices, nil
}

func (b *installerReadOnlyBridge) listDevices() ([]map[string]any, error) {
	requestID := atomic.AddUint64(&b.drawerSaveRequestID, 1)
	started := time.Now()
	b.recordInstallerDiagnostic("drawer.bridge.canonical.entry", fmt.Sprintf("requestId=%d", requestID))
	var devices []map[string]any
	if err := b.requestJSON(http.MethodGet, b.baseURL+"/devices", nil, &devices); err != nil {
		status, code := bridgeErrorDetails(err)
		b.recordInstallerDiagnostic("drawer.bridge.canonical.error", fmt.Sprintf("requestId=%d status=%s code=%s durationMs=%d", requestID, status, code, time.Since(started).Milliseconds()))
		return nil, err
	}
	b.recordInstallerDiagnostic("drawer.bridge.canonical.success", fmt.Sprintf("requestId=%d count=%d durationMs=%d", requestID, len(devices), time.Since(started).Milliseconds()))
	b.mu.Lock()
	b.devices = map[string]map[string]any{}
	for _, device := range devices {
		enrichUsbIdentity(device)
		if id, ok := device["id"].(string); ok && strings.TrimSpace(id) != "" {
			b.devices[id] = device
		}
	}
	b.mu.Unlock()
	return devices, nil
}

var usbIdentityPattern = regexp.MustCompile(`(?i)VID_([0-9A-F]{4}).*PID_([0-9A-F]{4})`)

func extractUsbVIDPID(nativeIdentifier string) (string, string) {
	matches := usbIdentityPattern.FindStringSubmatch(nativeIdentifier)
	if len(matches) != 3 {
		return "", ""
	}
	return strings.ToUpper(matches[1]), strings.ToUpper(matches[2])
}

func enrichUsbIdentity(device map[string]any) {
	descriptor, ok := device["descriptor"].(map[string]any)
	if !ok {
		return
	}
	nativeIdentifier, _ := descriptor["nativeIdentifier"].(string)
	vid, pid := extractUsbVIDPID(nativeIdentifier)
	if vid == "" || pid == "" {
		return
	}
	usb, ok := device["usb"].(map[string]any)
	if !ok {
		usb = map[string]any{}
		device["usb"] = usb
	}
	usb["vid"] = vid
	usb["pid"] = pid
}

func (b *installerReadOnlyBridge) configureDevice(deviceID, profileID string) (map[string]any, error) {
	return b.saveDeviceConfiguration(deviceID, profileID, "")
}

func (b *installerReadOnlyBridge) saveDeviceConfiguration(deviceID, profileID, logicalName string) (map[string]any, error) {
	deviceID = strings.TrimSpace(deviceID)
	profileID = strings.TrimSpace(profileID)
	if deviceID == "" || profileID == "" {
		return nil, errors.New("deviceId y profileId son obligatorios")
	}
	for _, r := range deviceID {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '-' && r != '_' {
			return nil, errors.New("deviceId inválido")
		}
	}
	if profileID != "THERMAL_58MM" && profileID != "THERMAL_80MM" {
		return nil, errors.New("perfil de impresora no soportado")
	}
	b.mu.Lock()
	device, ok := b.devices[deviceID]
	b.mu.Unlock()
	if !ok || device["type"] != "PRINTER" {
		return nil, errors.New("deviceId no pertenece a un dispositivo descubierto")
	}
	terminalID, _ := device["terminalId"].(string)
	if strings.TrimSpace(terminalID) == "" {
		terminalID = "local-terminal"
	}
	name := ""
	name = strings.TrimSpace(logicalName)
	update := map[string]any{"terminalId": terminalID, "profileId": profileID}
	if name != "" {
		update["name"] = name
	}
	body, err := json.Marshal(update)
	if err != nil {
		return nil, err
	}
	var updated map[string]any
	if err := b.requestJSON(http.MethodPatch, b.baseURL+"/devices/"+deviceID, body, &updated); err != nil {
		return nil, err
	}
	b.mu.Lock()
	b.devices[deviceID] = updated
	b.mu.Unlock()
	return updated, nil
}

// assignDevice binds a discovered/configured device to the local terminal.
// Cloud terminal assignment remains owned by the shared POS facade; this
// local binding is the Agent-side correlation used after installer setup.
func (b *installerReadOnlyBridge) assignDevice(deviceID, terminalID string) (map[string]any, error) {
	deviceID = strings.TrimSpace(deviceID)
	terminalID = strings.TrimSpace(terminalID)
	if deviceID == "" || terminalID == "" {
		return nil, errors.New("deviceId y terminalId son obligatorios")
	}
	b.mu.Lock()
	device, ok := b.devices[deviceID]
	b.mu.Unlock()
	if !ok {
		return nil, errors.New("deviceId no pertenece a un dispositivo descubierto")
	}
	// A terminal has one primary printer. Clear the descriptive local role
	// from the previous printer before assigning the new one; configurations
	// themselves remain untouched.
	if device["type"] == "PRINTER" {
		b.mu.Lock()
		previous := make([]map[string]any, 0)
		for id, candidate := range b.devices {
			if id == deviceID || candidate["type"] != "PRINTER" {
				continue
			}
			metadata, _ := candidate["metadata"].(map[string]any)
			if metadata["manusAssignmentRole"] == "PRIMARY_PRINTER" {
				copy := map[string]any{}
				for key, value := range metadata {
					if key != "manusAssignmentRole" {
						copy[key] = value
					}
				}
				previous = append(previous, map[string]any{"id": id, "metadata": copy, "terminalId": terminalID})
			}
		}
		b.mu.Unlock()
		for _, old := range previous {
			body, marshalErr := json.Marshal(map[string]any{"terminalId": terminalID, "metadata": old["metadata"]})
			if marshalErr != nil {
				return nil, marshalErr
			}
			var ignored map[string]any
			if patchErr := b.requestJSON(http.MethodPatch, b.baseURL+"/devices/"+old["id"].(string), body, &ignored); patchErr != nil {
				return nil, patchErr
			}
			b.mu.Lock()
			if current, exists := b.devices[old["id"].(string)]; exists {
				current["metadata"] = old["metadata"]
			}
			b.mu.Unlock()
		}
	}
	metadata := map[string]any{}
	if existing, ok := device["metadata"].(map[string]any); ok {
		for key, value := range existing {
			metadata[key] = value
		}
	}
	role := "PRIMARY_PRINTER"
	if device["type"] == "SCANNER" {
		role = "SCANNER"
	} else if device["type"] == "CASH_DRAWER" {
		role = "CASH_DRAWER"
	}
	metadata["manusAssignmentRole"] = role
	body, err := json.Marshal(map[string]any{"terminalId": terminalID, "metadata": metadata})
	if err != nil {
		return nil, err
	}
	var updated map[string]any
	if err := b.requestJSON(http.MethodPatch, b.baseURL+"/devices/"+deviceID, body, &updated); err != nil {
		return nil, err
	}
	b.mu.Lock()
	b.devices[deviceID] = updated
	b.mu.Unlock()
	return updated, nil
}

// assignCashDrawer records the explicit VIA_PRINTER relationship locally.
// Cloud terminal assignment remains owned by authenticated POS.
func (b *installerReadOnlyBridge) assignCashDrawer(deviceID, terminalID string) (map[string]any, error) {
	requestID := atomic.AddUint64(&b.drawerSaveRequestID, 1)
	started := time.Now()
	deviceID = strings.TrimSpace(deviceID)
	terminalID = strings.TrimSpace(terminalID)
	b.recordInstallerDiagnostic("drawer.bridge.assign.entry", fmt.Sprintf("requestId=%d deviceId=%s", requestID, deviceID))
	if deviceID == "" || terminalID == "" {
		return nil, errors.New("deviceId y terminalId son obligatorios")
	}
	b.mu.Lock()
	device, ok := b.devices[deviceID]
	b.mu.Unlock()
	if !ok || device["type"] != "PRINTER" {
		return nil, errors.New("deviceId no pertenece a una impresora descubierta")
	}
	metadata := map[string]any{}
	if existing, ok := device["metadata"].(map[string]any); ok {
		for key, value := range existing {
			metadata[key] = value
		}
	}
	metadata["cashDrawerConnectionType"] = "VIA_PRINTER"
	metadata["cashDrawerParentPrinterId"] = deviceID
	body, err := json.Marshal(map[string]any{"terminalId": terminalID, "metadata": metadata})
	if err != nil {
		return nil, err
	}
	var updated map[string]any
	b.recordInstallerDiagnostic("drawer.bridge.assign.http.start", fmt.Sprintf("requestId=%d deviceId=%s method=PATCH path=/devices/%s", requestID, deviceID, deviceID))
	if err := b.requestJSON(http.MethodPatch, b.baseURL+"/devices/"+deviceID, body, &updated); err != nil {
		status, code := bridgeErrorDetails(err)
		b.recordInstallerDiagnostic("drawer.bridge.assign.http.error", fmt.Sprintf("requestId=%d deviceId=%s status=%s code=%s durationMs=%d", requestID, deviceID, status, code, time.Since(started).Milliseconds()))
		return nil, err
	}
	b.recordInstallerDiagnostic("drawer.bridge.assign.http.success", fmt.Sprintf("requestId=%d deviceId=%s status=2xx durationMs=%d", requestID, deviceID, time.Since(started).Milliseconds()))
	b.mu.Lock()
	b.devices[deviceID] = updated
	b.mu.Unlock()
	return updated, nil
}

// setCashDrawerCertification records explicit operator certification on the
// physical parent printer. Send all existing metadata because Agent updates
// replace the metadata object rather than merging it.
func (b *installerReadOnlyBridge) setCashDrawerCertification(deviceID, terminalID string, certified bool) (map[string]any, error) {
	requestID := atomic.AddUint64(&b.drawerSaveRequestID, 1)
	started := time.Now()
	deviceID = strings.TrimSpace(deviceID)
	terminalID = strings.TrimSpace(terminalID)
	b.recordInstallerDiagnostic("drawer.bridge.certification.entry", fmt.Sprintf("requestId=%d deviceId=%s enabled=%t", requestID, deviceID, certified))
	if deviceID == "" || terminalID == "" {
		return nil, errors.New("deviceId y terminalId son obligatorios")
	}
	b.mu.Lock()
	device, ok := b.devices[deviceID]
	b.mu.Unlock()
	if !ok || device["type"] != "PRINTER" {
		return nil, errors.New("deviceId no pertenece a una impresora descubierta")
	}
	metadata := map[string]any{}
	if existing, ok := device["metadata"].(map[string]any); ok {
		for key, value := range existing {
			metadata[key] = value
		}
	}
	metadata["usbRawCashDrawerPulseCertified"] = certified
	body, err := json.Marshal(map[string]any{"terminalId": terminalID, "metadata": metadata})
	if err != nil {
		return nil, err
	}
	var updated map[string]any
	b.recordInstallerDiagnostic("drawer.bridge.certification.http.start", fmt.Sprintf("requestId=%d deviceId=%s method=PATCH path=/devices/%s", requestID, deviceID, deviceID))
	if err := b.requestJSON(http.MethodPatch, b.baseURL+"/devices/"+deviceID, body, &updated); err != nil {
		status, code := bridgeErrorDetails(err)
		b.recordInstallerDiagnostic("drawer.bridge.certification.http.error", fmt.Sprintf("requestId=%d deviceId=%s status=%s code=%s durationMs=%d", requestID, deviceID, status, code, time.Since(started).Milliseconds()))
		return nil, err
	}
	b.recordInstallerDiagnostic("drawer.bridge.certification.http.success", fmt.Sprintf("requestId=%d deviceId=%s status=2xx durationMs=%d", requestID, deviceID, time.Since(started).Milliseconds()))
	b.mu.Lock()
	b.devices[deviceID] = updated
	b.mu.Unlock()
	return updated, nil
}

// associateWindowsQueue links a physical printer only to a queue returned by
// the same discovery response. It never invents or weak-matches queue names.
func (b *installerReadOnlyBridge) associateWindowsQueue(deviceID, queueName string) (map[string]any, error) {
	deviceID, queueName = strings.TrimSpace(deviceID), strings.TrimSpace(queueName)
	if deviceID == "" || queueName == "" {
		return nil, errors.New("deviceId y queueName son obligatorios")
	}
	b.mu.Lock()
	device, deviceOK := b.devices[deviceID]
	var queueOK bool
	var queueInUse bool
	for id, candidate := range b.devices {
		fingerprint, _ := candidate["descriptor"].(map[string]any)
		fingerprint, _ = fingerprint["fingerprint"].(map[string]any)
		discoverySource, _ := fingerprint["source"].(string)
		if discoverySource == "WINDOWS_PRINT_QUEUE" && candidate["name"] == queueName {
			queueOK = true
		}
		if id != deviceID {
			usb, _ := candidate["usb"].(map[string]any)
			// A queue-only discovery row is inventory evidence, not ownership.
			// Only a configured non-discovery device can reserve a queue.
			if discoverySource != "WINDOWS_PRINT_QUEUE" && candidate["profileId"] != nil && usb["windowsQueueName"] == queueName {
				queueInUse = true
			}
		}
	}
	b.mu.Unlock()
	if !deviceOK || device["type"] != "PRINTER" {
		return nil, errors.New("deviceId no pertenece a una impresora descubierta")
	}
	if !queueOK {
		return nil, errors.New("queueName no pertenece al inventario Windows descubierto")
	}
	if queueInUse {
		return nil, errors.New("la cola de Windows ya estÃ¡ asociada a otro dispositivo")
	}
	usb := map[string]any{}
	if existing, ok := device["usb"].(map[string]any); ok {
		for key, value := range existing {
			usb[key] = value
		}
	}
	usb["windowsQueueName"] = queueName
	metadata := map[string]any{}
	if existing, ok := device["metadata"].(map[string]any); ok {
		for key, value := range existing {
			metadata[key] = value
		}
	}
	metadata["queueInstalled"] = true
	body, err := json.Marshal(map[string]any{"usb": usb, "metadata": metadata})
	if err != nil {
		return nil, err
	}
	var updated map[string]any
	if err := b.requestJSON(http.MethodPatch, b.baseURL+"/devices/"+deviceID, body, &updated); err != nil {
		return nil, err
	}
	b.mu.Lock()
	b.devices[deviceID] = updated
	b.mu.Unlock()
	return updated, nil
}

// registerNetworkPrinter is a typed onboarding seam for the Devices screen.
// It accepts only the fields needed to create a NETWORK printer and never
// exposes an arbitrary Agent proxy to the embedded UI.
func (b *installerReadOnlyBridge) registerNetworkPrinter(name, host string, port int, profileID, terminalID string) (map[string]any, error) {
	name = strings.TrimSpace(name)
	host = strings.TrimSpace(host)
	profileID = strings.TrimSpace(profileID)
	terminalID = strings.TrimSpace(terminalID)
	if name == "" || host == "" || terminalID == "" || port < 1 || port > 65535 {
		return nil, errors.New("datos de impresora de red inválidos")
	}
	if profileID != "THERMAL_58MM" && profileID != "THERMAL_80MM" && profileID != "GENERIC_TEXT" {
		return nil, errors.New("perfil de impresora no soportado")
	}
	id := "network-" + strings.NewReplacer(".", "-", ":", "-", " ", "-").Replace(strings.ToLower(name))
	body, err := json.Marshal(map[string]any{
		"id": id, "type": "PRINTER", "name": name, "status": "CONNECTED",
		"connectionType": "NETWORK", "terminalId": terminalID, "profileId": profileID,
		"network": map[string]any{"host": host, "port": port},
	})
	if err != nil {
		return nil, err
	}
	var created map[string]any
	if err := b.requestJSON(http.MethodPost, b.baseURL+"/devices", body, &created); err != nil {
		return nil, err
	}
	return created, nil
}

func (b *installerReadOnlyBridge) testPrinter(deviceID string) (map[string]any, error) {
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		return nil, errors.New("deviceId es obligatorio")
	}
	for _, r := range deviceID {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '-' && r != '_' {
			return nil, errors.New("deviceId inválido")
		}
	}
	b.mu.Lock()
	device, ok := b.devices[deviceID]
	b.mu.Unlock()
	if !ok || device["type"] != "PRINTER" {
		return nil, errors.New("deviceId no pertenece a una impresora descubierta")
	}
	status, _ := device["status"].(string)
	if status != "CONNECTED" {
		return nil, errors.New("la impresora no está conectada")
	}
	profileID, _ := device["profileId"].(string)
	if profileID != "THERMAL_58MM" && profileID != "THERMAL_80MM" {
		return nil, errors.New("la impresora no tiene un perfil soportado")
	}
	terminalID, _ := device["terminalId"].(string)
	if strings.TrimSpace(terminalID) == "" {
		terminalID = "local-terminal"
	}
	body, _ := json.Marshal(map[string]any{"terminalId": terminalID, "deviceId": deviceID})
	var result map[string]any
	if err := b.requestJSON(http.MethodPost, b.baseURL+"/printer/test-print", body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (b *installerReadOnlyBridge) testCashDrawer(deviceID string) (map[string]any, error) {
	requestID := atomic.AddUint64(&b.drawerRequestID, 1)
	started := time.Now()
	b.recordInstallerDiagnostic("drawer.bridge.start", fmt.Sprintf("requestId=%d timeoutMs=%d", requestID, cashDrawerBridgeTimeout.Milliseconds()))
	fail := func(classification, code string, err error) (map[string]any, error) {
		b.recordInstallerDiagnostic("drawer.bridge.error", fmt.Sprintf("requestId=%d durationMs=%d classification=%s code=%s", requestID, time.Since(started).Milliseconds(), classification, code))
		return nil, fmt.Errorf("%s: %w", classification, err)
	}
	deviceID = strings.TrimSpace(deviceID)
	b.mu.Lock()
	device, ok := b.devices[deviceID]
	b.mu.Unlock()
	if !ok || device["type"] != "PRINTER" {
		return fail("CONFIRMED_ERROR", "PARENT_PRINTER_MISSING", errors.New("deviceId no pertenece a una impresora descubierta"))
	}
	if device["status"] != "CONNECTED" {
		return fail("CONFIRMED_ERROR", "PARENT_PRINTER_UNAVAILABLE", errors.New("parent printer unavailable"))
		return nil, errors.New("la impresora no está conectada")
	}
	if !resolvedWindowsQueue(device) {
		return fail("CONFIRMED_ERROR", "PRINT_TRANSPORT_NOT_READY", errors.New("PRINT_TRANSPORT_NOT_READY: configure una cola de Windows"))
	}
	profileID, _ := device["profileId"].(string)
	if profileID != "THERMAL_58MM" && profileID != "THERMAL_80MM" {
		return fail("CONFIRMED_ERROR", "UNSUPPORTED_PROFILE", errors.New("unsupported printer profile"))
	}
	metadata, _ := device["metadata"].(map[string]any)
	certified, _ := metadata["usbRawCashDrawerPulseCertified"].(bool)
	if !certified {
		return fail("CONFIRMED_ERROR", "DRAWER_NOT_CERTIFIED", errors.New("esta impresora no esta certificada para abrir el cajon desde Manus"))
		return nil, errors.New("esta impresora no está certificada para abrir el cajón desde Manus")
	}
	terminalID, _ := device["terminalId"].(string)
	if strings.TrimSpace(terminalID) == "" {
		terminalID = "local-terminal"
	}
	body, _ := json.Marshal(map[string]any{"terminalId": terminalID, "printerDeviceId": deviceID, "deviceId": deviceID, "reason": "MANUAL_TEST"})
	var result map[string]any
	client := &http.Client{Timeout: cashDrawerBridgeTimeout, Transport: b.client.Transport}
	if err := b.requestJSONWithClient(client, http.MethodPost, b.baseURL+"/cash-drawer/open", body, &result); err != nil {
		classification := "RESULT_UNKNOWN"
		code := "BRIDGE_ACKNOWLEDGEMENT_LOST"
		if strings.Contains(err.Error(), "HTTP 4") {
			classification = "CONFIRMED_ERROR"
			code = "AGENT_VALIDATION_REJECTED"
		}
		return fail(classification, code, err)
	}
	b.recordInstallerDiagnostic("drawer.bridge.success", fmt.Sprintf("requestId=%d durationMs=%d", requestID, time.Since(started).Milliseconds()))
	return result, nil
}

func resolvedWindowsQueue(device map[string]any) bool {
	usb, _ := device["usb"].(map[string]any)
	if queue, ok := usb["windowsQueueName"].(string); ok && strings.TrimSpace(queue) != "" {
		return true
	}
	metadata, _ := device["metadata"].(map[string]any)
	if metadata["queueInstalled"] == true {
		if name, ok := usb["printerName"].(string); ok {
			return strings.TrimSpace(name) != ""
		}
	}
	return false
}

func (b *installerReadOnlyBridge) getHealth() (map[string]any, error) {
	var payload map[string]any
	if err := b.requestJSON(http.MethodGet, b.baseURL+"/health", nil, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func (b *installerReadOnlyBridge) requestJSON(method, url string, body []byte, out any) error {
	return b.requestJSONWithClient(b.client, method, url, body, out)
}

func (b *installerReadOnlyBridge) requestJSONWithClient(client *http.Client, method, url string, body []byte, out any) error {
	var reader io.Reader
	if body != nil {
		reader = strings.NewReader(string(body))
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Peripheral Agent respondió HTTP %d", resp.StatusCode)
	}
	if err := json.Unmarshal(responseBody, out); err != nil {
		return fmt.Errorf("respuesta inválida de Peripheral Agent: %w", err)
	}
	return nil
}

func bridgeErrorDetails(err error) (string, string) {
	if err == nil {
		return "none", "none"
	}
	message := err.Error()
	match := regexp.MustCompile(`HTTP (\d+)`).FindStringSubmatch(message)
	if len(match) == 2 {
		return match[1], "HTTP_" + match[1]
	}
	return "unknown", "LOCAL_ERROR"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return "Peripheral Agent no pudo completar la operación"
}
