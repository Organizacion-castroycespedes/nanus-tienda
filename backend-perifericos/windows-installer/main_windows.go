//go:build windows

package main

import (
	"crypto/sha256"
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
	PosVersion      string   `json:"posVersion"`
	PosRoot         string   `json:"posRoot"`
	PosManifest     string   `json:"posManifest"`
}

type posPayloadFile struct {
	Path   string `json:"path"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

type posPayloadManifest struct {
	SchemaVersion int              `json:"schemaVersion"`
	PosVersion    string           `json:"posVersion"`
	Executable    string           `json:"executable"`
	ShellConfig   string           `json:"shellConfig"`
	PayloadSize   int64            `json:"payloadSize"`
	Files         []posPayloadFile `json:"files"`
}

type runtimeLayout struct {
	InstallRoot        string
	ProgramDataRoot    string
	VersionsRoot       string
	CurrentRoot        string
	ConfigRoot         string
	LogsRoot           string
	StateRoot          string
	VersionRoot        string
	ServiceExe         string
	InstallLog         string
	ServiceLog         string
	ServiceStdout      string
	ServiceStderr      string
	RegistryKey        string
	POSInstallRoot     string
	POSVersionsRoot    string
	POSCurrentRoot     string
	POSVersionRoot     string
	POSExecutable      string
	POSPreviousPresent bool
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
	if len(os.Args) > 1 && strings.EqualFold(os.Args[1], "--uninstall-cleanup") {
		manifest, err := loadManifest()
		if err != nil {
			fatal(err)
		}
		fatal(runUninstallCleanup(manifest, os.Args[2:]))
		return
	}
	if len(os.Args) > 1 {
		if scenario, ok := coreFlowScenarioArg(os.Args[1]); ok {
			if err := runInstallerCoreFlowQA(scenario); err != nil {
				fatal(err)
			}
			return
		}
	}
	if requiresElevation(os.Args[1:]) && ensureElevated() != nil {
		if err := relaunchElevated(os.Args[1:]); err != nil {
			fatal(err)
		}
		return
	}
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
		case "--preflight":
			fatal(printPreflight(manifest))
		case "service":
			runAsService(manifest)
			return
		case "--ui-spike":
			fatal(runInstallerUI(true, false, false, false, false))
			return
		case "--ui-bridge-qa":
			fatal(runInstallerUI(false, true, false, false, false))
			return
		case "--ui-config-qa":
			fatal(runInstallerUI(false, true, true, false, false))
			return
		case "--ui-print-qa":
			fatal(runInstallerUI(false, true, true, true, false))
			return
		case "--ui-drawer-qa":
			fatal(runInstallerUI(false, true, true, true, true))
			return
		case "--help", "-h", "/?", "help":
			printUsage(manifest)
			return
		default:
			if strings.HasPrefix(os.Args[1], "-") || strings.HasPrefix(os.Args[1], "/") {
				printUsage(manifest)
				os.Exit(2)
			}
			fatal(runProductiveInstallerUI(manifest))
		}
		return
	}

	fatal(runProductiveInstallerUI(manifest))
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
		"posVersion":     manifest.PosVersion,
		"posRoot":        layout.POSInstallRoot,
		"posCurrentRoot": layout.POSCurrentRoot,
		"posExecutable":  layout.POSExecutable,
	}
	return json.NewEncoder(os.Stdout).Encode(payload)
}

func printPreflight(manifest installerManifest) error {
	layout := buildLayout(manifest)
	installedVersion, installedPath := currentInstalledVersion(manifest, layout)
	intent := "fresh install"
	state := "CLEAN"
	warning := ""
	if installedVersion != "" {
		if installedVersion == manifest.Version {
			intent = "same-version repair"
		} else {
			intent = "upgrade"
		}
	} else if hasInstallationFootprints(layout) {
		state = "INCONSISTENT"
		intent = "inconsistent installation"
		warning = "installation footprints exist but VERSION.json is missing or invalid"
	}
	return json.NewEncoder(os.Stdout).Encode(map[string]any{
		"embeddedAgentVersion":    manifest.Version,
		"installedAgentVersion":   installedVersion,
		"intendedMode":            intent,
		"installationState":       state,
		"warning":                 warning,
		"targetVersionDirectory":  layout.VersionRoot,
		"currentVersionDirectory": layout.CurrentRoot,
		"rollbackCandidate":       installedPath,
	})
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
	return installWithObserver(manifest, nil)
}

func installWithObserver(manifest installerManifest, observer installerCoreEventSink) error {
	if coreFlowHarnessActive.Load() {
		return fmt.Errorf("productive installer blocked during CoreFlow QA")
	}
	var sequence uint64
	preflightLogger := newPreflightLogger()
	if preflightLogger != nil {
		defer preflightLogger.Close()
		preflightLogger.Printf("lifecycle phase=START previousVersion=unknown targetVersion=%s", manifest.Version)
	}
	if observer != nil {
		emitCoreStep(observer, &sequence, eventInstallStarted, "", nil)
	}
	if err := runCoreStep(observer, &sequence, stepVerifyRequirements, func() error {
		if err := ensureSupportedHost(); err != nil {
			return err
		}
		return ensureElevated()
	}); err != nil {
		if preflightLogger != nil {
			preflightLogger.Printf("lifecycle phase=PREFLIGHT_FAILURE previousVersion=unknown targetVersion=%s rollbackAttempted=NO error=%v", manifest.Version, err)
		}
		return err
	}

	layout := buildLayout(manifest)
	layout.POSPreviousPresent = posPayloadValid(layout, manifest)
	if err := runCoreStep(observer, &sequence, stepPrepareFiles, func() error { return ensureBaseDirectories(layout) }); err != nil {
		return err
	}

	logger, err := newInstallLogger(layout.InstallLog)
	if err != nil {
		return err
	}
	defer logger.Close()

	logger.Printf("install start version=%s", manifest.Version)
	logger.Printf("lifecycle phase=PREFLIGHT_SUCCESS previousVersion=pending targetVersion=%s rollbackAttempted=NO", manifest.Version)

	existingVersion, existingVersionPath := currentInstalledVersion(manifest, layout)
	sameVersion := existingVersion == manifest.Version && existingVersion != ""

	if sameVersion {
		logger.Printf("repair existing version=%s path=%s", existingVersion, existingVersionPath)
	} else if existingVersion != "" {
		logger.Printf("upgrade from=%s to=%s", existingVersion, manifest.Version)
	} else {
		logger.Printf("fresh install version=%s", manifest.Version)
	}
	rollbackPath := ""
	repairBackupPath := ""
	repairStagingPath := ""

	if err := runCoreStep(observer, &sequence, stepInstallAgent, func() error {
		if sameVersion {
			var err error
			repairStagingPath, repairBackupPath, err = prepareSameVersionRepair(layout, manifest, logger)
			if err != nil {
				return err
			}
			rollbackPath = repairBackupPath
			return nil
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
			return err
		}
		if manifest.PosRoot != "" {
			if err := installPOSPayload(layout, manifest); err != nil {
				return fmt.Errorf("install POS payload: %w", err)
			}
		}
		_ = stopService(manifest)
		if err := ensureCurrentJunction(layout.CurrentRoot, layout.VersionRoot); err != nil {
			return fmt.Errorf("activate current version: %w", err)
		}
		rollbackPath = existingVersionPath
		return nil
	}); err != nil {
		if repairBackupPath != "" {
			emitRollback(observer, &sequence, manifest, layout, repairBackupPath, existingVersion, logger)
		}
		return err
	}
	if manifest.PosRoot != "" {
		posValid, reason := installedPOSMatchesEmbeddedManifest(layout, manifest)
		if posValid {
			logger.Printf("POS reconciliation state=MATCH")
		} else {
			logger.Printf("POS reconciliation state=MISMATCH detail=%s", reason)
			logger.Printf("POS payload mismatch; replacement required")
		}
		if !posValid {
			if err := installPOSPayload(layout, manifest); err != nil {
				logger.Printf("POS install failure stage=activation sanitized error=%v", err)
				if repairBackupPath != "" {
					_ = emitRollback(observer, &sequence, manifest, layout, repairBackupPath, existingVersion, logger)
				}
				return fmt.Errorf("install POS payload: %w", err)
			}
			logger.Printf("POS activation success version=%s", manifest.PosVersion)
		}
	}
	registration := buildServiceRegistration(manifest, layout)
	logger.Printf("service registration executable=%s args=%q", registration.Executable, registration.Args)
	if err := runCoreStep(observer, &sequence, stepConfigureService, func() error { return configureService(manifest, registration) }); err != nil {
		if rollbackPath != "" {
			emitRollback(observer, &sequence, manifest, layout, rollbackPath, existingVersion, logger)
		}
		return err
	}

	if err := ensureRecoveryPolicy(manifest); err != nil {
		logger.Printf("recovery policy warning: %v", err)
	}

	if err := runCoreStep(observer, &sequence, stepStartService, func() error { return startService(manifest) }); err != nil {
		if rollbackPath != "" {
			emitRollback(observer, &sequence, manifest, layout, rollbackPath, existingVersion, logger)
		}
		return fmt.Errorf("start service: %w", err)
	}

	if err := runCoreStep(observer, &sequence, stepVerifyService, func() error { return waitForHealth(manifest) }); err != nil {
		logger.Printf("health failed: %v", err)
		_ = stopService(manifest)
		if rollbackPath != "" {
			emitRollback(observer, &sequence, manifest, layout, rollbackPath, existingVersion, logger)
		}
		return fmt.Errorf("health gate failed: %w", err)
	}
	if manifest.PosRoot != "" {
		if err := createPOSShortcuts(layout); err != nil {
			logger.Printf("POS shortcut failure: %v", err)
			if rollbackPath != "" {
				_ = emitRollback(observer, &sequence, manifest, layout, rollbackPath, existingVersion, logger)
			}
			return fmt.Errorf("POS shortcuts: %w", err)
		}
		logger.Printf("POS verification success")
	}

	emitCoreStep(observer, &sequence, eventStepStarted, stepFinalize, nil)
	if err := writeUninstallMetadata(layout, manifest); err != nil {
		emitCoreStep(observer, &sequence, eventStepWarning, stepFinalize, err)
		logger.Printf("uninstall metadata warning: %v", err)
	} else {
		emitCoreStep(observer, &sequence, eventStepSucceeded, stepFinalize, nil)
	}

	logger.Printf("install success version=%s", manifest.Version)
	if repairStagingPath != "" || repairBackupPath != "" {
		if err := cleanupRepairArtifacts(repairStagingPath, repairBackupPath, logger); err != nil {
			logger.Printf("repair cleanup warning: %v", err)
		}
	}
	if observer != nil {
		emitCoreStep(observer, &sequence, eventInstallSuccess, "", nil)
	}
	fmt.Printf("SUCCESS version=%s\n", manifest.Version)
	return nil
}

func createPOSShortcuts(layout runtimeLayout) error {
	stableExecutable := filepath.Join(layout.POSCurrentRoot, "Manus POS.exe")
	if !exists(stableExecutable) {
		return fmt.Errorf("POS executable missing")
	}
	startMenu := filepath.Join(defaultOrEnv("ProgramData", `C:\ProgramData`), "Microsoft", "Windows", "Start Menu", "Programs", "Manus")
	if err := os.MkdirAll(startMenu, 0o755); err != nil {
		return err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("user home unavailable: %w", err)
	}
	desktop := filepath.Join(home, "Desktop")
	script := "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut($env:MANUS_SHORTCUT_PATH); $s.TargetPath=$env:MANUS_POS_TARGET; $s.WorkingDirectory=$env:MANUS_POS_WORKDIR; $s.Save()"
	for _, shortcut := range []string{filepath.Join(desktop, "Manus POS.lnk"), filepath.Join(startMenu, "Manus POS.lnk")} {
		cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
		cmd.Env = append(os.Environ(), "MANUS_SHORTCUT_PATH="+shortcut, "MANUS_POS_TARGET="+stableExecutable, "MANUS_POS_WORKDIR="+filepath.Dir(stableExecutable))
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("create shortcut %s: %w: %s", shortcut, err, strings.TrimSpace(string(output)))
		}
	}
	return nil
}

func posPayloadValid(layout runtimeLayout, manifest installerManifest) bool {
	valid, _ := installedPOSMatchesEmbeddedManifest(layout, manifest)
	return valid
}

func readEmbeddedPOSManifest(manifest installerManifest) (posPayloadManifest, error) {
	if manifest.PosManifest == "" {
		return posPayloadManifest{}, errors.New("POS manifest path missing")
	}
	manifestPath := filepath.ToSlash(filepath.Clean(manifest.PosManifest))
	if filepath.IsAbs(manifestPath) || manifestPath == "." || strings.HasPrefix(manifestPath, "../") || strings.Contains(manifestPath, "/../") {
		return posPayloadManifest{}, errors.New("unsafe POS manifest path")
	}
	data, err := embeddedAssets.ReadFile(manifestPath)
	if err != nil {
		return posPayloadManifest{}, fmt.Errorf("read POS manifest: %w", err)
	}
	var payload posPayloadManifest
	if err := json.Unmarshal(data, &payload); err != nil {
		return posPayloadManifest{}, fmt.Errorf("parse POS manifest: %w", err)
	}
	if payload.PosVersion == "" || len(payload.Files) == 0 {
		return posPayloadManifest{}, errors.New("POS manifest has no payload files")
	}
	return payload, nil
}

func safePOSRelativePath(relativePath string) (string, error) {
	if relativePath == "" || filepath.IsAbs(relativePath) || filepath.VolumeName(relativePath) != "" {
		return "", errors.New("unsafe POS payload path")
	}
	clean := filepath.Clean(relativePath)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", errors.New("unsafe POS payload path")
	}
	return clean, nil
}

func validateInstalledPOSPayload(layout runtimeLayout, manifest posPayloadManifest) error {
	if manifest.PosVersion == "" || !exists(layout.POSCurrentRoot) {
		return errors.New("POS current payload missing")
	}
	for _, file := range manifest.Files {
		relativePath, err := safePOSRelativePath(filepath.FromSlash(file.Path))
		if err != nil {
			return fmt.Errorf("%s: %w", file.Path, err)
		}
		installedPath := filepath.Join(layout.POSCurrentRoot, relativePath)
		relativeToRoot, err := filepath.Rel(layout.POSCurrentRoot, installedPath)
		if err != nil || relativeToRoot == ".." || strings.HasPrefix(relativeToRoot, ".."+string(filepath.Separator)) {
			return fmt.Errorf("%s: path escapes POS root", file.Path)
		}
		info, err := os.Stat(installedPath)
		if err != nil {
			return fmt.Errorf("%s: missing installed file", file.Path)
		}
		if !info.Mode().IsRegular() || info.Size() != file.Size {
			return fmt.Errorf("%s: size mismatch expected=%d actual=%d", file.Path, file.Size, info.Size())
		}
		fileHandle, err := os.Open(installedPath)
		if err != nil {
			return fmt.Errorf("%s: read installed file: %w", file.Path, err)
		}
		hash := sha256.New()
		if _, err := io.Copy(hash, fileHandle); err != nil {
			_ = fileHandle.Close()
			return fmt.Errorf("%s: hash installed file: %w", file.Path, err)
		}
		if err := fileHandle.Close(); err != nil {
			return fmt.Errorf("%s: close installed file: %w", file.Path, err)
		}
		actualHash := fmt.Sprintf("%x", hash.Sum(nil))
		if !strings.EqualFold(actualHash, file.SHA256) {
			return fmt.Errorf("%s: hash mismatch expected=%s actual=%s", file.Path, file.SHA256, actualHash)
		}
	}
	return nil
}

func installedPOSMatchesEmbeddedManifest(layout runtimeLayout, manifest installerManifest) (bool, string) {
	if manifest.PosRoot == "" || manifest.PosVersion == "" {
		return false, "POS payload metadata missing"
	}
	payload, err := readEmbeddedPOSManifest(manifest)
	if err != nil {
		return false, err.Error()
	}
	if payload.PosVersion != manifest.PosVersion {
		return false, fmt.Sprintf("manifest version mismatch expected=%s actual=%s", manifest.PosVersion, payload.PosVersion)
	}
	if err := validateInstalledPOSPayload(layout, payload); err != nil {
		return false, err.Error()
	}
	return true, ""
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

	if err := stopService(manifest); err != nil && !isMissingServiceError(err) {
		return fmt.Errorf("uninstall stop service: %w", err)
	}
	if err := waitForServiceStopped(manifest); err != nil {
		return fmt.Errorf("uninstall service stop confirmation: %w", err)
	}
	if err := deleteService(manifest); err != nil && !isMissingServiceError(err) {
		return err
	}
	helperPath, err := prepareUninstallCleanupHelper(layout, removeData)
	if err != nil {
		return err
	}
	cmd := exec.Command(helperPath, uninstallCleanupArgs(os.Getpid(), layout, removeData)...)
	cmd.Dir = filepath.Dir(helperPath)
	if err := cmd.Start(); err != nil {
		_ = os.Remove(helperPath)
		return fmt.Errorf("launch uninstall cleanup helper: %w", err)
	}
	if logger != nil {
		logger.Printf("uninstall cleanup helper launched pid=%d path=%s", cmd.Process.Pid, helperPath)
	}
	fmt.Println("UNINSTALL CLEANUP SCHEDULED")
	return nil
}

func prepareUninstallCleanupHelper(layout runtimeLayout, removeData bool) (string, error) {
	tempRoot := filepath.Join(os.TempDir(), fmt.Sprintf("ManusTerminalSetup-uninstall-%d", os.Getpid()))
	if err := os.MkdirAll(tempRoot, 0o700); err != nil {
		return "", err
	}
	helperPath := filepath.Join(tempRoot, "ManusTerminalSetup-uninstall-helper.exe")
	if err := copyFile(os.Args[0], helperPath); err != nil {
		self, selfErr := os.Executable()
		if selfErr != nil {
			return "", err
		}
		if copyErr := copyFile(self, helperPath); copyErr != nil {
			return "", copyErr
		}
	}
	return helperPath, nil
}

func uninstallCleanupArgs(parentPID int, layout runtimeLayout, removeData bool) []string {
	args := []string{
		"--uninstall-cleanup",
		fmt.Sprintf("--parent-pid=%d", parentPID),
		"--install-root=" + layout.InstallRoot,
		"--programdata-root=" + layout.ProgramDataRoot,
		"--pos-root=" + layout.POSInstallRoot,
	}
	if removeData {
		args = append(args, "--remove-data")
	}
	return args
}

func runUninstallCleanup(manifest installerManifest, args []string) error {
	parentPID, installRoot, programDataRoot, posRoot, removeData, err := parseUninstallCleanupArgs(args)
	if err != nil {
		return err
	}
	if err := waitForParentExit(parentPID); err != nil {
		return err
	}
	logger, _ := newInstallLogger(filepath.Join(programDataRoot, "logs", "installer.log"))
	cleanupLogPath := filepath.Join(programDataRoot, "logs", "installer.log")
	if logger != nil {
		logger.Printf("cleanup helper start parent pid=%d", parentPID)
		logger.Printf("cleanup parent exit confirmed")
		logger.Printf("PeripheralAgent delete start root=%s", installRoot)
	}
	if err := os.RemoveAll(installRoot); err != nil {
		if logger != nil {
			logger.Printf("PeripheralAgent delete failure error=%v", err)
		}
		return fmt.Errorf("uninstall cleanup Program Files: %w", err)
	}
	if exists(installRoot) {
		return fmt.Errorf("uninstall cleanup Program Files still exists: %s", installRoot)
	}
	if posRoot != "" {
		_ = removePOSShortcuts()
		if err := os.RemoveAll(posRoot); err != nil {
			return fmt.Errorf("uninstall cleanup POS: %w", err)
		}
		if exists(posRoot) {
			return fmt.Errorf("uninstall cleanup POS still exists: %s", posRoot)
		}
		_, _ = removeEmptyManusParent(filepath.Dir(posRoot))
	}
	if logger != nil {
		logger.Printf("PeripheralAgent delete success")
	}
	if removed, removeErr := removeEmptyManusParent(filepath.Dir(installRoot)); removeErr != nil {
		if logger != nil {
			logger.Printf("empty Manus parent cleanup failure error=%v", removeErr)
		}
	} else if removed && logger != nil {
		logger.Printf("empty Manus parent cleanup success")
	}
	if removeData {
		if logger != nil {
			logger.Printf("ProgramData policy=remove")
			_ = logger.Close()
			logger = nil
		}
		cleanupLogPath = filepath.Join(os.TempDir(), "ManusTerminalSetup-cleanup-"+fmt.Sprintf("%d", parentPID)+".log")
		logger, _ = newInstallLogger(cleanupLogPath)
		if logger != nil {
			defer logger.Close()
			logger.Printf("ProgramData logger closed before remove")
			logger.Printf("ProgramData delete start target=%s", programDataRoot)
		}
		if err := os.RemoveAll(programDataRoot); err != nil {
			if logger != nil {
				logger.Printf("ProgramData delete failure error=%v", err)
			}
			return fmt.Errorf("uninstall cleanup ProgramData: %w", err)
		}
		if logger != nil {
			logger.Printf("ProgramData delete success")
		}
		if removed, removeErr := removeEmptyManusParent(filepath.Dir(programDataRoot)); logger != nil {
			if removeErr != nil {
				logger.Printf("ProgramData Manus parent cleanup failure error=%v", removeErr)
			} else if removed {
				logger.Printf("ProgramData Manus parent cleanup success")
			}
		}
	} else if logger != nil {
		logger.Printf("ProgramData policy=preserve")
	}
	if err := deleteUninstallMetadata(manifest); err != nil && !isMissingServiceError(err) {
		return fmt.Errorf("uninstall cleanup registry: %w", err)
	}
	if logger != nil {
		logger.Printf("registry removal success")
	}
	tempRoot := filepath.Dir(os.Args[0])
	cleanupCommand := buildTempCleanupCommand(tempRoot)
	if logger != nil {
		logger.Printf("TEMP cleanup command=%s target=%s strategy=external-cmd-after-helper", cleanupCommand, tempRoot)
	}
	cleanupPID, cleanupErr := scheduleTempCleanup(tempRoot, cleanupLogPath, removeData)
	if logger != nil {
		if cleanupErr != nil {
			logger.Printf("TEMP cleanup launch failure error=%v", cleanupErr)
		} else {
			logger.Printf("TEMP cleanup launched pid=%d workingDir=%s", cleanupPID, filepath.Dir(tempRoot))
		}
		_ = logger.Close()
	}
	return nil
}

func removePOSShortcuts() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	paths := []string{
		filepath.Join(home, "Desktop", "Manus POS.lnk"),
		filepath.Join(defaultOrEnv("ProgramData", `C:\ProgramData`), "Microsoft", "Windows", "Start Menu", "Programs", "Manus", "Manus POS.lnk"),
	}
	for _, path := range paths {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func removeEmptyManusParent(manusRoot string) (bool, error) {
	if filepath.Base(filepath.Clean(manusRoot)) != "Manus" {
		return false, nil
	}
	entries, err := os.ReadDir(manusRoot)
	if err != nil || len(entries) != 0 {
		return false, err
	}
	if err := os.Remove(manusRoot); err != nil {
		return false, err
	}
	return true, nil
}

func scheduleTempCleanup(tempRoot, logPath string, removeLog bool) (int, error) {
	if tempRoot == "" {
		return 0, fmt.Errorf("empty temp cleanup target")
	}
	rel, err := filepath.Rel(os.TempDir(), tempRoot)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return 0, fmt.Errorf("temp cleanup target outside TEMP")
	}
	finalScript := ""
	if removeLog {
		finalScript = filepath.Join(filepath.Dir(tempRoot), filepath.Base(tempRoot)+"-log-cleanup.cmd")
		if err := writeFinalLogCleanupScript(finalScript, logPath); err != nil {
			return 0, err
		}
	}
	scriptPath, err := writeTempCleanupScriptWithFinal(tempRoot, logPath, removeLog, finalScript)
	if err != nil {
		return 0, err
	}
	cmd := exec.Command("cmd.exe", "/D", "/C", scriptPath)
	cmd.Dir = filepath.Dir(tempRoot)
	if err := cmd.Start(); err != nil {
		return 0, err
	}
	return cmd.Process.Pid, nil
}

func writeFinalLogCleanupScript(scriptPath, logPath string) error {
	contents := "@echo off\r\n" +
		"set \"LOG=" + quoteBatchPath(logPath) + "\"\r\n" +
		"for /L %%I in (1,1,12) do (\r\n" +
		"  if not exist \"%LOG%\" goto success\r\n" +
		"  del /q \"%LOG%\" >nul 2>&1\r\n" +
		"  if not exist \"%LOG%\" goto success\r\n" +
		"  timeout /t 5 /nobreak >nul\r\n" +
		")\r\n" +
		"goto done\r\n" +
		":success\r\n" +
		"del /q \"%~f0\" >nul 2>&1\r\n" +
		":done\r\n"
	return os.WriteFile(scriptPath, []byte(contents), 0o600)
}

func buildTempCleanupCommand(tempRoot string) string {
	return fmt.Sprintf("cmd.exe /D /C cleanup-target=\"%s\" retries=12", tempRoot)
}

func writeTempCleanupScript(tempRoot, logPath string, removeLog bool) (string, error) {
	return writeTempCleanupScriptWithFinal(tempRoot, logPath, removeLog, "")
}

func writeTempCleanupScriptWithFinal(tempRoot, logPath string, removeLog bool, finalScript string) (string, error) {
	if tempRoot == "" {
		return "", fmt.Errorf("empty temp cleanup target")
	}
	rel, err := filepath.Rel(os.TempDir(), tempRoot)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("temp cleanup target outside TEMP")
	}
	parent := filepath.Dir(tempRoot)
	scriptPath := filepath.Join(parent, filepath.Base(tempRoot)+"-cleanup.cmd")
	contents := "@echo off\r\n" +
		"set \"TARGET=" + quoteBatchPath(tempRoot) + "\"\r\n" +
		"set \"LOG=" + quoteBatchPath(logPath) + "\"\r\n" +
		"for /L %%I in (1,1,12) do (\r\n" +
		"  if not exist \"%TARGET%\" goto success\r\n" +
		"  echo cleanup retry %%I target=%TARGET%>>\"%LOG%\"\r\n" +
		"  rmdir /s /q \"%TARGET%\" >>\"%LOG%\" 2>&1\r\n" +
		"  if not exist \"%TARGET%\" goto success\r\n" +
		"  timeout /t 5 /nobreak >nul\r\n" +
		")\r\n" +
		"echo cleanup failure target=%TARGET% retries=12>>\"%LOG%\"\r\n" +
		"goto failureDone\r\n" +
		":success\r\n" +
		"echo cleanup success target=%TARGET%>>\"%LOG%\"\r\n" +
		func() string {
			if finalScript != "" {
				return "start \"\" /b cmd.exe /D /C \"" + quoteBatchPath(finalScript) + "\"\r\n"
			}
			return ""
		}() +
		":failureDone\r\n" +
		"del /q \"%~f0\" >nul 2>&1\r\n"
	_ = removeLog // final cleaner owns external log deletion.
	if err := os.WriteFile(scriptPath, []byte(contents), 0o600); err != nil {
		return "", err
	}
	return scriptPath, nil
}

func quoteBatchPath(path string) string {
	return strings.ReplaceAll(path, "%", "%%")
}

func parseUninstallCleanupArgs(args []string) (int, string, string, string, bool, error) {
	parentPID, installRoot, programDataRoot, posRoot := 0, "", "", ""
	removeData := false
	for _, arg := range args {
		switch {
		case strings.HasPrefix(arg, "--parent-pid="):
			if _, err := fmt.Sscanf(strings.TrimPrefix(arg, "--parent-pid="), "%d", &parentPID); err != nil {
				return 0, "", "", "", false, fmt.Errorf("invalid parent pid")
			}
		case strings.HasPrefix(arg, "--install-root="):
			installRoot = strings.TrimPrefix(arg, "--install-root=")
		case strings.HasPrefix(arg, "--programdata-root="):
			programDataRoot = strings.TrimPrefix(arg, "--programdata-root=")
		case strings.HasPrefix(arg, "--pos-root="):
			posRoot = strings.TrimPrefix(arg, "--pos-root=")
		case strings.EqualFold(arg, "--remove-data"):
			removeData = true
		}
	}
	if parentPID <= 0 || installRoot == "" || programDataRoot == "" {
		return 0, "", "", "", false, fmt.Errorf("incomplete uninstall cleanup arguments")
	}
	return parentPID, installRoot, programDataRoot, posRoot, removeData, nil
}

func waitForParentExit(parentPID int) error {
	if parentPID == os.Getpid() {
		return fmt.Errorf("cleanup helper cannot wait for itself")
	}
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(parentPID))
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(handle)
	_, err = windows.WaitForSingleObject(handle, windows.INFINITE)
	return err
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
	return waitForHealthVersion(manifest, manifest.Version)
}

func waitForHealthVersion(manifest installerManifest, expectedVersion string) error {
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
						stringValue(payload["version"]) == expectedVersion &&
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

func requiresElevation(args []string) bool {
	if len(args) == 0 {
		return true
	}
	switch strings.ToLower(args[0]) {
	case "service", "status", "inspect", "help", "-h", "/?", "--help":
		return false
	default:
		return true
	}
}

func relaunchElevated(args []string) error {
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve installer executable: %w", err)
	}
	quote := func(value string) string {
		return `"` + strings.ReplaceAll(value, `"`, `\\"`) + `"`
	}
	parameters := make([]string, 0, len(args))
	for _, arg := range args {
		parameters = append(parameters, quote(arg))
	}
	verb, _ := syscall.UTF16PtrFromString("runas")
	file, _ := syscall.UTF16PtrFromString(executable)
	params, _ := syscall.UTF16PtrFromString(strings.Join(parameters, " "))
	shell32 := syscall.NewLazyDLL("shell32.dll")
	result, _, callErr := shell32.NewProc("ShellExecuteW").Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(file)), uintptr(unsafe.Pointer(params)), 0, 1)
	if result <= 32 {
		if callErr != syscall.Errno(0) {
			return fmt.Errorf("request administrator elevation: %w", callErr)
		}
		return errors.New("request administrator elevation failed")
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
	posRoot := filepath.Join(filepath.Dir(installRoot), "POS")
	posVersions := filepath.Join(posRoot, "versions")
	posVersionRoot := filepath.Join(posVersions, manifest.PosVersion)
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
		POSInstallRoot:  posRoot,
		POSVersionsRoot: posVersions,
		POSCurrentRoot:  filepath.Join(posRoot, "current"),
		POSVersionRoot:  posVersionRoot,
		POSExecutable:   filepath.Join(posVersionRoot, "Manus POS.exe"),
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
		layout.POSInstallRoot,
		layout.POSVersionsRoot,
	} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	return nil
}

func installPOSPayload(layout runtimeLayout, manifest installerManifest) error {
	if manifest.PosRoot == "" || manifest.PosVersion == "" {
		return errors.New("POS payload metadata missing")
	}
	staging := filepath.Join(layout.POSVersionsRoot, ".staging-pos-"+strconv.FormatInt(time.Now().UnixNano(), 10))
	if err := os.RemoveAll(staging); err != nil {
		return err
	}
	if err := os.MkdirAll(staging, 0o755); err != nil {
		return err
	}
	defer os.RemoveAll(staging)
	if err := copyEmbeddedTree(manifest.PosRoot, staging); err != nil {
		return err
	}
	for _, required := range []string{"Manus POS.exe", "resources/app.asar", "resources/manus-shell.config.json"} {
		if !exists(filepath.Join(staging, required)) {
			return fmt.Errorf("POS payload missing %s", required)
		}
	}
	backup := filepath.Join(layout.POSVersionsRoot, ".backup-pos-"+strconv.FormatInt(time.Now().UnixNano(), 10))
	if exists(layout.POSVersionRoot) {
		if err := os.Rename(layout.POSVersionRoot, backup); err != nil {
			return err
		}
	}
	if err := os.Rename(staging, layout.POSVersionRoot); err != nil {
		if exists(backup) {
			_ = os.Rename(backup, layout.POSVersionRoot)
		}
		return err
	}
	if exists(backup) {
		_ = os.RemoveAll(backup)
	}
	return ensureCurrentJunction(layout.POSCurrentRoot, layout.POSVersionRoot)
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

func hasInstallationFootprints(layout runtimeLayout) bool {
	return exists(layout.InstallRoot) || exists(layout.CurrentRoot) || exists(layout.VersionRoot)
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

func prepareSameVersionRepair(layout runtimeLayout, manifest installerManifest, logger *installLogger) (string, string, error) {
	stagingPath, backupPath := newRepairPaths(layout)
	if logger != nil {
		logger.Printf("repair staging path=%s", stagingPath)
		logger.Printf("repair staging extraction start")
	}
	if err := os.MkdirAll(stagingPath, 0o755); err != nil {
		return "", "", fmt.Errorf("create repair staging: %w", err)
	}
	cleanupStaging := true
	defer func() {
		if cleanupStaging {
			_ = os.RemoveAll(stagingPath)
		}
	}()
	if err := copyEmbeddedTree(manifest.BundleRoot, stagingPath); err != nil {
		return "", "", fmt.Errorf("repair staging extraction: %w", err)
	}
	if err := copySelfExecutable(filepath.Join(stagingPath, "ManusTerminalSetup.exe")); err != nil {
		return "", "", fmt.Errorf("repair staging executable: %w", err)
	}
	stagedLayout := layout
	stagedLayout.VersionRoot = stagingPath
	stagedLayout.ServiceExe = filepath.Join(stagingPath, "ManusTerminalSetup.exe")
	if err := ensureLocalConfig(stagedLayout); err != nil {
		return "", "", fmt.Errorf("repair staging config: %w", err)
	}
	if err := validateRepairStaging(stagingPath, manifest); err != nil {
		return "", "", err
	}
	if logger != nil {
		logger.Printf("repair staging validation success path=%s", stagingPath)
	}
	if err := ensureServicePermissions(stagedLayout); err != nil {
		return "", "", fmt.Errorf("repair staging permissions: %w", err)
	}
	if logger != nil {
		logger.Printf("repair service stop requested")
	}
	if err := stopService(manifest); err != nil {
		return "", "", fmt.Errorf("repair service stop: %w", err)
	}
	if err := waitForServiceStopped(manifest); err != nil {
		return "", "", err
	}
	if logger != nil {
		logger.Printf("repair service stopped")
		logger.Printf("repair activation start oldTarget=%s backup=%s", layout.VersionRoot, backupPath)
	}
	if err := os.Rename(layout.VersionRoot, backupPath); err != nil {
		return "", "", fmt.Errorf("repair backup live target: %w", err)
	}
	if err := os.Rename(stagingPath, layout.VersionRoot); err != nil {
		_ = os.Rename(backupPath, layout.VersionRoot)
		return "", "", fmt.Errorf("repair activate replacement: %w", err)
	}
	cleanupStaging = false
	if !exists(layout.CurrentRoot) {
		if err := ensureCurrentJunction(layout.CurrentRoot, layout.VersionRoot); err != nil {
			return "", backupPath, fmt.Errorf("repair restore current: %w", err)
		}
	}
	if logger != nil {
		logger.Printf("repair replacement activated current=%s", layout.CurrentRoot)
	}
	return stagingPath, backupPath, nil
}

func newRepairPaths(layout runtimeLayout) (string, string) {
	stamp := fmt.Sprintf("%d-%d", time.Now().UnixNano(), os.Getpid())
	return filepath.Join(layout.VersionsRoot, ".staging-repair-"+stamp),
		filepath.Join(layout.VersionsRoot, ".backup-repair-"+stamp)
}

func validateRepairStaging(stagingPath string, manifest installerManifest) error {
	versionPath := filepath.Join(stagingPath, manifest.VersionFileName)
	version, ok := readInstalledVersion(versionPath)
	if !ok || version != manifest.Version {
		return fmt.Errorf("repair staging validation: VERSION.json does not contain %s", manifest.Version)
	}
	for _, required := range []string{
		filepath.Join(stagingPath, "ManusTerminalSetup.exe"),
		filepath.Join(stagingPath, "runtime", "node.exe"),
		filepath.Join(stagingPath, "app", "main.js"),
	} {
		if !exists(required) {
			return fmt.Errorf("repair staging validation: missing %s", required)
		}
	}
	return nil
}

func waitForServiceStopped(manifest installerManifest) error {
	timeout := envDurationSeconds("MANUS_INSTALLER_SERVICE_STOP_TIMEOUT_SECONDS", 30)
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		manager, err := mgr.Connect()
		if err != nil {
			return err
		}
		service, err := manager.OpenService(manifest.ServiceName)
		if err != nil {
			manager.Disconnect()
			if isMissingServiceError(err) {
				return nil
			}
			return err
		}
		status, queryErr := service.Query()
		service.Close()
		manager.Disconnect()
		if queryErr == nil && status.State == svc.Stopped {
			return nil
		}
		time.Sleep(250 * time.Millisecond)
	}
	return fmt.Errorf("service did not stop within %s", timeout)
}

func stopServiceIfRunning(manifest installerManifest) error {
	manager, err := mgr.Connect()
	if err != nil {
		return err
	}
	service, err := manager.OpenService(manifest.ServiceName)
	if err != nil {
		manager.Disconnect()
		return err
	}
	status, queryErr := service.Query()
	service.Close()
	manager.Disconnect()
	if queryErr != nil || status.State == svc.Stopped {
		return queryErr
	}
	return stopService(manifest)
}

func cleanupRepairArtifacts(stagingPath, backupPath string, logger *installLogger) error {
	var firstErr error
	for _, path := range []string{stagingPath, backupPath} {
		if path == "" {
			continue
		}
		if err := os.RemoveAll(path); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if firstErr == nil && logger != nil {
		logger.Printf("repair cleanup complete")
	}
	return firstErr
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

func rollbackToPreviousVersion(
	manifest installerManifest,
	layout runtimeLayout,
	rollbackPath string,
	expectedVersion string,
	logger *installLogger,
) error {
	if strings.HasPrefix(filepath.Base(rollbackPath), ".backup-repair-") {
		if err := stopServiceIfRunning(manifest); err != nil && !isMissingServiceError(err) {
			return fmt.Errorf("rollback stop service: %w", err)
		}
		if err := waitForServiceStopped(manifest); err != nil {
			return err
		}
		failedPath := filepath.Join(layout.VersionsRoot, ".failed-repair-"+fmt.Sprintf("%d-%d", time.Now().UnixNano(), os.Getpid()))
		if err := os.Rename(layout.VersionRoot, failedPath); err != nil {
			return fmt.Errorf("rollback preserve failed replacement: %w", err)
		}
		if err := os.Rename(rollbackPath, layout.VersionRoot); err != nil {
			_ = os.Rename(failedPath, layout.VersionRoot)
			return fmt.Errorf("rollback restore payload: %w", err)
		}
		if err := ensureCurrentJunction(layout.CurrentRoot, layout.VersionRoot); err != nil {
			return err
		}
		registration := buildServiceRegistration(manifest, layout)
		if err := configureService(manifest, registration); err != nil {
			return fmt.Errorf("rollback configure service: %w", err)
		}
		if err := startService(manifest); err != nil {
			return fmt.Errorf("rollback start service: %w", err)
		}
		if err := waitForHealthVersion(manifest, expectedVersion); err != nil {
			return fmt.Errorf("rollback health: %w", err)
		}
		_ = os.RemoveAll(failedPath)
		if logger != nil {
			logger.Printf("rollback restored repair payload version=%s", expectedVersion)
		}
		return nil
	}
	if err := restorePreviousVersion(manifest, layout, rollbackPath, logger); err != nil {
		return err
	}
	registration := buildServiceRegistration(manifest, layout)
	registration.Executable = filepath.Join(rollbackPath, "ManusTerminalSetup.exe")
	if err := configureService(manifest, registration); err != nil {
		return fmt.Errorf("rollback configure service: %w", err)
	}
	if err := startService(manifest); err != nil {
		return fmt.Errorf("rollback start service: %w", err)
	}
	if err := waitForHealthVersion(manifest, expectedVersion); err != nil {
		return fmt.Errorf("rollback health: %w", err)
	}
	if logger != nil {
		logger.Printf("rollback restored version=%s", expectedVersion)
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

func newPreflightLogger() *installLogger {
	programData := defaultOrEnv("ProgramData", `C:\ProgramData`)
	paths := []string{
		filepath.Join(programData, "Manus", "PeripheralAgent", "logs", "installer-preflight.log"),
		filepath.Join(os.TempDir(), "Manus", "PeripheralAgent", "installer-preflight.log"),
	}
	for _, path := range paths {
		if logger, err := newInstallLogger(path); err == nil {
			return logger
		}
	}
	return nil
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
