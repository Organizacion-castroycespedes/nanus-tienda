//go:build windows

package main

import (
	"errors"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

type r6RegistryAction struct {
	kind   string
	path   string
	access uint32
	view   uint32
}

type r6RegistryKey struct {
	strings map[string]string
	dwords  map[string]uint32
}

func (k *r6RegistryKey) Close() error { return nil }
func (k *r6RegistryKey) SetStringValue(name, value string) error {
	k.strings[name] = value
	return nil
}
func (k *r6RegistryKey) SetDWordValue(name string, value uint32) error {
	k.dwords[name] = value
	return nil
}

type r6RegistryStore struct {
	actions   []r6RegistryAction
	key       *r6RegistryKey
	createErr error
	openErr   error
	deleteErr error
}

func (s *r6RegistryStore) Create(path string, access uint32) (uninstallRegistryKey, error) {
	s.actions = append(s.actions, r6RegistryAction{kind: "create", path: path, access: access, view: access & (registry.WOW64_32KEY | registry.WOW64_64KEY)})
	if s.createErr != nil {
		return nil, s.createErr
	}
	return s.key, nil
}

func (s *r6RegistryStore) Open(path string, access uint32) (uninstallRegistryKey, error) {
	s.actions = append(s.actions, r6RegistryAction{kind: "open", path: path, access: access, view: access & (registry.WOW64_32KEY | registry.WOW64_64KEY)})
	if s.openErr != nil {
		return nil, s.openErr
	}
	return s.key, nil
}

func (s *r6RegistryStore) Delete(path string, view uint32) error {
	s.actions = append(s.actions, r6RegistryAction{kind: "delete", path: path, view: view})
	return s.deleteErr
}

func TestR6RegistryOperationsUseOneCanonicalPathAndView(t *testing.T) {
	if strings.Contains(uninstallRegistryPath, `\\`) {
		t.Fatalf("canonical registry path contains a doubled separator: %q", uninstallRegistryPath)
	}
	manifest := installerManifest{DisplayName: "Manus Peripheral Agent", Version: "0.1.1-qa.13"}
	layout := buildLayout(manifest)
	if layout.RegistryKey != uninstallRegistryPath {
		t.Fatalf("layout registry path mismatch: %q", layout.RegistryKey)
	}
	store := &r6RegistryStore{key: &r6RegistryKey{strings: map[string]string{}, dwords: map[string]uint32{}}}
	previous := uninstallRegistryOps
	uninstallRegistryOps = store
	t.Cleanup(func() { uninstallRegistryOps = previous })

	if err := writeUninstallMetadata(layout, manifest); err != nil {
		t.Fatalf("write metadata: %v", err)
	}
	present, err := uninstallMetadataPresent(manifest)
	if err != nil || !present {
		t.Fatalf("observe metadata: present=%t err=%v", present, err)
	}
	if err := deleteUninstallMetadata(manifest); err != nil {
		t.Fatalf("delete metadata: %v", err)
	}
	if len(store.actions) != 3 {
		t.Fatalf("unexpected registry action count: %d", len(store.actions))
	}
	for _, action := range store.actions {
		if action.path != uninstallRegistryPath {
			t.Fatalf("%s used non-canonical path %q", action.kind, action.path)
		}
		if action.kind != "delete" && action.view != uninstallRegistryView {
			t.Fatalf("%s used registry view %#x, want %#x", action.kind, action.view, uninstallRegistryView)
		}
		if action.kind == "delete" && action.view != uninstallRegistryView {
			t.Fatalf("delete used registry view %#x, want %#x", action.view, uninstallRegistryView)
		}
	}
	if store.key.strings["DisplayName"] != manifest.DisplayName || store.key.strings["DisplayVersion"] != manifest.Version {
		t.Fatalf("representative uninstall metadata was not written: %#v", store.key.strings)
	}
	if store.key.dwords["NoModify"] != 1 || store.key.dwords["NoRepair"] != 1 {
		t.Fatalf("uninstall flags were not written: %#v", store.key.dwords)
	}
}

func TestR6RegistryMissingKeyIsIdempotentAndFailuresPropagate(t *testing.T) {
	manifest := installerManifest{}
	missing := &r6RegistryStore{key: &r6RegistryKey{strings: map[string]string{}, dwords: map[string]uint32{}}, openErr: windows.ERROR_FILE_NOT_FOUND, deleteErr: windows.ERROR_FILE_NOT_FOUND}
	previous := uninstallRegistryOps
	uninstallRegistryOps = missing
	t.Cleanup(func() { uninstallRegistryOps = previous })
	present, err := uninstallMetadataPresent(manifest)
	if err != nil || present {
		t.Fatalf("missing registry key was not treated as absent: present=%t err=%v", present, err)
	}
	if err := deleteUninstallMetadata(manifest); err != nil {
		t.Fatalf("missing registry delete was not idempotent: %v", err)
	}

	missing.openErr = errors.New("registry access denied")
	if _, err := uninstallMetadataPresent(manifest); err == nil {
		t.Fatal("registry observation failure was swallowed")
	}
	missing.deleteErr = errors.New("registry delete denied")
	if err := deleteUninstallMetadata(manifest); err == nil {
		t.Fatal("registry delete failure was swallowed")
	}
}

type r6POSHandle struct {
	path        string
	identity    uint64
	pathErr     error
	identityErr error
	terminate   error
	waitExited  bool
	terminated  bool
}

func (h *r6POSHandle) ImagePath() (string, error)       { return h.path, h.pathErr }
func (h *r6POSHandle) Identity() (uint64, error)        { return h.identity, h.identityErr }
func (h *r6POSHandle) Terminate() error                 { h.terminated = true; return h.terminate }
func (h *r6POSHandle) Wait(time.Duration) (bool, error) { return h.waitExited, nil }
func (h *r6POSHandle) Close()                           {}

type r6POSOps struct {
	discoveries   [][]scopedPOSProcess
	discoverErrs  map[int]error
	handles       map[uint32]scopedPOSProcessHandle
	discoverCalls int
}

func (o *r6POSOps) Discover(string) ([]scopedPOSProcess, error) {
	index := o.discoverCalls
	o.discoverCalls++
	if err := o.discoverErrs[index]; err != nil {
		return nil, err
	}
	if index >= len(o.discoveries) {
		return nil, nil
	}
	return o.discoveries[index], nil
}

func (o *r6POSOps) Open(process scopedPOSProcess) (scopedPOSProcessHandle, error) {
	return o.handles[process.pid], nil
}

func TestR6DiscoveryAccessDeniedFailsClosed(t *testing.T) {
	ops := &r6POSOps{discoverErrs: map[int]error{0: errors.New("access denied")}}
	if err := closeScopedPOSProcessesWith(`C:\POS`, nil, ops); err == nil {
		t.Fatal("access-denied discovery must fail closed")
	}
}

func TestR6DiscoveryQueryFailuresFailClosedWithoutTermination(t *testing.T) {
	for name, handle := range map[string]*r6POSHandle{
		"image path": {pathErr: errors.New("image path unavailable")},
		"identity":   {path: `C:\POS\Manus POS.exe`, identityErr: errors.New("identity unavailable")},
	} {
		t.Run(name, func(t *testing.T) {
			ops := &r6POSOps{
				discoveries: [][]scopedPOSProcess{{{pid: 501, path: `C:\POS\Manus POS.exe`, identity: 1}}, {}},
				handles:     map[uint32]scopedPOSProcessHandle{501: handle},
			}
			if err := closeScopedPOSProcessesWith(`C:\POS`, nil, ops); err == nil {
				t.Fatal("query failure must fail closed")
			}
			if handle.terminated {
				t.Fatal("uninspectable process was treated as terminated")
			}
		})
	}
}

func TestR6FinalScanFailureCannotReportSuccess(t *testing.T) {
	handle := &r6POSHandle{path: `C:\POS\Manus POS.exe`, identity: 1, waitExited: true}
	ops := &r6POSOps{
		discoveries:  [][]scopedPOSProcess{{{pid: 502, path: `C:\POS\Manus POS.exe`, identity: 1}}, {}},
		discoverErrs: map[int]error{1: errors.New("final scan access denied")},
		handles:      map[uint32]scopedPOSProcessHandle{502: handle},
	}
	if err := closeScopedPOSProcessesWith(`C:\POS`, nil, ops); err == nil {
		t.Fatal("final scan failure must not report success")
	}
}
