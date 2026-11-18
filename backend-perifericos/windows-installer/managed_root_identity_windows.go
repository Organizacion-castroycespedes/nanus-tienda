//go:build windows

package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	managedRootDesiredAccess = windows.FILE_READ_ATTRIBUTES
	managedRootShareMode     = windows.FILE_SHARE_READ | windows.FILE_SHARE_WRITE
	managedRootCreationMode  = windows.OPEN_EXISTING
	managedRootOpenFlags     = windows.FILE_FLAG_BACKUP_SEMANTICS | windows.FILE_FLAG_OPEN_REPARSE_POINT

	managedRootFileNameNormalized = 0
	managedRootVolumeNameDOS      = 0
)

type managedRootAnchor uint8

const (
	managedRootProgramFiles managedRootAnchor = iota + 1
	managedRootProgramData
	managedRootLocalAppData
)

type managedRootIdentityRequest struct {
	Anchor       managedRootAnchor
	RelativePath string
}

type managedRootFileIdentity struct {
	VolumeSerialNumber uint64
	FileID             [16]byte
}

type managedRootAttributeTag struct {
	FileAttributes uint32
	ReparseTag     uint32
}

type managedRootIdentityAPI interface {
	KnownFolderPath(managedRootAnchor) (string, error)
	OpenDirectory(string, uint32, uint32, uint32, uint32) (windows.Handle, error)
	FinalPath(windows.Handle) (string, error)
	FileIdentity(windows.Handle) (managedRootFileIdentity, error)
	AttributeTag(windows.Handle) (managedRootAttributeTag, error)
	CloseHandle(windows.Handle) error
}

type managedRootComponentIdentity struct {
	lexicalPath string
	finalPath   string
	identity    managedRootFileIdentity
	attribute   managedRootAttributeTag
	handle      windows.Handle
	closed      bool
}

// managedRootObservation proves only the observed identity at a point in time.
// It is not authority to delete, rename, change ACLs, or perform any mutation.
type managedRootObservation struct {
	api        managedRootIdentityAPI
	anchor     managedRootAnchor
	components []managedRootComponentIdentity
	closed     bool
}

func observeManagedRootIdentity(api managedRootIdentityAPI, request managedRootIdentityRequest) (_ *managedRootObservation, retErr error) {
	if api == nil {
		return nil, errors.New("managed root observation API is nil")
	}

	parts, err := validateManagedRootRelativePath(request.RelativePath)
	if err != nil {
		return nil, err
	}

	anchorPath, err := api.KnownFolderPath(request.Anchor)
	if err != nil {
		return nil, fmt.Errorf("resolve managed root anchor: %w", err)
	}
	anchorPath, err = validateManagedRootAbsolutePath(anchorPath)
	if err != nil {
		return nil, fmt.Errorf("validate managed root anchor: %w", err)
	}

	observation := &managedRootObservation{api: api, anchor: request.Anchor}
	defer func() {
		if retErr != nil {
			retErr = errors.Join(retErr, observation.Close())
		}
	}()

	paths := make([]string, 0, len(parts)+1)
	paths = append(paths, anchorPath)
	current := anchorPath
	for _, part := range parts {
		current = filepath.Join(current, part)
		paths = append(paths, current)
	}

	for index, path := range paths {
		component, observeErr := observeManagedRootComponent(api, path)
		if observeErr != nil {
			return nil, fmt.Errorf("observe managed root component %q: %w", path, observeErr)
		}
		observation.components = append(observation.components, component)

		if index > 0 {
			parent := observation.components[index-1]
			if component.identity.VolumeSerialNumber != parent.identity.VolumeSerialNumber {
				return nil, fmt.Errorf("managed root component %q changed volume", path)
			}
			if !isStrictFinalPathChild(parent.finalPath, component.finalPath) {
				return nil, fmt.Errorf("managed root component %q escaped its observed parent", path)
			}
		}
	}

	return observation, nil
}

func (observation *managedRootObservation) Revalidate() (retErr error) {
	if observation == nil || observation.api == nil {
		return errors.New("managed root observation is nil")
	}
	if observation.closed {
		return errors.New("managed root observation is closed")
	}
	if len(observation.components) == 0 {
		return errors.New("managed root observation has no components")
	}

	for index := range observation.components {
		expected := observation.components[index]
		retained, err := queryManagedRootComponent(observation.api, expected.handle, expected.lexicalPath)
		if err != nil {
			return fmt.Errorf("revalidate retained managed root component %q: %w", expected.lexicalPath, err)
		}
		if err := compareManagedRootComponent(expected, retained); err != nil {
			return fmt.Errorf("revalidate retained managed root component %q: %w", expected.lexicalPath, err)
		}

		freshHandle, err := observation.api.OpenDirectory(
			expected.lexicalPath,
			managedRootDesiredAccess,
			managedRootShareMode,
			managedRootCreationMode,
			managedRootOpenFlags,
		)
		if err != nil {
			return fmt.Errorf("reopen managed root component %q: %w", expected.lexicalPath, err)
		}
		if !validManagedRootHandle(freshHandle) {
			return fmt.Errorf("reopen managed root component %q: invalid handle", expected.lexicalPath)
		}

		freshClosed := false
		closeFresh := func() error {
			if freshClosed {
				return nil
			}
			freshClosed = true
			return observation.api.CloseHandle(freshHandle)
		}

		fresh, queryErr := queryManagedRootComponent(observation.api, freshHandle, expected.lexicalPath)
		if queryErr == nil {
			queryErr = compareManagedRootComponent(expected, fresh)
		}
		closeErr := closeFresh()
		if queryErr != nil || closeErr != nil {
			return errors.Join(
				wrapOptionalError("revalidate fresh managed root component "+fmt.Sprintf("%q", expected.lexicalPath), queryErr),
				wrapOptionalError("close fresh managed root component "+fmt.Sprintf("%q", expected.lexicalPath), closeErr),
			)
		}
	}

	return nil
}

func (observation *managedRootObservation) Close() error {
	if observation == nil || observation.closed {
		return nil
	}
	observation.closed = true

	var closeErr error
	for index := len(observation.components) - 1; index >= 0; index-- {
		component := &observation.components[index]
		if component.closed {
			continue
		}
		component.closed = true
		if err := observation.api.CloseHandle(component.handle); err != nil {
			closeErr = errors.Join(closeErr, fmt.Errorf("close managed root component %q: %w", component.lexicalPath, err))
		}
	}
	return closeErr
}

func observeManagedRootComponent(api managedRootIdentityAPI, path string) (managedRootComponentIdentity, error) {
	handle, err := api.OpenDirectory(path, managedRootDesiredAccess, managedRootShareMode, managedRootCreationMode, managedRootOpenFlags)
	if err != nil {
		return managedRootComponentIdentity{}, err
	}
	if !validManagedRootHandle(handle) {
		return managedRootComponentIdentity{}, errors.New("native API returned an invalid directory handle")
	}

	component, queryErr := queryManagedRootComponent(api, handle, path)
	if queryErr != nil {
		return managedRootComponentIdentity{}, errors.Join(queryErr, wrapOptionalError("close rejected managed root handle", api.CloseHandle(handle)))
	}
	return component, nil
}

func queryManagedRootComponent(api managedRootIdentityAPI, handle windows.Handle, lexicalPath string) (managedRootComponentIdentity, error) {
	finalPath, err := api.FinalPath(handle)
	if err != nil {
		return managedRootComponentIdentity{}, fmt.Errorf("query final path: %w", err)
	}
	finalPath, err = normalizeManagedRootFinalPath(finalPath)
	if err != nil {
		return managedRootComponentIdentity{}, fmt.Errorf("validate final path: %w", err)
	}
	expectedPath, err := normalizeManagedRootFinalPath(lexicalPath)
	if err != nil {
		return managedRootComponentIdentity{}, fmt.Errorf("validate lexical path: %w", err)
	}
	if !strings.EqualFold(expectedPath, finalPath) {
		return managedRootComponentIdentity{}, fmt.Errorf("final path %q differs from lexical path %q", finalPath, expectedPath)
	}

	identity, err := api.FileIdentity(handle)
	if err != nil {
		return managedRootComponentIdentity{}, fmt.Errorf("query file identity: %w", err)
	}
	if identity.VolumeSerialNumber == 0 || isZeroFileID(identity.FileID) {
		return managedRootComponentIdentity{}, errors.New("file identity metadata is incomplete")
	}

	attribute, err := api.AttributeTag(handle)
	if err != nil {
		return managedRootComponentIdentity{}, fmt.Errorf("query file attributes: %w", err)
	}
	if attribute.FileAttributes == 0 {
		return managedRootComponentIdentity{}, errors.New("file attribute metadata is incomplete")
	}
	if attribute.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY == 0 {
		return managedRootComponentIdentity{}, errors.New("observed object is not a directory")
	}
	if attribute.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 || attribute.ReparseTag != 0 {
		return managedRootComponentIdentity{}, fmt.Errorf("reparse point is not authorized (tag %#x)", attribute.ReparseTag)
	}

	return managedRootComponentIdentity{
		lexicalPath: lexicalPath,
		finalPath:   finalPath,
		identity:    identity,
		attribute:   attribute,
		handle:      handle,
	}, nil
}

func compareManagedRootComponent(expected, actual managedRootComponentIdentity) error {
	if !strings.EqualFold(expected.finalPath, actual.finalPath) {
		return errors.New("final path identity changed")
	}
	if expected.identity != actual.identity {
		return errors.New("volume or file identity changed")
	}
	if expected.attribute != actual.attribute {
		return errors.New("file attributes or reparse tag changed")
	}
	return nil
}

func validateManagedRootRelativePath(path string) ([]string, error) {
	if path == "" {
		return nil, errors.New("managed root relative path is empty")
	}
	if filepath.IsAbs(path) || filepath.VolumeName(path) != "" || strings.HasPrefix(path, `\`) || strings.HasPrefix(path, `/`) {
		return nil, errors.New("managed root relative path must be relative")
	}
	if strings.Contains(path, ":") {
		return nil, errors.New("managed root relative path contains a volume or alternate stream")
	}

	normalized := strings.ReplaceAll(path, "/", `\`)
	parts := strings.Split(normalized, `\`)
	if len(parts) == 0 {
		return nil, errors.New("managed root relative path has no components")
	}
	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return nil, errors.New("managed root relative path contains traversal")
		}
	}
	return parts, nil
}

func validateManagedRootAbsolutePath(path string) (string, error) {
	clean, err := normalizeManagedRootFinalPath(path)
	if err != nil {
		return "", err
	}
	volume := filepath.VolumeName(clean)
	if volume == "" || !filepath.IsAbs(clean) {
		return "", errors.New("path is not an absolute local DOS path")
	}
	if strings.EqualFold(clean, volume+`\`) {
		return "", errors.New("volume root is not an authorized managed root")
	}
	return clean, nil
}

func normalizeManagedRootFinalPath(path string) (string, error) {
	if path == "" {
		return "", errors.New("path is empty")
	}
	if strings.HasPrefix(strings.ToLower(path), `\\?\unc\`) || strings.HasPrefix(path, `\\`) && !strings.HasPrefix(path, `\\?\`) {
		return "", errors.New("UNC path is not authorized")
	}
	if strings.HasPrefix(path, `\\.\`) || strings.HasPrefix(path, `\??\`) {
		return "", errors.New("device namespace path is not authorized")
	}
	if strings.HasPrefix(path, `\\?\`) {
		path = path[4:]
	}
	clean := filepath.Clean(path)
	if clean == "." || filepath.VolumeName(clean) == "" || !filepath.IsAbs(clean) {
		return "", errors.New("path is not an absolute local DOS path")
	}
	volume := filepath.VolumeName(clean)
	if strings.Contains(clean[len(volume):], ":") {
		return "", errors.New("path contains an alternate data stream")
	}
	return clean, nil
}

func isStrictFinalPathChild(parent, child string) bool {
	relative, err := filepath.Rel(parent, child)
	if err != nil || relative == "." || relative == ".." || filepath.IsAbs(relative) {
		return false
	}
	return !strings.HasPrefix(relative, `..\`) && !strings.HasPrefix(relative, `../`)
}

func validManagedRootHandle(handle windows.Handle) bool {
	return handle != 0 && handle != windows.InvalidHandle
}

func isZeroFileID(id [16]byte) bool {
	return id == [16]byte{}
}

func wrapOptionalError(operation string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", operation, err)
}

type nativeManagedRootIdentityAPI struct{}

func (nativeManagedRootIdentityAPI) KnownFolderPath(anchor managedRootAnchor) (string, error) {
	var folderID *windows.KNOWNFOLDERID
	switch anchor {
	case managedRootProgramFiles:
		folderID = windows.FOLDERID_ProgramFiles
	case managedRootProgramData:
		folderID = windows.FOLDERID_ProgramData
	case managedRootLocalAppData:
		folderID = windows.FOLDERID_LocalAppData
	default:
		return "", fmt.Errorf("managed root anchor %d is not authorized", anchor)
	}
	return windows.KnownFolderPath(folderID, windows.KF_FLAG_DEFAULT)
}

func (nativeManagedRootIdentityAPI) OpenDirectory(path string, access, share, creation, flags uint32) (windows.Handle, error) {
	pathPointer, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return windows.InvalidHandle, err
	}
	return windows.CreateFile(pathPointer, access, share, nil, creation, flags, 0)
}

func (nativeManagedRootIdentityAPI) FinalPath(handle windows.Handle) (string, error) {
	buffer := make([]uint16, 512)
	for {
		length, err := windows.GetFinalPathNameByHandle(
			handle,
			&buffer[0],
			uint32(len(buffer)),
			managedRootFileNameNormalized|managedRootVolumeNameDOS,
		)
		if err != nil {
			return "", err
		}
		if length == 0 {
			return "", errors.New("GetFinalPathNameByHandle returned an empty path")
		}
		if length < uint32(len(buffer)) {
			return windows.UTF16ToString(buffer[:length]), nil
		}
		buffer = make([]uint16, length+1)
	}
}

type managedRootNativeFileIDInfo struct {
	VolumeSerialNumber uint64
	FileID             [16]byte
}

func (nativeManagedRootIdentityAPI) FileIdentity(handle windows.Handle) (managedRootFileIdentity, error) {
	var info managedRootNativeFileIDInfo
	err := windows.GetFileInformationByHandleEx(
		handle,
		windows.FileIdInfo,
		(*byte)(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)
	if err != nil {
		return managedRootFileIdentity{}, err
	}
	return managedRootFileIdentity{VolumeSerialNumber: info.VolumeSerialNumber, FileID: info.FileID}, nil
}

type managedRootNativeAttributeTagInfo struct {
	FileAttributes uint32
	ReparseTag     uint32
}

func (nativeManagedRootIdentityAPI) AttributeTag(handle windows.Handle) (managedRootAttributeTag, error) {
	var info managedRootNativeAttributeTagInfo
	err := windows.GetFileInformationByHandleEx(
		handle,
		windows.FileAttributeTagInfo,
		(*byte)(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)
	if err != nil {
		return managedRootAttributeTag{}, err
	}
	return managedRootAttributeTag{FileAttributes: info.FileAttributes, ReparseTag: info.ReparseTag}, nil
}

func (nativeManagedRootIdentityAPI) CloseHandle(handle windows.Handle) error {
	return windows.CloseHandle(handle)
}
