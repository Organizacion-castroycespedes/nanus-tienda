package main

// 14.4b stage 2: native adapter for installTransitionSystem. It is reachable
// only through routeInstallTransition, which returns the original P0-B
// rejection while installTransitionExecutionEnabled is false and
// approvedInstallTransitions is empty. Several legacy helpers are unsafe for an
// A-to-B update and are deliberately not used here:
//   - configureService deletes and recreates the service; UPDATE changes only
//     the binary path with UpdateConfig and keeps the LocalService account.
//   - copyBundleToVersion and installPOSPayload remove or rename an existing
//     version root; UPDATE stages into a directory it creates exclusively.
//   - ensureCurrentJunction calls os.RemoveAll on the link; UPDATE removes only
//     the reparse point and never recurses into a payload.
// Protected state is observed as SHA-256 digests only; DPAPI blobs are hashed,
// never decrypted, and their contents never leave this process.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc/mgr"
)

type nativeInstallTransitionSystem struct {
	manifest      installerManifest
	layout        runtimeLayout
	agentStateDir string
	configPath    string
	aclRoots      []string
	sourceRoots   []string
	copyTree      func(source, destination string) error
	copySelf      func(destination string) error
	makeJunction  func(link, target string) error
	httpGet       func(url string) (*http.Response, error)
	healthTimeout time.Duration
	healthPoll    time.Duration
}

func newNativeInstallTransitionSystem(m installerManifest, sourceRoots []string) (*nativeInstallTransitionSystem, error) {
	l := buildLayout(m)
	dataRoot, err := resolveLocalServiceAgentDataRoot()
	if err != nil {
		return nil, fmt.Errorf("localservice_data_root: %w", err)
	}
	client := &http.Client{Timeout: 3 * time.Second}
	return &nativeInstallTransitionSystem{
		manifest:      m,
		layout:        l,
		agentStateDir: filepath.Join(dataRoot, "state"),
		configPath:    filepath.Join(l.ConfigRoot, "agent.config.local.json"),
		aclRoots:      []string{l.InstallRoot, l.POSInstallRoot, l.ProgramDataRoot, dataRoot},
		sourceRoots:   append([]string(nil), sourceRoots...),
		copyTree:      copyEmbeddedTree,
		copySelf:      copySelfExecutable,
		makeJunction:  createInstallTransitionJunction,
		httpGet:       client.Get,
		healthTimeout: envDurationSeconds("MANUS_INSTALLER_HEALTH_TIMEOUT_SECONDS", 60),
		healthPoll:    envDurationSeconds("MANUS_INSTALLER_HEALTH_POLL_SECONDS", 2),
	}, nil
}

func (n *nativeInstallTransitionSystem) POSProcessRunning() (bool, error) {
	processes, err := discoverScopedPOSProcesses(n.layout.POSInstallRoot)
	if err != nil {
		return false, fmt.Errorf("pos_process_scope_unknown: %w", err)
	}
	return len(processes) > 0, nil
}

func installTransitionFileDigest(path string) (installTransitionProtectedItem, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return installTransitionProtectedItem{Presence: installEvidenceAbsent}, nil
	}
	if err != nil {
		return installTransitionProtectedItem{}, err
	}
	sum := sha256.Sum256(data)
	return installTransitionProtectedItem{Presence: installEvidencePresent, SHA256: hex.EncodeToString(sum[:])}, nil
}

// installTransitionSecretSetDigest hashes the set of DPAPI blob files by name and
// content digest. Blobs are never decrypted.
func installTransitionSecretSetDigest(stateDir string) (installTransitionProtectedItem, error) {
	matches, err := filepath.Glob(filepath.Join(stateDir, "secret-*.dpapi.json"))
	if err != nil {
		return installTransitionProtectedItem{}, err
	}
	if len(matches) == 0 {
		return installTransitionProtectedItem{Presence: installEvidenceAbsent}, nil
	}
	sort.Strings(matches)
	set := sha256.New()
	for _, path := range matches {
		data, err := os.ReadFile(path)
		if err != nil {
			return installTransitionProtectedItem{}, err
		}
		sum := sha256.Sum256(data)
		fmt.Fprintf(set, "%s:%s\n", strings.ToLower(filepath.Base(path)), hex.EncodeToString(sum[:]))
	}
	return installTransitionProtectedItem{Presence: installEvidencePresent, SHA256: hex.EncodeToString(set.Sum(nil))}, nil
}

// installTransitionACLDigest hashes owner, group and DACL of each root. It reads
// security descriptors only; it never changes an ACL.
func installTransitionACLDigest(roots []string) (installTransitionProtectedItem, error) {
	if len(roots) == 0 {
		return installTransitionProtectedItem{}, errors.New("acl_roots_missing")
	}
	set := sha256.New()
	for _, root := range roots {
		sd, err := windows.GetNamedSecurityInfo(root, windows.SE_FILE_OBJECT,
			windows.OWNER_SECURITY_INFORMATION|windows.GROUP_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
		if err != nil {
			return installTransitionProtectedItem{}, fmt.Errorf("acl_read %s: %w", root, err)
		}
		fmt.Fprintf(set, "%s\n%s\n", strings.ToLower(filepath.Clean(root)), sd.String())
	}
	return installTransitionProtectedItem{Presence: installEvidencePresent, SHA256: hex.EncodeToString(set.Sum(nil))}, nil
}

func (n *nativeInstallTransitionSystem) ProtectedState() ([]installTransitionProtectedItem, error) {
	type source struct {
		kind installTransitionProtectedKind
		read func() (installTransitionProtectedItem, error)
	}
	sources := []source{
		{installTransitionProtectedInstallationID, func() (installTransitionProtectedItem, error) {
			return installTransitionFileDigest(filepath.Join(n.agentStateDir, "agent-installation-id"))
		}},
		{installTransitionProtectedDeviceRegistry, func() (installTransitionProtectedItem, error) {
			return installTransitionFileDigest(filepath.Join(n.agentStateDir, "device-registry.state.json"))
		}},
		{installTransitionProtectedAgentConfig, func() (installTransitionProtectedItem, error) { return installTransitionFileDigest(n.configPath) }},
		{installTransitionProtectedDPAPISet, func() (installTransitionProtectedItem, error) {
			return installTransitionSecretSetDigest(n.agentStateDir)
		}},
		{installTransitionProtectedACLBaseline, func() (installTransitionProtectedItem, error) { return installTransitionACLDigest(n.aclRoots) }},
	}
	items := make([]installTransitionProtectedItem, 0, len(sources))
	for _, s := range sources {
		item, err := s.read()
		if err != nil {
			return nil, fmt.Errorf("protected_%s: %w", s.kind, err)
		}
		item.Kind = s.kind
		items = append(items, item)
	}
	return items, nil
}

func (n *nativeInstallTransitionSystem) InstallationID() (string, error) {
	data, err := os.ReadFile(filepath.Join(n.agentStateDir, "agent-installation-id"))
	if err != nil {
		return "", fmt.Errorf("installation_id: %w", err)
	}
	id := strings.TrimSpace(string(data))
	if id == "" {
		return "", errors.New("installation_id_empty")
	}
	return id, nil
}

// parseInstallTransitionServiceExecutable returns the quoted executable of a
// service binary path built by buildServiceBinaryPath.
func parseInstallTransitionServiceExecutable(binaryPath string) (string, error) {
	value := strings.TrimSpace(binaryPath)
	if !strings.HasPrefix(value, `"`) {
		return "", errors.New("service_binary_unquoted")
	}
	end := strings.Index(value[1:], `"`)
	if end < 0 {
		return "", errors.New("service_binary_unterminated")
	}
	exe := value[1 : end+1]
	if !filepath.IsAbs(exe) || !strings.EqualFold(filepath.Base(exe), "ManusTerminalSetup.exe") {
		return "", errors.New("service_binary_unexpected")
	}
	return exe, nil
}

func (n *nativeInstallTransitionSystem) openService() (*mgr.Mgr, *mgr.Service, error) {
	manager, err := mgr.Connect()
	if err != nil {
		return nil, nil, err
	}
	service, err := manager.OpenService(n.manifest.ServiceName)
	if err != nil {
		_ = manager.Disconnect()
		return nil, nil, err
	}
	return manager, service, nil
}

func (n *nativeInstallTransitionSystem) ServiceBinary() (string, error) {
	manager, service, err := n.openService()
	if err != nil {
		return "", err
	}
	defer manager.Disconnect()
	defer service.Close()
	config, err := service.Config()
	if err != nil {
		return "", err
	}
	if !sameWindowsIdentity(config.ServiceStartName, n.manifest.ServiceAccount) {
		return "", errors.New("service_account_unexpected")
	}
	return parseInstallTransitionServiceExecutable(config.BinaryPathName)
}

// SetServiceBinary changes only the binary path of the existing service. The
// service is never deleted or recreated and its account must stay LocalService.
func (n *nativeInstallTransitionSystem) SetServiceBinary(executable string) error {
	manager, service, err := n.openService()
	if err != nil {
		return err
	}
	defer manager.Disconnect()
	defer service.Close()
	config, err := service.Config()
	if err != nil {
		return err
	}
	if !sameWindowsIdentity(config.ServiceStartName, n.manifest.ServiceAccount) {
		return errors.New("service_account_unexpected")
	}
	args := n.manifest.ServiceArgs
	if len(args) == 0 {
		args = []string{"service"}
	}
	config.BinaryPathName = buildServiceBinaryPath(executable, args...)
	if err := service.UpdateConfig(config); err != nil {
		return err
	}
	after, err := service.Config()
	if err != nil {
		return err
	}
	if !strings.EqualFold(after.BinaryPathName, config.BinaryPathName) || !sameWindowsIdentity(after.ServiceStartName, n.manifest.ServiceAccount) {
		return errors.New("service_config_not_applied")
	}
	return nil
}

func (n *nativeInstallTransitionSystem) StopService() error  { return stopService(n.manifest) }
func (n *nativeInstallTransitionSystem) StartService() error { return startService(n.manifest) }

func (n *nativeInstallTransitionSystem) ServiceStopped() (bool, error) {
	snapshot, err := queryServiceSnapshot(n.manifest.ServiceName)
	if err != nil {
		return false, err
	}
	if !snapshot.exists {
		return false, errors.New("service_missing")
	}
	return !snapshot.running, nil
}

func (n *nativeInstallTransitionSystem) PortReleased() (bool, error) {
	return localAgentPortAvailable(), nil
}

func (n *nativeInstallTransitionSystem) JunctionTarget(link string) (string, error) {
	info, err := os.Lstat(link)
	if err != nil {
		return "", err
	}
	if info.Mode()&(os.ModeSymlink|os.ModeIrregular) == 0 {
		return "", errors.New("link_not_reparse_point")
	}
	return os.Readlink(link)
}

func (n *nativeInstallTransitionSystem) SetJunction(link, target string) error {
	return switchInstallTransitionJunction(link, target, n.makeJunction)
}

// switchInstallTransitionJunction replaces a junction without recursing into
// either payload: the target must exist, the link must be a reparse point, and
// os.Remove deletes only the reparse point (RemoveDirectory) before re-linking.
func switchInstallTransitionJunction(link, target string, makeJunction func(link, target string) error) error {
	targetInfo, err := os.Lstat(target)
	if err != nil {
		return fmt.Errorf("junction_target_missing: %w", err)
	}
	if !targetInfo.IsDir() || targetInfo.Mode()&(os.ModeSymlink|os.ModeIrregular) != 0 {
		return errors.New("junction_target_not_directory")
	}
	info, err := os.Lstat(link)
	switch {
	case err == nil:
		if info.Mode()&(os.ModeSymlink|os.ModeIrregular) == 0 {
			return errors.New("junction_link_not_reparse_point")
		}
		if current, readErr := os.Readlink(link); readErr == nil && installTransitionSamePath(current, target) {
			return nil
		}
		if err := os.Remove(link); err != nil {
			return fmt.Errorf("junction_remove: %w", err)
		}
	case errors.Is(err, os.ErrNotExist):
	default:
		return err
	}
	if err := makeJunction(link, target); err != nil {
		return err
	}
	if current, err := os.Readlink(link); err != nil || !installTransitionSamePath(current, target) {
		return errors.New("junction_not_applied")
	}
	return nil
}

func createInstallTransitionJunction(link, target string) error {
	if err := os.MkdirAll(filepath.Dir(link), 0o755); err != nil {
		return err
	}
	out, err := exec.Command("cmd.exe", "/C", "mklink", "/J", link, target).CombinedOutput()
	if err != nil {
		return fmt.Errorf("mklink junction: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (n *nativeInstallTransitionSystem) PathAbsent(path string) (bool, error) {
	_, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return true, nil
	}
	return false, err
}

func (n *nativeInstallTransitionSystem) stagingRoot(kind string) (string, error) {
	switch kind {
	case "agent":
		return n.layout.VersionsRoot, nil
	case "pos":
		return n.layout.POSVersionsRoot, nil
	}
	return "", errors.New("staging_kind_unknown")
}

func (n *nativeInstallTransitionSystem) requiredFiles(kind string) []string {
	if kind == "pos" {
		return []string{"Manus POS.exe", filepath.Join("resources", "app.asar"), filepath.Join("resources", "manus-shell.config.json")}
	}
	return []string{"ManusTerminalSetup.exe", n.manifest.VersionFileName}
}

// StagePayload creates target exclusively under the version root of its kind and
// copies the embedded payload into it. On failure it removes only the directory
// it created in this call, never a source payload.
func (n *nativeInstallTransitionSystem) StagePayload(kind, target string) (err error) {
	root, err := n.stagingRoot(kind)
	if err != nil {
		return err
	}
	if !installTransitionSamePath(filepath.Dir(target), root) {
		return errors.New("staging_target_outside_version_root")
	}
	for _, source := range n.sourceRoots {
		if installTransitionSamePath(target, source) || pathWithinRoot(target, source) || pathWithinRoot(source, target) {
			return errors.New("staging_target_overlaps_source")
		}
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return err
	}
	if err := os.Mkdir(target, 0o755); err != nil {
		return fmt.Errorf("staging_target_not_absent: %w", err)
	}
	defer func() {
		if err != nil {
			_ = os.RemoveAll(target) // created exclusively above; never a source payload
		}
	}()
	switch kind {
	case "agent":
		if err := n.copyTree(n.manifest.BundleRoot, target); err != nil {
			return err
		}
		if err := n.copySelf(filepath.Join(target, "ManusTerminalSetup.exe")); err != nil {
			return err
		}
	case "pos":
		if err := n.copyTree(n.manifest.PosRoot, target); err != nil {
			return err
		}
	}
	return n.ValidateStaged(kind, target)
}

func (n *nativeInstallTransitionSystem) ValidateStaged(kind, target string) error {
	info, err := os.Lstat(target)
	if err != nil || !info.IsDir() || info.Mode()&(os.ModeSymlink|os.ModeIrregular) != 0 {
		return errors.New("staged_payload_not_directory")
	}
	for _, required := range n.requiredFiles(kind) {
		if required == "" {
			return errors.New("staged_required_file_unknown")
		}
		if _, err := os.Stat(filepath.Join(target, required)); err != nil {
			return fmt.Errorf("staged_payload_missing %s", required)
		}
	}
	return nil
}

func (n *nativeInstallTransitionSystem) PayloadIntact(root string) error {
	kind := "agent"
	if pathWithinRoot(root, n.layout.POSVersionsRoot) {
		kind = "pos"
	}
	return n.ValidateStaged(kind, root)
}

// Health polls the Agent health endpoint until it reports status ok or the
// timeout expires, and returns the reported version and installation ID.
func (n *nativeInstallTransitionSystem) Health() (string, string, error) {
	deadline := time.Now().Add(n.healthTimeout)
	var lastErr error
	for {
		version, id, err := readInstallTransitionHealth(n.httpGet, n.manifest.HealthURL)
		if err == nil {
			return version, id, nil
		}
		lastErr = err
		if !time.Now().Before(deadline) {
			return "", "", fmt.Errorf("health_timeout: %w", lastErr)
		}
		time.Sleep(n.healthPoll)
	}
}

func readInstallTransitionHealth(get func(string) (*http.Response, error), url string) (string, string, error) {
	resp, err := get(url)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("health_status_%d", resp.StatusCode)
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", "", errors.New("health_payload_invalid")
	}
	if payload["status"] != "ok" || stringValue(payload["platform"]) != "win32" || stringValue(payload["architecture"]) != "x64" {
		return "", "", errors.New("health_not_ok")
	}
	return stringValue(payload["version"]), stringValue(payload["agentInstallationId"]), nil
}

func (n *nativeInstallTransitionSystem) WriteUninstallMetadata(version string) error {
	if version != n.manifest.Version {
		return errors.New("uninstall_metadata_version_mismatch")
	}
	return writeUninstallMetadata(n.layout, n.manifest)
}
