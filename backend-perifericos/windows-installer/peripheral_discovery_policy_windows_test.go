//go:build windows

package main

import (
	"strings"
	"testing"
)

func TestAgentConfigEnablesAutomaticDiscovery(t *testing.T) {
	tests := []struct {
		name string
		data string
		want bool
	}{
		{name: "qa-real-adapters-manual-only", data: `{"packageProfile":"qa","enableRealAdapters":true,"discoverOnStartup":false}`, want: false},
		{name: "qa-env-or-json-cannot-enable-startup", data: `{"packageProfile":"qa","enableRealAdapters":true,"discoverOnStartup":true}`, want: false},
		{name: "production-explicit-startup", data: `{"packageProfile":"production","enableRealAdapters":true,"discoverOnStartup":true}`, want: true},
		{name: "dev-explicit-startup", data: `{"packageProfile":"dev","enableRealAdapters":true,"discoverOnStartup":true}`, want: true},
		{name: "adapters-disabled", data: `{"packageProfile":"production","enableRealAdapters":false,"discoverOnStartup":true}`, want: false},
		{name: "missing-profile", data: `{"enableRealAdapters":true,"discoverOnStartup":true}`, want: false},
		{name: "missing-field", data: `{"packageProfile":"production","enableRealAdapters":true}`, want: false},
		{name: "wrong-type", data: `{"packageProfile":"production","enableRealAdapters":true,"discoverOnStartup":"true"}`, want: false},
		{name: "malformed", data: `{"packageProfile":"production","enableRealAdapters":true,`, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := agentConfigEnablesAutomaticDiscovery([]byte(test.data)); got != test.want {
				t.Fatalf("agentConfigEnablesAutomaticDiscovery() = %v, want %v", got, test.want)
			}
		})
	}

	if packagedAgentStartupDiscoveryEnabled(installerManifest{
		BundleRoot:     "assets/bundle/agent",
		ConfigRelative: "config/missing-agent-config.json",
	}) {
		t.Fatal("unreadable embedded config must disable automatic discovery")
	}
}

func TestProductiveDevicesHarnessKeepsDiscoveryBehindPolicy(t *testing.T) {
	html := appendProductiveDevicesHarness(false)
	if !strings.Contains(html, "window.__manusAutoDiscoveryEnabled=false") {
		t.Fatal("installer harness did not embed the disabled startup policy")
	}
	if !strings.Contains(html, "if(window.__manusAutoDiscoveryEnabled!==true") {
		t.Fatal("installer harness does not guard its startup discovery callback")
	}
	if !strings.Contains(html, "retry.onclick=function(){diag('ui.search.click','');setLoading(true);loadDevices();}") {
		t.Fatal("installer harness lost its explicit manual discovery action")
	}
}
