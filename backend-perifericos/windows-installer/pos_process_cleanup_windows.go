//go:build windows

package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

const posProcessTerminationTimeout = 10 * time.Second

var (
	errPOSProcessGone        = errors.New("POS process no longer exists")
	errLegacyUnownedPOSScope = errors.New("legacy_unowned_scope")
)

type posProcessClass string

const (
	posProcessManaged posProcessClass = "managed"
	posProcessLegacy  posProcessClass = "legacy"
	posProcessForeign posProcessClass = "foreign"
	posProcessUnknown posProcessClass = "unknown"
)

type scopedPOSProcessHandle interface {
	ImagePath() (string, error)
	Identity() (uint64, error)
	ProveOwnership(root, imagePath string, identity uint64) (bool, error)
	Close() error
}

type scopedPOSTerminationHandle interface {
	scopedPOSProcessHandle
	Terminate() error
	Wait(time.Duration) (bool, error)
}

type scopedPOSProcess struct {
	pid      uint32
	path     string
	identity uint64
	class    posProcessClass
	handle   scopedPOSProcessHandle
}

type scopedPOSProcessOperations interface {
	Discover(string) ([]scopedPOSProcess, error)
	AcquireTermination(scopedPOSProcess) (scopedPOSTerminationHandle, error)
}

type authorizedPOSProcess struct {
	process scopedPOSProcess
	handle  scopedPOSTerminationHandle
}

type retainedPOSProcessHandle struct {
	pid    uint32
	role   string
	handle interface {
		Close() error
	}
}

func pathWithinRoot(path, root string) bool {
	path = strings.TrimRight(strings.ToLower(filepath.Clean(path)), `\/`)
	root = strings.TrimRight(strings.ToLower(filepath.Clean(root)), `\/`)
	if path == "" || root == "" || path == root {
		return false
	}
	return strings.HasPrefix(path, root+string(filepath.Separator)) || strings.HasPrefix(path, root+"\\") || strings.HasPrefix(path, root+"/")
}

func sameWindowsPath(left, right string) bool {
	return strings.EqualFold(filepath.Clean(left), filepath.Clean(right))
}

func discoverScopedPOSProcesses(posRoot string) ([]scopedPOSProcess, error) {
	return newNativePOSProcessOperations().Discover(posRoot)
}

func closeScopedPOSProcesses(posRoot string, logger *installLogger) error {
	return closeScopedPOSProcessesWith(posRoot, logger, newNativePOSProcessOperations())
}

func closeScopedPOSProcessesWith(posRoot string, logger *installLogger, operations scopedPOSProcessOperations) (resultErr error) {
	if operations == nil {
		return errors.New("POS process operations are required")
	}

	processes, err := operations.Discover(posRoot)
	if err != nil {
		return fmt.Errorf("discover POS processes: %w", err)
	}
	retainedHandles := make([]retainedPOSProcessHandle, 0, len(processes)*2)
	for _, process := range processes {
		if process.handle != nil {
			retainedHandles = append(retainedHandles, retainedPOSProcessHandle{pid: process.pid, role: "observation", handle: process.handle})
		}
	}
	defer func() {
		for _, retained := range retainedHandles {
			if closeErr := retained.handle.Close(); closeErr != nil {
				resultErr = errors.Join(resultErr, fmt.Errorf("close POS process %d %s handle: %w", retained.pid, retained.role, closeErr))
			}
		}
	}()

	if logger != nil {
		logger.Printf("POS process discovery root=%s count=%d", posRoot, len(processes))
		for _, process := range processes {
			logger.Printf("POS process pid=%d class=%s path=%s", process.pid, process.class, process.path)
		}
	}

	authorized := make([]authorizedPOSProcess, 0, len(processes))
	var authorizationErrors []error
	for _, process := range processes {
		if process.handle == nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("POS process %d has no retained authorization handle", process.pid))
			continue
		}
		switch process.class {
		case posProcessForeign:
			continue
		case posProcessUnknown:
			authorizationErrors = append(authorizationErrors, fmt.Errorf("POS process %d ownership is unknown", process.pid))
			continue
		case posProcessLegacy:
			authorizationErrors = append(authorizationErrors, fmt.Errorf("POS process %d: %w", process.pid, errLegacyUnownedPOSScope))
			continue
		case posProcessManaged:
		default:
			authorizationErrors = append(authorizationErrors, fmt.Errorf("POS process %d has invalid classification %q", process.pid, process.class))
			continue
		}

		currentPath, pathErr := process.handle.ImagePath()
		if errors.Is(pathErr, errPOSProcessGone) {
			continue
		}
		if pathErr != nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("revalidate POS process %d image: %w", process.pid, pathErr))
			continue
		}
		currentIdentity, identityErr := process.handle.Identity()
		if errors.Is(identityErr, errPOSProcessGone) {
			continue
		}
		if identityErr != nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("revalidate POS process %d identity: %w", process.pid, identityErr))
			continue
		}
		if !pathWithinRoot(currentPath, posRoot) || !sameWindowsPath(currentPath, process.path) || currentIdentity != process.identity {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("POS process %d identity changed before termination", process.pid))
			continue
		}
		owned, ownershipErr := process.handle.ProveOwnership(posRoot, currentPath, currentIdentity)
		if ownershipErr != nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("revalidate POS process %d ownership: %w", process.pid, ownershipErr))
			continue
		}
		if !owned {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("POS process %d: %w", process.pid, errLegacyUnownedPOSScope))
			continue
		}

		terminationHandle, acquireErr := operations.AcquireTermination(process)
		if errors.Is(acquireErr, errPOSProcessGone) {
			continue
		}
		if acquireErr != nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("acquire POS process %d termination handle: %w", process.pid, acquireErr))
			continue
		}
		if terminationHandle == nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("acquire POS process %d termination handle: empty handle", process.pid))
			continue
		}
		retainedHandles = append(retainedHandles, retainedPOSProcessHandle{pid: process.pid, role: "termination", handle: terminationHandle})

		terminationPath, terminationPathErr := terminationHandle.ImagePath()
		if errors.Is(terminationPathErr, errPOSProcessGone) {
			continue
		}
		if terminationPathErr != nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("authorize POS process %d termination image: %w", process.pid, terminationPathErr))
			continue
		}
		terminationIdentity, terminationIdentityErr := terminationHandle.Identity()
		if errors.Is(terminationIdentityErr, errPOSProcessGone) {
			continue
		}
		if terminationIdentityErr != nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("authorize POS process %d termination identity: %w", process.pid, terminationIdentityErr))
			continue
		}
		if !pathWithinRoot(terminationPath, posRoot) || !sameWindowsPath(terminationPath, currentPath) || terminationIdentity != currentIdentity {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("POS process %d identity changed while acquiring termination rights", process.pid))
			continue
		}
		terminationOwned, terminationOwnershipErr := terminationHandle.ProveOwnership(posRoot, terminationPath, terminationIdentity)
		if terminationOwnershipErr != nil {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("authorize POS process %d termination ownership: %w", process.pid, terminationOwnershipErr))
			continue
		}
		if !terminationOwned {
			authorizationErrors = append(authorizationErrors, fmt.Errorf("POS process %d: %w", process.pid, errLegacyUnownedPOSScope))
			continue
		}
		authorized = append(authorized, authorizedPOSProcess{process: process, handle: terminationHandle})
	}
	if len(authorizationErrors) != 0 {
		return errors.Join(authorizationErrors...)
	}

	var cleanupErrors []error
	for _, authorizedProcess := range authorized {
		process := authorizedProcess.process
		if logger != nil {
			logger.Printf("POS managed process termination pid=%d", process.pid)
			logger.Printf("POS process bounded wait pid=%d timeout=%s", process.pid, posProcessTerminationTimeout)
		}
		if terminateErr := authorizedProcess.handle.Terminate(); terminateErr != nil {
			if errors.Is(terminateErr, errPOSProcessGone) {
				continue
			}
			cleanupErrors = append(cleanupErrors, fmt.Errorf("terminate POS process %d: %w", process.pid, terminateErr))
			continue
		}
		exited, waitErr := authorizedProcess.handle.Wait(posProcessTerminationTimeout)
		if waitErr != nil {
			cleanupErrors = append(cleanupErrors, fmt.Errorf("wait for POS process %d: %w", process.pid, waitErr))
			continue
		}
		if !exited {
			cleanupErrors = append(cleanupErrors, fmt.Errorf("POS process %d did not exit within %s", process.pid, posProcessTerminationTimeout))
		}
	}

	remaining, scanErr := operations.Discover(posRoot)
	for _, process := range remaining {
		if process.handle != nil {
			retainedHandles = append(retainedHandles, retainedPOSProcessHandle{pid: process.pid, role: "final observation", handle: process.handle})
		}
	}
	if scanErr != nil {
		cleanupErrors = append(cleanupErrors, fmt.Errorf("verify POS process exit: %w", scanErr))
	} else if len(remaining) != 0 {
		cleanupErrors = append(cleanupErrors, fmt.Errorf("%d scoped POS processes remain", len(remaining)))
	}
	if len(cleanupErrors) != 0 {
		return errors.Join(cleanupErrors...)
	}
	if logger != nil {
		logger.Printf("all POS processes exited")
	}
	return nil
}
