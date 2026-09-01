//go:build windows

package main

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

//go:embed all:assets/**
var embeddedAssets embed.FS

const (
	serviceName  = "ManusPeripheralAgent"
	displayName  = "Manus Peripheral Agent"
	publisher    = "Manus"
	serviceDelay = 30 * time.Second
)

type installerManifest struct {
	Version         string   `json:"version"`
	BundleDirName   string   `json:"bundleDirName"`
	BundleRoot      string   `json:"bundleRoot"`
	ServiceName     string   `json:"serviceName"`
	DisplayName     string   `json:"displayName"`
	Description     string   `json:"description"`
	AgentName       string   `json:"agentName"`
	ServiceAccount  string   `json:"serviceAccount"`
	ServiceArgs     []string `json:"serviceArgs"`
	HealthURL       string   `json:"healthUrl"`
	InstallRoot     string   `json:"installRoot"`
	ProgramDataRoot string   `json:"programDataRoot"`
	ConfigRelative  string   `json:"configRelative"`
	LogsRelative    string   `json:"logsRelative"`
	StateRelative   string   `json:"stateRelative"`
	VersionFileName string   `json:"versionFileName"`
}

type runtimeLayout struct {
	InstallRoot     string
	ProgramDataRoot string
	VersionsRoot    string
	CurrentRoot     string
	ConfigRoot      string
	LogsRoot        string
	StateRoot       string
	VersionRoot     string
	ServiceExe      string
	InstallLog      string
	ServiceLog      string
	ServiceStdout   string
	ServiceStderr   string
	RegistryKey     string
}

type statusReport struct {
	Installed      bool   `json:"installed"`
	Version        string `json:"version,omitempty"`
	ServicePresent bool   `json:"servicePresent"`
	ServiceRunning bool   `json:"serviceRunning"`
	InstallRoot    string `json:"installRoot"`
	CurrentRoot    string `json:"currentRoot"`
	ConfigPath     string `json:"configPath"`
	LogsPath       string `json:"logsPath"`
	HealthURL      string `json:"healthUrl"`
	InstallLog     string `json:"installLog"`
	ServiceBinary  string `json:"serviceBinary"`
}

func main() {
	manifest, err := loadManifest()
	if err != nil {
		fatal(err)
	}

	if len(os.Args) > 1 {
		switch strings.ToLower(os.Args[1]) {
		case "install", "/install":
			fatal(install(manifest))
		case "repair", "/repair":
			fatal(install(manifest))
		case "uninstall", "/uninstall":
			fatal(uninstall(manifest, containsArg(os.Args[2:], "--remove-data", "/remove-data")))
		case "status", "/status":
			fatal(printStatus(manifest))
		case "inspect", "/inspect":
			fatal(printInspect(manifest))
		case "service":
			runAsService(manifest)
			return
		case "--help", "-h", "/?", "help":
			printUsage(manifest)
			return
		default:
			if strings.HasPrefix(os.Args[1], "-") || strings.HasPrefix(os.Args[1], "/") {
				printUsage(manifest)
				os.Exit(2)
			}
			fatal(install(manifest))
		}
		return
	}

	fatal(install(manifest))
}

func fatal(err error) {
	if err == nil {
		return
	}
	fmt.Fprintln(os.Stderr, err.Error())
	os.Exit(1)
}

func printUsage(manifest installerManifest) {
	fmt.Printf("%s %s\n", manifest.DisplayName, manifest.Version)
	fmt.Println("Usage:")
	fmt.Println("  ManusTerminalSetup.exe install")
	fmt.Println("  ManusTerminalSetup.exe repair")
	fmt.Println("  ManusTerminalSetup.exe uninstall [--remove-data]")
	fmt.Println("  ManusTerminalSetup.exe status")
	fmt.Println("  ManusTerminalSetup.exe inspect")
	fmt.Println("  ManusTerminalSetup.exe service")
}

func printInspect(manifest installerManifest) error {
	layout := buildLayout(manifest)
	payload := map[string]any{
		"version":        manifest.Version,
		"serviceName":    manifest.ServiceName,
		"displayName":    manifest.DisplayName,
		"serviceAccount": manifest.ServiceAccount,
		"installRoot":    layout.InstallRoot,
		"currentRoot":    layout.CurrentRoot,
		"versionsRoot":   layout.VersionsRoot,
		"configRoot":     layout.ConfigRoot,
		"logsRoot":       layout.LogsRoot,
		"stateRoot":      layout.StateRoot,
		"serviceBinary":  layout.ServiceExe,
		"healthUrl":      manifest.HealthURL,
		"bundleRoot":     manifest.BundleRoot,
		"bundleDirName":  manifest.BundleDirName,
		"serviceArgs":    manifest.ServiceArgs,
	}
	return json.NewEncoder(os.Stdout).Encode(payload)
}

func printStatus(manifest installerManifest) error {
	layout := buildLayout(manifest)
	report := statusReport{
		Installed:      exists(layout.CurrentRoot),
		ServicePresent: false,
		InstallRoot:    layout.InstallRoot,
		CurrentRoot:    layout.CurrentRoot,
		ConfigPath:     filepath.Join(layout.ConfigRoot, "agent.config.local.json"),
		LogsPath:       layout.LogsRoot,
		HealthURL:      manifest.HealthURL,
		InstallLog:     layout.InstallLog,
		ServiceBinary:  layout.ServiceExe,
	}

	if version, ok := readInstalledVersion(filepath.Join(layout.CurrentRoot, "VERSION.json")); ok {
		report.Version = version
	}

	if m, err := mgr.Connect(); err == nil {
		defer m.Disconnect()
		if s, err := m.OpenService(manifest.ServiceName); err == nil {
			defer s.Close()
			report.ServicePresent = true
			if st, err := s.Query(); err == nil {
				report.ServiceRunning = st.State == svc.Running
			}
		}
	}

	return json.NewEncoder(os.Stdout).Encode(report)
}

func install(manifest installerManifest) error {
	if err := ensureSupportedHost(); err != nil {
		return err
	}
	if err := ensureElevated(); err != nil {
		return err
	}

	layout := buildLayout(manifest)
	if err := ensureBaseDirectories(layout); err != nil {
		return err
	}

	logger, err := newInstallLogger(layout.InstallLog)
	if err != nil {
		return err
	}
	defer logger.Close()

	logger.Printf("install start version=%s", manifest.Version)

	existingVersion, existingVersionPath := currentInstalledVersion(manifest, layout)
	sameVersion := existingVersion == manifest.Version && existingVersion != ""

	if sameVersion {
		logger.Printf("repair existing version=%s path=%s", existingVersion, existingVersionPath)
	} else if existingVersion != "" {
		logger.Printf("upgrade from=%s to=%s", existingVersion, manifest.Version)
	} else {
		logger.Printf("fresh install version=%s", manifest.Version)
	}

	if err := copyBundleToVersion(layout, manifest); err != nil {
		return fmt.Errorf("install copy payload: %w", err)
	}

	if err := copySelfExecutable(layout.ServiceExe); err != nil {
		return fmt.Errorf("copy installer executable: %w", err)
	}

	if err := ensureLocalConfig(layout); err != nil {
		return fmt.Errorf("prepare config: %w", err)
	}

	if err := ensureServicePermissions(layout); err != nil {
		return fmt.Errorf("prepare service permissions: %w", err)
	}

	_ = stopService(manifest)

	if err := ensureCurrentJunction(layout.CurrentRoot, layout.VersionRoot); err != nil {
		return fmt.Errorf("activate current version: %w", err)
	}

	rollbackPath := existingVersionPath
	registration := buildServiceRegistration(manifest, layout)
	logger.Printf("service registration executable=%s args=%q", registration.Executable, registration.Args)
	if err := configureService(manifest, registration); err != nil {
		if rollbackPath != "" {
			_ = restorePreviousVersion(manifest, layout, rollbackPath, logger)
		}
		return err
	}

	if err := ensureRecoveryPolicy(manifest); err != nil {
		logger.Printf("recovery policy warning: %v", err)
	}

	if err := startService(manifest); err != nil {
		if rollbackPath != "" {
			_ = restorePreviousVersion(manifest, layout, rollbackPath, logger)
		}
		return fmt.Errorf("start service: %w", err)
	}

	if err := waitForHealth(manifest); err != nil {
		logger.Printf("health failed: %v", err)
		_ = stopService(manifest)
		if rollbackPath != "" {
			_ = restorePreviousVersion(manifest, layout, rollbackPath, logger)
			if restartErr := startService(manifest); restartErr != nil {
				logger.Printf("rollback restart failed: %v", restartErr)
			} else if healthErr := waitForHealth(manifest); healthErr != nil {
				logger.Printf("rollback health failed: %v", healthErr)
			} else {
				logger.Printf("rollback restored version=%s", existingVersion)
			}
		}
		return fmt.Errorf("health gate failed: %w", err)
	}

	if err := writeUninstallMetadata(layout, manifest); err != nil {
		logger.Printf("uninstall metadata warning: %v", err)
	}

	logger.Printf("install success version=%s", manifest.Version)
	fmt.Printf("SUCCESS version=%s\n", manifest.Version)
	return nil
}

func uninstall(manifest installerManifest, removeData bool) error {
	if err := ensureSupportedHost(); err != nil {
		return err
	}
	if err := ensureElevated(); err != nil {
		return err
	}

	layout := buildLayout(manifest)
	logger, err := newInstallLogger(layout.InstallLog)
	if err == nil {
		defer logger.Close()
		logger.Printf("uninstall start removeData=%t", removeData)
	}

	_ = stopService(manifest)
	if err := deleteService(manifest); err != nil && !isMissingServiceError(err) {
		return err
	}
	if err := deleteUninstallMetadata(manifest); err != nil {
		return err
	}
	if err := removeCurrentJunction(layout.CurrentRoot); err != nil {
		return err
	}
	if err := os.RemoveAll(filepath.Join(layout.InstallRoot, "versions")); err != nil {
		return err
	}
	if removeData {
		_ = os.RemoveAll(layout.ProgramDataRoot)
	}
	fmt.Println("SUCCESS uninstall")
	return nil
}

func runAsService(manifest installerManifest) {
	handler := &agentService{manifest: manifest, layout: buildLayout(manifest)}
	if err := svc.Run(manifest.ServiceName, handler); err != nil {
		fatal(err)
	}
}

type agentService struct {
	manifest installerManifest
	layout   runtimeLayout
}

func (a *agentService) Execute(args []string, r <-chan svc.ChangeRequest, s chan<- svc.Status) (bool, uint32) {
	s <- svc.Status{State: svc.StartPending}

	cmd, stdoutFile, stderrFile, err := a.startAgentProcess()
	if err != nil {
		_ = a.writeServiceLog("start failed: %v", err)
		s <- svc.Status{State: svc.Stopped, Accepts: 0}
		return false, 1
	}
	defer stdoutFile.Close()
	defer stderrFile.Close()

	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	s <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
	_ = a.writeServiceLog("running pid=%d", cmd.Process.Pid)

	for {
		select {
		case err := <-done:
			if err == nil {
				_ = a.writeServiceLog("child exited cleanly")
				s <- svc.Status{State: svc.Stopped}
				return false, 0
			}
			_ = a.writeServiceLog("child exited with error: %v", err)
			s <- svc.Status{State: svc.Stopped}
			return false, 1
		case req := <-r:
			switch req.Cmd {
			case svc.Interrogate:
				s <- req.CurrentStatus
			case svc.Stop, svc.Shutdown:
				_ = a.writeServiceLog("stop requested")
				s <- svc.Status{State: svc.StopPending}
				if cmd.Process != nil {
					_ = cmd.Process.Kill()
				}
				<-done
				s <- svc.Status{State: svc.Stopped}
				return false, 0
			default:
				_ = a.writeServiceLog("ignored control cmd=%d", req.Cmd)
			}
		}
	}
}

func (a *agentService) startAgentProcess() (*exec.Cmd, *os.File, *os.File, error) {
	nodeExe := filepath.Join(a.layout.CurrentRoot, "runtime", "node.exe")
	entryPoint := filepath.Join(a.layout.CurrentRoot, "app", "main.js")
	configPath := filepath.Join(a.layout.ProgramDataRoot, "config", "agent.config.local.json")

	if !exists(nodeExe) {
		return nil, nil, nil, fmt.Errorf("missing runtime node.exe at %s", nodeExe)
	}
	if !exists(entryPoint) {
		return nil, nil, nil, fmt.Errorf("missing app entrypoint at %s", entryPoint)
	}
	if !exists(configPath) {
		return nil, nil, nil, fmt.Errorf("missing config at %s", configPath)
	}

	if err := os.MkdirAll(a.layout.LogsRoot, 0o755); err != nil {
		return nil, nil, nil, err
	}

	stdoutFile, err := os.OpenFile(a.layout.ServiceStdout, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, nil, nil, err
	}
	stderrFile, err := os.OpenFile(a.layout.ServiceStderr, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		_ = stdoutFile.Close()
		return nil, nil, nil, err
	}

	env := append(os.Environ(),
		"PERIPHERALS_CONFIG_PATH="+configPath,
		"PERIPHERALS_VERSION="+a.manifest.Version,
		"PERIPHERALS_BIND=127.0.0.1",
		"PERIPHERALS_PORT=4050",
	)

	cmd := exec.Command(nodeExe, entryPoint)
	cmd.Dir = a.layout.CurrentRoot
	cmd.Env = env
	cmd.Stdout = stdoutFile
	cmd.Stderr = stderrFile
	if err := cmd.Start(); err != nil {
		_ = stdoutFile.Close()
		_ = stderrFile.Close()
		return nil, nil, nil, err
	}

	return cmd, stdoutFile, stderrFile, nil
}

func (a *agentService) writeServiceLog(format string, args ...any) error {
	line := fmt.Sprintf("%s %s\n", time.Now().Format(time.RFC3339Nano), fmt.Sprintf(format, args...))
	return appendFile(a.layout.ServiceLog, []byte(line), 0o644)
}

type serviceRegistration struct {
	Executable string
	Args       []string
}

func buildServiceRegistration(manifest installerManifest, layout runtimeLayout) serviceRegistration {
	serviceArgs := manifest.ServiceArgs
	if len(serviceArgs) == 0 {
		serviceArgs = []string{"service"}
	}
	return serviceRegistration{
		Executable: layout.ServiceExe,
		Args:       append([]string(nil), serviceArgs...),
	}
}

func configureService(manifest installerManifest, registration serviceRegistration) error {
	svcManager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer svcManager.Disconnect()

	service, err := svcManager.OpenService(manifest.ServiceName)
	if err == nil {
		_ = service.Close()
		if err := deleteService(manifest); err != nil && !isMissingServiceError(err) {
			return err
		}
	}

	service, err = svcManager.CreateService(manifest.ServiceName, registration.Executable, mgr.Config{
		DisplayName:      manifest.DisplayName,
		Description:      manifest.Description,
		StartType:        mgr.StartAutomatic,
		ServiceStartName: manifest.ServiceAccount,
		DelayedAutoStart: false,
	}, registration.Args...)
	if err != nil {
		return err
	}
	defer service.Close()

	return nil
}

func ensureRecoveryPolicy(manifest installerManifest) error {
	svcManager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer svcManager.Disconnect()

	service, err := svcManager.OpenService(manifest.ServiceName)
	if err != nil {
		return err
	}
	defer service.Close()

	if err := service.SetRecoveryActions([]mgr.RecoveryAction{
		{Type: mgr.ServiceRestart, Delay: serviceDelay},
		{Type: mgr.ServiceRestart, Delay: serviceDelay},
		{Type: mgr.ServiceRestart, Delay: serviceDelay},
	}, uint32((24 * time.Hour).Seconds())); err != nil {
		return err
	}
	return service.SetRecoveryActionsOnNonCrashFailures(true)
}

func startService(manifest installerManifest) error {
	svcManager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer svcManager.Disconnect()

	service, err := svcManager.OpenService(manifest.ServiceName)
	if err != nil {
		return err
	}
	defer service.Close()
	return service.Start()
}

func stopService(manifest installerManifest) error {
	svcManager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer svcManager.Disconnect()

	service, err := svcManager.OpenService(manifest.ServiceName)
	if err != nil {
		return err
	}
	defer service.Close()
	_, err = service.Control(svc.Stop)
	return err
}

func deleteService(manifest installerManifest) error {
	svcManager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer svcManager.Disconnect()

	service, err := svcManager.OpenService(manifest.ServiceName)
	if err != nil {
		return err
	}
	defer service.Close()
	return service.Delete()
}

func waitForHealth(manifest installerManifest) error {
	timeout := envDurationSeconds("MANUS_INSTALLER_HEALTH_TIMEOUT_SECONDS", 60)
	poll := envDurationSeconds("MANUS_INSTALLER_HEALTH_POLL_SECONDS", 2)
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 3 * time.Second}

	var lastErr error
	for time.Now().Before(deadline) {
		resp, err := client.Get(manifest.HealthURL)
		if err == nil {
			body, _ := io.ReadAll(resp.Body)
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var payload map[string]any
				if err := json.Unmarshal(body, &payload); err == nil {
					if payload["status"] == "ok" &&
						stringValue(payload["version"]) == manifest.Version &&
						stringValue(payload["platform"]) == "win32" &&
						stringValue(payload["architecture"]) == "x64" {
						return nil
					}
				}
			}
			lastErr = fmt.Errorf("health status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
		} else {
			lastErr = err
		}
		time.Sleep(poll)
	}
	if lastErr == nil {
		lastErr = errors.New("health timeout")
	}
	return lastErr
}

func ensureSupportedHost() error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("windows installer only runs on Windows")
	}
	if runtime.GOARCH != "amd64" {
		return fmt.Errorf("windows installer only supports amd64")
	}
	return nil
}

func ensureElevated() error {
	token := windows.GetCurrentProcessToken()
	var isElevated uint32
	var outLen uint32
	if err := windows.GetTokenInformation(token, windows.TokenElevation, (*byte)(unsafe.Pointer(&isElevated)), uint32(unsafe.Sizeof(isElevated)), &outLen); err != nil {
		return err
	}
	if isElevated == 0 {
		return errors.New("administrator privileges required")
	}
	return nil
}

func buildLayout(manifest installerManifest) runtimeLayout {
	installRoot := defaultOrEnv("ProgramFiles", `C:\Program Files`)
	installRoot = filepath.Join(installRoot, "Manus", "PeripheralAgent")
	programDataRoot := defaultOrEnv("ProgramData", `C:\ProgramData`)
	programDataRoot = filepath.Join(programDataRoot, "Manus", "PeripheralAgent")
	versionsRoot := filepath.Join(installRoot, "versions")
	versionRoot := filepath.Join(versionsRoot, manifest.Version)
	currentRoot := filepath.Join(installRoot, "current")
	configRoot := filepath.Join(programDataRoot, "config")
	logsRoot := filepath.Join(programDataRoot, "logs")
	stateRoot := filepath.Join(programDataRoot, "state")
	serviceExe := filepath.Join(versionRoot, "ManusTerminalSetup.exe")
	return runtimeLayout{
		InstallRoot:     installRoot,
		ProgramDataRoot: programDataRoot,
		VersionsRoot:    versionsRoot,
		CurrentRoot:     currentRoot,
		ConfigRoot:      configRoot,
		LogsRoot:        logsRoot,
		StateRoot:       stateRoot,
		VersionRoot:     versionRoot,
		ServiceExe:      serviceExe,
		InstallLog:      filepath.Join(logsRoot, "installer.log"),
		ServiceLog:      filepath.Join(logsRoot, "service.log"),
		ServiceStdout:   filepath.Join(logsRoot, "service.stdout.log"),
		ServiceStderr:   filepath.Join(logsRoot, "service.stderr.log"),
		RegistryKey:     `Software\Microsoft\Windows\CurrentVersion\Uninstall\ManusPeripheralAgent`,
	}
}

func ensureBaseDirectories(layout runtimeLayout) error {
	for _, dir := range []string{
		layout.InstallRoot,
		layout.VersionsRoot,
		layout.ProgramDataRoot,
		layout.ConfigRoot,
		layout.LogsRoot,
		layout.StateRoot,
	} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	return nil
}

func ensureServicePermissions(layout runtimeLayout) error {
	if err := grantLocalServiceAccess(layout.InstallRoot, "RX"); err != nil {
		return err
	}
	if err := grantLocalServiceAccess(layout.VersionRoot, "RX"); err != nil {
		return err
	}
	if err := grantLocalServiceAccess(layout.ProgramDataRoot, "M"); err != nil {
		return err
	}
	return nil
}

func grantLocalServiceAccess(path string, permission string) error {
	grant := fmt.Sprintf(`NT AUTHORITY\LocalService:(OI)(CI)%s`, permission)
	cmd := exec.Command("icacls", path, "/grant", grant, "/T", "/C")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("icacls %s: %w: %s", path, err, strings.TrimSpace(string(output)))
	}
	return nil
}

func currentInstalledVersion(manifest installerManifest, layout runtimeLayout) (string, string) {
	versionPath := filepath.Join(layout.CurrentRoot, manifest.VersionFileName)
	if version, ok := readInstalledVersion(versionPath); ok {
		return version, filepath.Join(layout.VersionsRoot, version)
	}

	if version, ok := readInstalledVersion(filepath.Join(layout.VersionRoot, manifest.VersionFileName)); ok {
		return version, layout.VersionRoot
	}

	return "", ""
}

func readInstalledVersion(versionFilePath string) (string, bool) {
	data, err := os.ReadFile(versionFilePath)
	if err != nil {
		return "", false
	}
	var payload struct {
		Version string `json:"version"`
	}
	if strings.HasSuffix(strings.ToLower(versionFilePath), ".json") {
		if err := json.Unmarshal(data, &payload); err == nil && payload.Version != "" {
			return payload.Version, true
		}
	}
	return strings.TrimSpace(string(data)), len(strings.TrimSpace(string(data))) > 0
}

func copyBundleToVersion(layout runtimeLayout, manifest installerManifest) error {
	if err := os.RemoveAll(layout.VersionRoot); err != nil {
		return err
	}
	if err := os.MkdirAll(layout.VersionRoot, 0o755); err != nil {
		return err
	}
	if err := copyEmbeddedTree(manifest.BundleRoot, layout.VersionRoot); err != nil {
		return err
	}
	return nil
}

func copySelfExecutable(destination string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	return copyFile(self, destination)
}

func ensureLocalConfig(layout runtimeLayout) error {
	localSeedPath := filepath.Join(layout.VersionRoot, "config", "agent.config.local.json")
	seedBytes, err := os.ReadFile(localSeedPath)
	if err != nil {
		examplePath := filepath.Join(layout.VersionRoot, "config", "agent.config.example.json")
		seedBytes, err = os.ReadFile(examplePath)
		if err != nil {
			return err
		}
	}
	if err := os.MkdirAll(layout.ConfigRoot, 0o755); err != nil {
		return err
	}
	localPath := filepath.Join(layout.ConfigRoot, "agent.config.local.json")
	if exists(localPath) {
		return nil
	}

	// Preserve the repo's approved local config model. The installer only seeds
	// an external mutable file if one does not already exist.
	return os.WriteFile(localPath, seedBytes, 0o644)
}

func ensureCurrentJunction(currentRoot, versionRoot string) error {
	if err := os.RemoveAll(currentRoot); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(currentRoot), 0o755); err != nil {
		return err
	}
	cmd := exec.Command("cmd.exe", "/C", "mklink", "/J", currentRoot, versionRoot)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("mklink junction: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func removeCurrentJunction(currentRoot string) error {
	if err := os.RemoveAll(currentRoot); err != nil {
		return err
	}
	return nil
}

func restorePreviousVersion(manifest installerManifest, layout runtimeLayout, rollbackPath string, logger *installLogger) error {
	if rollbackPath == "" {
		return nil
	}
	if err := os.RemoveAll(layout.CurrentRoot); err != nil {
		return err
	}
	if err := ensureCurrentJunction(layout.CurrentRoot, rollbackPath); err != nil {
		return err
	}
	if logger != nil {
		logger.Printf("rollback activated current=%s", rollbackPath)
	}
	return nil
}

func writeUninstallMetadata(layout runtimeLayout, manifest installerManifest) error {
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, layout.RegistryKey, registry.ALL_ACCESS)
	if err != nil {
		return err
	}
	defer key.Close()

	uninstallExe := filepath.Join(layout.CurrentRoot, "ManusTerminalSetup.exe")
	uninstallString := fmt.Sprintf("%s uninstall", syscall.EscapeArg(uninstallExe))
	quietString := fmt.Sprintf("%s uninstall --remove-data", syscall.EscapeArg(uninstallExe))

	values := map[string]string{
		"DisplayName":          manifest.DisplayName,
		"DisplayVersion":       manifest.Version,
		"Publisher":            publisher,
		"InstallLocation":      layout.CurrentRoot,
		"InstallDate":          time.Now().Format("20060102"),
		"UninstallString":      uninstallString,
		"QuietUninstallString": quietString,
		"DisplayIcon":          uninstallExe,
	}

	for name, value := range values {
		if err := key.SetStringValue(name, value); err != nil {
			return err
		}
	}
	if err := key.SetDWordValue("NoModify", 1); err != nil {
		return err
	}
	if err := key.SetDWordValue("NoRepair", 1); err != nil {
		return err
	}
	return nil
}

func deleteUninstallMetadata(manifest installerManifest) error {
	if err := registry.DeleteKey(registry.LOCAL_MACHINE, `Software\Microsoft\Windows\CurrentVersion\Uninstall\ManusPeripheralAgent`); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "the system cannot find the file specified") {
			return nil
		}
		return err
	}
	return nil
}

func loadManifest() (installerManifest, error) {
	data, err := embeddedAssets.ReadFile("assets/manifest.json")
	if err != nil {
		return installerManifest{}, err
	}
	var manifest installerManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return installerManifest{}, err
	}
	if manifest.ServiceName == "" {
		manifest.ServiceName = serviceName
	}
	if manifest.DisplayName == "" {
		manifest.DisplayName = displayName
	}
	if manifest.Description == "" {
		manifest.Description = "Manus Peripheral Agent Windows installer and service host"
	}
	if manifest.HealthURL == "" {
		manifest.HealthURL = "http://127.0.0.1:4050/health"
	}
	if manifest.ServiceAccount == "" {
		manifest.ServiceAccount = "NT AUTHORITY\\LocalService"
	}
	if manifest.BundleRoot == "" && manifest.BundleDirName != "" {
		manifest.BundleRoot = filepath.ToSlash(filepath.Join("assets", "bundle", manifest.BundleDirName))
	}
	if len(manifest.ServiceArgs) == 0 {
		manifest.ServiceArgs = []string{"service"}
	}
	if manifest.VersionFileName == "" {
		manifest.VersionFileName = "VERSION.json"
	}
	return manifest, nil
}

func copyEmbeddedTree(sourceRoot, destRoot string) error {
	return fs.WalkDir(embeddedAssets, sourceRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(sourceRoot, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destRoot, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := embeddedAssets.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
}

func copyFile(sourcePath, destinationPath string) error {
	if err := os.MkdirAll(filepath.Dir(destinationPath), 0o755); err != nil {
		return err
	}
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(destinationPath)
	if err != nil {
		return err
	}
	defer destination.Close()

	if _, err := io.Copy(destination, source); err != nil {
		return err
	}
	return destination.Sync()
}

func appendFile(path string, data []byte, perm os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, perm)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.Write(data)
	return err
}

type installLogger struct {
	file *os.File
}

func newInstallLogger(path string) (*installLogger, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return nil, err
	}
	return &installLogger{file: file}, nil
}

func (l *installLogger) Close() error {
	if l == nil || l.file == nil {
		return nil
	}
	return l.file.Close()
}

func (l *installLogger) Printf(format string, args ...any) {
	if l == nil || l.file == nil {
		return
	}
	line := fmt.Sprintf("%s %s\n", time.Now().Format(time.RFC3339Nano), fmt.Sprintf(format, args...))
	_, _ = l.file.WriteString(line)
}

func containsArg(args []string, expected ...string) bool {
	for _, arg := range args {
		for _, candidate := range expected {
			if strings.EqualFold(arg, candidate) {
				return true
			}
		}
	}
	return false
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func defaultOrEnv(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func envDurationSeconds(name string, fallbackSeconds int) time.Duration {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return time.Duration(fallbackSeconds) * time.Second
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return time.Duration(fallbackSeconds) * time.Second
	}
	return time.Duration(seconds) * time.Second
}

func buildServiceBinaryPath(exePath string, args ...string) string {
	quoted := quoteWindowsServiceExecutable(exePath)
	for _, arg := range args {
		quoted += " " + syscall.EscapeArg(arg)
	}
	return quoted
}

func quoteWindowsServiceExecutable(exePath string) string {
	return `"` + strings.ReplaceAll(exePath, `"`, `""`) + `"`
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func isMissingServiceError(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) || strings.Contains(strings.ToLower(err.Error()), "service does not exist")
}
