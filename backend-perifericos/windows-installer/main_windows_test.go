//go:build windows

package main

import (
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestEmbeddedAssetsIncludeLeadingUnderscoreFiles(t *testing.T) {
	_, err := embeddedAssets.ReadFile("assets/bundle/ManusPeripheralAgent-win-x64-0.1.1-qa.3/node_modules/readable-stream/lib/_stream_readable.js")
	if err != nil {
		t.Fatalf("embedded asset missing: %v", err)
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
