//go:build windows

package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const localServiceProfileRegistryKey = `SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\S-1-5-19`

var localServiceProfileVariable = regexp.MustCompile(`%([^%]+)%`)

var readLocalServiceProfilePath = readLocalServiceProfilePathFromRegistry
var removeManagedDataTree = os.RemoveAll
var readManagedPathAttributes = readWindowsManagedPathAttributes
var repairManagedDataRemovalPermissions = repairManagedDataRemovalPermissionsWithACL
var resolveWindowsRoot = resolveWindowsRootFromAPI

func readWindowsManagedPathAttributes(path string) (uint32, error) {
	pointer, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}
	return windows.GetFileAttributes(pointer)
}

func readLocalServiceProfilePathFromRegistry() (string, error) {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, localServiceProfileRegistryKey, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err != nil {
		return "", fmt.Errorf("open LocalService profile registry key: %w", err)
	}
	defer key.Close()
	value, valueType, err := key.GetStringValue("ProfileImagePath")
	if err != nil {
		return "", fmt.Errorf("read LocalService profile path: %w", err)
	}
	if valueType != registry.SZ && valueType != registry.EXPAND_SZ {
		return "", errors.New("LocalService profile path has an unsupported registry type")
	}
	return strings.TrimSpace(value), nil
}

func resolveLocalServiceAgentDataRoot() (string, error) {
	profileRoot, err := readLocalServiceProfilePath()
	if err != nil {
		return "", err
	}
	windowsRoot, err := resolveWindowsRoot()
	if err != nil {
		return "", err
	}
	return deriveLocalServiceAgentDataRoot(expandLocalServiceProfilePath(profileRoot, windowsRoot), windowsRoot)
}

func resolveWindowsRootFromAPI() (string, error) {
	windowsRoot, err := windows.GetWindowsDirectory()
	if err != nil {
		return "", fmt.Errorf("resolve Windows directory: %w", err)
	}
	windowsRoot = filepath.Clean(strings.TrimSpace(windowsRoot))
	if windowsRoot == "." || !filepath.IsAbs(windowsRoot) {
		return "", errors.New("Windows directory resolution returned a non-absolute path")
	}
	return windowsRoot, nil
}

func expandLocalServiceProfilePath(value, windowsRoot string) string {
	windowsRoot = filepath.Clean(strings.TrimSpace(windowsRoot))
	return localServiceProfileVariable.ReplaceAllStringFunc(value, func(token string) string {
		name := token[1 : len(token)-1]
		switch {
		case strings.EqualFold(name, "SystemRoot"):
			return windowsRoot
		case strings.EqualFold(name, "SystemDrive"):
			return filepath.VolumeName(windowsRoot)
		default:
			// Unexpected variables make the resulting profile path invalid and
			// therefore fail closed in deriveLocalServiceAgentDataRoot.
			return ""
		}
	})
}

func deriveLocalServiceAgentDataRoot(profileRoot, systemRoot string) (string, error) {
	profileRoot = filepath.Clean(strings.TrimSpace(profileRoot))
	systemRoot = filepath.Clean(strings.TrimSpace(systemRoot))
	if profileRoot == "." || systemRoot == "." || !filepath.IsAbs(profileRoot) || !filepath.IsAbs(systemRoot) {
		return "", errors.New("LocalService profile resolution returned a non-absolute path")
	}
	expectedProfile := filepath.Join(systemRoot, "ServiceProfiles", "LocalService")
	if !strings.EqualFold(profileRoot, expectedProfile) {
		return "", fmt.Errorf("LocalService profile path is outside the expected Windows service profile: %s", profileRoot)
	}
	target := filepath.Join(profileRoot, "AppData", "Local", "Manus", "PeripheralAgent")
	if err := validateExactAgentDataRoot(target, target); err != nil {
		return "", err
	}
	return target, nil
}

func expectedProgramDataAgentRoot() string {
	return filepath.Join(defaultOrEnv("ProgramData", `C:\ProgramData`), "Manus", "PeripheralAgent")
}

func validateExactAgentDataRoot(target, expected string) error {
	target = filepath.Clean(strings.TrimSpace(target))
	expected = filepath.Clean(strings.TrimSpace(expected))
	if target == "." || expected == "." || !filepath.IsAbs(target) || !filepath.IsAbs(expected) {
		return errors.New("managed Agent data root must be an absolute non-empty path")
	}
	if !strings.EqualFold(target, expected) {
		return fmt.Errorf("managed Agent data root differs from expected target: %s", target)
	}
	if !strings.EqualFold(filepath.Base(target), "PeripheralAgent") || !strings.EqualFold(filepath.Base(filepath.Dir(target)), "Manus") {
		return fmt.Errorf("managed Agent data root has an unexpected suffix: %s", target)
	}
	volume := filepath.VolumeName(target)
	if volume == "" || strings.EqualFold(filepath.Clean(target), filepath.Clean(volume+string(filepath.Separator))) {
		return fmt.Errorf("managed Agent data root is too broad: %s", target)
	}
	return nil
}

func validateRemovalTreeNoReparse(target string) error {
	if !exists(target) {
		return nil
	}
	return filepath.WalkDir(target, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		attributes, err := readManagedPathAttributes(path)
		if err != nil {
			return fmt.Errorf("inspect managed removal path %s: %w", path, err)
		}
		if attributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
			return fmt.Errorf("managed removal path is a reparse point: %s", path)
		}
		return nil
	})
}

func validateExistingAncestorsNoReparse(target, boundary string) error {
	target = filepath.Clean(target)
	boundary = filepath.Clean(boundary)
	for current := target; ; current = filepath.Dir(current) {
		if exists(current) {
			attributes, err := readManagedPathAttributes(current)
			if err != nil {
				return fmt.Errorf("inspect managed removal ancestor %s: %w", current, err)
			}
			if attributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
				return fmt.Errorf("managed removal ancestor is a reparse point: %s", current)
			}
		}
		if strings.EqualFold(current, boundary) {
			return nil
		}
		next := filepath.Dir(current)
		if next == current {
			return fmt.Errorf("managed removal boundary is not an ancestor: %s", boundary)
		}
	}
}

func repairManagedDataRemovalPermissionsWithACL(path string) error {
	if output, err := runACLCommand("takeown.exe", "/f", path, "/a", "/r", "/d", "Y"); err != nil {
		return fmt.Errorf("take ownership of managed Agent data: %w (%s)", err, strings.TrimSpace(string(output)))
	}
	if output, err := runACLCommand("icacls.exe", path, "/grant:r", "*S-1-5-32-544:(OI)(CI)(F)", "/t", "/c"); err != nil {
		return fmt.Errorf("grant Administrators removal access to managed Agent data: %w (%s)", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func removeExactAgentDataRoot(target, expected string) error {
	if err := validateExactAgentDataRoot(target, expected); err != nil {
		return err
	}
	if !exists(target) {
		return nil
	}
	volume := filepath.VolumeName(target)
	if volume == "" {
		return errors.New("managed Agent data root has no volume trust anchor")
	}
	volumeRoot := filepath.Clean(volume + string(filepath.Separator))
	if err := validateExistingAncestorsNoReparse(target, volumeRoot); err != nil {
		return err
	}
	if err := validateRemovalTreeNoReparse(target); err != nil {
		return err
	}
	if err := removeManagedDataTree(target); err != nil {
		if !isManagedDataAccessDenied(err) {
			return fmt.Errorf("remove managed Agent data root: %w", err)
		}
		if err := repairManagedDataRemovalPermissions(target); err != nil {
			return err
		}
		if err := validateRemovalTreeNoReparse(target); err != nil {
			return err
		}
		if err := removeManagedDataTree(target); err != nil {
			return fmt.Errorf("remove managed Agent data root after ACL repair: %w", err)
		}
	}
	if exists(target) {
		return fmt.Errorf("managed Agent data root still exists after removal: %s", target)
	}
	return nil
}

func isManagedDataAccessDenied(err error) bool {
	return errors.Is(err, windows.ERROR_ACCESS_DENIED) || strings.Contains(strings.ToLower(err.Error()), "access denied")
}

func removeRequestedAgentData(programDataRoot string) error {
	localServiceRoot, err := resolveLocalServiceAgentDataRoot()
	if err != nil {
		return err
	}
	if err := validateExactAgentDataRoot(programDataRoot, expectedProgramDataAgentRoot()); err != nil {
		return err
	}
	// Validate both roots before mutating either one.
	if exists(programDataRoot) {
		if err := validateRemovalTreeNoReparse(programDataRoot); err != nil {
			return err
		}
	}
	if exists(localServiceRoot) {
		if err := validateRemovalTreeNoReparse(localServiceRoot); err != nil {
			return err
		}
	}
	if err := removeExactAgentDataRoot(localServiceRoot, localServiceRoot); err != nil {
		return fmt.Errorf("remove LocalService Agent data: %w", err)
	}
	if err := removeExactAgentDataRoot(programDataRoot, expectedProgramDataAgentRoot()); err != nil {
		return fmt.Errorf("remove ProgramData Agent data: %w", err)
	}
	return nil
}
