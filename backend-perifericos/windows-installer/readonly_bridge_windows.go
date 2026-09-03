//go:build windows

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const peripheralAgentBaseURL = "http://127.0.0.1:4050"

// installerReadOnlyBridge is the only bridge exposed by the WebView2 spike.
// It deliberately contains read-only operations; installation and device
// mutation remain owned by Installer Core and are not callable from JavaScript.
type installerReadOnlyBridge struct {
	client  *http.Client
	baseURL string
	mu      sync.Mutex
	devices map[string]map[string]any
}

type installerStatePayload struct {
	Agent   map[string]any   `json:"agent"`
	Devices []map[string]any `json:"devices"`
	Error   string           `json:"error,omitempty"`
}

func newInstallerReadOnlyBridge() *installerReadOnlyBridge {
	return &installerReadOnlyBridge{client: &http.Client{Timeout: 5 * time.Second}, baseURL: peripheralAgentBaseURL, devices: map[string]map[string]any{}}
}

func (b *installerReadOnlyBridge) getInstallerState() (installerStatePayload, error) {
	health, err := b.getHealth()
	if err != nil {
		return installerStatePayload{Agent: map[string]any{"status": "unavailable"}, Error: err.Error()}, nil
	}
	return installerStatePayload{Agent: health, Devices: []map[string]any{}}, nil
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
		if id, ok := device["id"].(string); ok && strings.TrimSpace(id) != "" {
			b.devices[id] = device
		}
	}
	b.mu.Unlock()
	return payload.Devices, nil
}

func (b *installerReadOnlyBridge) configureDevice(deviceID, profileID string) (map[string]any, error) {
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
	body, err := json.Marshal(map[string]any{"terminalId": terminalID, "profileId": profileID})
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
	deviceID = strings.TrimSpace(deviceID)
	b.mu.Lock()
	device, ok := b.devices[deviceID]
	b.mu.Unlock()
	if !ok || device["type"] != "PRINTER" {
		return nil, errors.New("deviceId no pertenece a una impresora descubierta")
	}
	if device["status"] != "CONNECTED" {
		return nil, errors.New("la impresora no está conectada")
	}
	profileID, _ := device["profileId"].(string)
	if profileID != "THERMAL_58MM" && profileID != "THERMAL_80MM" {
		return nil, errors.New("la impresora no tiene un perfil soportado")
	}
	metadata, _ := device["metadata"].(map[string]any)
	certified, _ := metadata["usbRawCashDrawerPulseCertified"].(bool)
	if !certified {
		return nil, errors.New("esta impresora no está certificada para abrir el cajón desde Manus")
	}
	terminalID, _ := device["terminalId"].(string)
	if strings.TrimSpace(terminalID) == "" {
		terminalID = "local-terminal"
	}
	body, _ := json.Marshal(map[string]any{"terminalId": terminalID, "printerDeviceId": deviceID, "deviceId": deviceID, "reason": "MANUAL_TEST"})
	var result map[string]any
	if err := b.requestJSON(http.MethodPost, b.baseURL+"/cash-drawer/open", body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (b *installerReadOnlyBridge) getHealth() (map[string]any, error) {
	var payload map[string]any
	if err := b.requestJSON(http.MethodGet, b.baseURL+"/health", nil, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func (b *installerReadOnlyBridge) requestJSON(method, url string, body []byte, out any) error {
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
	resp, err := b.client.Do(req)
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return "Peripheral Agent no pudo completar la operación"
}
