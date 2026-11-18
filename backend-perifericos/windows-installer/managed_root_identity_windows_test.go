//go:build windows

package main

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

type fakeManagedRootOpen struct {
	path     string
	access   uint32
	share    uint32
	creation uint32
	flags    uint32
}

type fakeManagedRootEntry struct {
	finalPath    string
	identity     managedRootFileIdentity
	attribute    managedRootAttributeTag
	finalErr     error
	identityErr  error
	attributeErr error
}

type fakeManagedRootAPI struct {
	knownFolders map[managedRootAnchor]string
	knownErr     error
	openHandles  map[string][]windows.Handle
	openErr      map[string]error
	entries      map[windows.Handle]fakeManagedRootEntry
	closeErr     map[windows.Handle]error
	opens        []fakeManagedRootOpen
	closes       map[windows.Handle]int
}

func (fake *fakeManagedRootAPI) KnownFolderPath(anchor managedRootAnchor) (string, error) {
	if fake.knownErr != nil {
		return "", fake.knownErr
	}
	path, ok := fake.knownFolders[anchor]
	if !ok {
		return "", errors.New("unknown known folder")
	}
	return path, nil
}

func (fake *fakeManagedRootAPI) OpenDirectory(path string, access, share, creation, flags uint32) (windows.Handle, error) {
	fake.opens = append(fake.opens, fakeManagedRootOpen{path, access, share, creation, flags})
	if err := fake.openErr[path]; err != nil {
		return windows.InvalidHandle, err
	}
	handles := fake.openHandles[path]
	if len(handles) == 0 {
		return windows.InvalidHandle, errors.New("no fake handle")
	}
	handle := handles[0]
	fake.openHandles[path] = handles[1:]
	return handle, nil
}

func (fake *fakeManagedRootAPI) FinalPath(handle windows.Handle) (string, error) {
	entry := fake.entries[handle]
	return entry.finalPath, entry.finalErr
}

func (fake *fakeManagedRootAPI) FileIdentity(handle windows.Handle) (managedRootFileIdentity, error) {
	entry := fake.entries[handle]
	return entry.identity, entry.identityErr
}

func (fake *fakeManagedRootAPI) AttributeTag(handle windows.Handle) (managedRootAttributeTag, error) {
	entry := fake.entries[handle]
	return entry.attribute, entry.attributeErr
}

func (fake *fakeManagedRootAPI) CloseHandle(handle windows.Handle) error {
	if fake.closes == nil {
		fake.closes = make(map[windows.Handle]int)
	}
	fake.closes[handle]++
	return fake.closeErr[handle]
}

func managedRootTestID(value byte) managedRootFileIdentity {
	var id [16]byte
	id[0] = value
	return managedRootFileIdentity{VolumeSerialNumber: 7, FileID: id}
}

func newValidManagedRootFake() *fakeManagedRootAPI {
	paths := []string{`C:\Program Files`, `C:\Program Files\MANUS`, `C:\Program Files\MANUS\POS`}
	fake := &fakeManagedRootAPI{
		knownFolders: map[managedRootAnchor]string{managedRootProgramFiles: paths[0]},
		openHandles:  make(map[string][]windows.Handle),
		openErr:      make(map[string]error),
		entries:      make(map[windows.Handle]fakeManagedRootEntry),
		closeErr:     make(map[windows.Handle]error),
		closes:       make(map[windows.Handle]int),
	}
	for index, path := range paths {
		retained := windows.Handle(index + 1)
		fresh := windows.Handle(index + 11)
		fake.openHandles[path] = []windows.Handle{retained, fresh}
		entry := fakeManagedRootEntry{
			finalPath: `\\?\` + path,
			identity:  managedRootTestID(byte(index + 1)),
			attribute: managedRootAttributeTag{FileAttributes: windows.FILE_ATTRIBUTE_DIRECTORY},
		}
		fake.entries[retained] = entry
		fake.entries[fresh] = entry
	}
	return fake
}

func observeValidManagedRoot(t *testing.T, fake *fakeManagedRootAPI) *managedRootObservation {
	t.Helper()
	observation, err := observeManagedRootIdentity(fake, managedRootIdentityRequest{
		Anchor:       managedRootProgramFiles,
		RelativePath: `MANUS\POS`,
	})
	if err != nil {
		t.Fatalf("observeManagedRootIdentity() error = %v", err)
	}
	return observation
}

func TestHUWIN002EROOT01ObserveRevalidateAndClose(t *testing.T) {
	fake := newValidManagedRootFake()
	observation := observeValidManagedRoot(t, fake)

	if err := observation.Revalidate(); err != nil {
		t.Fatalf("Revalidate() error = %v", err)
	}
	if err := observation.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	if err := observation.Close(); err != nil {
		t.Fatalf("second Close() error = %v", err)
	}

	if len(fake.opens) != 6 {
		t.Fatalf("OpenDirectory calls = %d, want 6", len(fake.opens))
	}
	for _, call := range fake.opens {
		if call.access != managedRootDesiredAccess || call.access&windows.GENERIC_WRITE != 0 {
			t.Errorf("access = %#x, want exact read attributes %#x", call.access, managedRootDesiredAccess)
		}
		if call.share != managedRootShareMode || call.creation != managedRootCreationMode || call.flags != managedRootOpenFlags {
			t.Errorf("unexpected open contract: %+v", call)
		}
	}
	for _, handle := range []windows.Handle{1, 2, 3, 11, 12, 13} {
		if fake.closes[handle] != 1 {
			t.Errorf("handle %d close count = %d, want 1", handle, fake.closes[handle])
		}
	}
}

func TestHUWIN002EROOT01RejectsInvalidRelativePaths(t *testing.T) {
	cases := []string{"", `C:\outside`, `\\server\share`, `..\escape`, `MANUS\..\escape`, `.\MANUS`, `MANUS::stream`, `\rooted`, `MANUS\\POS`, `MANUS\/POS`}
	for _, path := range cases {
		t.Run(strings.ReplaceAll(path, `\`, `_`), func(t *testing.T) {
			fake := newValidManagedRootFake()
			_, err := observeManagedRootIdentity(fake, managedRootIdentityRequest{Anchor: managedRootProgramFiles, RelativePath: path})
			if err == nil {
				t.Fatal("expected fail-closed path rejection")
			}
			if len(fake.opens) != 0 {
				t.Fatalf("OpenDirectory calls = %d, want 0", len(fake.opens))
			}
		})
	}
}

func TestHUWIN002EROOT01RejectsInvalidKnownFolders(t *testing.T) {
	cases := []string{`relative`, `C:\`, `C:\Program Files:stream`, `\\server\share`, `\\?\UNC\server\share`, `\\.\C:\Program Files`}
	for _, path := range cases {
		t.Run(strings.ReplaceAll(path, `\`, `_`), func(t *testing.T) {
			fake := newValidManagedRootFake()
			fake.knownFolders[managedRootProgramFiles] = path
			_, err := observeManagedRootIdentity(fake, managedRootIdentityRequest{Anchor: managedRootProgramFiles, RelativePath: `MANUS`})
			if err == nil {
				t.Fatal("expected fail-closed known-folder rejection")
			}
		})
	}

	t.Run("API unavailable", func(t *testing.T) {
		fake := newValidManagedRootFake()
		fake.knownErr = errors.New("not implemented")
		_, err := observeManagedRootIdentity(fake, managedRootIdentityRequest{Anchor: managedRootProgramFiles, RelativePath: `MANUS`})
		if !errors.Is(err, fake.knownErr) {
			t.Fatalf("error = %v, want API error", err)
		}
	})
}

func TestHUWIN002EROOT01RejectsIncompleteOrUnsafeObservation(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*fakeManagedRootAPI)
	}{
		{"access denied", func(fake *fakeManagedRootAPI) { fake.openErr[`C:\Program Files\MANUS`] = windows.ERROR_ACCESS_DENIED }},
		{"invalid handle", func(fake *fakeManagedRootAPI) {
			fake.openHandles[`C:\Program Files`] = []windows.Handle{windows.InvalidHandle}
		}},
		{"final path query", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.finalErr = errors.New("final failed")
			fake.entries[2] = entry
		}},
		{"file identity query", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.identityErr = errors.New("identity failed")
			fake.entries[2] = entry
		}},
		{"attribute query", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.attributeErr = errors.New("attribute failed")
			fake.entries[2] = entry
		}},
		{"final path changed", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.finalPath = `\\?\D:\foreign`
			fake.entries[2] = entry
		}},
		{"different volume", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.identity.VolumeSerialNumber = 8
			fake.entries[2] = entry
		}},
		{"zero volume", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.identity.VolumeSerialNumber = 0
			fake.entries[2] = entry
		}},
		{"zero file id", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.identity.FileID = [16]byte{}
			fake.entries[2] = entry
		}},
		{"reparse ancestor", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.attribute = managedRootAttributeTag{FileAttributes: windows.FILE_ATTRIBUTE_DIRECTORY | windows.FILE_ATTRIBUTE_REPARSE_POINT, ReparseTag: 0xa0000003}
			fake.entries[2] = entry
		}},
		{"tag without bit", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.attribute.ReparseTag = 0xa000000c
			fake.entries[2] = entry
		}},
		{"not directory", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.attribute.FileAttributes = windows.FILE_ATTRIBUTE_NORMAL
			fake.entries[2] = entry
		}},
		{"truncated attributes", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.attribute = managedRootAttributeTag{}
			fake.entries[2] = entry
		}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			fake := newValidManagedRootFake()
			test.mutate(fake)
			_, err := observeManagedRootIdentity(fake, managedRootIdentityRequest{Anchor: managedRootProgramFiles, RelativePath: `MANUS\POS`})
			if err == nil {
				t.Fatal("expected fail-closed observation error")
			}
			for handle, count := range fake.closes {
				if count != 1 {
					t.Errorf("handle %d close count = %d, want 1", handle, count)
				}
			}
		})
	}
}

func TestHUWIN002EROOT01RevalidationRejectsReplacement(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*fakeManagedRootAPI)
	}{
		{"retained query failure", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[2]
			entry.identityErr = errors.New("retained failed")
			fake.entries[2] = entry
		}},
		{"fresh open failure", func(fake *fakeManagedRootAPI) { fake.openErr[`C:\Program Files\MANUS`] = windows.ERROR_ACCESS_DENIED }},
		{"fresh final path changed", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[12]
			entry.finalPath = `\\?\C:\Program Files\MANUS-other`
			fake.entries[12] = entry
		}},
		{"fresh volume changed", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[12]
			entry.identity.VolumeSerialNumber = 8
			fake.entries[12] = entry
		}},
		{"fresh file id changed", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[12]
			entry.identity = managedRootTestID(99)
			fake.entries[12] = entry
		}},
		{"fresh becomes reparse", func(fake *fakeManagedRootAPI) {
			entry := fake.entries[12]
			entry.attribute.FileAttributes |= windows.FILE_ATTRIBUTE_REPARSE_POINT
			entry.attribute.ReparseTag = 0xa0000003
			fake.entries[12] = entry
		}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			fake := newValidManagedRootFake()
			observation := observeValidManagedRoot(t, fake)
			test.mutate(fake)
			if err := observation.Revalidate(); err == nil {
				t.Fatal("expected fail-closed revalidation error")
			}
			if err := observation.Close(); err != nil {
				t.Fatalf("Close() error = %v", err)
			}
			for handle, count := range fake.closes {
				if count != 1 {
					t.Errorf("handle %d close count = %d, want 1", handle, count)
				}
			}
		})
	}
}

func TestHUWIN002EROOT01PreservesPrimaryAndCloseErrors(t *testing.T) {
	fake := newValidManagedRootFake()
	primary := errors.New("identity unavailable")
	closeFailure := errors.New("close failed")
	entry := fake.entries[2]
	entry.identityErr = primary
	fake.entries[2] = entry
	fake.closeErr[2] = closeFailure

	_, err := observeManagedRootIdentity(fake, managedRootIdentityRequest{Anchor: managedRootProgramFiles, RelativePath: `MANUS\POS`})
	if !errors.Is(err, primary) || !errors.Is(err, closeFailure) {
		t.Fatalf("error = %v, want primary and close errors", err)
	}
	if fake.closes[2] != 1 || fake.closes[1] != 1 {
		t.Fatalf("close counts = %#v, want each opened handle once", fake.closes)
	}
}

func TestHUWIN002EROOT01RevalidatePreservesQueryAndCloseErrors(t *testing.T) {
	fake := newValidManagedRootFake()
	observation := observeValidManagedRoot(t, fake)
	primary := errors.New("fresh identity unavailable")
	closeFailure := errors.New("fresh close failed")
	entry := fake.entries[12]
	entry.identityErr = primary
	fake.entries[12] = entry
	fake.closeErr[12] = closeFailure

	err := observation.Revalidate()
	if !errors.Is(err, primary) || !errors.Is(err, closeFailure) {
		t.Fatalf("error = %v, want primary and close errors", err)
	}
	if fake.closes[12] != 1 {
		t.Fatalf("fresh handle close count = %d, want 1", fake.closes[12])
	}
	delete(fake.closeErr, 12)
	if err := observation.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
}

func TestHUWIN002EROOT01InterfaceHasNoDestructiveOperation(t *testing.T) {
	apiType := reflect.TypeOf((*managedRootIdentityAPI)(nil)).Elem()
	want := map[string]bool{
		"KnownFolderPath": true,
		"OpenDirectory":   true,
		"FinalPath":       true,
		"FileIdentity":    true,
		"AttributeTag":    true,
		"CloseHandle":     true,
	}
	if apiType.NumMethod() != len(want) {
		t.Fatalf("API method count = %d, want %d", apiType.NumMethod(), len(want))
	}
	for index := 0; index < apiType.NumMethod(); index++ {
		name := apiType.Method(index).Name
		if !want[name] {
			t.Fatalf("unexpected API method %q", name)
		}
	}
}
