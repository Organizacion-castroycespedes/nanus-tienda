//go:build windows

package main

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"path/filepath"
	"runtime"
	"strings"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	managedTreeShare           = windows.FILE_SHARE_READ | windows.FILE_SHARE_WRITE
	managedTreeObjectFlags     = windows.OBJ_DONT_REPARSE
	managedTreeMaxPages        = 128
	managedTreeMaxChildren     = 4096
	managedTreeDirectoryHeader = 88 // FILE_ID_EXTD_DIR_INFO.FileName offset on Windows AMD64.
)

type managedTreeEntry struct {
	Name      string
	FileID    [16]byte
	Attribute managedRootAttributeTag
}

// No mutation capability belongs in this interface. Root handles are borrowed;
// every successfully opened relative handle belongs to the observation call.
type managedTreeAPI interface {
	OpenRelative(windows.Handle, string, uint32, uint32, uint32, uint32, uint32) (windows.Handle, error)
	ReadDirectory(windows.Handle, bool) ([]managedTreeEntry, bool, error)
	FileSystem(windows.Handle) (string, error)
	FileIdentity(windows.Handle) (managedRootFileIdentity, error)
	AttributeTag(windows.Handle) (managedRootAttributeTag, error)
	CloseHandle(windows.Handle) error
}

type managedTreeChildObservation struct {
	Name      string
	Identity  managedRootFileIdentity
	Attribute managedRootAttributeTag
}

// This is a completed direct-child enumeration at observation time, not an
// atomic snapshot, recursive clean-tree proof, or permission to delete anything.
// The caller must keep ROOT-01 open and must not concurrently Close/Revalidate it.
type managedTreeObservation struct {
	Parent   managedRootFileIdentity
	Children []managedTreeChildObservation
}

// ROOT-05A is a model, not a Windows mutation capability. Simulated handles are
// deliberately not windows.Handle. Only test fakes implement the two sealed
// interfaces below; there is no native adapter, controller or product caller.
type managedTreeSimulatedHandle uint64

type managedTreeSimulationState string

const (
	managedTreeSimulationPrepared  managedTreeSimulationState = "prepared"
	managedTreeSimulationRejected  managedTreeSimulationState = "rejected"
	managedTreeSimulationPartial   managedTreeSimulationState = "partial"
	managedTreeSimulationFailed    managedTreeSimulationState = "failed"
	managedTreeSimulationCompleted managedTreeSimulationState = "completed-simulated"
)

// The retained ROOT-01 root is also the parent: only one direct child is modeled.
// OperationID is correlation data, not a token, SID or production authority.
type managedTreeSimulationBinding struct {
	OperationID [16]byte
	Root        managedRootFileIdentity
	Parent      windows.Handle
	Child       managedTreeChildObservation
}

type managedTreeFixtureSimulationAuthority interface {
	managedTreeFixtureSimulationOnly()
	authorizeSimulation(managedTreeSimulationBinding) error
}

type managedTreeSimulatedOpen struct {
	Parent                                     windows.Handle
	Name                                       string
	Access, Share, Flags, Disposition, Options uint32
}

type managedTreeSimulatedMetadata struct {
	Identity      managedRootFileIdentity
	Attribute     managedRootAttributeTag
	Complete      bool
	LinkCount     uint32
	DeletePending bool
}

type managedTreeSimulatedPostconditions struct {
	Binding                                                            managedTreeSimulationBinding
	EnumerationComplete, Absent, AncestorsUnchanged, SentinelUnchanged bool
}

type managedTreeFileSimulationAPI interface {
	managedTreeAPI // Unchanged read-only observation operations, exercised by fakes.
	managedTreeSimulationOnly()
	simulationAcquire(managedTreeSimulatedOpen) (managedTreeSimulatedHandle, error)
	simulationMetadata(managedTreeSimulatedHandle) (managedTreeSimulatedMetadata, error)
	simulationClose(managedTreeSimulatedHandle) error
	simulationDisposition(managedTreeSimulatedHandle, uint32, [1]byte) (bool, error)
	simulationPostconditions(managedTreeSimulationBinding) (managedTreeSimulatedPostconditions, error)
}

type managedTreeSimulationResult struct {
	State                             managedTreeSimulationState
	Simulated                         bool
	Attempted, Marked, VerifiedAbsent bool
}

// On successful preparation the caller owns this model and must defer close or
// invoke simulateDisposition, which closes it on every path. ROOT-01 is borrowed;
// the caller must retain it and must not concurrently mutate/revalidate/close it.
type managedTreeFileSimulation struct {
	api                               managedTreeFileSimulationAPI
	authority                         managedTreeFixtureSimulationAuthority
	ctx                               context.Context
	root                              *managedRootObservation
	anchor                            managedRootAnchor
	components                        []managedRootComponentIdentity
	binding                           managedTreeSimulationBinding
	guard, target                     managedTreeSimulatedHandle
	owned                             []managedTreeSimulatedHandle
	closed, used                      bool
	state                             managedTreeSimulationState
	attempted, marked, verifiedAbsent bool
}

func prepareManagedTreeFileSimulation(ctx context.Context, api managedTreeFileSimulationAPI, authority managedTreeFixtureSimulationAuthority, root *managedRootObservation, operation [16]byte, name string) (prepared *managedTreeFileSimulation, result managedTreeSimulationResult, retErr error) {
	p := &managedTreeFileSimulation{ctx: ctx, api: api, authority: authority, root: root, state: managedTreeSimulationRejected}
	defer func() {
		if retErr != nil {
			if closeErr := p.close(); closeErr != nil {
				retErr = errors.Join(retErr, closeErr)
				p.state = managedTreeSimulationFailed
			}
			prepared = nil
		}
		result = p.result()
	}()
	if ctx == nil || api == nil || authority == nil || operation == [16]byte{} {
		return nil, result, errors.New("simulation requires context, fake APIs and explicit fixture authority/operation")
	}
	if err := validateManagedTreeName(name); err != nil {
		return nil, result, err
	}
	if strings.EqualFold(name, "current") {
		return nil, result, errors.New("current is outside single-file simulation scope")
	}
	if err := validateManagedTreeSimulationRoot(root); err != nil {
		return nil, result, err
	}
	p.anchor = root.anchor
	p.components = append([]managedRootComponentIdentity(nil), root.components...)
	if err := ctx.Err(); err != nil {
		return nil, result, err
	}
	p.state = managedTreeSimulationFailed
	observation, err := observeManagedTreeChildren(api, root)
	if err != nil {
		return nil, result, err
	}
	parent := root.components[len(root.components)-1]
	p.binding = managedTreeSimulationBinding{OperationID: operation, Root: parent.identity, Parent: parent.handle}
	if observation == nil || observation.Parent != parent.identity {
		return nil, result, errors.New("simulation parent observation mismatched")
	}
	found := false
	for _, child := range observation.Children {
		if child.Name == name {
			p.binding.Child, found = child, true
		}
	}
	if !found {
		p.state = managedTreeSimulationRejected
		return nil, result, errors.New("simulation child was not completely observed within parent")
	}
	if err := validateManagedTreeAttribute(p.binding.Child.Attribute); err != nil {
		return nil, result, err
	}
	if p.binding.Child.Attribute.FileAttributes&(windows.FILE_ATTRIBUTE_DIRECTORY|windows.FILE_ATTRIBUTE_READONLY|windows.FILE_ATTRIBUTE_OFFLINE) != 0 {
		return nil, result, errors.New("simulation observed child is not an eligible ordinary file")
	}
	for _, component := range root.components {
		if p.binding.Child.Identity == component.identity {
			return nil, result, errors.New("simulation child aliased a root/ancestor identity")
		}
	}
	if err := ctx.Err(); err != nil {
		return nil, result, err
	}
	// Share/access are hypotheses carried to a fake, never requested from Windows.
	p.guard, err = p.acquire(windows.FILE_READ_ATTRIBUTES, 7)
	if err != nil {
		return nil, result, err
	}
	if err := p.validateHandle(p.guard); err != nil {
		return nil, result, err
	}
	if err := authority.authorizeSimulation(p.binding); err != nil {
		p.state = managedTreeSimulationRejected
		return nil, result, fmt.Errorf("fixture simulation authorization: %w", err)
	}
	if err := ctx.Err(); err != nil {
		return nil, result, err
	}
	p.target, err = p.acquire(0x10080, 1)
	if err != nil {
		return nil, result, err
	}
	if err := p.revalidate(); err != nil {
		return nil, result, err
	}
	p.state = managedTreeSimulationPrepared
	return p, result, nil
}

func validateManagedTreeSimulationRoot(root *managedRootObservation) error {
	if root == nil || root.api == nil || root.closed || len(root.components) < 2 {
		return errors.New("simulation requires a live ROOT-01 root and ancestors")
	}
	seen := make(map[windows.Handle]bool)
	volume := root.components[0].identity.VolumeSerialNumber
	for _, c := range root.components {
		if c.closed || !validManagedRootHandle(c.handle) || seen[c.handle] || volume == 0 || c.identity.VolumeSerialNumber != volume || isZeroFileID(c.identity.FileID) || c.attribute.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY == 0 {
			return errors.New("simulation root/ancestor handle or identity invalid")
		}
		if err := validateManagedTreeAttribute(c.attribute); err != nil {
			return err
		}
		seen[c.handle] = true
	}
	return nil
}

func validateManagedTreeSimulationFile(actual managedTreeSimulatedMetadata, expected managedTreeChildObservation) error {
	if err := validateManagedTreeAttribute(actual.Attribute); err != nil {
		return err
	}
	blocked := uint32(windows.FILE_ATTRIBUTE_DIRECTORY | windows.FILE_ATTRIBUTE_READONLY | windows.FILE_ATTRIBUTE_OFFLINE)
	if !actual.Complete || actual.LinkCount != 1 || actual.DeletePending || actual.Attribute.FileAttributes&blocked != 0 || actual.Identity.VolumeSerialNumber == 0 || isZeroFileID(actual.Identity.FileID) || actual.Identity != expected.Identity || actual.Attribute != expected.Attribute {
		return errors.New("simulation requires complete unchanged ordinary single-link file metadata")
	}
	return nil
}

func (p *managedTreeFileSimulation) acquire(access, share uint32) (managedTreeSimulatedHandle, error) {
	if err := p.ctx.Err(); err != nil {
		return 0, err
	}
	h, err := p.api.simulationAcquire(managedTreeSimulatedOpen{Parent: p.binding.Parent, Name: p.binding.Child.Name, Access: access, Share: share, Flags: managedTreeObjectFlags, Disposition: windows.FILE_OPEN, Options: windows.FILE_OPEN_REPARSE_POINT | windows.FILE_NON_DIRECTORY_FILE})
	for _, existing := range p.owned {
		if h == existing {
			return 0, errors.Join(err, errors.New("simulation acquisition aliased a live handle"))
		}
	}
	if h != 0 && h != ^managedTreeSimulatedHandle(0) {
		p.owned = append(p.owned, h) // A valid handle accompanying an error is owned too.
	} else {
		err = errors.Join(err, errors.New("invalid simulated handle"))
	}
	return h, errors.Join(err, p.ctx.Err())
}

func (p *managedTreeFileSimulation) validateHandle(h managedTreeSimulatedHandle) error {
	if err := p.ctx.Err(); err != nil {
		return err
	}
	metadata, err := p.api.simulationMetadata(h)
	if err != nil {
		return err
	}
	return errors.Join(validateManagedTreeSimulationFile(metadata, p.binding.Child), p.ctx.Err())
}

func (p *managedTreeFileSimulation) validateRetainedScope() error {
	if err := validateManagedTreeSimulationRoot(p.root); err != nil {
		return err
	}
	if p.root.anchor != p.anchor || len(p.root.components) != len(p.components) {
		return errors.New("simulation root/ancestor scope changed")
	}
	for i, expected := range p.components {
		if p.root.components[i] != expected {
			return errors.New("simulation root/ancestor snapshot changed")
		}
	}
	parent := p.root.components[len(p.root.components)-1]
	if parent.identity != p.binding.Root || parent.handle != p.binding.Parent {
		return errors.New("simulation retained parent binding changed")
	}
	return nil
}

func (p *managedTreeFileSimulation) revalidateParent() error {
	if err := p.ctx.Err(); err != nil {
		return err
	}
	if err := p.validateRetainedScope(); err != nil {
		return err
	}
	if err := p.root.Revalidate(); err != nil {
		return err
	}
	// Compare to the original authorization again, including after a post-scan.
	if err := p.validateRetainedScope(); err != nil {
		return err
	}
	fs, err := p.api.FileSystem(p.binding.Parent)
	if err != nil || fs != "NTFS" {
		return errors.Join(err, errors.New("simulation requires known NTFS"))
	}
	return p.ctx.Err()
}

func (p *managedTreeFileSimulation) revalidate() error {
	if err := p.revalidateParent(); err != nil {
		return err
	}
	for _, h := range []managedTreeSimulatedHandle{p.guard, p.target} {
		if err := p.validateHandle(h); err != nil {
			return err
		}
	}
	if err := p.authority.authorizeSimulation(p.binding); err != nil {
		return err
	}
	return p.ctx.Err()
}

func (p *managedTreeFileSimulation) result() managedTreeSimulationResult {
	return managedTreeSimulationResult{State: p.state, Simulated: true, Attempted: p.attempted, Marked: p.marked, VerifiedAbsent: p.verifiedAbsent}
}

func (p *managedTreeFileSimulation) close() error {
	if p == nil || p.closed {
		return nil
	}
	p.closed = true
	var closeErr error
	// Original guard first, final target last. No blind retry after close error.
	for _, h := range p.owned {
		closeErr = errors.Join(closeErr, wrapOptionalError("close simulated handle", p.api.simulationClose(h)))
	}
	p.owned = nil
	return closeErr
}

func (p *managedTreeFileSimulation) simulateDisposition() (result managedTreeSimulationResult, retErr error) {
	if p == nil {
		return managedTreeSimulationResult{State: managedTreeSimulationRejected, Simulated: true}, errors.New("nil simulation preparation")
	}
	defer func() {
		if closeErr := p.close(); closeErr != nil {
			retErr = errors.Join(retErr, closeErr)
		}
		if retErr != nil {
			p.verifiedAbsent = false
			p.state = managedTreeSimulationFailed
			if p.attempted {
				p.state = managedTreeSimulationPartial
			}
		}
		result = p.result()
	}()
	if p.closed || p.used || p.state != managedTreeSimulationPrepared {
		return result, errors.New("simulation is not a live unused preparation")
	}
	p.used = true
	if err := p.revalidate(); err != nil {
		return result, err
	}
	p.attempted = true
	accepted, err := p.api.simulationDisposition(p.target, windows.FileDispositionInfo, [1]byte{1})
	p.marked = accepted
	// From this point neither target nor guard receives I/O except close.
	closeErr := p.close()
	if err != nil || closeErr != nil || !accepted {
		return result, errors.Join(err, closeErr, errors.New("simulated disposition not verified"))
	}
	if err := p.ctx.Err(); err != nil {
		return result, err
	}
	if err := p.revalidateParent(); err != nil {
		return result, err
	}
	post, err := p.api.simulationPostconditions(p.binding)
	if err != nil {
		return result, err
	}
	if post.Binding != p.binding || !post.EnumerationComplete || !post.Absent || !post.AncestorsUnchanged || !post.SentinelUnchanged {
		return result, errors.New("simulated absence/scope/sentinel postconditions are incomplete")
	}
	if err := p.revalidateParent(); err != nil {
		return result, err
	}
	p.verifiedAbsent, p.state = true, managedTreeSimulationCompleted
	return result, nil
}

func observeManagedTreeChildren(api managedTreeAPI, root *managedRootObservation) (result *managedTreeObservation, retErr error) {
	if api == nil || root == nil || root.closed || root.api == nil || len(root.components) < 2 {
		return nil, errors.New("managed tree requires a live ROOT-01 parent and ancestor")
	}
	for _, component := range root.components {
		if component.closed || !validManagedRootHandle(component.handle) {
			return nil, errors.New("managed tree ROOT-01 contains a closed or invalid handle")
		}
	}
	if err := root.Revalidate(); err != nil {
		return nil, fmt.Errorf("managed tree parent preflight: %w", err)
	}
	expected := root.components[len(root.components)-1]
	ancestor := root.components[len(root.components)-2]
	name := filepath.Base(expected.lexicalPath)
	if err := validateManagedTreeName(name); err != nil {
		return nil, err
	}
	if !strings.EqualFold(filepath.Dir(expected.lexicalPath), ancestor.lexicalPath) {
		return nil, errors.New("managed tree parent is not an immediate ROOT-01 child")
	}
	if err := compareManagedTreeMetadata(api, ancestor.handle, ancestor.identity, ancestor.attribute); err != nil {
		return nil, err
	}

	var owned []windows.Handle
	borrowed := make(map[windows.Handle]bool)
	for _, component := range root.components {
		borrowed[component.handle] = true
	}
	defer func() {
		for index := len(owned) - 1; index >= 0; index-- {
			retErr = errors.Join(retErr, wrapOptionalError("close managed tree handle", api.CloseHandle(owned[index])))
		}
		if retErr != nil {
			result = nil
		}
	}()
	open := func(parent windows.Handle, name string, directory bool) (windows.Handle, error) {
		access, options := managedTreeOpenMode(directory)
		handle, err := api.OpenRelative(parent, name, access, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, options)
		if borrowed[handle] {
			return 0, errors.New("relative open aliased a borrowed handle")
		}
		for _, existing := range owned {
			if handle == existing {
				return 0, errors.New("relative open reused a live handle")
			}
		}
		if validManagedRootHandle(handle) {
			owned = append(owned, handle)
		}
		if err != nil {
			return 0, fmt.Errorf("open relative managed tree object: %w", err)
		}
		if !validManagedRootHandle(handle) {
			return 0, errors.New("invalid managed tree handle")
		}
		return handle, nil
	}
	parent, err := open(ancestor.handle, name, true)
	if err != nil {
		return nil, err
	}
	if err := compareManagedTreeMetadata(api, parent, expected.identity, expected.attribute); err != nil {
		return nil, err
	}
	fs, err := api.FileSystem(parent)
	if err != nil {
		return nil, fmt.Errorf("managed tree filesystem observation: %w", err)
	}
	if fs != "NTFS" {
		return nil, errors.New("managed tree filesystem is not supported NTFS")
	}

	result = &managedTreeObservation{Parent: expected.identity, Children: make([]managedTreeChildObservation, 0)}
	seen := make(map[string]bool)
	var childHandles []windows.Handle
	complete := false
	for page := 0; page < managedTreeMaxPages; page++ {
		entries, done, err := api.ReadDirectory(parent, page == 0)
		if err != nil {
			return nil, fmt.Errorf("managed tree enumeration incomplete: %w", err)
		}
		if done && len(entries) != 0 {
			return nil, errors.New("ambiguous managed tree enumeration completion")
		}
		if done {
			complete = true
			break
		}
		if len(entries) == 0 {
			return nil, errors.New("managed tree enumeration made no progress")
		}
		for _, entry := range entries {
			if err := validateManagedTreeName(entry.Name); err != nil {
				return nil, err
			}
			key := strings.ToUpper(entry.Name)
			if seen[key] || len(result.Children) >= managedTreeMaxChildren {
				return nil, errors.New("duplicate or excessive managed tree children")
			}
			seen[key] = true
			if err := validateManagedTreeAttribute(entry.Attribute); err != nil {
				return nil, err
			}
			if isZeroFileID(entry.FileID) {
				return nil, errors.New("enumerated file identity missing")
			}
			directory := entry.Attribute.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0
			child, err := open(parent, entry.Name, directory)
			if err != nil {
				return nil, err
			}
			identity := managedRootFileIdentity{VolumeSerialNumber: expected.identity.VolumeSerialNumber, FileID: entry.FileID}
			if err := compareManagedTreeMetadata(api, child, identity, entry.Attribute); err != nil {
				return nil, err
			}
			result.Children = append(result.Children, managedTreeChildObservation{Name: entry.Name, Identity: identity, Attribute: entry.Attribute})
			childHandles = append(childHandles, child)
		}
	}
	if !complete {
		return nil, errors.New("managed tree enumeration page limit reached")
	}
	for index, child := range result.Children {
		if err := compareManagedTreeMetadata(api, childHandles[index], child.Identity, child.Attribute); err != nil {
			return nil, fmt.Errorf("revalidate managed tree child: %w", err)
		}
	}
	if err := compareManagedTreeMetadata(api, parent, expected.identity, expected.attribute); err != nil {
		return nil, err
	}
	if err := compareManagedTreeMetadata(api, ancestor.handle, ancestor.identity, ancestor.attribute); err != nil {
		return nil, err
	}
	if err := root.Revalidate(); err != nil {
		return nil, fmt.Errorf("managed tree final parent validation: %w", err)
	}
	return result, nil
}

func validateManagedTreeName(name string) error {
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "\\/:\x00<>\"|?*") || strings.TrimSpace(name) != name || strings.HasSuffix(name, ".") {
		return errors.New("ambiguous managed tree child name")
	}
	for _, r := range name {
		if r < 32 || r == '\uFFFD' {
			return errors.New("invalid managed tree child character")
		}
	}
	if len(utf16.Encode([]rune(name))) > 255 {
		return errors.New("managed tree child name too long")
	}
	stem := strings.TrimRight(strings.ToUpper(strings.SplitN(name, ".", 2)[0]), " ")
	if stem == "CON" || stem == "PRN" || stem == "AUX" || stem == "NUL" || stem == "CONIN$" || stem == "CONOUT$" ||
		(len([]rune(stem)) == 4 && (strings.HasPrefix(stem, "COM") || strings.HasPrefix(stem, "LPT")) && strings.ContainsRune("123456789¹²³", []rune(stem)[3])) {
		return errors.New("reserved managed tree child name")
	}
	return nil
}

func managedTreeOpenMode(directory bool) (uint32, uint32) {
	if directory {
		return windows.FILE_READ_ATTRIBUTES | windows.FILE_LIST_DIRECTORY, windows.FILE_OPEN_REPARSE_POINT | windows.FILE_DIRECTORY_FILE
	}
	return windows.FILE_READ_ATTRIBUTES, windows.FILE_OPEN_REPARSE_POINT | windows.FILE_NON_DIRECTORY_FILE
}

func validateManagedTreeAttribute(attribute managedRootAttributeTag) error {
	if attribute.FileAttributes == 0 || attribute.FileAttributes&(windows.FILE_ATTRIBUTE_REPARSE_POINT|windows.FILE_ATTRIBUTE_DEVICE) != 0 || attribute.ReparseTag != 0 {
		return errors.New("managed tree metadata missing or reparse/device object rejected")
	}
	return nil
}

func compareManagedTreeMetadata(api managedTreeAPI, handle windows.Handle, expected managedRootFileIdentity, attribute managedRootAttributeTag) error {
	if !validManagedRootHandle(handle) || expected.VolumeSerialNumber == 0 || isZeroFileID(expected.FileID) {
		return errors.New("invalid managed tree identity")
	}
	actual, err := api.FileIdentity(handle)
	if err != nil {
		return fmt.Errorf("managed tree file identity: %w", err)
	}
	observed, err := api.AttributeTag(handle)
	if err != nil {
		return fmt.Errorf("managed tree attributes: %w", err)
	}
	if err := validateManagedTreeAttribute(observed); err != nil {
		return err
	}
	if actual != expected || observed != attribute {
		return errors.New("managed tree volume, File ID, type or attributes changed")
	}
	return nil
}

// The native implementation is intentionally unwired. No native tests run in ROOT-03.
type nativeManagedTreeAPI struct{ nativeManagedRootIdentityAPI }

func managedTreeRelativeAttributes(parent windows.Handle, name string) (*windows.OBJECT_ATTRIBUTES, error) {
	if !validManagedRootHandle(parent) {
		return nil, errors.New("invalid relative parent handle")
	}
	if err := validateManagedTreeName(name); err != nil {
		return nil, err
	}
	unicodeName, err := windows.NewNTUnicodeString(name)
	if err != nil {
		return nil, err
	}
	return &windows.OBJECT_ATTRIBUTES{Length: uint32(unsafe.Sizeof(windows.OBJECT_ATTRIBUTES{})), RootDirectory: parent, ObjectName: unicodeName, Attributes: managedTreeObjectFlags}, nil
}

func (nativeManagedTreeAPI) OpenRelative(parent windows.Handle, name string, access, share, flags, disposition, options uint32) (windows.Handle, error) {
	oa, err := managedTreeRelativeAttributes(parent, name)
	if err != nil {
		return 0, err
	}
	directory := options&windows.FILE_DIRECTORY_FILE != 0
	wantAccess, wantOptions := managedTreeOpenMode(directory)
	if access != wantAccess || share != managedTreeShare || flags != managedTreeObjectFlags || disposition != windows.FILE_OPEN || options != wantOptions {
		return 0, errors.New("non-observational relative open rejected")
	}
	if err := windows.NewLazySystemDLL("ntdll.dll").NewProc("NtCreateFile").Find(); err != nil {
		return 0, err
	}
	var handle windows.Handle
	var iosb windows.IO_STATUS_BLOCK
	err = windows.NtCreateFile(&handle, access, oa, &iosb, nil, 0, share, disposition, options, 0, 0)
	runtime.KeepAlive(oa)
	if err == nil && (iosb.Status != 0 || iosb.Information != 1) {
		err = errors.New("NtCreateFile did not confirm FILE_OPENED")
	}
	// A valid handle is returned even with an error so the owning caller closes it.
	return handle, err
}

func (nativeManagedTreeAPI) FileSystem(handle windows.Handle) (string, error) {
	if err := windows.NewLazySystemDLL("kernel32.dll").NewProc("GetVolumeInformationByHandleW").Find(); err != nil {
		return "", err
	}
	var fs [256]uint16
	if err := windows.GetVolumeInformationByHandle(handle, nil, 0, nil, nil, nil, &fs[0], uint32(len(fs))); err != nil {
		return "", err
	}
	return windows.UTF16ToString(fs[:]), nil
}

func (nativeManagedTreeAPI) ReadDirectory(handle windows.Handle, restart bool) ([]managedTreeEntry, bool, error) {
	if err := windows.NewLazySystemDLL("kernel32.dll").NewProc("GetFileInformationByHandleEx").Find(); err != nil {
		return nil, false, err
	}
	// uint64 backing preserves the documented eight-byte record alignment.
	backing := make([]uint64, 8192)
	buffer := unsafe.Slice((*byte)(unsafe.Pointer(&backing[0])), len(backing)*8)
	for page := 0; page < managedTreeMaxPages; page++ {
		clear(buffer)
		class := uint32(windows.FileIdExtdDirectoryInfo)
		if restart && page == 0 {
			class = windows.FileIdExtdDirectoryRestartInfo
		}
		err := windows.GetFileInformationByHandleEx(handle, class, &buffer[0], uint32(len(buffer)))
		if errors.Is(err, windows.ERROR_NO_MORE_FILES) {
			return nil, true, nil
		}
		if err != nil {
			return nil, false, err
		}
		entries, err := parseManagedTreeDirectoryBuffer(buffer)
		runtime.KeepAlive(backing)
		if err != nil || len(entries) != 0 {
			return entries, false, err
		}
	}
	return nil, false, errors.New("directory pages contained no observable children within limit")
}

func parseManagedTreeDirectoryBuffer(buffer []byte) ([]managedTreeEntry, error) {
	var entries []managedTreeEntry
	for offset := 0; ; {
		if len(buffer)-offset < managedTreeDirectoryHeader {
			return nil, errors.New("truncated directory record")
		}
		record := buffer[offset:]
		next := int(binary.LittleEndian.Uint32(record[0:4]))
		nameBytes := int(binary.LittleEndian.Uint32(record[60:64]))
		limit := len(record)
		if next != 0 {
			if next%8 != 0 || next < managedTreeDirectoryHeader || next > len(record)-managedTreeDirectoryHeader {
				return nil, errors.New("invalid directory record offset")
			}
			limit = next
		}
		if nameBytes == 0 || nameBytes%2 != 0 || nameBytes > 510 || nameBytes > limit-managedTreeDirectoryHeader {
			return nil, errors.New("truncated or invalid directory name")
		}
		encoded := make([]uint16, nameBytes/2)
		for i := range encoded {
			encoded[i] = binary.LittleEndian.Uint16(record[88+i*2 : 90+i*2])
		}
		name := string(utf16.Decode(encoded))
		attribute := managedRootAttributeTag{FileAttributes: binary.LittleEndian.Uint32(record[56:60])}
		// ReparsePointTag is undefined for non-reparse entries in this structure.
		if attribute.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
			attribute.ReparseTag = binary.LittleEndian.Uint32(record[68:72])
		}
		var id [16]byte
		copy(id[:], record[72:88])
		if name != "." && name != ".." {
			if err := validateManagedTreeName(name); err != nil {
				return nil, err
			}
			if isZeroFileID(id) || attribute.FileAttributes == 0 {
				return nil, errors.New("directory identity metadata missing")
			}
			entries = append(entries, managedTreeEntry{Name: name, FileID: id, Attribute: attribute})
		}
		if next == 0 {
			break
		}
		offset += next
	}
	// Dot records are never opened. The native adapter continues to an explicit
	// ERROR_NO_MORE_FILES or a non-dot page, with a bound on empty pages.
	return entries, nil
}
