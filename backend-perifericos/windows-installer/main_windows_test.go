//go:build windows

package main

import (
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
	_, err := embeddedAssets.ReadFile("assets/bundle/ManusPeripheralAgent-win-x64-0.1.1-qa.4/node_modules/readable-stream/lib/_stream_readable.js")
	if err != nil {
		t.Fatalf("embedded asset missing: %v", err)
	}
}

func TestReadOnlyBridgeHealthAndDiscovery(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body := `{"status":"ok","mode":"REAL","version":"qa"}`
		if r.URL.Path == "/devices/discover" {
			body = `{"success":true,"mode":"REAL","devices":[{"id":"p1","type":"PRINTER"}]}`
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
	pid, installRoot, dataRoot, removeData, err := parseUninstallCleanupArgs(args)
	if err != nil || pid != 1234 || installRoot != layout.InstallRoot || dataRoot != layout.ProgramDataRoot || removeData {
		t.Fatalf("cleanup args parse = %d %q %q %v %v", pid, installRoot, dataRoot, removeData, err)
	}
	if strings.HasPrefix(filepath.Clean(filepath.Dir(os.TempDir())), filepath.Clean(layout.InstallRoot)) {
		t.Fatal("test temp root unexpectedly inside Program Files")
	}
}

func TestUninstallCleanupRequiresParentAndRoots(t *testing.T) {
	if _, _, _, _, err := parseUninstallCleanupArgs(nil); err == nil {
		t.Fatal("incomplete cleanup arguments accepted")
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
