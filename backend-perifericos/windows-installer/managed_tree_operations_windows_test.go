//go:build windows

package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
	"time"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
)

// ROOT-05A implementations exist only in this _test.go file. These integer
// handles have no relationship to kernel handles. No native mutation adapter.
type root05aFake struct {
	*root03Fake
	opens         []managedTreeSimulatedOpen
	meta          map[managedTreeSimulatedHandle]managedTreeSimulatedMetadata
	allocated     map[managedTreeSimulatedHandle]bool
	closed        map[managedTreeSimulatedHandle]int
	closeErrors   map[managedTreeSimulatedHandle]error
	metadataCalls map[managedTreeSimulatedHandle]int
	events        []string
	acquireHook   func(int) (managedTreeSimulatedHandle, error)
	metadataHook  func(managedTreeSimulatedHandle, int) error
	markHook      func()
	markAccepted  bool
	markError     error
	marks         int
	markHandle    managedTreeSimulatedHandle
	markClass     uint32
	markPayload   [1]byte
	post          managedTreeSimulatedPostconditions
	postError     error
	posts         int
}

func (*root05aFake) managedTreeSimulationOnly() {}
func (f *root05aFake) simulationAcquire(request managedTreeSimulatedOpen) (managedTreeSimulatedHandle, error) {
	f.opens = append(f.opens, request)
	f.events = append(f.events, fmt.Sprintf("acquire_%d", len(f.opens)))
	h, err := managedTreeSimulatedHandle(500+len(f.opens)), error(nil)
	if f.acquireHook != nil {
		h, err = f.acquireHook(len(f.opens))
	}
	if h != 0 && h != ^managedTreeSimulatedHandle(0) {
		f.allocated[h] = true
		if _, exists := f.meta[h]; !exists {
			f.meta[h] = managedTreeSimulatedMetadata{Identity: managedRootTestID(4), Attribute: managedRootAttributeTag{FileAttributes: windows.FILE_ATTRIBUTE_NORMAL}, Complete: true, LinkCount: 1}
		}
	}
	return h, err
}
func (f *root05aFake) simulationMetadata(h managedTreeSimulatedHandle) (managedTreeSimulatedMetadata, error) {
	f.events = append(f.events, fmt.Sprintf("metadata_%d", h))
	f.metadataCalls[h]++
	if f.closed[h] != 0 || f.marks != 0 {
		return managedTreeSimulatedMetadata{}, errors.New("fake metadata queried after mark/close")
	}
	if f.metadataHook != nil {
		if err := f.metadataHook(h, f.metadataCalls[h]); err != nil {
			return managedTreeSimulatedMetadata{}, err
		}
	}
	m, ok := f.meta[h]
	if !ok {
		return m, errors.New("unknown fake handle")
	}
	return m, nil
}
func (f *root05aFake) simulationClose(h managedTreeSimulatedHandle) error {
	f.events = append(f.events, fmt.Sprintf("close_%d", h))
	f.closed[h]++
	return f.closeErrors[h]
}
func (f *root05aFake) simulationDisposition(h managedTreeSimulatedHandle, class uint32, payload [1]byte) (bool, error) {
	f.events = append(f.events, "mark")
	f.marks++
	f.markHandle, f.markClass, f.markPayload = h, class, payload
	if f.closed[501] != 0 || f.closed[h] != 0 || f.metadataCalls[501] == 0 || f.metadataCalls[h] == 0 {
		return false, errors.New("simulation lost a retained validated handle")
	}
	if f.markHook != nil {
		f.markHook()
	}
	return f.markAccepted, f.markError
}
func (f *root05aFake) simulationPostconditions(managedTreeSimulationBinding) (managedTreeSimulatedPostconditions, error) {
	f.events = append(f.events, "post")
	f.posts++
	if f.closed[501] != 1 || f.closed[502] != 1 {
		return managedTreeSimulatedPostconditions{}, errors.New("postconditions before exact handle closure")
	}
	return f.post, f.postError
}

type root05aAuthority struct {
	approved managedTreeSimulationBinding
	err      error
	calls    int
	hook     func(int)
}

func (*root05aAuthority) managedTreeFixtureSimulationOnly() {}
func (a *root05aAuthority) authorizeSimulation(binding managedTreeSimulationBinding) error {
	a.calls++
	if a.hook != nil {
		a.hook(a.calls)
	}
	if a.err != nil {
		return a.err
	}
	if binding != a.approved {
		return errors.New("fixture did not approve this operation/root/parent/child")
	}
	return nil
}

type root05aCase struct {
	root    *managedRootObservation
	rootAPI *fakeManagedRootAPI
	f       *root05aFake
	a       *root05aAuthority
	ctx     context.Context
	cancel  context.CancelFunc
	op      [16]byte
	name    string
}

func root05aFixture(t *testing.T) *root05aCase {
	t.Helper()
	root, rf, observation := root03Fixture(t)
	// More revalidation checkpoints than ROOT-03. Give every fresh observation
	// a distinct fake handle so exact-close assertions remain meaningful.
	for path, handles := range rf.openHandles {
		entry := rf.entries[handles[0]]
		for i := 0; i < 16; i++ {
			h := windows.Handle(1000 + len(rf.entries))
			rf.entries[h] = entry
			rf.openHandles[path] = append(rf.openHandles[path], h)
		}
	}
	original := *root
	components := append([]managedRootComponentIdentity(nil), root.components...)
	t.Cleanup(func() { *root = original; root.components = components })
	file := observation.names["file.txt"]
	observation.pages = []root03Page{{entries: []managedTreeEntry{{"file.txt", file.id.FileID, file.attr}}}, {done: true}}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	op := [16]byte{1, 2, 3} // Deterministic fake correlation, not a production ID issuer.
	binding := managedTreeSimulationBinding{OperationID: op, Root: managedRootTestID(3), Parent: 3, Child: managedTreeChildObservation{"file.txt", file.id, file.attr}}
	f := &root05aFake{root03Fake: observation, meta: make(map[managedTreeSimulatedHandle]managedTreeSimulatedMetadata), allocated: make(map[managedTreeSimulatedHandle]bool), closed: make(map[managedTreeSimulatedHandle]int), closeErrors: make(map[managedTreeSimulatedHandle]error), metadataCalls: make(map[managedTreeSimulatedHandle]int), markAccepted: true,
		post: managedTreeSimulatedPostconditions{Binding: binding, EnumerationComplete: true, Absent: true, AncestorsUnchanged: true, SentinelUnchanged: true}}
	return &root05aCase{root, rf, f, &root05aAuthority{approved: binding}, ctx, cancel, op, "file.txt"}
}
func (c *root05aCase) prepare() (*managedTreeFileSimulation, managedTreeSimulationResult, error) {
	return prepareManagedTreeFileSimulation(c.ctx, c.f, c.a, c.root, c.op, c.name)
}
func root05aAssertClosed(t *testing.T, c *root05aCase) {
	t.Helper()
	for h := range c.f.allocated {
		if c.f.closed[h] != 1 {
			t.Errorf("simulated handle %d closed %d times", h, c.f.closed[h])
		}
	}
	for h, count := range c.f.closed {
		if !c.f.allocated[h] || count != 1 {
			t.Errorf("unexpected simulated close %d=%d", h, count)
		}
	}
	for _, request := range c.f.root03Fake.opens {
		if request.access&0x10000 != 0 || request.share != 3 {
			t.Fatal("observational seam gained destructive rights/sharing")
		}
	}
	for _, h := range []windows.Handle{1, 2, 3} {
		if c.rootAPI.closes[h] != 0 {
			t.Errorf("borrowed root handle %d closed", h)
		}
	}
	root03AssertClosed(t, c.f.root03Fake)
}

func TestHUWIN002EROOT05AAuthorizedPreparationAndSimulation(t *testing.T) {
	c := root05aFixture(t)
	p, result, err := c.prepare()
	if err != nil || p == nil || result.State != managedTreeSimulationPrepared || !result.Simulated || result.Attempted || result.VerifiedAbsent || c.f.marks != 0 {
		t.Fatalf("prepared=%+v result=%+v err=%v", p, result, err)
	}
	defer p.close()
	for i, request := range c.f.opens {
		access, share := uint32(0x80), uint32(7)
		if i == 1 {
			access, share = 0x10080, 1
		}
		want := managedTreeSimulatedOpen{3, "file.txt", access, share, windows.OBJ_DONT_REPARSE, windows.FILE_OPEN, windows.FILE_OPEN_REPARSE_POINT | windows.FILE_NON_DIRECTORY_FILE}
		if request != want {
			t.Fatalf("simulation open=%+v want=%+v", request, want)
		}
	}
	if len(c.f.opens) != 2 || c.f.closed[501] != 0 || c.f.closed[502] != 0 || c.a.calls < 2 {
		t.Fatal("preparation did not retain both handles/authority")
	}
	result, err = p.simulateDisposition()
	if err != nil || !result.Simulated || result.State != managedTreeSimulationCompleted || !result.Attempted || !result.Marked || !result.VerifiedAbsent {
		t.Fatalf("result=%+v err=%v", result, err)
	}
	if c.f.markHandle != 502 || c.f.markClass != 4 || c.f.markPayload != [1]byte{1} || c.f.marks != 1 || c.f.posts != 1 {
		t.Fatal("wrong simulated handle/ABI/postconditions")
	}
	mark := -1
	for i, event := range c.f.events {
		if event == "mark" {
			mark = i
		}
	}
	if !reflect.DeepEqual(c.f.events[mark+1:], []string{"close_501", "close_502", "post"}) {
		t.Fatalf("target I/O after simulated mark: %v", c.f.events)
	}
	root05aAssertClosed(t, c)
}

func TestHUWIN002EROOT05AScopeAndPreconditions(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*root05aCase)
	}{
		{"missing_operation", func(c *root05aCase) { c.op = [16]byte{} }},
		{"different_operation", func(c *root05aCase) { c.op[0]++ }},
		{"external_object", func(c *root05aCase) { c.a.approved.Child.Identity = managedRootTestID(99) }},
		{"wrong_root", func(c *root05aCase) { c.a.approved.Root = managedRootTestID(99) }},
		{"wrong_parent", func(c *root05aCase) { c.a.approved.Parent = 99 }},
		{"denied_authority", func(c *root05aCase) { c.a.err = windows.ERROR_ACCESS_DENIED }},
		{"root_closed", func(c *root05aCase) { c.root.closed = true }},
		{"invalid_parent_handle", func(c *root05aCase) { c.root.components[2].handle = 0 }},
		{"aliased_ancestor_handle", func(c *root05aCase) { c.root.components[2].handle = 2 }},
		{"closed_ancestor", func(c *root05aCase) { c.root.components[1].closed = true }},
		{"missing_identity", func(c *root05aCase) { c.root.components[2].identity.FileID = [16]byte{} }},
		{"changed_ancestor_volume", func(c *root05aCase) { c.root.components[1].identity.VolumeSerialNumber++ }},
		{"root_replaced", func(c *root05aCase) {
			m := c.rootAPI.entries[3]
			m.identity = managedRootTestID(90)
			c.rootAPI.entries[3] = m
		}},
		{"not_ntfs", func(c *root05aCase) { c.f.filesystem = "ReFS" }},
		{"filesystem_denied", func(c *root05aCase) { c.f.fsErr = windows.ERROR_ACCESS_DENIED }},
		{"enumeration_incomplete", func(c *root05aCase) { c.f.pages = c.f.pages[:1] }},
		{"enumeration_failed", func(c *root05aCase) { c.f.pages[1] = root03Page{err: windows.ERROR_ACCESS_DENIED} }},
		{"child_absent", func(c *root05aCase) { c.f.pages = []root03Page{{done: true}} }},
		{"child_aliases_root", func(c *root05aCase) {
			m := c.f.names["file.txt"]
			m.id = managedRootTestID(3)
			c.f.names["file.txt"] = m
			c.f.pages[0].entries[0].FileID = m.id.FileID
		}},
		{"observed_directory", func(c *root05aCase) {
			c.name = "folder"
			m := c.f.names["folder"]
			c.f.pages[0].entries = []managedTreeEntry{{"folder", m.id.FileID, m.attr}}
		}},
		{"observed_reparse", func(c *root05aCase) {
			c.f.pages[0].entries[0].Attribute = managedRootAttributeTag{FileAttributes: windows.FILE_ATTRIBUTE_REPARSE_POINT, ReparseTag: 0xA000000C}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := root05aFixture(t)
			tc.mutate(c)
			p, r, err := c.prepare()
			if err == nil || p != nil || !r.Simulated || r.State == managedTreeSimulationPrepared || r.State == managedTreeSimulationCompleted || c.f.marks != 0 {
				t.Fatalf("p=%v r=%+v err=%v", p, r, err)
			}
			for _, request := range c.f.opens {
				if request.Access&0x10000 != 0 {
					t.Fatal("rejected scope acquired simulated DELETE rights")
				}
			}
			root05aAssertClosed(t, c)
		})
	}
}

func TestHUWIN002EROOT05ANames(t *testing.T) {
	for i, name := range []string{"", ".", "..", "current", "CURRENT", `x/y`, `x\y`, `C:\outside`, `\\host\share`, "x:stream", "x\x00y", "trailing.", " trailing", "trailing ", "NUL", "a?", strings.Repeat("a", 256)} {
		t.Run(fmt.Sprintf("invalid_%d", i), func(t *testing.T) {
			c := root05aFixture(t)
			c.name = name
			p, r, err := c.prepare()
			if err == nil || p != nil || r.State != managedTreeSimulationRejected || len(c.f.opens) != 0 || c.f.marks != 0 {
				t.Fatalf("r=%+v err=%v", r, err)
			}
			root05aAssertClosed(t, c)
		})
	}
}

func TestHUWIN002EROOT05AMetadataAndAcquisitionFailures(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*root05aCase)
	}{
		{"guard_access_denied", func(c *root05aCase) {
			c.f.acquireHook = func(int) (managedTreeSimulatedHandle, error) { return 0, windows.ERROR_ACCESS_DENIED }
		}},
		{"final_access_denied", func(c *root05aCase) {
			c.f.acquireHook = func(n int) (managedTreeSimulatedHandle, error) {
				if n == 2 {
					return 0, windows.ERROR_ACCESS_DENIED
				}
				return 501, nil
			}
		}},
		{"final_sharing_conflict", func(c *root05aCase) {
			c.f.acquireHook = func(n int) (managedTreeSimulatedHandle, error) {
				if n == 2 {
					return 502, windows.ERROR_SHARING_VIOLATION
				}
				return 501, nil
			}
		}},
		{"invalid_zero", func(c *root05aCase) {
			c.f.acquireHook = func(int) (managedTreeSimulatedHandle, error) { return 0, nil }
		}},
		{"invalid_minus_one", func(c *root05aCase) {
			c.f.acquireHook = func(int) (managedTreeSimulatedHandle, error) { return ^managedTreeSimulatedHandle(0), nil }
		}},
		{"aliased_final", func(c *root05aCase) {
			c.f.acquireHook = func(int) (managedTreeSimulatedHandle, error) { return 501, nil }
		}},
		{"metadata_denied", func(c *root05aCase) {
			c.f.metadataHook = func(managedTreeSimulatedHandle, int) error { return windows.ERROR_ACCESS_DENIED }
		}},
		{"api_unavailable", func(c *root05aCase) {
			c.f.metadataHook = func(managedTreeSimulatedHandle, int) error { return windows.ERROR_PROC_NOT_FOUND }
		}},
	}
	metadataCases := []struct {
		name   string
		change func(*managedTreeSimulatedMetadata)
	}{
		{"volume_changed", func(m *managedTreeSimulatedMetadata) { m.Identity.VolumeSerialNumber++ }},
		{"file_id_changed", func(m *managedTreeSimulatedMetadata) { m.Identity.FileID[0]++ }},
		{"identity_missing", func(m *managedTreeSimulatedMetadata) { m.Identity.FileID = [16]byte{} }},
		{"directory", func(m *managedTreeSimulatedMetadata) { m.Attribute.FileAttributes = windows.FILE_ATTRIBUTE_DIRECTORY }},
		{"symlink", func(m *managedTreeSimulatedMetadata) {
			m.Attribute.FileAttributes |= windows.FILE_ATTRIBUTE_REPARSE_POINT
			m.Attribute.ReparseTag = 0xA000000C
		}},
		{"junction", func(m *managedTreeSimulatedMetadata) {
			m.Attribute.FileAttributes |= windows.FILE_ATTRIBUTE_REPARSE_POINT
			m.Attribute.ReparseTag = 0xA0000003
		}},
		{"tag_without_attribute", func(m *managedTreeSimulatedMetadata) { m.Attribute.ReparseTag = 0xA0000003 }},
		{"metadata_incomplete", func(m *managedTreeSimulatedMetadata) { m.Complete = false }},
		{"attribute_missing", func(m *managedTreeSimulatedMetadata) { m.Attribute.FileAttributes = 0 }},
		{"hard_link", func(m *managedTreeSimulatedMetadata) { m.LinkCount = 2 }},
		{"link_count_missing", func(m *managedTreeSimulatedMetadata) { m.LinkCount = 0 }},
		{"delete_pending", func(m *managedTreeSimulatedMetadata) { m.DeletePending = true }},
		{"read_only", func(m *managedTreeSimulatedMetadata) { m.Attribute.FileAttributes |= windows.FILE_ATTRIBUTE_READONLY }},
		{"offline", func(m *managedTreeSimulatedMetadata) { m.Attribute.FileAttributes |= windows.FILE_ATTRIBUTE_OFFLINE }},
	}
	for _, mc := range metadataCases {
		for _, handle := range []managedTreeSimulatedHandle{501, 502} {
			cases = append(cases, struct {
				name   string
				mutate func(*root05aCase)
			}{fmt.Sprintf("%s_%d", mc.name, handle), func(c *root05aCase) {
				c.f.metadataHook = func(h managedTreeSimulatedHandle, n int) error {
					if h == handle && n == 1 {
						m := c.f.meta[h]
						mc.change(&m)
						c.f.meta[h] = m
					}
					return nil
				}
			}})
		}
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := root05aFixture(t)
			tc.mutate(c)
			p, r, err := c.prepare()
			if err == nil || p != nil || r.State == managedTreeSimulationCompleted || c.f.marks != 0 {
				t.Fatalf("r=%+v err=%v", r, err)
			}
			root05aAssertClosed(t, c)
		})
	}
}

func TestHUWIN002EROOT05ARetainedIdentityAndRevocation(t *testing.T) {
	for _, stage := range []string{"transition_guard", "before_mark_guard", "before_mark_target", "parent_substitution", "ancestor_substitution", "revoked_authority"} {
		t.Run(stage, func(t *testing.T) {
			c := root05aFixture(t)
			if stage == "transition_guard" {
				c.f.acquireHook = func(n int) (managedTreeSimulatedHandle, error) {
					if n == 2 {
						m := c.f.meta[501]
						m.Identity.FileID[0]++
						c.f.meta[501] = m
					}
					return managedTreeSimulatedHandle(500 + n), nil
				}
			}
			p, r, err := c.prepare()
			if stage == "transition_guard" {
				if err == nil || p != nil || c.f.marks != 0 {
					t.Fatalf("r=%+v err=%v", r, err)
				}
				root05aAssertClosed(t, c)
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			switch stage {
			case "before_mark_guard":
				m := c.f.meta[501]
				m.Identity.FileID[0]++
				c.f.meta[501] = m
			case "before_mark_target":
				m := c.f.meta[502]
				m.Identity.VolumeSerialNumber++
				c.f.meta[502] = m
			case "parent_substitution":
				c.root.components[2].identity = managedRootTestID(88)
			case "ancestor_substitution":
				c.root.components[1].identity = managedRootTestID(88)
			case "revoked_authority":
				c.a.err = windows.ERROR_ACCESS_DENIED
			}
			r, err = p.simulateDisposition()
			if err == nil || r.State != managedTreeSimulationFailed || c.f.marks != 0 {
				t.Fatalf("r=%+v err=%v", r, err)
			}
			root05aAssertClosed(t, c)
		})
	}
}

func TestHUWIN002EROOT05AUnknownFinalResultNeverCompletes(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*root05aCase)
	}{
		{"absence_unknown", func(c *root05aCase) { c.f.post.Absent = false }},
		{"enumeration_incomplete", func(c *root05aCase) { c.f.post.EnumerationComplete = false }},
		{"ancestor_unknown", func(c *root05aCase) { c.f.post.AncestorsUnchanged = false }},
		{"sentinel_changed", func(c *root05aCase) { c.f.post.SentinelUnchanged = false }},
		{"wrong_post_operation", func(c *root05aCase) { c.f.post.Binding.OperationID[0]++ }},
		{"wrong_post_root", func(c *root05aCase) { c.f.post.Binding.Root.FileID[0]++ }},
		{"wrong_post_child", func(c *root05aCase) { c.f.post.Binding.Child.Identity.FileID[0]++ }},
		{"postscan_failed", func(c *root05aCase) { c.f.postError = windows.ERROR_ACCESS_DENIED }},
		{"mark_error_unknown", func(c *root05aCase) { c.f.markError = windows.ERROR_ACCESS_DENIED }},
		{"mark_rejected", func(c *root05aCase) { c.f.markAccepted = false }},
		{"guard_close_failed", func(c *root05aCase) { c.f.closeErrors[501] = errors.New("guard close failed") }},
		{"target_close_failed", func(c *root05aCase) { c.f.closeErrors[502] = errors.New("target close failed") }},
		{"ancestor_replaced_after_mark", func(c *root05aCase) {
			c.f.markHook = func() {
				c.root.components[1].identity = managedRootTestID(88)
				for h, m := range c.rootAPI.entries {
					if strings.HasSuffix(m.finalPath, `\MANUS`) {
						m.identity = managedRootTestID(88)
						c.rootAPI.entries[h] = m
					}
				}
			}
		}},
		{"parent_replaced_after_mark", func(c *root05aCase) {
			c.f.markHook = func() {
				c.root.components[2].identity = managedRootTestID(88)
				for h, m := range c.rootAPI.entries {
					if strings.HasSuffix(m.finalPath, `\POS`) {
						m.identity = managedRootTestID(88)
						c.rootAPI.entries[h] = m
					}
				}
			}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := root05aFixture(t)
			p, _, err := c.prepare()
			if err != nil {
				t.Fatal(err)
			}
			tc.mutate(c)
			r, err := p.simulateDisposition()
			if err == nil || r.State != managedTreeSimulationPartial || r.VerifiedAbsent || !r.Simulated || c.f.marks != 1 {
				t.Fatalf("r=%+v err=%v", r, err)
			}
			root05aAssertClosed(t, c)
		})
	}
}

func TestHUWIN002EROOT05AErrorsAndExactClosure(t *testing.T) {
	primary, guardClose, targetClose := errors.New("primary"), errors.New("guard close"), errors.New("target close")
	for _, stage := range []string{"preparation", "preparation_with_valid_error_handle", "before_mark", "after_mark"} {
		t.Run(stage, func(t *testing.T) {
			c := root05aFixture(t)
			c.f.closeErrors[501] = guardClose
			c.f.closeErrors[502] = targetClose
			if stage == "preparation" {
				c.f.metadataHook = func(h managedTreeSimulatedHandle, _ int) error {
					if h == 502 {
						return primary
					}
					return nil
				}
			}
			if stage == "preparation_with_valid_error_handle" {
				c.f.acquireHook = func(n int) (managedTreeSimulatedHandle, error) {
					if n == 2 {
						return 502, primary
					}
					return 501, nil
				}
			}
			p, r, err := c.prepare()
			if stage == "before_mark" || stage == "after_mark" {
				if err != nil {
					t.Fatal(err)
				}
				if stage == "before_mark" {
					c.a.err = primary
				} else {
					c.f.markError = primary
				}
				r, err = p.simulateDisposition()
			}
			if !errors.Is(err, primary) || !errors.Is(err, guardClose) || !errors.Is(err, targetClose) || r.State == managedTreeSimulationCompleted {
				t.Fatalf("r=%+v err=%v", r, err)
			}
			if p != nil {
				_ = p.close()
				_ = p.close()
			}
			root05aAssertClosed(t, c)
		})
	}
}

func TestHUWIN002EROOT05ATimeoutAndCancellation(t *testing.T) {
	for _, stage := range []string{"initial", "guard_acquisition", "authority", "target_acquisition", "before_mark", "during_mark", "postscan_timeout"} {
		t.Run(stage, func(t *testing.T) {
			c := root05aFixture(t)
			switch stage {
			case "initial":
				c.cancel()
			case "guard_acquisition", "target_acquisition":
				c.f.acquireHook = func(n int) (managedTreeSimulatedHandle, error) {
					if (stage == "guard_acquisition" && n == 1) || (stage == "target_acquisition" && n == 2) {
						c.cancel()
					}
					return managedTreeSimulatedHandle(500 + n), nil
				}
			case "authority":
				c.a.hook = func(int) { c.cancel() }
			}
			p, r, err := c.prepare()
			if stage == "before_mark" || stage == "during_mark" || stage == "postscan_timeout" {
				if err != nil {
					t.Fatal(err)
				}
				switch stage {
				case "before_mark":
					c.cancel()
				case "during_mark":
					c.f.markHook = c.cancel
				case "postscan_timeout":
					c.f.postError = context.DeadlineExceeded
				}
				r, err = p.simulateDisposition()
			}
			if err == nil || r.State == managedTreeSimulationCompleted || r.VerifiedAbsent || (!errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded)) {
				t.Fatalf("r=%+v err=%v", r, err)
			}
			if stage != "during_mark" && stage != "postscan_timeout" && c.f.marks != 0 {
				t.Fatal("mark after timeout")
			}
			root05aAssertClosed(t, c)
		})
	}
}

func TestHUWIN002EROOT05ANilCapabilitiesAndSingleUse(t *testing.T) {
	for _, missing := range []string{"context", "api", "authority", "root"} {
		t.Run(missing, func(t *testing.T) {
			c := root05aFixture(t)
			var api managedTreeFileSimulationAPI = c.f
			var authority managedTreeFixtureSimulationAuthority = c.a
			switch missing {
			case "context":
				c.ctx = nil
			case "api":
				api = nil
			case "authority":
				authority = nil
			case "root":
				c.root = nil
			}
			p, r, err := prepareManagedTreeFileSimulation(c.ctx, api, authority, c.root, c.op, c.name)
			if err == nil || p != nil || r.State != managedTreeSimulationRejected || c.f.marks != 0 {
				t.Fatalf("r=%+v err=%v", r, err)
			}
			root05aAssertClosed(t, c)
		})
	}
	for _, action := range []string{"abandon_prepared", "repeat_simulation"} {
		t.Run(action, func(t *testing.T) {
			c := root05aFixture(t)
			p, _, err := c.prepare()
			if err != nil {
				t.Fatal(err)
			}
			if action == "abandon_prepared" {
				_ = p.close()
			} else {
				if _, err = p.simulateDisposition(); err != nil {
					t.Fatal(err)
				}
			}
			r, err := p.simulateDisposition()
			if err == nil || r.State == managedTreeSimulationCompleted || c.f.marks > 1 {
				t.Fatalf("r=%+v err=%v", r, err)
			}
			_ = p.close()
			root05aAssertClosed(t, c)
		})
	}
}

func TestHUWIN002EROOT05AStructuralSeparation(t *testing.T) {
	if _, ok := any(nativeManagedTreeAPI{}).(managedTreeFileSimulationAPI); ok {
		t.Fatal("native observer acquired simulation capability")
	}
	if reflect.TypeOf(managedTreeSimulatedHandle(0)) == reflect.TypeOf(windows.Handle(0)) {
		t.Fatal("simulation handle became a kernel handle")
	}
	file, err := parser.ParseFile(token.NewFileSet(), "managed_tree_operations_windows.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"OpenRelative", "ReadDirectory", "FileSystem", "FileIdentity", "AttributeTag", "CloseHandle"}
	var got []string
	for _, decl := range file.Decls {
		if g, ok := decl.(*ast.GenDecl); ok {
			for _, s := range g.Specs {
				if typ, ok := s.(*ast.TypeSpec); ok && typ.Name.Name == "managedTreeAPI" {
					for _, field := range typ.Type.(*ast.InterfaceType).Methods.List {
						for _, n := range field.Names {
							got = append(got, n.Name)
						}
					}
				}
			}
		}
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("observation API changed: %v", got)
	}
	forbidden := map[string]bool{"SetFileInformationByHandle": true, "NtSetInformationFile": true, "DeleteFile": true, "RemoveDirectory": true, "RemoveAll": true, "Rename": true, "DeviceIoControl": true}
	ast.Inspect(file, func(n ast.Node) bool {
		if c, ok := n.(*ast.CallExpr); ok {
			if s, ok := c.Fun.(*ast.SelectorExpr); ok && forbidden[s.Sel.Name] {
				t.Errorf("native mutation call %s", s.Sel.Name)
			}
		}
		return true
	})
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok {
			continue
		}
		if fn.Name.Name == "simulationDisposition" || fn.Name.Name == "managedTreeSimulationOnly" || fn.Name.Name == "managedTreeFixtureSimulationOnly" {
			t.Errorf("production implements fake-only method %s", fn.Name.Name)
		}
		modeled := strings.HasPrefix(fn.Name.Name, "prepareManagedTreeFileSimulation") || strings.HasPrefix(fn.Name.Name, "validateManagedTreeSimulation")
		if fn.Recv != nil {
			if star, ok := fn.Recv.List[0].Type.(*ast.StarExpr); ok {
				if id, ok := star.X.(*ast.Ident); ok && id.Name == "managedTreeFileSimulation" {
					modeled = true
				}
			}
		}
		if modeled {
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				if c, ok := n.(*ast.CallExpr); ok {
					if s, ok := c.Fun.(*ast.SelectorExpr); ok {
						if id, ok := s.X.(*ast.Ident); ok && (id.Name == "windows" || id.Name == "os") {
							t.Errorf("simulation calls native/filesystem API %s.%s", id.Name, s.Sel.Name)
						}
					}
				}
				return true
			})
		}
	}
}

// ROOT-05B-R3 only creates fresh protected fixtures, opens/queries/closes, and
// never disposes or renames an object. The ROOT-05A simulation stays separate.
func TestHUWIN002EROOT05BNativeSharing(t *testing.T) {
	if os.Getenv("MANUS_ROOT05BR3_NATIVE") != "1" {
		t.Skip("ROOT05B-R3 native opt-in not enabled")
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	// A process token is effective only when this locked thread is not impersonating.
	// Record the entire enabled/deny-only group frame; reject restricting SIDs.
	tokenFrame := func() (string, error) {
		thread, e := windows.GetCurrentThread()
		if e != nil {
			return "", e
		}
		var impersonation windows.Token
		e = windows.OpenThreadToken(thread, windows.TOKEN_QUERY, true, &impersonation)
		if e == nil {
			return "", errors.Join(errors.New("impersonation is outside fixture scope"), impersonation.Close())
		}
		if !errors.Is(e, windows.ERROR_NO_TOKEN) {
			return "", e
		}
		tok := windows.GetCurrentProcessToken()
		scalar := func(class uint32) (uint32, error) {
			var value, size uint32
			e := windows.GetTokenInformation(tok, class, (*byte)(unsafe.Pointer(&value)), 4, &size)
			if e != nil {
				return 0, e
			}
			if size != 4 {
				return 0, errors.New("truncated scalar token metadata")
			}
			return value, nil
		}
		buffer := func(class uint32) ([]byte, error) {
			data := make([]byte, 65536)
			var size uint32
			if e := windows.GetTokenInformation(tok, class, &data[0], uint32(len(data)), &size); e != nil {
				return nil, e
			}
			if size == 0 || size > uint32(len(data)) {
				return nil, errors.New("truncated token metadata")
			}
			return data[:size], nil
		}
		inBufferSID := func(data []byte, sid *windows.SID) bool {
			if sid == nil || len(data) == 0 {
				return false
			}
			start, end := uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(&data[0]))+uintptr(len(data))
			address := uintptr(unsafe.Pointer(sid))
			return address >= start && address+8 <= end && sid.IsValid() && address+uintptr(sid.Len()) <= end
		}
		groups := func(class uint32) ([]map[string]any, error) {
			data, e := buffer(class)
			if e != nil {
				return nil, e
			}
			offset := unsafe.Offsetof(windows.Tokengroups{}.Groups)
			if uintptr(len(data)) < offset {
				return nil, errors.New("truncated token group header")
			}
			g := (*windows.Tokengroups)(unsafe.Pointer(&data[0]))
			if offset+uintptr(g.GroupCount)*unsafe.Sizeof(windows.SIDAndAttributes{}) > uintptr(len(data)) {
				return nil, errors.New("truncated token groups")
			}
			rows := make([]map[string]any, 0, g.GroupCount)
			for _, item := range g.AllGroups() {
				if !inBufferSID(data, item.Sid) {
					return nil, errors.New("invalid token group SID")
				}
				rows = append(rows, map[string]any{"sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(item.Sid.String()))), "attributes": item.Attributes})
			}
			runtime.KeepAlive(data)
			return rows, nil
		}
		kind, e := scalar(windows.TokenType)
		if e != nil || kind != windows.TokenPrimary {
			return "", errors.Join(e, errors.New("not a primary token"))
		}
		elevation, e := scalar(windows.TokenElevation)
		if e != nil || elevation != 0 {
			return "", errors.Join(e, errors.New("elevated token rejected"))
		}
		session, e := scalar(windows.TokenSessionId)
		if e != nil || session == 0 {
			return "", errors.Join(e, errors.New("noninteractive session"))
		}
		elevationType, e := scalar(windows.TokenElevationType)
		if e != nil {
			return "", e
		}
		integrity, e := buffer(windows.TokenIntegrityLevel)
		if e != nil || len(integrity) < int(unsafe.Sizeof(windows.Tokenmandatorylabel{})) {
			return "", errors.Join(e, errors.New("integrity unavailable"))
		}
		label := (*windows.Tokenmandatorylabel)(unsafe.Pointer(&integrity[0]))
		if !inBufferSID(integrity, label.Label.Sid) || label.Label.Sid.String() != "S-1-16-8192" {
			return "", errors.New("Medium integrity required")
		}
		runtime.KeepAlive(integrity)
		restricted, e := groups(windows.TokenRestrictedSids)
		if e != nil || len(restricted) != 0 {
			return "", errors.Join(e, errors.New("restricting SIDs rejected; no ACL expansion"))
		}
		ordinary, e := groups(windows.TokenGroups)
		if e != nil {
			return "", e
		}
		user, e := tok.GetTokenUser()
		if e != nil || user.User.Sid == nil || !user.User.Sid.IsValid() {
			return "", errors.Join(e, errors.New("invalid TokenUser"))
		}
		data, e := json.Marshal(map[string]any{"sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(user.User.Sid.String()))), "type": kind, "elevation": elevation, "elevationType": elevationType, "session": session, "integrity": "Medium", "groups": ordinary, "restrictedSIDs": restricted, "impersonation": false})
		return string(data), e
	}
	initialTokenFrame, err := tokenFrame()
	if err != nil {
		t.Fatal("STOP: token preflight", err)
	}
	anchor, err := windows.KnownFolderPath(windows.FOLDERID_LocalAppData, windows.KF_FLAG_DEFAULT)
	if err != nil {
		t.Fatal(err)
	}
	temp := filepath.Join(anchor, "Temp")
	root04NoReparseChain(t, temp)
	var elevated, session, returned uint32
	token := windows.GetCurrentProcessToken()
	if err = windows.GetTokenInformation(token, windows.TokenElevation, (*byte)(unsafe.Pointer(&elevated)), 4, &returned); err != nil || returned != 4 || elevated != 0 {
		t.Fatal("ROOT05B requires non-elevated token", err)
	}
	if err = windows.GetTokenInformation(token, windows.TokenSessionId, (*byte)(unsafe.Pointer(&session)), 4, &returned); err != nil || returned != 4 {
		t.Fatal("token session unavailable", err)
	}
	user, err := token.GetTokenUser()
	if err != nil {
		t.Fatal(err)
	}
	userSID := user.User.Sid.String()
	if userSID == "S-1-5-18" || userSID == "S-1-5-19" || userSID == "S-1-5-20" || session == 0 {
		t.Fatal("service token is outside fixture authorization")
	}
	version := windows.RtlGetVersion()
	var nonce [16]byte
	if _, err = rand.Read(nonce[:]); err != nil {
		t.Fatal(err)
	}
	fixture := filepath.Join(temp, fmt.Sprintf("ManusRoot05BR3-fixture-%x", nonce))
	evidence := filepath.Join(temp, fmt.Sprintf("ManusRoot05BR3-evidence-%x", nonce))
	api := nativeManagedTreeAPI{}
	baseRoot, err := observeManagedRootIdentity(nativeManagedRootIdentityAPI{}, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: "Temp"})
	if err != nil {
		t.Fatal("TEMP identity", err)
	}
	defer func() {
		if e := baseRoot.Close(); e != nil {
			t.Error("TEMP close", e)
		}
	}()
	if fs, e := api.FileSystem(baseRoot.components[len(baseRoot.components)-1].handle); e != nil || fs != "NTFS" {
		t.Fatal("TEMP NTFS unavailable", e)
	}
	createDirectory := func(path string, childMask uint32) {
		if e := baseRoot.Revalidate(); e != nil {
			t.Fatal("TEMP changed", e)
		}
		sddl := fmt.Sprintf("O:%sD:P(A;;0x001200A3;;;%s)(A;OIIO;0x%08X;;;%s)", userSID, userSID, childMask, userSID)
		sd, e := windows.SecurityDescriptorFromString(sddl)
		if e != nil || sd == nil || !sd.IsValid() {
			t.Fatal("ambiguous initial SDDL", e)
		}
		sa := windows.SecurityAttributes{Length: uint32(unsafe.Sizeof(windows.SecurityAttributes{})), SecurityDescriptor: sd, InheritHandle: 0}
		pointer, e := windows.UTF16PtrFromString(path)
		if e != nil {
			t.Fatal(e)
		}
		e = windows.CreateDirectory(pointer, &sa)
		runtime.KeepAlive(sd)
		if e != nil {
			t.Fatal("create-new protected directory; no repair/retry", e)
		}
		t.Logf("ROOT05BR3_CREATED %s", path)
		root04NoReparseChain(t, path)
	}
	createDirectory(fixture, 0x13019f)
	createDirectory(evidence, 0x12019f)
	relative, err := filepath.Rel(anchor, fixture)
	if err != nil {
		t.Fatal(err)
	}
	root, err := observeManagedRootIdentity(nativeManagedRootIdentityAPI{}, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: relative})
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := root.Close(); err != nil {
			t.Error("root close", err)
		}
	}()
	evidenceRelative, err := filepath.Rel(anchor, evidence)
	if err != nil {
		t.Fatal(err)
	}
	evidenceRoot, err := observeManagedRootIdentity(nativeManagedRootIdentityAPI{}, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: evidenceRelative})
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if e := evidenceRoot.Close(); e != nil {
			t.Error("evidence root close", e)
		}
	}()
	parent := root.components[len(root.components)-1]
	if parent.identity.VolumeSerialNumber != baseRoot.components[len(baseRoot.components)-1].identity.VolumeSerialNumber || evidenceRoot.components[len(evidenceRoot.components)-1].identity.VolumeSerialNumber != parent.identity.VolumeSerialNumber {
		t.Fatal("fixture/evidence changed volume")
	}
	fs, err := api.FileSystem(parent.handle)
	if err != nil || fs != "NTFS" {
		t.Fatal("STOP: fixture filesystem is not proved NTFS", err)
	}
	identityJSON := func(id managedRootFileIdentity) map[string]string {
		return map[string]string{"volume": fmt.Sprintf("%d", id.VolumeSerialNumber), "fileId": fmt.Sprintf("%x", id.FileID)}
	}
	var events []map[string]any
	emit := func(event string, detail any) {
		row := map[string]any{"event": event, "at": time.Now().UTC(), "detail": detail}
		events = append(events, row)
		data, _ := json.Marshal(row)
		t.Logf("ROOT05B_EVIDENCE %s", data)
	}
	create := func(path, content string) {
		f, e := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if e != nil {
			t.Fatal(e)
		}
		_, e = f.WriteString(content)
		if e = errors.Join(e, f.Close()); e != nil {
			t.Fatal(e)
		}
	}
	target := filepath.Join(fixture, "target.txt")
	sentinel := filepath.Join(evidence, "sentinel.txt")
	// Exact user-only ACLs; nominal DELETE on target is never a disposition.
	security := func(h windows.Handle, directory bool, childMask uint32) (map[string]any, error) {
		sd, e := windows.GetSecurityInfo(h, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
		if e != nil {
			return nil, e
		}
		if !sd.IsValid() {
			return nil, errors.New("invalid descriptor")
		}
		owner, _, e := sd.Owner()
		if e != nil || owner == nil || !owner.Equals(user.User.Sid) {
			return nil, errors.Join(e, errors.New("owner is not TokenUser"))
		}
		control, _, e := sd.Control()
		if e != nil || (control&windows.SE_DACL_PROTECTED != 0) != directory {
			return nil, errors.Join(e, errors.New("DACL protection mismatch"))
		}
		acl, _, e := sd.DACL()
		if e != nil || acl == nil {
			return nil, errors.Join(e, errors.New("missing/NULL DACL"))
		}
		expected := []struct {
			mask  uint32
			flags uint8
		}{{childMask, windows.INHERITED_ACE}}
		if directory {
			expected = []struct {
				mask  uint32
				flags uint8
			}{{0x1200a3, 0}, {childMask, windows.OBJECT_INHERIT_ACE | windows.INHERIT_ONLY_ACE}}
		}
		if int(acl.AceCount) != len(expected) {
			return nil, errors.New("unexpected ACE count")
		}
		entries := make([]map[string]any, 0, len(expected))
		for i, want := range expected {
			var ace *windows.ACCESS_ALLOWED_ACE
			if e = windows.GetAce(acl, uint32(i), &ace); e != nil || ace == nil {
				return nil, errors.Join(e, errors.New("ACE unavailable"))
			}
			if ace.Header.AceType != windows.ACCESS_ALLOWED_ACE_TYPE || ace.Header.AceSize < 12 || ace.Header.AceFlags != want.flags || uint32(ace.Mask) != want.mask {
				return nil, errors.New("unexpected ACE type/flags/mask")
			}
			sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart))
			if !sid.IsValid() || sid.Len()+8 > int(ace.Header.AceSize) || !sid.Equals(user.User.Sid) {
				return nil, errors.New("external/invalid ACE SID")
			}
			entries = append(entries, map[string]any{"type": ace.Header.AceType, "flags": ace.Header.AceFlags, "mask": fmt.Sprintf("%#x", ace.Mask)})
		}
		sddl := sd.String()
		if sddl == "" {
			return nil, errors.New("SDDL unavailable")
		}
		runtime.KeepAlive(sd)
		return map[string]any{"ownerSID_SHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(owner.String()))), "control": fmt.Sprintf("%#x", control), "sddl": sddl, "aces": entries}, nil
	}
	// Controller hashes through a no-follow read handle after checking its ID and
	// effective path. Probe code never gets the sentinel path/handle.
	snapshot := func(path string) (out map[string]any, id managedRootFileIdentity, hash string, retErr error) {
		ptr, e := windows.UTF16PtrFromString(path)
		if e != nil {
			return nil, id, "", e
		}
		h, e := windows.CreateFile(ptr, windows.GENERIC_READ|windows.READ_CONTROL|windows.FILE_READ_ATTRIBUTES, 7, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
		if e != nil {
			return nil, id, "", e
		}
		defer func() { retErr = errors.Join(retErr, windows.CloseHandle(h)) }()
		id, e = api.FileIdentity(h)
		if e != nil {
			return nil, id, "", e
		}
		attr, e := api.AttributeTag(h)
		if e != nil {
			return nil, id, "", e
		}
		if e = validateManagedTreeAttribute(attr); e != nil {
			return nil, id, "", e
		}
		final, e := api.FinalPath(h)
		if e != nil {
			return nil, id, "", e
		}
		final, e = normalizeManagedRootFinalPath(final)
		if e != nil || !strings.EqualFold(final, path) || id.VolumeSerialNumber != parent.identity.VolumeSerialNumber || isZeroFileID(id.FileID) {
			return nil, id, "", errors.New("snapshot escaped controlled identity/path")
		}
		mask := uint32(0x13019f)
		if strings.EqualFold(path, sentinel) {
			mask = 0x12019f
		} else if !strings.EqualFold(path, target) {
			return nil, id, "", errors.New("snapshot outside exact inventory")
		}
		sec, e := security(h, false, mask)
		if e != nil {
			return nil, id, "", e
		}
		digest := sha256.New()
		var buffer [4096]byte
		total := 0
		for {
			var n uint32
			e = windows.ReadFile(h, buffer[:], &n, nil)
			if e != nil && !errors.Is(e, windows.ERROR_HANDLE_EOF) {
				return nil, id, "", e
			}
			if n == 0 {
				break
			}
			digest.Write(buffer[:n])
			total += int(n)
			if total > 65536 {
				return nil, id, "", errors.New("fixture unexpectedly large")
			}
		}
		hash = fmt.Sprintf("%x", digest.Sum(nil))
		out = map[string]any{"path": path, "identity": identityJSON(id), "sha256": hash, "security": sec}
		return out, id, hash, nil
	}
	directorySecurity := func(observation *managedRootObservation, mask uint32) (out map[string]any, retErr error) {
		if e := observation.Revalidate(); e != nil {
			return nil, e
		}
		component := observation.components[len(observation.components)-1]
		pointer, e := windows.UTF16PtrFromString(component.lexicalPath)
		if e != nil {
			return nil, e
		}
		h, e := windows.CreateFile(pointer, windows.READ_CONTROL|windows.FILE_READ_ATTRIBUTES|windows.FILE_LIST_DIRECTORY, 7, nil, windows.OPEN_EXISTING, managedRootOpenFlags, 0)
		if e != nil {
			return nil, e
		}
		defer func() { retErr = errors.Join(retErr, windows.CloseHandle(h)) }()
		id, e := api.FileIdentity(h)
		if e != nil || id != component.identity {
			return nil, errors.Join(e, errors.New("directory security handle identity changed"))
		}
		attr, e := api.AttributeTag(h)
		if e != nil || attr != component.attribute {
			return nil, errors.Join(e, errors.New("directory attributes changed"))
		}
		fs, e := api.FileSystem(h)
		if e != nil || fs != "NTFS" {
			return nil, errors.Join(e, errors.New("NTFS not demonstrated"))
		}
		sec, e := security(h, true, mask)
		if e != nil {
			return nil, e
		}
		if e := observation.Revalidate(); e != nil {
			return nil, e
		}
		return sec, nil
	}
	dirSecurity, err := directorySecurity(root, 0x13019f)
	if err != nil {
		t.Fatal("STOP: fixture DACL", err)
	}
	evidenceSecurity, err := directorySecurity(evidenceRoot, 0x12019f)
	if err != nil {
		t.Fatal("STOP: evidence DACL", err)
	}
	if e := baseRoot.Revalidate(); e != nil {
		t.Fatal(e)
	}
	create(target, fmt.Sprintf("ROOT05BR3 innocuous file %x\n", nonce))
	create(sentinel, fmt.Sprintf("ROOT05BR3 external controlled sentinel %x\n", nonce))
	initial, targetID, targetHash, err := snapshot(target)
	if err != nil {
		t.Fatal(err)
	}
	sentinelInitial, sentinelID, sentinelHash, err := snapshot(sentinel)
	if err != nil {
		t.Fatal(err)
	}
	emit("host", map[string]any{"build": version.BuildNumber, "architecture": "AMD64", "filesystem": fs, "elevated": false, "session": session, "sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(userSID))), "token": json.RawMessage(initialTokenFrame)})
	emit("fixture_initial", map[string]any{"fixture": fixture, "rootIdentity": identityJSON(parent.identity), "rootSecurity": dirSecurity, "evidenceIdentity": identityJSON(evidenceRoot.components[len(evidenceRoot.components)-1].identity), "evidenceSecurity": evidenceSecurity, "file": initial, "sentinel": sentinelInitial})
	writeJSON := func(path string, value any) error {
		data, e := json.MarshalIndent(value, "", "  ")
		if e != nil {
			return e
		}
		f, e := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if e != nil {
			return e
		}
		_, e = f.Write(append(data, '\n'))
		return errors.Join(e, f.Close())
	}
	if err = writeJSON(filepath.Join(evidence, "fixture-manifest.json"), map[string]any{"operation": fmt.Sprintf("%x", nonce), "fixture": fixture, "root": identityJSON(parent.identity), "initial": initial, "sentinel": sentinelInitial}); err != nil {
		t.Fatal(err)
	}
	type held struct {
		h      windows.Handle
		closed bool
		serial int
	}
	var heldHandles []*held
	closeFailed := false
	closeH := func(h *held) {
		if h == nil || h.closed {
			return
		}
		h.closed = true
		e := windows.CloseHandle(h.h)
		emit("close", map[string]any{"serial": h.serial, "error": fmt.Sprint(e)})
		if e != nil {
			closeFailed = true
			t.Error("STOP: close failed", e)
		}
	}
	defer func() {
		for _, h := range heldHandles {
			closeH(h)
		}
		final, id, hash, e := snapshot(target)
		sfinal, sid, shash, se := snapshot(sentinel)
		unchanged := e == nil && se == nil && id == targetID && hash == targetHash && sid == sentinelID && shash == sentinelHash
		if !unchanged {
			t.Error("STOP: file/sentinel identity or hash changed", e, se)
		}
		if e := root.Revalidate(); e != nil {
			t.Error("STOP: root revalidation", e)
		}
		if e := evidenceRoot.Revalidate(); e != nil {
			t.Error("STOP: evidence revalidation", e)
		}
		fixtureFinalSecurity, fse := directorySecurity(root, 0x13019f)
		evidenceFinalSecurity, ese := directorySecurity(evidenceRoot, 0x12019f)
		sameJSON := func(a, b any) bool {
			x, e := json.Marshal(a)
			y, f := json.Marshal(b)
			return e == nil && f == nil && string(x) == string(y)
		}
		securityUnchanged := fse == nil && ese == nil && sameJSON(fixtureFinalSecurity, dirSecurity) && sameJSON(evidenceFinalSecurity, evidenceSecurity)
		if !securityUnchanged {
			t.Error("STOP: final DACL mismatch", fse, ese)
		}
		emit("fixture_final", map[string]any{"file": final, "sentinel": sfinal, "unchanged": unchanged, "fileError": fmt.Sprint(e), "sentinelError": fmt.Sprint(se)})
		report := map[string]any{"phase": "HU-WIN-002E-ROOT-05B-R3", "failed": t.Failed(), "outcome": "observation-only; no disposition", "fixture": fixture, "evidence": evidence, "events": events, "initial": initial, "sentinelInitial": sentinelInitial, "final": final, "sentinelFinal": sfinal, "unchanged": unchanged, "probeHandlesOpened": len(heldHandles), "probeCloseFailed": closeFailed, "rootSecurityInitial": dirSecurity, "rootSecurityFinal": fixtureFinalSecurity, "evidenceSecurityInitial": evidenceSecurity, "evidenceSecurityFinal": evidenceFinalSecurity, "securityUnchanged": securityUnchanged, "nativeRenameOrReplacement": "NOT_RUN; forbidden in this scope", "disposition": "NOT_RUN; no API call exists in this harness", "cleanup": "NOT_PERFORMED"}
		if !securityUnchanged {
			t.Log("report only on stdout: evidence root not trusted")
			return
		}
		if e := writeJSON(filepath.Join(evidence, "native-report.json"), report); e != nil {
			t.Error("write native report", e)
		}
	}()
	register := func(h windows.Handle) *held {
		for _, old := range heldHandles {
			if !old.closed && old.h == h {
				t.Fatal("STOP: native handle aliased a live handle")
			}
		}
		out := &held{h: h, serial: len(heldHandles) + 1}
		heldHandles = append(heldHandles, out)
		return out
	}
	openRelative := func(st *testing.T, name string, directory bool, access, share uint32) (*held, uint32) {
		st.Helper()
		if name != "target.txt" || directory {
			st.Fatal("child outside fixed fixture inventory")
		}
		if access != 0x80 && access != 0x81 && access != 0x10080 {
			st.Fatal("unexpected access")
		}
		if access == 0x10080 && name != "target.txt" {
			st.Fatal("DELETE rights only allowed for fixture target")
		}
		if share != 1 && share != 3 && share != 7 {
			st.Fatal("unexpected share mode")
		}
		if closeFailed {
			st.Fatal("STOP: previous close failed")
		}
		if e := root.Revalidate(); e != nil {
			st.Fatal("STOP: parent changed", e)
		}
		if access == 0x10080 {
			frame, e := tokenFrame()
			if e != nil || frame != initialTokenFrame {
				st.Fatal("STOP: token changed", e)
			}
			if e := baseRoot.Revalidate(); e != nil {
				st.Fatal(e)
			}
			root04NoReparseChain(st, temp)
			fixtureSec, e := directorySecurity(root, 0x13019f)
			evidenceSec, f := directorySecurity(evidenceRoot, 0x12019f)
			encode := func(v any) string {
				b, e := json.Marshal(v)
				if e != nil {
					st.Fatal(e)
				}
				return string(b)
			}
			if e != nil || f != nil || encode(fixtureSec) != encode(dirSecurity) || encode(evidenceSec) != encode(evidenceSecurity) {
				st.Fatal("STOP: security changed", e, f)
			}
			fileNow, idNow, hashNow, e := snapshot(target)
			sentinelNow, sidNow, shashNow, f := snapshot(sentinel)
			if e != nil || f != nil || idNow != targetID || hashNow != targetHash || sidNow != sentinelID || shashNow != sentinelHash || encode(fileNow) != encode(initial) || encode(sentinelNow) != encode(sentinelInitial) {
				st.Fatal("STOP: target/sentinel changed", e, f)
			}
			if e := root.Revalidate(); e != nil {
				st.Fatal(e)
			}
			emit("DELETE_open_gate_passed", map[string]any{"name": name, "operation": fmt.Sprintf("%x", nonce), "parent": identityJSON(parent.identity), "target": identityJSON(targetID)})
		}
		oa, e := managedTreeRelativeAttributes(parent.handle, name)
		if e != nil {
			st.Fatal(e)
		}
		options := uint32(windows.FILE_OPEN_REPARSE_POINT | windows.FILE_NON_DIRECTORY_FILE)
		if directory {
			options = windows.FILE_OPEN_REPARSE_POINT | windows.FILE_DIRECTORY_FILE
		}
		var h windows.Handle
		var iosb windows.IO_STATUS_BLOCK
		start := time.Now()
		e = windows.NtCreateFile(&h, access, oa, &iosb, nil, 0, share, windows.FILE_OPEN, options, 0, 0)
		runtime.KeepAlive(oa)
		status := uint32(0)
		if e != nil {
			nt, ok := e.(windows.NTStatus)
			if !ok {
				st.Fatal("non-NTSTATUS error", e)
			}
			status = uint32(nt)
		}
		emit("NtCreateFile", map[string]any{"name": name, "parentIdentity": identityJSON(parent.identity), "access": fmt.Sprintf("%#x", access), "share": fmt.Sprintf("%#x", share), "objectFlags": "0x1000", "options": fmt.Sprintf("%#x", options), "ntstatus": fmt.Sprintf("0x%08X", status), "elapsedMS": time.Since(start).Milliseconds(), "iosbValid": e == nil})
		var owned *held
		if validManagedRootHandle(h) {
			owned = register(h)
		}
		if time.Since(start) > 5*time.Second {
			st.Fatal("STOP: unexpectedly slow native open")
		}
		if status != 0 && status != 0xC0000043 {
			st.Fatal("STOP: unexpected native status", e)
		}
		if status != 0 {
			if owned != nil {
				closeH(owned)
				st.Fatal("STOP: error returned a valid handle")
			}
			return nil, status
		}
		if owned == nil || iosb.Status != 0 || iosb.Information != 1 {
			st.Fatal("STOP: success without verified FILE_OPENED")
		}
		id, ie := api.FileIdentity(h)
		attr, ae := api.AttributeTag(h)
		final, fe := api.FinalPath(h)
		final, ne := normalizeManagedRootFinalPath(final)
		if ie != nil || ae != nil || fe != nil || ne != nil || id.VolumeSerialNumber != parent.identity.VolumeSerialNumber || isZeroFileID(id.FileID) || !strings.EqualFold(final, filepath.Join(fixture, name)) {
			st.Fatal("STOP: opened-handle metadata/path inconsistent", ie, ae, fe, ne)
		}
		if name == "target.txt" && (id != targetID || attr.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0 || validateManagedTreeAttribute(attr) != nil) {
			st.Fatal("STOP: target identity changed")
		}
		emit("opened_identity", map[string]any{"serial": owned.serial, "name": name, "identity": identityJSON(id), "attributes": fmt.Sprintf("%#x", attr.FileAttributes), "tag": fmt.Sprintf("%#x", attr.ReparseTag), "finalPath": final})
		return owned, status
	}
	run := func(name string, fn func(*testing.T)) {
		if !t.Run(name, fn) || closeFailed {
			t.Fatal("STOP: native case failed; no further probes")
		}
	}
	cases := []struct {
		name                                               string
		firstAccess, firstShare, secondAccess, secondShare uint32
		expected                                           uint32
		measure                                            bool
	}{
		{"guard_07_then_final_01", 0x80, 7, 0x10080, 1, 0, false},
		{"reverse_final_01_then_guard_07", 0x10080, 1, 0x80, 7, 0, false},
		{"attribute_guard_without_share_delete", 0x80, 3, 0x10080, 1, 0, true},
		{"read_lock_without_share_delete", 0x81, 1, 0x10080, 1, 0xC0000043, false},
		{"read_lock_with_share_delete", 0x81, 7, 0x10080, 1, 0, false},
		{"final_then_reader_without_share_delete", 0x10080, 1, 0x81, 1, 0xC0000043, false},
		{"final_then_another_delete_handle", 0x10080, 1, 0x10080, 7, 0xC0000043, false},
		{"reverse_attribute_guard_without_share_delete", 0x10080, 1, 0x80, 3, 0, true},
	}
	for _, c := range cases {
		run(c.name, func(st *testing.T) {
			first, status := openRelative(st, "target.txt", false, c.firstAccess, c.firstShare)
			defer closeH(first)
			if status != 0 {
				st.Fatal("first handle failed")
			}
			second, status := openRelative(st, "target.txt", false, c.secondAccess, c.secondShare)
			defer closeH(second)
			if !c.measure && status != c.expected {
				st.Fatalf("status=0x%08X expected=0x%08X", status, c.expected)
			}
			if second != nil {
				a, e := api.FileIdentity(first.h)
				b, f := api.FileIdentity(second.h)
				if e != nil || f != nil || a != targetID || a != b {
					st.Fatal("STOP: retained-handle identity mismatch", e, f)
				}
			}
			emit("sharing_case", map[string]any{"case": c.name, "status": fmt.Sprintf("0x%08X", status), "measurementOnly": c.measure})
			if e := root.Revalidate(); e != nil {
				st.Fatal(e)
			}
			closeH(second)
			closeH(first)
			if closeFailed {
				st.Fatal("STOP: close failed before recovery")
			}
			recovered, recoveredStatus := openRelative(st, "target.txt", false, 0x10080, 1)
			defer closeH(recovered)
			if recoveredStatus != 0 {
				st.Fatal("STOP: sharing did not recover after close")
			}
			emit("sharing_recovery", map[string]any{"case": c.name, "status": fmt.Sprintf("0x%08X", recoveredStatus)})
		})
	}
	// Reparse/link preparation and native rename/substitution are outside R3.
	emit("scope_limits", map[string]any{"rename_substitution": "NOT_RUN; modeled by ROOT05A fakes", "disposition": "NOT_RUN", "TOCTOU_immunity": "NOT_PROVEN", "cleanup": "NOT_PERFORMED"})
}

type root03Metadata struct {
	id   managedRootFileIdentity
	attr managedRootAttributeTag
}
type root03Open struct {
	parent                                     windows.Handle
	name                                       string
	access, share, flags, disposition, options uint32
}
type root03Page struct {
	entries []managedTreeEntry
	done    bool
	err     error
}
type root03Fake struct {
	meta          map[windows.Handle]root03Metadata
	names         map[string]root03Metadata
	pages         []root03Page
	filesystem    string
	fsErr         error
	opens         []root03Open
	restarts      []bool
	closes        map[windows.Handle]int
	closeErr      map[windows.Handle]error
	identityCalls map[windows.Handle]int
	identityHook  func(windows.Handle, int) error
	attributeHook func(windows.Handle) error
	openHook      func(int) (windows.Handle, error)
	readHook      func(int)
	next          windows.Handle
}

func (f *root03Fake) OpenRelative(parent windows.Handle, name string, access, share, flags, disposition, options uint32) (windows.Handle, error) {
	f.opens = append(f.opens, root03Open{parent, name, access, share, flags, disposition, options})
	if f.openHook != nil {
		return f.openHook(len(f.opens))
	}
	f.next++
	f.meta[f.next] = f.names[name]
	return f.next, nil
}
func (f *root03Fake) ReadDirectory(_ windows.Handle, restart bool) ([]managedTreeEntry, bool, error) {
	f.restarts = append(f.restarts, restart)
	if f.readHook != nil {
		f.readHook(len(f.restarts))
	}
	if len(f.pages) == 0 {
		return nil, false, errors.New("fake enumeration exhausted")
	}
	p := f.pages[0]
	f.pages = f.pages[1:]
	return p.entries, p.done, p.err
}
func (f *root03Fake) FileSystem(windows.Handle) (string, error) { return f.filesystem, f.fsErr }
func (f *root03Fake) FileIdentity(h windows.Handle) (managedRootFileIdentity, error) {
	f.identityCalls[h]++
	if f.identityHook != nil {
		if err := f.identityHook(h, f.identityCalls[h]); err != nil {
			return managedRootFileIdentity{}, err
		}
	}
	return f.meta[h].id, nil
}
func (f *root03Fake) AttributeTag(h windows.Handle) (managedRootAttributeTag, error) {
	if f.attributeHook != nil {
		if err := f.attributeHook(h); err != nil {
			return managedRootAttributeTag{}, err
		}
	}
	return f.meta[h].attr, nil
}
func (f *root03Fake) CloseHandle(h windows.Handle) error { f.closes[h]++; return f.closeErr[h] }

func root03Fixture(t *testing.T) (*managedRootObservation, *fakeManagedRootAPI, *root03Fake) {
	t.Helper()
	r := newValidManagedRootFake()
	for path, handles := range r.openHandles {
		h := handles[0] + 20
		r.openHandles[path] = append(handles, h)
		r.entries[h] = r.entries[handles[0]]
	}
	root := observeValidManagedRoot(t, r)
	t.Cleanup(func() {
		if err := root.Close(); err != nil {
			t.Errorf("root close: %v", err)
		}
	})
	dir := managedRootAttributeTag{FileAttributes: windows.FILE_ATTRIBUTE_DIRECTORY}
	file := managedRootAttributeTag{FileAttributes: windows.FILE_ATTRIBUTE_NORMAL}
	f := &root03Fake{
		meta:       map[windows.Handle]root03Metadata{2: {managedRootTestID(2), dir}, 3: {managedRootTestID(3), dir}},
		names:      map[string]root03Metadata{"POS": {managedRootTestID(3), dir}, "file.txt": {managedRootTestID(4), file}, "folder": {managedRootTestID(5), dir}},
		filesystem: "NTFS", closes: make(map[windows.Handle]int), closeErr: make(map[windows.Handle]error), identityCalls: make(map[windows.Handle]int), next: 99,
	}
	f.pages = []root03Page{{entries: []managedTreeEntry{{"file.txt", managedRootTestID(4).FileID, file}, {"folder", managedRootTestID(5).FileID, dir}}}, {done: true}}
	return root, r, f
}

func root03AssertClosed(t *testing.T, f *root03Fake) {
	t.Helper()
	for h := windows.Handle(100); h <= f.next; h++ {
		if f.closes[h] != 1 {
			t.Errorf("handle %d closes=%d", h, f.closes[h])
		}
	}
	for h, count := range f.closes {
		if count != 1 || h < 100 {
			t.Errorf("unexpected close %d count %d", h, count)
		}
	}
}

func TestHUWIN002EROOT03ObservationAndExactAccess(t *testing.T) {
	root, r, f := root03Fixture(t)
	result, err := observeManagedTreeChildren(f, root)
	if err != nil || result == nil || len(result.Children) != 2 {
		t.Fatalf("result=%+v err=%v", result, err)
	}
	if result.Parent != managedRootTestID(3) {
		t.Fatal("wrong parent identity")
	}
	want := []root03Open{
		{2, "POS", 0x81, 3, windows.OBJ_DONT_REPARSE, windows.FILE_OPEN, windows.FILE_OPEN_REPARSE_POINT | windows.FILE_DIRECTORY_FILE},
		{100, "file.txt", 0x80, 3, windows.OBJ_DONT_REPARSE, windows.FILE_OPEN, windows.FILE_OPEN_REPARSE_POINT | windows.FILE_NON_DIRECTORY_FILE},
		{100, "folder", 0x81, 3, windows.OBJ_DONT_REPARSE, windows.FILE_OPEN, windows.FILE_OPEN_REPARSE_POINT | windows.FILE_DIRECTORY_FILE},
	}
	if !reflect.DeepEqual(f.opens, want) {
		t.Fatalf("opens=%+v want=%+v", f.opens, want)
	}
	if !reflect.DeepEqual(f.restarts, []bool{true, false}) {
		t.Fatal("enumeration did not reach explicit end")
	}
	for _, h := range []windows.Handle{100, 101, 102} {
		if f.identityCalls[h] != 2 {
			t.Errorf("handle %d not revalidated", h)
		}
	}
	for h := windows.Handle(1); h <= 3; h++ {
		if r.closes[h] != 0 {
			t.Fatal("borrowed ROOT-01 handle closed early")
		}
	}
	root03AssertClosed(t, f)
}

func TestHUWIN002EROOT03Names(t *testing.T) {
	for _, name := range []string{"file.txt", "folder", "área", "a b", "😀.txt"} {
		t.Run("valid_"+name, func(t *testing.T) {
			if err := validateManagedTreeName(name); err != nil {
				t.Fatal(err)
			}
		})
	}
	bad := []string{"", ".", "..", `a/b`, `a\b`, `C:\x`, `\\server\share`, `x:stream`, "a\x00b", "trailing.", " leading", "trailing ", "CON", "con.txt", "NUL", "COM1", "LPT9", "COM¹", "a*", "a?", "a|", "a<", "a>", "a\"", "a\x01", strings.Repeat("a", 256), "\uFFFD"}
	for index, name := range bad {
		t.Run(fmt.Sprintf("invalid_%d", index), func(t *testing.T) {
			if err := validateManagedTreeName(name); err == nil {
				t.Fatalf("accepted %q", name)
			}
		})
	}
}

func TestHUWIN002EROOT03ParentAuthority(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*managedRootObservation, *fakeManagedRootAPI)
	}{
		{"closed", func(r *managedRootObservation, _ *fakeManagedRootAPI) { r.closed = true }},
		{"no_ancestor", func(r *managedRootObservation, _ *fakeManagedRootAPI) { r.components = r.components[:1] }},
		{"invalid_handle", func(r *managedRootObservation, _ *fakeManagedRootAPI) { r.components[2].handle = 0 }},
		{"closed_component", func(r *managedRootObservation, _ *fakeManagedRootAPI) { r.components[2].closed = true }},
		{"missing_api", func(r *managedRootObservation, _ *fakeManagedRootAPI) { r.api = nil }},
		{"preflight_change", func(_ *managedRootObservation, f *fakeManagedRootAPI) {
			e := f.entries[3]
			e.identity = managedRootTestID(9)
			f.entries[3] = e
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, rf, f := root03Fixture(t)
			original := *r
			saved := append([]managedRootComponentIdentity(nil), r.components...)
			tc.mutate(r, rf)
			result, err := observeManagedTreeChildren(f, r)
			*r = original
			r.components = saved
			if result != nil || err == nil || len(f.opens) != 0 {
				t.Fatalf("result=%v err=%v opens=%v", result, err, f.opens)
			}
		})
	}
	t.Run("nil_parent", func(t *testing.T) {
		_, _, f := root03Fixture(t)
		if result, err := observeManagedTreeChildren(f, nil); err == nil || result != nil {
			t.Fatal("accepted nil")
		}
	})
	t.Run("nil_api", func(t *testing.T) {
		r, _, _ := root03Fixture(t)
		if result, err := observeManagedTreeChildren(nil, r); err == nil || result != nil {
			t.Fatal("accepted nil")
		}
	})
}

func TestHUWIN002EROOT03FailuresNeverReturnCleanObservation(t *testing.T) {
	denied := windows.ERROR_ACCESS_DENIED
	cases := []struct {
		name   string
		mutate func(*managedRootObservation, *fakeManagedRootAPI, *root03Fake)
	}{
		{"filesystem_ReFS", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) { f.filesystem = "ReFS" }},
		{"filesystem_unknown", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) { f.filesystem = "" }},
		{"filesystem_API_unavailable", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.fsErr = windows.ERROR_PROC_NOT_FOUND
		}},
		{"enumeration_API_unavailable", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.pages = []root03Page{{err: windows.ERROR_INVALID_PARAMETER}}
		}},
		{"enumeration_interrupted", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.pages[1] = root03Page{err: denied}
		}},
		{"empty_page_not_complete", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) { f.pages = []root03Page{{}} }},
		{"entries_with_error", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) { f.pages[0].err = denied }},
		{"entries_with_done", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) { f.pages[0].done = true }},
		{"duplicate_name", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.pages[0].entries = append(f.pages[0].entries, f.pages[0].entries[0])
		}},
		{"unsafe_name", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.pages[0].entries[0].Name = `..\outside`
		}},
		{"enumerated_ID_missing", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.pages[0].entries[0].FileID = [16]byte{}
		}},
		{"enumerated_metadata_missing", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.pages[0].entries[0].Attribute = managedRootAttributeTag{}
		}},
		{"external_junction", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.pages[0].entries[0].Attribute = managedRootAttributeTag{windows.FILE_ATTRIBUTE_DIRECTORY | windows.FILE_ATTRIBUTE_REPARSE_POINT, windows.IO_REPARSE_TAG_MOUNT_POINT}
		}},
		{"substituted_current", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.pages[0].entries[0].Name = "current"
			f.pages[0].entries[0].Attribute = managedRootAttributeTag{windows.FILE_ATTRIBUTE_DIRECTORY | windows.FILE_ATTRIBUTE_REPARSE_POINT, windows.IO_REPARSE_TAG_MOUNT_POINT}
		}},
		{"child_substitution", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			e := f.names["file.txt"]
			e.id = managedRootTestID(9)
			f.names["file.txt"] = e
		}},
		{"child_volume_changed", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			e := f.names["file.txt"]
			e.id.VolumeSerialNumber++
			f.names["file.txt"] = e
		}},
		{"child_type_changed", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			e := f.names["file.txt"]
			e.attr.FileAttributes = windows.FILE_ATTRIBUTE_DIRECTORY
			f.names["file.txt"] = e
		}},
		{"opened_child_reparse", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			e := f.names["file.txt"]
			e.attr.FileAttributes |= windows.FILE_ATTRIBUTE_REPARSE_POINT
			f.names["file.txt"] = e
		}},
		{"child_revalidation_changed", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.identityHook = func(h windows.Handle, n int) error {
				if h == 101 && n == 2 {
					e := f.meta[h]
					e.id = managedRootTestID(9)
					f.meta[h] = e
				}
				return nil
			}
		}},
		{"parent_revalidation_changed", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.identityHook = func(h windows.Handle, n int) error {
				if h == 100 && n == 2 {
					return denied
				}
				return nil
			}
		}},
		{"final_ROOT01_changed", func(_ *managedRootObservation, r *fakeManagedRootAPI, f *root03Fake) {
			f.readHook = func(n int) {
				if n == 2 {
					e := r.entries[3]
					e.identity = managedRootTestID(9)
					r.entries[3] = e
				}
			}
		}},
		{"identity_API_denied", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.identityHook = func(windows.Handle, int) error { return denied }
		}},
		{"attribute_API_denied", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) {
			f.attributeHook = func(windows.Handle) error { return denied }
		}},
		{"close_error", func(_ *managedRootObservation, _ *fakeManagedRootAPI, f *root03Fake) { f.closeErr[101] = denied }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, rf, f := root03Fixture(t)
			tc.mutate(r, rf, f)
			result, err := observeManagedTreeChildren(f, r)
			if err == nil || result != nil {
				t.Fatalf("false success result=%+v err=%v", result, err)
			}
			root03AssertClosed(t, f)
		})
	}
}

func TestHUWIN002EROOT03RelativeOpenErrors(t *testing.T) {
	for _, err := range []error{windows.ERROR_ACCESS_DENIED, windows.ERROR_SHARING_VIOLATION, windows.ERROR_PROC_NOT_FOUND, windows.NTStatus(0xC000050B)} {
		t.Run(err.Error(), func(t *testing.T) {
			r, _, f := root03Fixture(t)
			f.openHook = func(int) (windows.Handle, error) { return 0, err }
			result, got := observeManagedTreeChildren(f, r)
			if result != nil || !errors.Is(got, err) {
				t.Fatalf("result=%v err=%v", result, got)
			}
		})
	}
	for _, h := range []windows.Handle{0, windows.InvalidHandle, 2, 3} {
		t.Run(fmt.Sprintf("invalid_or_borrowed_%d", h), func(t *testing.T) {
			r, _, f := root03Fixture(t)
			f.openHook = func(int) (windows.Handle, error) { return h, nil }
			result, err := observeManagedTreeChildren(f, r)
			if err == nil || result != nil || len(f.closes) != 0 {
				t.Fatal("bad handle accepted/closed")
			}
		})
	}
}

func TestHUWIN002EROOT03CombinedErrorsAndUniqueClose(t *testing.T) {
	r, _, f := root03Fixture(t)
	primary := errors.New("primary metadata failure")
	secondary := errors.New("close failure")
	f.identityHook = func(h windows.Handle, _ int) error {
		if h == 101 {
			return primary
		}
		return nil
	}
	f.closeErr[101] = secondary
	result, err := observeManagedTreeChildren(f, r)
	if result != nil || !errors.Is(err, primary) || !errors.Is(err, secondary) {
		t.Fatalf("lost errors: %v", err)
	}
	root03AssertClosed(t, f)
	t.Run("handle_with_open_error", func(t *testing.T) {
		r, _, f := root03Fixture(t)
		f.next = 100
		f.openHook = func(int) (windows.Handle, error) { return 100, primary }
		f.closeErr[100] = secondary
		result, err := observeManagedTreeChildren(f, r)
		if result != nil || !errors.Is(err, primary) || !errors.Is(err, secondary) || f.closes[100] != 1 {
			t.Fatalf("result=%v error=%v closes=%v", result, err, f.closes)
		}
	})
}

func TestHUWIN002EROOT03EmptyRequiresExplicitEnd(t *testing.T) {
	r, _, f := root03Fixture(t)
	f.pages = []root03Page{{done: true}}
	result, err := observeManagedTreeChildren(f, r)
	if err != nil || result == nil || len(result.Children) != 0 {
		t.Fatalf("result=%v err=%v", result, err)
	}
	root03AssertClosed(t, f)
}

func root03Record(name string, id byte, attr uint32) []byte {
	encoded := utf16.Encode([]rune(name))
	size := managedTreeDirectoryHeader + len(encoded)*2
	size = (size + 7) &^ 7
	b := make([]byte, size)
	binary.LittleEndian.PutUint32(b[56:60], attr)
	binary.LittleEndian.PutUint32(b[60:64], uint32(len(encoded)*2))
	b[72] = id
	for i, u := range encoded {
		binary.LittleEndian.PutUint16(b[88+i*2:], u)
	}
	return b
}

func TestHUWIN002EROOT03DirectoryBufferLayout(t *testing.T) {
	a := root03Record("file.txt", 4, windows.FILE_ATTRIBUTE_NORMAL)
	b := root03Record("folder", 5, windows.FILE_ATTRIBUTE_DIRECTORY)
	binary.LittleEndian.PutUint32(a[:4], uint32(len(a)))
	entries, err := parseManagedTreeDirectoryBuffer(append(a, b...))
	if err != nil || len(entries) != 2 || entries[0].FileID[0] != 4 || entries[1].Name != "folder" {
		t.Fatalf("entries=%v err=%v", entries, err)
	}
	t.Run("dot_entries_filtered", func(t *testing.T) {
		entries, err := parseManagedTreeDirectoryBuffer(root03Record("..", 1, windows.FILE_ATTRIBUTE_DIRECTORY))
		if err != nil || len(entries) != 0 {
			t.Fatalf("entries=%v err=%v", entries, err)
		}
	})
	t.Run("undefined_nonreparse_tag_ignored", func(t *testing.T) {
		b := root03Record("file", 4, windows.FILE_ATTRIBUTE_NORMAL)
		binary.LittleEndian.PutUint32(b[68:72], 0xdeadbeef)
		entries, err := parseManagedTreeDirectoryBuffer(b)
		if err != nil || entries[0].Attribute.ReparseTag != 0 {
			t.Fatal("used undefined tag")
		}
	})
}

func TestHUWIN002EROOT03RejectsTruncatedDirectoryBuffers(t *testing.T) {
	cases := []struct {
		name string
		make func() []byte
	}{
		{"short", func() []byte { return make([]byte, 87) }},
		{"empty", func() []byte { return nil }},
		{"zero_name", func() []byte { return make([]byte, 88) }},
		{"odd_name_length", func() []byte { b := root03Record("x", 1, 128); binary.LittleEndian.PutUint32(b[60:64], 3); return b }},
		{"truncated_name", func() []byte { b := root03Record("x", 1, 128); binary.LittleEndian.PutUint32(b[60:64], 100); return b }},
		{"offset_unaligned", func() []byte { b := root03Record("x", 1, 128); binary.LittleEndian.PutUint32(b[:4], 89); return b }},
		{"offset_outside", func() []byte { b := root03Record("x", 1, 128); binary.LittleEndian.PutUint32(b[:4], 4096); return b }},
		{"missing_ID", func() []byte { return root03Record("x", 0, 128) }},
		{"missing_attributes", func() []byte { return root03Record("x", 1, 0) }},
		{"NUL_name", func() []byte { return root03Record("a\x00", 1, 128) }},
		{"bad_UTF16", func() []byte { b := root03Record("x", 1, 128); binary.LittleEndian.PutUint16(b[88:], 0xd800); return b }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if entries, err := parseManagedTreeDirectoryBuffer(tc.make()); err == nil || entries != nil {
				t.Fatalf("accepted malformed metadata: %v %v", entries, err)
			}
		})
	}
}

func TestHUWIN002EROOT03NativeObjectAttributesWithoutSyscall(t *testing.T) {
	oa, err := managedTreeRelativeAttributes(42, "child")
	if err != nil {
		t.Fatal(err)
	}
	if oa.RootDirectory != 42 || oa.Length != uint32(unsafe.Sizeof(windows.OBJECT_ATTRIBUTES{})) || oa.Attributes != windows.OBJ_DONT_REPARSE || oa.SecurityDescriptor != nil || oa.SecurityQoS != nil {
		t.Fatalf("bad object attributes: %+v", oa)
	}
	if oa.ObjectName.Length != 10 || oa.ObjectName.String() != "child" {
		t.Fatal("invalid Unicode lifetime/length")
	}
	for _, h := range []windows.Handle{0, windows.InvalidHandle} {
		if _, err := managedTreeRelativeAttributes(h, "child"); err == nil {
			t.Fatal("accepted invalid RootDirectory")
		}
	}
	// Rejected before calling a native function; checks the adapter cannot be
	// instructed to create objects or expand access through this interface.
	api := nativeManagedTreeAPI{}
	if _, err := api.OpenRelative(42, "child", 0xffffffff, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, windows.FILE_OPEN_REPARSE_POINT|windows.FILE_DIRECTORY_FILE); err == nil {
		t.Fatal("accepted excessive access")
	}
}

func TestHUWIN002EROOT03InterfaceHasOnlyObservationMethods(t *testing.T) {
	typ := reflect.TypeOf((*managedTreeAPI)(nil)).Elem()
	want := map[string]bool{"OpenRelative": true, "ReadDirectory": true, "FileSystem": true, "FileIdentity": true, "AttributeTag": true, "CloseHandle": true}
	if typ.NumMethod() != len(want) {
		t.Fatal("interface capability changed")
	}
	for i := 0; i < typ.NumMethod(); i++ {
		if !want[typ.Method(i).Name] {
			t.Fatalf("unexpected method %s", typ.Method(i).Name)
		}
	}
}

func TestHUWIN002EROOT03ChildOpenAndMetadataFailures(t *testing.T) {
	for _, failure := range []error{windows.ERROR_ACCESS_DENIED, windows.ERROR_SHARING_VIOLATION, windows.ERROR_PROC_NOT_FOUND} {
		t.Run(failure.Error(), func(t *testing.T) {
			r, _, f := root03Fixture(t)
			f.openHook = func(n int) (windows.Handle, error) {
				if n == 1 {
					f.next = 100
					f.meta[100] = f.names["POS"]
					return 100, nil
				}
				return 0, failure
			}
			result, err := observeManagedTreeChildren(f, r)
			if result != nil || !errors.Is(err, failure) || len(f.opens) != 2 {
				t.Fatalf("result=%v err=%v", result, err)
			}
			root03AssertClosed(t, f)
		})
	}
	t.Run("child_identity_truncated", func(t *testing.T) {
		r, _, f := root03Fixture(t)
		e := f.names["file.txt"]
		e.id.FileID = [16]byte{}
		f.names["file.txt"] = e
		if result, err := observeManagedTreeChildren(f, r); err == nil || result != nil {
			t.Fatal("accepted missing File ID")
		}
		root03AssertClosed(t, f)
	})
	t.Run("child_attributes_truncated", func(t *testing.T) {
		r, _, f := root03Fixture(t)
		e := f.names["file.txt"]
		e.attr = managedRootAttributeTag{}
		f.names["file.txt"] = e
		if result, err := observeManagedTreeChildren(f, r); err == nil || result != nil {
			t.Fatal("accepted missing attributes")
		}
		root03AssertClosed(t, f)
	})
	t.Run("duplicate_live_handle", func(t *testing.T) {
		r, _, f := root03Fixture(t)
		f.next = 100
		f.meta[100] = f.names["POS"]
		f.openHook = func(int) (windows.Handle, error) { return 100, nil }
		if result, err := observeManagedTreeChildren(f, r); err == nil || result != nil {
			t.Fatal("accepted duplicate handle")
		}
		root03AssertClosed(t, f)
	})
}

func TestHUWIN002EROOT03PageLimitIsNotCompletion(t *testing.T) {
	r, _, f := root03Fixture(t)
	f.pages = nil
	for i := 0; i < managedTreeMaxPages; i++ {
		name := fmt.Sprintf("child_%d", i)
		id := managedRootTestID(byte(i + 10))
		attr := managedRootAttributeTag{FileAttributes: windows.FILE_ATTRIBUTE_NORMAL}
		f.names[name] = root03Metadata{id, attr}
		f.pages = append(f.pages, root03Page{entries: []managedTreeEntry{{name, id.FileID, attr}}})
	}
	result, err := observeManagedTreeChildren(f, r)
	if err == nil || result != nil || len(f.restarts) != managedTreeMaxPages {
		t.Fatalf("result=%v err=%v pages=%d", result, err, len(f.restarts))
	}
	root03AssertClosed(t, f)
}

func TestHUWIN002EROOT03NativeRejectsCapabilityExpansionWithoutSyscall(t *testing.T) {
	access, options := managedTreeOpenMode(true)
	cases := []root03Open{
		{42, "child", access, managedTreeShare | 4, managedTreeObjectFlags, windows.FILE_OPEN, options},
		{42, "child", access, managedTreeShare, 0, windows.FILE_OPEN, options},
		{42, "child", access, managedTreeShare, managedTreeObjectFlags, windows.FILE_CREATE, options},
		{42, "child", access, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, options | 0x1000},
		{42, "child", access | 0x10000, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, options},
	}
	for i, c := range cases {
		t.Run(fmt.Sprintf("reject_%d", i), func(t *testing.T) {
			h, err := (nativeManagedTreeAPI{}).OpenRelative(c.parent, c.name, c.access, c.share, c.flags, c.disposition, c.options)
			if err == nil || h != 0 {
				t.Fatalf("expanded capability: %v %v", h, err)
			}
		})
	}
}

// ROOT-04 is never enabled by an ordinary go test. The operator must supply a
// fresh, marked run directory directly beneath the current user's real TEMP.
// Fixtures are intentionally retained: no t.TempDir, remove, rename or ACL calls.
type root04NativeAudit struct {
	nativeManagedTreeAPI
	t *testing.T
}

func root04Evidence(t *testing.T, event string, detail any) {
	t.Helper()
	data, err := json.Marshal(map[string]any{"event": event, "at": time.Now().UTC(), "detail": detail})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("ROOT04_EVIDENCE %s", data)
}

func (a root04NativeAudit) OpenRelative(parent windows.Handle, name string, access, share, flags, disposition, options uint32) (windows.Handle, error) {
	h, err := a.nativeManagedTreeAPI.OpenRelative(parent, name, access, share, flags, disposition, options)
	root04Evidence(a.t, "NtCreateFile", map[string]any{"parentHandle": uint64(parent), "name": name, "access": fmt.Sprintf("%#x", access), "share": share, "objectFlags": fmt.Sprintf("%#x", flags), "disposition": disposition, "options": fmt.Sprintf("%#x", options), "error": fmt.Sprint(err), "validHandle": validManagedRootHandle(h)})
	return h, err
}

func (a root04NativeAudit) ReadDirectory(h windows.Handle, restart bool) ([]managedTreeEntry, bool, error) {
	entries, done, err := a.nativeManagedTreeAPI.ReadDirectory(h, restart)
	root04Evidence(a.t, "FileIdExtdDirectoryInfo", map[string]any{"restart": restart, "entries": entries, "complete": done, "error": fmt.Sprint(err)})
	return entries, done, err
}

func root04NoReparseChain(t *testing.T, path string) {
	t.Helper()
	for current := path; ; current = filepath.Dir(current) {
		info, err := os.Lstat(current)
		if err != nil {
			t.Fatal(err)
		}
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			t.Fatalf("ROOT04 non-directory/reparse ancestor %q", current)
		}
		pointer, err := windows.UTF16PtrFromString(current)
		if err != nil {
			t.Fatal(err)
		}
		attributes, err := windows.GetFileAttributes(pointer)
		if err != nil {
			t.Fatal(err)
		}
		if attributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
			t.Fatalf("ROOT04 reparse ancestor %q", current)
		}
		if filepath.Dir(current) == current {
			break
		}
	}
}

func TestHUWIN002EROOT04NativeObservation(t *testing.T) {
	if os.Getenv("MANUS_ROOT04_NATIVE") != "1" {
		t.Skip("ROOT04 native opt-in not enabled")
	}
	anchor, err := windows.KnownFolderPath(windows.FOLDERID_LocalAppData, windows.KF_FLAG_DEFAULT)
	if err != nil {
		t.Fatal(err)
	}
	run := os.Getenv("MANUS_ROOT04_RUN_ROOT")
	base := filepath.Base(run)
	if !strings.HasPrefix(base, "ManusRoot04-") || len(base) != len("ManusRoot04-")+32 {
		t.Fatal("invalid exclusive run identity")
	}
	if !strings.EqualFold(filepath.Clean(run), filepath.Join(anchor, "Temp", base)) {
		t.Fatal("run root is not directly under Known-Folder TEMP")
	}
	marker, err := os.ReadFile(filepath.Join(run, "operation.txt"))
	if err != nil || string(marker) != strings.TrimPrefix(base, "ManusRoot04-") {
		t.Fatal("run marker mismatch")
	}
	root04NoReparseChain(t, run)
	var elevation, returned uint32
	err = windows.GetTokenInformation(windows.GetCurrentProcessToken(), windows.TokenElevation, (*byte)(unsafe.Pointer(&elevation)), 4, &returned)
	if err != nil || returned != 4 || elevation != 0 {
		t.Fatalf("requires verified non-elevated token: elevated=%d size=%d error=%v", elevation, returned, err)
	}
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		t.Fatal(err)
	}
	sidHash := sha256.Sum256([]byte(user.User.Sid.String()))
	version := windows.RtlGetVersion()
	root04Evidence(t, "host", map[string]any{"windowsBuild": version.BuildNumber, "windowsMajor": version.MajorVersion, "windowsMinor": version.MinorVersion, "sidSHA256": fmt.Sprintf("%x", sidHash), "elevated": false, "run": run})
	// No existing fixture is adopted. os.Mkdir fails if either name exists.
	fixture := filepath.Join(run, "fixture")
	sentinelDir := filepath.Join(run, "sentinel")
	for _, dir := range []string{fixture, sentinelDir, filepath.Join(fixture, "parent"), filepath.Join(fixture, "other"), filepath.Join(fixture, "parent", "folder"), filepath.Join(fixture, "parent", "locked")} {
		if err := os.Mkdir(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	create := func(path, content string) {
		t.Helper()
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			t.Fatal(err)
		}
		_, writeErr := f.WriteString(content)
		closeErr := f.Close()
		if err := errors.Join(writeErr, closeErr); err != nil {
			t.Fatal(err)
		}
	}
	sentinel := filepath.Join(sentinelDir, "sentinel.txt")
	create(sentinel, "ROOT04 external controlled sentinel "+string(marker))
	create(filepath.Join(fixture, "parent", "file.txt"), "ROOT04 benign initial content")
	create(filepath.Join(fixture, "other", "file.txt"), "ROOT04 same name in other parent")
	hashFile := func(path string) [32]byte {
		t.Helper()
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		return sha256.Sum256(data)
	}
	sentinelInitial := hashFile(sentinel)
	root04Evidence(t, "sentinel_initial", map[string]any{"path": sentinel, "sha256": fmt.Sprintf("%x", sentinelInitial)})
	t.Cleanup(func() {
		data, err := os.ReadFile(sentinel)
		if err != nil {
			t.Errorf("sentinel final read failed: %v", err)
			return
		}
		final := sha256.Sum256(data)
		root04Evidence(t, "sentinel_final", map[string]any{"path": sentinel, "sha256": fmt.Sprintf("%x", final), "unchanged": final == sentinelInitial})
		if final != sentinelInitial {
			t.Error("STOP: sentinel changed")
		}
	})
	relative, err := filepath.Rel(anchor, filepath.Join(fixture, "parent"))
	if err != nil {
		t.Fatal(err)
	}
	root, err := observeManagedRootIdentity(nativeManagedRootIdentityAPI{}, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: relative})
	if err != nil {
		t.Fatalf("native ROOT01 preflight: %v", err)
	}
	t.Cleanup(func() {
		if err := root.Close(); err != nil {
			t.Errorf("ROOT01 close: %v", err)
		}
	})
	api := root04NativeAudit{t: t}
	parent := root.components[len(root.components)-1]
	fs, err := api.FileSystem(parent.handle)
	root04Evidence(t, "GetVolumeInformationByHandle", map[string]any{"filesystem": fs, "error": fmt.Sprint(err)})
	if err != nil || fs != "NTFS" {
		t.Fatalf("STOP: filesystem not proved NTFS: %q %v", fs, err)
	}
	root04Evidence(t, "parent_initial", parent.identity)
	caseRun := func(name string, fn func(*testing.T)) {
		t.Helper()
		if !t.Run(name, func(st *testing.T) {
			start := time.Now()
			defer func() {
				root04Evidence(st, "case", map[string]any{"name": name, "failed": st.Failed(), "skipped": st.Skipped(), "elapsedMS": time.Since(start).Milliseconds()})
			}()
			fn(st)
		}) {
			t.FailNow()
		}
	}
	closeHandle := func(st *testing.T, h windows.Handle) {
		st.Helper()
		if validManagedRootHandle(h) {
			if err := api.CloseHandle(h); err != nil {
				st.Errorf("close native handle: %v", err)
			}
		}
	}
	openChild := func(st *testing.T, name string, directory bool) windows.Handle {
		st.Helper()
		access, options := managedTreeOpenMode(directory)
		h, err := api.OpenRelative(parent.handle, name, access, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, options)
		if err != nil {
			closeHandle(st, h)
			st.Fatal(err)
		}
		return h
	}
	caseRun("relative_open_and_raw_NTSTATUS", func(st *testing.T) {
		oa, err := managedTreeRelativeAttributes(parent.handle, "file.txt")
		if err != nil {
			st.Fatal(err)
		}
		var h windows.Handle
		var iosb windows.IO_STATUS_BLOCK
		err = windows.NtCreateFile(&h, windows.FILE_READ_ATTRIBUTES, oa, &iosb, nil, 0, managedTreeShare, windows.FILE_OPEN, windows.FILE_OPEN_REPARSE_POINT|windows.FILE_NON_DIRECTORY_FILE, 0, 0)
		defer closeHandle(st, h)
		root04Evidence(st, "raw_NtCreateFile", map[string]any{"error": fmt.Sprint(err), "ioStatus": fmt.Sprintf("%#x", uint32(iosb.Status)), "information": iosb.Information, "rootDirectory": uint64(oa.RootDirectory), "access": "0x80", "share": "0x3", "objectFlags": "0x1000", "options": "0x200040"})
		if err != nil || iosb.Status != 0 || iosb.Information != 1 || !validManagedRootHandle(h) {
			st.Fatal("NtCreateFile did not confirm existing relative file")
		}
		id, err := api.FileIdentity(h)
		if err != nil {
			st.Fatal(err)
		}
		attr, err := api.AttributeTag(h)
		if err != nil {
			st.Fatal(err)
		}
		path, err := api.FinalPath(h)
		if err != nil {
			st.Fatal(err)
		}
		root04Evidence(st, "relative_file", map[string]any{"identity": id, "attribute": attr, "finalPath": path})
		actual, err := normalizeManagedRootFinalPath(path)
		if err != nil || !strings.EqualFold(actual, filepath.Join(fixture, "parent", "file.txt")) {
			st.Fatal("relative handle escaped its parent")
		}
		if id.VolumeSerialNumber != parent.identity.VolumeSerialNumber || isZeroFileID(id.FileID) || attr.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0 {
			st.Fatal("file identity/type mismatch")
		}
	})
	caseRun("effective_RootDirectory", func(st *testing.T) {
		otherPath := filepath.Join(fixture, "other")
		other, err := api.OpenDirectory(otherPath, managedRootDesiredAccess, managedRootShareMode, managedRootCreationMode, managedRootOpenFlags)
		if err != nil {
			st.Fatal(err)
		}
		defer closeHandle(st, other)
		a := openChild(st, "file.txt", false)
		defer closeHandle(st, a)
		access, options := managedTreeOpenMode(false)
		b, err := api.OpenRelative(other, "file.txt", access, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, options)
		defer closeHandle(st, b)
		if err != nil {
			st.Fatal(err)
		}
		idA, errA := api.FileIdentity(a)
		idB, errB := api.FileIdentity(b)
		root04Evidence(st, "same_name_different_parent", map[string]any{"first": idA, "second": idB})
		if errA != nil || errB != nil || idA == idB {
			st.Fatal("RootDirectory identities not distinguished")
		}
	})
	caseRun("complete_enumeration_and_directory_metadata", func(st *testing.T) {
		result, err := observeManagedTreeChildren(api, root)
		root04Evidence(st, "observed_children", map[string]any{"result": result, "error": fmt.Sprint(err)})
		if err != nil || result == nil || len(result.Children) != 3 {
			st.Fatal("native enumeration incomplete")
		}
		want := map[string]bool{"file.txt": false, "folder": true, "locked": true}
		for _, child := range result.Children {
			directory, ok := want[child.Name]
			if !ok || (child.Attribute.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0) != directory {
				st.Fatal("unexpected enumerated type")
			}
		}
	})
	caseRun("benign_content_change_revalidation", func(st *testing.T) {
		h := openChild(st, "file.txt", false)
		defer closeHandle(st, h)
		before, err := api.FileIdentity(h)
		if err != nil {
			st.Fatal(err)
		}
		f, err := os.OpenFile(filepath.Join(fixture, "parent", "file.txt"), os.O_WRONLY|os.O_APPEND, 0)
		if err != nil {
			st.Fatal(err)
		}
		_, writeErr := f.WriteString("\nROOT04 approved benign append")
		closeErr := f.Close()
		if err := errors.Join(writeErr, closeErr); err != nil {
			st.Fatal(err)
		}
		after, err := api.FileIdentity(h)
		if err != nil || before != after {
			st.Fatal("identity changed after append")
		}
		if err := root.Revalidate(); err != nil {
			st.Fatal(err)
		}
		result, err := observeManagedTreeChildren(api, root)
		if err != nil || result == nil {
			st.Fatal(err)
		}
		root04Evidence(st, "benign_append_identity", map[string]any{"before": before, "after": after, "fixtureFileSHA256": fmt.Sprintf("%x", hashFile(filepath.Join(fixture, "parent", "file.txt")))})
	})
	caseRun("coexisting_read_only_observation_handles", func(st *testing.T) {
		a := openChild(st, "file.txt", false)
		defer closeHandle(st, a)
		b := openChild(st, "file.txt", false)
		defer closeHandle(st, b)
		idA, errA := api.FileIdentity(a)
		idB, errB := api.FileIdentity(b)
		if errA != nil || errB != nil || a == b || idA != idB {
			st.Fatal("coexisting read-only identities inconsistent")
		}
		root04Evidence(st, "coexisting_handles", map[string]any{"identity": idA, "access": "0x80", "share": "0x3"})
	})
	caseRun("sharing_conflict_fail_closed_and_recovery", func(st *testing.T) {
		pointer, err := windows.UTF16PtrFromString(filepath.Join(fixture, "parent", "locked"))
		if err != nil {
			st.Fatal(err)
		}
		h, err := windows.CreateFile(pointer, windows.FILE_LIST_DIRECTORY|windows.FILE_READ_ATTRIBUTES, 0, nil, windows.OPEN_EXISTING, managedRootOpenFlags, 0)
		if err != nil {
			st.Fatal(err)
		}
		closed := false
		defer func() {
			if !closed {
				closeHandle(st, h)
			}
		}()
		result, err := observeManagedTreeChildren(api, root)
		root04Evidence(st, "sharing_conflict", map[string]any{"resultNil": result == nil, "error": fmt.Sprint(err)})
		if result != nil || !errors.Is(err, windows.NTStatus(0xC0000043)) {
			st.Fatal("sharing conflict did not fail closed with STATUS_SHARING_VIOLATION")
		}
		closed = true
		if err := api.CloseHandle(h); err != nil {
			st.Fatal(err)
		}
		result, err = observeManagedTreeChildren(api, root)
		if err != nil || result == nil {
			st.Fatal("observation did not recover after lock close")
		}
	})
	caseRun("invalid_names_rejected_without_native_open", func(st *testing.T) {
		for _, name := range []string{"..", `.\file.txt`, `folder/file.txt`, `file.txt:stream`, `C:\outside`, "a\x00b"} {
			h, err := api.OpenRelative(parent.handle, name, windows.FILE_READ_ATTRIBUTES, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, windows.FILE_OPEN_REPARSE_POINT|windows.FILE_NON_DIRECTORY_FILE)
			if validManagedRootHandle(h) || err == nil {
				closeHandle(st, h)
				st.Fatal("invalid name accepted")
			}
		}
	})
	caseRun("external_reparse_rejected_no_follow", func(st *testing.T) {
		link := filepath.Join(fixture, "parent", "current")
		linkPointer, err := windows.UTF16PtrFromString(link)
		if err != nil {
			st.Fatal(err)
		}
		targetPointer, err := windows.UTF16PtrFromString(sentinelDir)
		if err != nil {
			st.Fatal(err)
		}
		// 0x2 is the documented SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE.
		err = windows.CreateSymbolicLink(linkPointer, targetPointer, windows.SYMBOLIC_LINK_FLAG_DIRECTORY|0x2)
		root04Evidence(st, "CreateSymbolicLink_unprivileged", map[string]any{"link": link, "target": sentinelDir, "error": fmt.Sprint(err)})
		if errors.Is(err, windows.ERROR_PRIVILEGE_NOT_HELD) || errors.Is(err, windows.ERROR_ACCESS_DENIED) || errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
			st.Skipf("NOT_RUN: unprivileged symlink unavailable: %v", err)
		}
		if err != nil {
			st.Fatal(err)
		}
		access, options := managedTreeOpenMode(true)
		h, openErr := api.OpenRelative(parent.handle, "current", access, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, options)
		defer closeHandle(st, h)
		if openErr != nil {
			if !errors.Is(openErr, windows.STATUS_REPARSE_POINT_ENCOUNTERED) {
				st.Fatalf("unexpected reparse status: %v", openErr)
			}
		} else {
			attr, err := api.AttributeTag(h)
			if err != nil || attr.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT == 0 {
				st.Fatal("STOP: external target followed")
			}
			root04Evidence(st, "no_follow_link_metadata", attr)
		}
		result, err := observeManagedTreeChildren(api, root)
		if err == nil || result != nil {
			st.Fatal("external current reparse accepted")
		}
		root04Evidence(st, "reparse_fail_closed", map[string]any{"resultNil": result == nil, "error": fmt.Sprint(err)})
	})
	caseRun("final_parent_identity", func(st *testing.T) {
		if err := root.Revalidate(); err != nil {
			st.Fatal(err)
		}
		final, err := api.FileIdentity(parent.handle)
		if err != nil || final != parent.identity {
			st.Fatal("final parent identity mismatch")
		}
		root04Evidence(st, "parent_final", final)
	})
}

// ROOT-05C-A uses only existing R3 objects. All helpers below are test-local;
// neither the observation API nor the simulated disposition API is expanded.
// SDK: https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_standard_info
// BOOLEAN is one byte, not the four-byte Win32 BOOL. AMD64 adds two tail bytes.
type root05caStandardInfo struct {
	AllocationSize int64
	EndOfFile      int64
	NumberOfLinks  uint32
	DeletePending  uint8
	Directory      uint8
	Padding        [2]byte
}

func root05caCheckABI() error {
	var info root05caStandardInfo
	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" || unsafe.Sizeof(info) != 24 || unsafe.Alignof(info) != 8 ||
		unsafe.Offsetof(info.AllocationSize) != 0 || unsafe.Offsetof(info.EndOfFile) != 8 ||
		unsafe.Offsetof(info.NumberOfLinks) != 16 || unsafe.Offsetof(info.DeletePending) != 20 || unsafe.Offsetof(info.Directory) != 21 ||
		unsafe.Offsetof(info.Padding) != 22 || windows.FileStandardInfo != 1 {
		return errors.New("unsupported FILE_STANDARD_INFO ABI")
	}
	return nil
}

func root05caDecodeStandard(data []byte) (root05caStandardInfo, error) {
	if err := root05caCheckABI(); err != nil {
		return root05caStandardInfo{}, err
	}
	if len(data) != 24 {
		return root05caStandardInfo{}, errors.New("incomplete FILE_STANDARD_INFO buffer")
	}
	info := root05caStandardInfo{
		AllocationSize: int64(binary.LittleEndian.Uint64(data[0:8])), EndOfFile: int64(binary.LittleEndian.Uint64(data[8:16])),
		NumberOfLinks: binary.LittleEndian.Uint32(data[16:20]), DeletePending: data[20], Directory: data[21],
	}
	if info.AllocationSize < 0 || info.EndOfFile < 0 || info.NumberOfLinks == 0 || info.DeletePending > 1 || info.Directory > 1 {
		return root05caStandardInfo{}, errors.New("invalid or incomplete FILE_STANDARD_INFO fields")
	}
	return info, nil
}

func root05caQueryStandard(h windows.Handle, length uint32) (root05caStandardInfo, error) {
	if err := root05caCheckABI(); err != nil || !validManagedRootHandle(h) || (length != 1 && length != 24) {
		return root05caStandardInfo{}, errors.Join(err, errors.New("invalid standard-info observation request"))
	}
	// Aligned backing, eight-byte canaries on both sides. Failed calls are never decoded.
	backing := [5]uint64{0xa5a5a5a5a5a5a5a5, 0xcccccccccccccccc, 0xcccccccccccccccc, 0xcccccccccccccccc, 0xa5a5a5a5a5a5a5a5}
	err := windows.GetFileInformationByHandleEx(h, windows.FileStandardInfo, (*byte)(unsafe.Pointer(&backing[1])), length)
	if backing[0] != 0xa5a5a5a5a5a5a5a5 || backing[4] != 0xa5a5a5a5a5a5a5a5 {
		return root05caStandardInfo{}, errors.Join(err, errors.New("FILE_STANDARD_INFO canary changed"))
	}
	if err != nil {
		return root05caStandardInfo{}, err
	}
	if length != 24 {
		return root05caStandardInfo{}, errors.New("undersized query unexpectedly succeeded")
	}
	// GetFileInformationByHandleEx has no returned-length parameter. The exact ABI,
	// call success, field validation and independent basic-info comparison are gates;
	// this does not claim arbitrary driver truncation can always be detected.
	data := unsafe.Slice((*byte)(unsafe.Pointer(&backing[1])), 24)
	info, err := root05caDecodeStandard(data)
	runtime.KeepAlive(backing)
	return info, err
}

type root05caAudit struct {
	nativeManagedRootIdentityAPI
	live           map[windows.Handle]bool
	opened, closed int
	closeErrors    int
	events         []map[string]any
}

func (a *root05caAudit) own(h windows.Handle, err error) (windows.Handle, error) {
	if validManagedRootHandle(h) {
		if a.live[h] {
			return 0, errors.Join(err, errors.New("native handle aliases a live handle"))
		}
		a.live[h] = true
		a.opened++
		if err != nil {
			return 0, errors.Join(err, a.CloseHandle(h))
		}
	} else if err == nil {
		err = errors.New("native success returned invalid handle")
	}
	return h, err
}

func (a *root05caAudit) CloseHandle(h windows.Handle) error {
	if !a.live[h] {
		return errors.New("duplicate or unowned handle close")
	}
	delete(a.live, h) // One close attempt, including a failed close; never retry it.
	a.closed++
	err := windows.CloseHandle(h)
	if err != nil {
		a.closeErrors++
	}
	a.events = append(a.events, map[string]any{"api": "CloseHandle", "win32Error": fmt.Sprint(err)})
	return err
}

func (a *root05caAudit) OpenDirectory(path string, access, share, creation, flags uint32) (windows.Handle, error) {
	if access != managedRootDesiredAccess || share != managedRootShareMode || creation != windows.OPEN_EXISTING || flags != managedRootOpenFlags {
		return 0, errors.New("ROOT-01 read-only open contract changed")
	}
	h, err := a.nativeManagedRootIdentityAPI.OpenDirectory(path, access, share, creation, flags)
	a.events = append(a.events, map[string]any{"api": "CreateFileW directory", "access": access, "share": share, "flags": flags, "win32Error": fmt.Sprint(err)})
	return a.own(h, err)
}

func (a *root05caAudit) OpenRelative(parent windows.Handle, name string, access, share, flags, disposition, options uint32) (windows.Handle, error) {
	// READ_CONTROL is used exclusively for owner/DACL queries. No generic rights,
	// DELETE, SYNCHRONIZE, writes, create-if-missing or delete-on-close are accepted.
	directory := options&windows.FILE_DIRECTORY_FILE != 0
	want, wantOptions := managedTreeOpenMode(directory)
	if !a.live[parent] || (access != want && access != want|windows.READ_CONTROL) ||
		(share != 3 && share != 7) || flags != windows.OBJ_DONT_REPARSE || disposition != windows.FILE_OPEN || options != wantOptions {
		return 0, errors.New("non-observational test open rejected")
	}
	oa, err := managedTreeRelativeAttributes(parent, name)
	if err != nil {
		return 0, err
	}
	var h windows.Handle
	var iosb windows.IO_STATUS_BLOCK
	err = windows.NtCreateFile(&h, access, oa, &iosb, nil, 0, share, disposition, options, 0, 0)
	runtime.KeepAlive(oa)
	status := uint32(0)
	if err != nil {
		if nt, ok := err.(windows.NTStatus); ok {
			status = uint32(nt)
		}
	}
	a.events = append(a.events, map[string]any{"api": "NtCreateFile", "name": name, "access": access, "share": share, "objectFlags": flags, "options": options, "ntstatus": fmt.Sprintf("0x%08X", status), "error": fmt.Sprint(err)})
	if err == nil && (iosb.Status != 0 || iosb.Information != 1) {
		err = errors.New("NtCreateFile did not confirm FILE_OPENED")
	}
	return a.own(h, err)
}

func (*root05caAudit) ReadDirectory(h windows.Handle, restart bool) ([]managedTreeEntry, bool, error) {
	return (nativeManagedTreeAPI{}).ReadDirectory(h, restart)
}
func (*root05caAudit) FileSystem(h windows.Handle) (string, error) {
	return (nativeManagedTreeAPI{}).FileSystem(h)
}

// Fixed previously certified R3 inventory. No environment path is fixture authority.
func TestHUWIN002EROOT05CANativeMetadata(t *testing.T) {
	if os.Getenv("MANUS_ROOT05CA_NATIVE") != "1" {
		t.Skip("ROOT05C-A read-only native opt-in not enabled")
	}
	if err := root05caCheckABI(); err != nil {
		t.Fatal("STOP: ABI", err)
	}
	for _, proc := range []struct{ dll, name string }{{"kernel32.dll", "GetFileInformationByHandleEx"}, {"ntdll.dll", "NtCreateFile"}} {
		if err := windows.NewLazySystemDLL(proc.dll).NewProc(proc.name).Find(); err != nil {
			t.Fatal("STOP: API unavailable", proc.name, err)
		}
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	started := time.Now()
	a := &root05caAudit{live: make(map[windows.Handle]bool)}
	var roots []*managedRootObservation
	var stages []map[string]any
	defer func() {
		for i := len(roots) - 1; i >= 0; i-- {
			if err := roots[i].Close(); err != nil {
				t.Error("STOP: ROOT-01 close", err)
			}
		}
		if len(a.live) != 0 {
			t.Error("STOP: unexpected outstanding handles", len(a.live))
			for h := range a.live {
				if err := a.CloseHandle(h); err != nil {
					t.Error("cleanup close only", err)
				}
			}
		}
		deleteRequests := 0
		for _, event := range a.events {
			if access, ok := event["access"].(uint32); ok && access&windows.DELETE != 0 {
				deleteRequests++
			}
		}
		if deleteRequests != 0 || a.closeErrors != 0 || a.opened != a.closed {
			t.Error("STOP: access/close accounting failed")
		}
		data, err := json.Marshal(map[string]any{"phase": "HU-WIN-002E-ROOT-05C-A", "failed": t.Failed(), "outcome": "observation-only; no disposition", "abiSize": 24, "abiOffsets": []int{0, 8, 16, 20, 21}, "windowsBuild": windows.RtlGetVersion().BuildNumber, "stages": stages, "events": a.events, "handlesOpened": a.opened, "closeAttempts": a.closed, "closeErrors": a.closeErrors, "remainingHandles": len(a.live), "elapsedMS": time.Since(started).Milliseconds(), "deleteRequests": deleteRequests, "namespaceMutations": 0, "limitations": "point-in-time observation; no namespace exclusion; positive DeletePending NOT_RUN"})
		if err != nil {
			t.Error(err)
		} else {
			t.Logf("ROOT05CA_REPORT %s", data)
		}
	}()
	check := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal("STOP:", err)
		}
		if time.Since(started) > 30*time.Second {
			t.Fatal("STOP: soft operation budget exceeded; no implied I/O cancellation")
		}
	}
	// This is a query-only process-token pseudo-handle. No product process is opened.
	tokenFrame := func() string {
		t.Helper()
		thread, err := windows.GetCurrentThread()
		check(err)
		var impersonation windows.Token
		err = windows.OpenThreadToken(thread, windows.TOKEN_QUERY, true, &impersonation)
		if err == nil {
			check(errors.Join(errors.New("impersonation rejected"), impersonation.Close()))
		}
		if !errors.Is(err, windows.ERROR_NO_TOKEN) {
			check(err)
		}
		tok := windows.GetCurrentProcessToken()
		scalar := func(class uint32) uint32 {
			var value, n uint32
			check(windows.GetTokenInformation(tok, class, (*byte)(unsafe.Pointer(&value)), 4, &n))
			if n != 4 {
				t.Fatal("STOP: incomplete token scalar")
			}
			return value
		}
		buffer := func(class uint32) []byte {
			buf := make([]byte, 65536)
			var n uint32
			check(windows.GetTokenInformation(tok, class, &buf[0], uint32(len(buf)), &n))
			if n == 0 || n > uint32(len(buf)) {
				t.Fatal("STOP: incomplete token buffer")
			}
			return buf[:n]
		}
		inBuffer := func(buf []byte, sid *windows.SID) bool {
			start := uintptr(unsafe.Pointer(&buf[0]))
			p := uintptr(unsafe.Pointer(sid))
			return sid != nil && p >= start && p+8 <= start+uintptr(len(buf)) && sid.IsValid() && p+uintptr(sid.Len()) <= start+uintptr(len(buf))
		}
		groups := func(class uint32) []map[string]any {
			buf := buffer(class)
			offset := unsafe.Offsetof(windows.Tokengroups{}.Groups)
			if uintptr(len(buf)) < offset {
				t.Fatal("STOP: truncated groups")
			}
			g := (*windows.Tokengroups)(unsafe.Pointer(&buf[0]))
			if offset+uintptr(g.GroupCount)*unsafe.Sizeof(windows.SIDAndAttributes{}) > uintptr(len(buf)) {
				t.Fatal("STOP: truncated group entries")
			}
			rows := make([]map[string]any, 0, g.GroupCount)
			for _, item := range g.AllGroups() {
				if !inBuffer(buf, item.Sid) {
					t.Fatal("STOP: invalid group SID")
				}
				rows = append(rows, map[string]any{"sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(item.Sid.String()))), "attributes": item.Attributes})
			}
			runtime.KeepAlive(buf)
			return rows
		}
		kind, elevation, session := scalar(windows.TokenType), scalar(windows.TokenElevation), scalar(windows.TokenSessionId)
		integrity := buffer(windows.TokenIntegrityLevel)
		if len(integrity) < int(unsafe.Sizeof(windows.Tokenmandatorylabel{})) {
			t.Fatal("STOP: truncated integrity")
		}
		label := (*windows.Tokenmandatorylabel)(unsafe.Pointer(&integrity[0]))
		if kind != windows.TokenPrimary || elevation != 0 || session == 0 || !inBuffer(integrity, label.Label.Sid) || label.Label.Sid.String() != "S-1-16-8192" {
			t.Fatal("STOP: non-elevated interactive primary Medium token required")
		}
		runtime.KeepAlive(integrity)
		restricted := groups(windows.TokenRestrictedSids)
		if len(restricted) != 0 {
			t.Fatal("STOP: restricted token outside fixture contract")
		}
		user, err := tok.GetTokenUser()
		check(err)
		if user.User.Sid == nil || !user.User.Sid.IsValid() {
			t.Fatal("STOP: invalid user SID")
		}
		data, err := json.Marshal(map[string]any{"sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(user.User.Sid.String()))), "type": kind, "elevation": elevation, "elevationType": scalar(windows.TokenElevationType), "session": session, "integrity": "Medium", "groups": groups(windows.TokenGroups), "restrictedSIDs": restricted, "impersonation": false})
		check(err)
		return string(data)
	}
	initialToken := tokenFrame()
	stages = append(stages, map[string]any{"stage": "token", "frame": json.RawMessage(initialToken)})
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	check(err)
	if fmt.Sprintf("%x", sha256.Sum256([]byte(user.User.Sid.String()))) != "e24a12cc55cabbe6b85340bcf725244bb5c283ab4ab2fd2a7ee3ee64374fad34" {
		t.Fatal("STOP: R3 owner token changed")
	}
	anchor, err := windows.KnownFolderPath(windows.FOLDERID_LocalAppData, windows.KF_FLAG_DEFAULT)
	check(err)
	const suffix = "df1ceb065628d80b59dd8ecf216704c3"
	fixture := filepath.Join(anchor, "Temp", "ManusRoot05BR3-fixture-"+suffix)
	evidence := filepath.Join(anchor, "Temp", "ManusRoot05BR3-evidence-"+suffix)
	root04NoReparseChain(t, fixture)
	root04NoReparseChain(t, evidence)
	for _, relative := range []string{filepath.Join("Temp", filepath.Base(fixture)), filepath.Join("Temp", filepath.Base(evidence))} {
		root, err := observeManagedRootIdentity(a, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: relative})
		check(err)
		roots = append(roots, root)
	}
	identityJSON := func(id managedRootFileIdentity) map[string]string {
		return map[string]string{"volume": fmt.Sprintf("%d", id.VolumeSerialNumber), "fileId": fmt.Sprintf("%x", id.FileID)}
	}
	security := func(h windows.Handle, directory bool, mask uint32) string {
		t.Helper()
		sd, err := windows.GetSecurityInfo(h, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
		check(err)
		if !sd.IsValid() {
			t.Fatal("STOP: invalid security descriptor")
		}
		owner, _, err := sd.Owner()
		check(err)
		control, _, err := sd.Control()
		check(err)
		if owner == nil || !owner.Equals(user.User.Sid) || (control&windows.SE_DACL_PROTECTED != 0) != directory {
			t.Fatal("STOP: owner/protection changed")
		}
		acl, _, err := sd.DACL()
		check(err)
		wants := []struct {
			mask  uint32
			flags uint8
		}{{mask, windows.INHERITED_ACE}}
		if directory {
			wants = []struct {
				mask  uint32
				flags uint8
			}{{0x1200a3, 0}, {mask, windows.OBJECT_INHERIT_ACE | windows.INHERIT_ONLY_ACE}}
		}
		if acl == nil || int(acl.AceCount) != len(wants) {
			t.Fatal("STOP: missing DACL or unexpected ACE count")
		}
		for i, want := range wants {
			var ace *windows.ACCESS_ALLOWED_ACE
			check(windows.GetAce(acl, uint32(i), &ace))
			if ace == nil || ace.Header.AceType != windows.ACCESS_ALLOWED_ACE_TYPE || ace.Header.AceSize < 12 || uint32(ace.Mask) != want.mask || ace.Header.AceFlags != want.flags {
				t.Fatal("STOP: ACE contract changed")
			}
			sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart))
			if !sid.IsValid() || sid.Len()+8 > int(ace.Header.AceSize) || !sid.Equals(user.User.Sid) {
				t.Fatal("STOP: external or invalid ACE")
			}
		}
		sddl := sd.String()
		if sddl == "" {
			t.Fatal("STOP: missing SDDL")
		}
		runtime.KeepAlive(sd)
		return sddl
	}
	open := func(parent windows.Handle, name string, directory, acl bool) windows.Handle {
		t.Helper()
		access, options := managedTreeOpenMode(directory)
		if acl {
			access |= windows.READ_CONTROL
		}
		h, err := a.OpenRelative(parent, name, access, 7, managedTreeObjectFlags, windows.FILE_OPEN, options)
		check(err)
		return h
	}
	var parents [2]windows.Handle
	for i, root := range roots {
		component := root.components[len(root.components)-1]
		ancestor := root.components[len(root.components)-2]
		parents[i] = open(ancestor.handle, filepath.Base(component.lexicalPath), true, true)
		id, err := a.FileIdentity(parents[i])
		check(err)
		wantID := "61d60500000004000000000000000000"
		if i == 1 {
			wantID = "6dd60500000004000000000000000000"
		}
		fs, err := a.FileSystem(parents[i])
		check(err)
		if fmt.Sprintf("%x", id.FileID) != wantID || id.VolumeSerialNumber != 5518860861372801062 || id != component.identity || fs != "NTFS" {
			t.Fatal("STOP: retained R3 directory identity/filesystem changed")
		}
		mask := uint32(0x13019f)
		if i == 1 {
			mask = 0x12019f
		}
		security(parents[i], true, mask) // Validate protected parent before reading contents.
	}
	// This read uses a no-follow, OPEN_EXISTING synchronous read handle solely for
	// bounded hashing. Metadata probes themselves remain parent-relative Nt opens.
	snapshot := func(index int, name, wantID, wantHash string, mask uint32) map[string]any {
		t.Helper()
		root := roots[index]
		check(root.Revalidate())
		path := filepath.Join(root.components[len(root.components)-1].lexicalPath, name)
		ptr, err := windows.UTF16PtrFromString(path)
		check(err)
		h, err := windows.CreateFile(ptr, windows.FILE_READ_ATTRIBUTES|windows.FILE_READ_DATA|windows.READ_CONTROL, 7, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
		a.events = append(a.events, map[string]any{"api": "CreateFileW hash", "access": uint32(windows.FILE_READ_ATTRIBUTES | windows.FILE_READ_DATA | windows.READ_CONTROL), "share": 7, "flags": windows.FILE_FLAG_OPEN_REPARSE_POINT, "win32Error": fmt.Sprint(err)})
		h, err = a.own(h, err)
		check(err)
		defer func() {
			if err := a.CloseHandle(h); err != nil {
				t.Error("snapshot close", err)
			}
		}()
		id, err := a.FileIdentity(h)
		check(err)
		attr, err := a.AttributeTag(h)
		check(err)
		check(validateManagedTreeAttribute(attr))
		final, err := a.FinalPath(h)
		check(err)
		final, err = normalizeManagedRootFinalPath(final)
		check(err)
		if !strings.EqualFold(final, path) || fmt.Sprintf("%x", id.FileID) != wantID || id.VolumeSerialNumber != 5518860861372801062 || attr.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0 {
			t.Fatal("STOP: snapshot identity/path/type changed")
		}
		sddl := security(h, false, mask)
		digest := sha256.New()
		var buf [4096]byte
		total := 0
		for {
			var n uint32
			err := windows.ReadFile(h, buf[:], &n, nil)
			if err != nil && !errors.Is(err, windows.ERROR_HANDLE_EOF) {
				check(err)
			}
			if n == 0 {
				break
			}
			digest.Write(buf[:n])
			total += int(n)
			if total > 65536 {
				t.Fatal("STOP: fixture file exceeds bound")
			}
		}
		hash := fmt.Sprintf("%x", digest.Sum(nil))
		if hash != wantHash {
			t.Fatal("STOP: historical hash mismatch", name)
		}
		check(compareManagedTreeMetadata(a, h, id, attr))
		check(root.Revalidate())
		return map[string]any{"path": final, "identity": identityJSON(id), "sha256": hash, "sddl": sddl, "size": total}
	}
	const targetID = "6ed60500000004000000000000000000"
	const targetHash = "75165c043f91f30c42680bc85d71b14e81139da24808d02fc1164af09fbf56f9"
	const sentinelID = "77d60500000004000000000000000000"
	const sentinelHash = "3c1dafb32dc27ad25ed3a76a0da59e3595696b7ea75d285ef8f7de0f1593d581"
	state := func() map[string]any {
		check(roots[0].Revalidate())
		check(roots[1].Revalidate())
		return map[string]any{"target": snapshot(0, "target.txt", targetID, targetHash, 0x13019f), "sentinel": snapshot(1, "sentinel.txt", sentinelID, sentinelHash, 0x12019f), "fixtureSDDL": security(parents[0], true, 0x13019f), "evidenceSDDL": security(parents[1], true, 0x12019f)}
	}
	initial := state()
	stages = append(stages, map[string]any{"stage": "initial", "state": initial})
	for _, length := range []int{0, 1, 20, 22, 23, 25} {
		if _, err := root05caDecodeStandard(make([]byte, length)); err == nil {
			t.Fatal("truncated decoder input accepted", length)
		}
	}
	h1 := open(parents[0], "target.txt", false, true)
	h2 := open(parents[0], "target.txt", false, true)
	for i, h := range []windows.Handle{h1, h2} {
		info, err := root05caQueryStandard(h, 24)
		check(err)
		var basic windows.ByHandleFileInformation
		check(windows.GetFileInformationByHandle(h, &basic))
		if info.NumberOfLinks != basic.NumberOfLinks || uint64(info.EndOfFile) != uint64(basic.FileSizeHigh)<<32|uint64(basic.FileSizeLow) || info.Directory != 0 || info.DeletePending != 0 || info.NumberOfLinks != 1 {
			t.Fatal("STOP: standard-info cross-check or regular fixture contract failed", info)
		}
		id, err := a.FileIdentity(h)
		check(err)
		attr, err := a.AttributeTag(h)
		check(err)
		check(validateManagedTreeAttribute(attr))
		if fmt.Sprintf("%x", id.FileID) != targetID || id.VolumeSerialNumber != roots[0].components[len(roots[0].components)-1].identity.VolumeSerialNumber {
			t.Fatal("STOP: target handle identity differs")
		}
		stages = append(stages, map[string]any{"stage": "metadata", "handleIndex": i, "identity": identityJSON(id), "standard": info, "attributes": attr, "security": security(h, false, 0x13019f)})
	}
	_, shortErr := root05caQueryStandard(h1, 1)
	var errno windows.Errno
	if shortErr == nil || !errors.As(shortErr, &errno) {
		t.Fatal("STOP: short buffer must return a Win32 API error", shortErr)
	}
	stages = append(stages, map[string]any{"stage": "short_buffer", "size": 1, "win32Error": uint32(errno)})
	entries, complete := []managedTreeEntry{}, false
	for page := 0; page < managedTreeMaxPages; page++ {
		batch, done, err := a.ReadDirectory(parents[0], page == 0)
		check(err)
		if done {
			if len(batch) != 0 {
				t.Fatal("STOP: ambiguous enumeration completion")
			}
			complete = true
			break
		}
		if len(batch) == 0 || len(entries)+len(batch) > managedTreeMaxChildren {
			t.Fatal("STOP: incomplete enumeration")
		}
		entries = append(entries, batch...)
	}
	if !complete || len(entries) != 1 || entries[0].Name != "target.txt" || fmt.Sprintf("%x", entries[0].FileID) != targetID {
		t.Fatal("STOP: enumeration does not match exact R3 inventory")
	}
	for _, h := range []windows.Handle{h1, h2} {
		id, err := a.FileIdentity(h)
		check(err)
		check(compareManagedTreeMetadata(a, h, id, entries[0].Attribute))
		if fmt.Sprintf("%x", id.FileID) != targetID {
			t.Fatal("STOP: final target identity changed")
		}
		info, err := root05caQueryStandard(h, 24)
		check(err)
		if info.NumberOfLinks != 1 || info.DeletePending != 0 || info.Directory != 0 {
			t.Fatal("STOP: final standard metadata changed")
		}
		check(a.CloseHandle(h))
	}
	stages = append(stages, map[string]any{"stage": "enumeration", "complete": complete, "entries": entries, "parent": identityJSON(roots[0].components[len(roots[0].components)-1].identity)})
	final := state()
	if !reflect.DeepEqual(initial, final) || tokenFrame() != initialToken {
		t.Fatal("STOP: final token/security/identity/hash changed")
	}
	stages = append(stages, map[string]any{"stage": "final", "state": final, "unchanged": true})
	for _, h := range parents {
		check(a.CloseHandle(h))
	}
}

// B1 uses the classic NT information class, NOT x/sys's misleading 72 alias.
// Microsoft wdm.h: FileLinkInformation=11, FileLinkInformationEx=72.
const root05cb1ClassicLinkClass uint32 = 11

// Classic BOOLEAN plus ABI padding; RootDirectory is an existing owned parent.
// The variable UTF-16 payload starts at byte 20, not sizeof(header)=24.
type root05cb1LinkHeader struct {
	ReplaceIfExists uint8
	Padding         [7]byte
	RootDirectory   windows.Handle
	FileNameLength  uint32
	FileName        [1]uint16
}

func root05cb1LinkBuffer(parent windows.Handle) ([]uint64, []byte, error) {
	var header root05cb1LinkHeader
	var oa windows.OBJECT_ATTRIBUTES
	var us windows.NTUnicodeString
	if err := root05caCheckABI(); err != nil {
		return nil, nil, err
	}
	if unsafe.Sizeof(header) != 24 || unsafe.Alignof(header) != 8 || unsafe.Offsetof(header.ReplaceIfExists) != 0 ||
		unsafe.Offsetof(header.RootDirectory) != 8 || unsafe.Offsetof(header.FileNameLength) != 16 || unsafe.Offsetof(header.FileName) != 20 ||
		unsafe.Sizeof(oa) != 48 || unsafe.Alignof(oa) != 8 || unsafe.Offsetof(oa.RootDirectory) != 8 || unsafe.Offsetof(oa.ObjectName) != 16 || unsafe.Offsetof(oa.Attributes) != 24 ||
		unsafe.Offsetof(oa.SecurityDescriptor) != 32 || unsafe.Offsetof(oa.SecurityQoS) != 40 ||
		unsafe.Sizeof(us) != 16 || unsafe.Offsetof(us.Buffer) != 8 || unsafe.Offsetof(us.Length) != 0 || unsafe.Offsetof(us.MaximumLength) != 2 ||
		unsafe.Sizeof(windows.IO_STATUS_BLOCK{}) != 16 || unsafe.Offsetof(windows.IO_STATUS_BLOCK{}.Information) != 8 ||
		root05cb1ClassicLinkClass != 11 || root05cb1ClassicLinkClass == uint32(windows.FileLinkInformation) || !validManagedRootHandle(parent) {
		return nil, nil, errors.New("unsupported NT11/OBJECT_ATTRIBUTES/UNICODE_STRING/IOSB ABI")
	}
	name, err := windows.UTF16FromString("alias.txt")
	if err != nil || len(name) != 10 || name[len(name)-1] != 0 {
		return nil, nil, errors.Join(err, errors.New("invalid fixed NT11 name"))
	}
	// 20-byte fixed prefix, 18 name bytes, two zero terminator/padding bytes.
	backing := make([]uint64, 7) // 8-byte canary + 40-byte payload + canary.
	backing[0], backing[6] = 0xa5a5a5a5a5a5a5a5, 0xa5a5a5a5a5a5a5a5
	data := unsafe.Slice((*byte)(unsafe.Pointer(&backing[1])), 40)
	binary.LittleEndian.PutUint64(data[8:16], uint64(parent))
	binary.LittleEndian.PutUint32(data[16:20], 18)
	for i, value := range name {
		binary.LittleEndian.PutUint16(data[20+i*2:], value)
	}
	decoded := (*root05cb1LinkHeader)(unsafe.Pointer(&data[0]))
	if decoded.ReplaceIfExists != 0 || decoded.Padding != [7]byte{} || decoded.RootDirectory != parent || decoded.FileNameLength != 18 ||
		decoded.FileName[0] != 'a' || uintptr(unsafe.Pointer(&data[0]))%8 != 0 || data[38] != 0 || data[39] != 0 {
		return nil, nil, errors.New("NT11 serialized header/Unicode mismatch")
	}
	return backing, data, nil
}

// Only used if an anomalous pending request cannot be proved complete. Keep its
// source handle, IOSB and backing memory alive until this test process exits;
// never close an in-flight handle or pretend that a timeout cancelled kernel I/O.
var root05cb1PendingLifetime []any

func root05cb1RejectMultipleLinks(t *testing.T, links uint32) {
	t.Helper()
	c := root05aFixture(t)
	c.f.metadataHook = func(h managedTreeSimulatedHandle, _ int) error {
		m := c.f.meta[h]
		m.LinkCount = links
		c.f.meta[h] = m
		return nil
	}
	prepared, result, err := c.prepare()
	if err == nil || prepared != nil || result.State == managedTreeSimulationCompleted || !result.Simulated || result.Attempted || c.f.marks != 0 {
		t.Fatal("multi-link model falsely authorized/completed", err, result)
	}
	for _, request := range c.f.opens {
		if request.Access&windows.DELETE != 0 {
			t.Fatal("multi-link model acquired destructive rights")
		}
	}
	root05aAssertClosed(t, c)
	t.Logf("simulated links=%d rejected state=%s marks=%d error=%s", links, result.State, c.f.marks, err)
}

func TestHUWIN002EROOT05CB1NativeHardLink(t *testing.T) {
	if os.Getenv("MANUS_ROOT05CB1_NATIVE") != "1" {
		t.Skip("B1 NT11 single-alias native opt-in not enabled")
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	started := time.Now()
	check := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal("STOP: ", err)
		}
		if time.Since(started) > 30*time.Second {
			t.Fatal("STOP: soft operation budget; no cancellation implied")
		}
	}
	// Pure ABI/buffer gates precede every filesystem creation and NtSet call.
	backing, buffer, err := root05cb1LinkBuffer(windows.Handle(1))
	check(err)
	if binary.LittleEndian.Uint64(buffer[8:16]) != 1 || backing[0] != backing[6] {
		t.Fatal("STOP: ABI self-check")
	}
	if !t.Run("fake_multi_link_preflight", func(st *testing.T) { root05cb1RejectMultipleLinks(st, 2) }) {
		t.Fatal("STOP: fake rejection gate failed before filesystem creation")
	}
	for _, proc := range []struct{ dll, name string }{{"ntdll.dll", "NtSetInformationFile"}, {"ntdll.dll", "NtCreateFile"}, {"kernel32.dll", "GetFileInformationByHandleEx"}, {"kernel32.dll", "GetVolumeInformationByHandleW"}} {
		check(windows.NewLazySystemDLL(proc.dll).NewProc(proc.name).Find())
	}
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	check(err)
	if user.User.Sid == nil || !user.User.Sid.IsValid() {
		t.Fatal("STOP: invalid TokenUser")
	}
	u := user.User.Sid.String()
	tokenFrame := func() string {
		t.Helper()
		thread, err := windows.GetCurrentThread()
		check(err)
		var impersonation windows.Token
		err = windows.OpenThreadToken(thread, windows.TOKEN_QUERY, true, &impersonation)
		if err == nil {
			check(errors.Join(errors.New("impersonation rejected"), impersonation.Close()))
		}
		if !errors.Is(err, windows.ERROR_NO_TOKEN) {
			check(err)
		}
		tok := windows.GetCurrentProcessToken()
		scalar := func(class uint32) uint32 {
			var value, n uint32
			check(windows.GetTokenInformation(tok, class, (*byte)(unsafe.Pointer(&value)), 4, &n))
			if n != 4 {
				t.Fatal("STOP: incomplete token scalar")
			}
			return value
		}
		query := func(class uint32) []byte {
			data := make([]byte, 65536)
			var n uint32
			check(windows.GetTokenInformation(tok, class, &data[0], uint32(len(data)), &n))
			if n == 0 || n > uint32(len(data)) {
				t.Fatal("STOP: incomplete token metadata")
			}
			return data[:n]
		}
		validSID := func(data []byte, sid *windows.SID) bool {
			start, p := uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(sid))
			return sid != nil && p >= start && p+8 <= start+uintptr(len(data)) && sid.IsValid() && p+uintptr(sid.Len()) <= start+uintptr(len(data))
		}
		groups := func(class uint32) []map[string]any {
			data := query(class)
			offset := unsafe.Offsetof(windows.Tokengroups{}.Groups)
			if uintptr(len(data)) < offset {
				t.Fatal("STOP: truncated group header")
			}
			g := (*windows.Tokengroups)(unsafe.Pointer(&data[0]))
			if offset+uintptr(g.GroupCount)*unsafe.Sizeof(windows.SIDAndAttributes{}) > uintptr(len(data)) {
				t.Fatal("STOP: truncated groups")
			}
			rows := make([]map[string]any, 0, g.GroupCount)
			for _, group := range g.AllGroups() {
				if !validSID(data, group.Sid) {
					t.Fatal("STOP: invalid group SID")
				}
				rows = append(rows, map[string]any{"sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(group.Sid.String()))), "attributes": group.Attributes})
			}
			runtime.KeepAlive(data)
			return rows
		}
		kind, elevation, session := scalar(windows.TokenType), scalar(windows.TokenElevation), scalar(windows.TokenSessionId)
		data := query(windows.TokenIntegrityLevel)
		if len(data) < int(unsafe.Sizeof(windows.Tokenmandatorylabel{})) {
			t.Fatal("STOP: truncated integrity")
		}
		label := (*windows.Tokenmandatorylabel)(unsafe.Pointer(&data[0]))
		if kind != windows.TokenPrimary || elevation != 0 || session == 0 || !validSID(data, label.Label.Sid) || label.Label.Sid.String() != "S-1-16-8192" {
			t.Fatal("STOP: interactive primary Medium non-elevated token required")
		}
		runtime.KeepAlive(data)
		restricted := groups(windows.TokenRestrictedSids)
		if len(restricted) != 0 {
			t.Fatal("STOP: restricted token; no permission expansion")
		}
		currentUser, err := tok.GetTokenUser()
		check(err)
		if currentUser.User.Sid == nil || !currentUser.User.Sid.Equals(user.User.Sid) {
			t.Fatal("STOP: token user changed")
		}
		encoded, err := json.Marshal(map[string]any{"sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(u))), "type": kind, "elevation": elevation, "elevationType": scalar(windows.TokenElevationType), "session": session, "integrity": "Medium", "impersonation": false, "restrictedSIDs": restricted, "groups": groups(windows.TokenGroups)})
		check(err)
		return string(encoded)
	}
	initialToken := tokenFrame()
	a := &root05caAudit{live: make(map[windows.Handle]bool)}
	var roots []*managedRootObservation
	var stages []map[string]any
	fixture, evidence := "", ""
	attempts, status := 0, uint32(0)
	var pendingHandle windows.Handle
	defer func() {
		for i := len(roots) - 1; i >= 0; i-- {
			if err := roots[i].Close(); err != nil {
				t.Error("root close", err)
			}
		}
		for h := range a.live {
			if h == pendingHandle {
				continue
			}
			if err := a.CloseHandle(h); err != nil {
				t.Error("owned close", err)
			}
		}
		deleteRequests := 0
		for _, event := range a.events {
			if access, ok := event["access"].(uint32); ok && access&windows.DELETE != 0 {
				deleteRequests++
			}
		}
		if a.opened != a.closed || a.closeErrors != 0 || deleteRequests != 0 {
			t.Error("STOP: access/close accounting")
		}
		report, err := json.Marshal(map[string]any{"phase": "HU-WIN-002E-ROOT-05C-B1", "failed": t.Failed(), "outcome": "hard-link observation only; no disposition/completed", "fixture": fixture, "evidence": evidence, "windowsBuild": windows.RtlGetVersion().BuildNumber, "token": json.RawMessage(initialToken), "class": root05cb1ClassicLinkClass, "moduleAlias": windows.FileLinkInformation, "linkAttempts": attempts, "ntstatus": fmt.Sprintf("0x%08X", status), "abi": map[string]any{"headerSize": 24, "alignment": 8, "rootOffset": 8, "nameLengthOffset": 16, "nameOffset": 20, "payloadSize": 40, "nameBytes": 18, "OBJECT_ATTRIBUTES": 48, "UNICODE_STRING": 16}, "stages": stages, "events": a.events, "handlesOpened": a.opened, "closeAttempts": a.closed, "closeErrors": a.closeErrors, "remainingHandles": len(a.live), "deleteRequests": deleteRequests, "dispositionCalls": 0, "elapsedMS": time.Since(started).Milliseconds(), "cleanup": "NOT_PERFORMED", "namespaceExclusion": "NOT_PROVEN"})
		if err != nil {
			t.Error(err)
		} else {
			t.Logf("ROOT05CB1_REPORT %s", report)
		}
	}()
	anchor, err := windows.KnownFolderPath(windows.FOLDERID_LocalAppData, windows.KF_FLAG_DEFAULT)
	check(err)
	temp := filepath.Join(anchor, "Temp")
	root04NoReparseChain(t, temp)
	base, err := observeManagedRootIdentity(a, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: "Temp"})
	check(err)
	roots = append(roots, base)
	baseComponent := base.components[len(base.components)-1]
	fs, err := a.FileSystem(baseComponent.handle)
	check(err)
	if fs != "NTFS" {
		t.Fatal("STOP: TEMP is not verified NTFS")
	}
	if os.Getenv("MANUS_ROOT05CB1_PREFLIGHT_ONLY") == "1" {
		t.Skip("preflight-only: ABI/fake/token/NTFS gates passed; zero fixture creation or NT11 attempts")
	}
	var nonce [16]byte
	_, err = rand.Read(nonce[:])
	check(err)
	fixture = filepath.Join(temp, fmt.Sprintf("ManusRoot05CB1-fixture-%x", nonce))
	evidence = filepath.Join(temp, fmt.Sprintf("ManusRoot05CB1-evidence-%x", nonce))
	// Descriptors are parsed and checked before creating either directory.
	var descriptors [2]*windows.SECURITY_DESCRIPTOR
	for i, mask := range []uint32{0x1200a7, 0x1200a3} {
		sddl := fmt.Sprintf("O:%sD:P(A;;0x%08X;;;%s)(A;OIIO;0x00120083;;;%s)", u, mask, u, u)
		descriptors[i], err = windows.SecurityDescriptorFromString(sddl)
		check(err)
		if descriptors[i] == nil || !descriptors[i].IsValid() {
			t.Fatal("STOP: invalid initial SDDL")
		}
	}
	if tokenFrame() != initialToken {
		t.Fatal("STOP: pre-creation token changed")
	}
	for i, path := range []string{fixture, evidence} {
		check(base.Revalidate())
		root04NoReparseChain(t, temp)
		ptr, err := windows.UTF16PtrFromString(path)
		check(err)
		sa := windows.SecurityAttributes{Length: uint32(unsafe.Sizeof(windows.SecurityAttributes{})), SecurityDescriptor: descriptors[i]}
		check(windows.CreateDirectory(ptr, &sa)) // Create-new only; never repair or retry.
		runtime.KeepAlive(descriptors[i])
		t.Logf("ROOT05CB1_CREATED %s", path)
		root04NoReparseChain(t, path)
		relative, err := filepath.Rel(anchor, path)
		check(err)
		root, err := observeManagedRootIdentity(a, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: relative})
		check(err)
		roots = append(roots, root)
	}
	security := func(h windows.Handle, directory bool, mask uint32) string {
		t.Helper()
		sd, err := windows.GetSecurityInfo(h, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
		check(err)
		if !sd.IsValid() {
			t.Fatal("STOP: invalid security metadata")
		}
		owner, _, err := sd.Owner()
		check(err)
		control, _, err := sd.Control()
		check(err)
		if owner == nil || !owner.Equals(user.User.Sid) || (control&windows.SE_DACL_PROTECTED != 0) != directory {
			t.Fatal("STOP: owner/protection mismatch")
		}
		acl, _, err := sd.DACL()
		check(err)
		wants := []struct {
			mask  uint32
			flags uint8
		}{{0x120083, windows.INHERITED_ACE}}
		if directory {
			wants = []struct {
				mask  uint32
				flags uint8
			}{{mask, 0}, {0x120083, windows.OBJECT_INHERIT_ACE | windows.INHERIT_ONLY_ACE}}
		}
		if acl == nil || int(acl.AceCount) != len(wants) {
			t.Fatal("STOP: missing/external ACE")
		}
		for i, want := range wants {
			var ace *windows.ACCESS_ALLOWED_ACE
			check(windows.GetAce(acl, uint32(i), &ace))
			if ace == nil || ace.Header.AceType != windows.ACCESS_ALLOWED_ACE_TYPE || ace.Header.AceSize < 12 || uint32(ace.Mask) != want.mask || ace.Header.AceFlags != want.flags {
				t.Fatal("STOP: ACE type/mask/flags mismatch")
			}
			sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart))
			if !sid.IsValid() || sid.Len()+8 > int(ace.Header.AceSize) || !sid.Equals(user.User.Sid) {
				t.Fatal("STOP: external/invalid principal")
			}
		}
		out := sd.String()
		runtime.KeepAlive(sd)
		if out == "" {
			t.Fatal("STOP: SDDL unavailable")
		}
		return out
	}
	// A test-local open gate. No source/path/file other than the fixed new inventory
	// is admitted. All NT file I/O uses a synchronous handle with SYNCHRONIZE.
	ntOpen := func(parent windows.Handle, name string, access, disposition uint32, directory bool) windows.Handle {
		t.Helper()
		if !a.live[parent] || access&windows.DELETE != 0 {
			t.Fatal("STOP: invalid parent/destructive open")
		}
		options := uint32(windows.FILE_OPEN_REPARSE_POINT | windows.FILE_NON_DIRECTORY_FILE | windows.FILE_SYNCHRONOUS_IO_NONALERT)
		if directory {
			if disposition != windows.FILE_OPEN || access != 0x200a3 || (name != filepath.Base(fixture) && name != filepath.Base(evidence)) {
				t.Fatal("STOP: directory outside fixed plan")
			}
			options = windows.FILE_OPEN_REPARSE_POINT | windows.FILE_DIRECTORY_FILE
		} else {
			if name != "target.txt" && name != "alias.txt" && name != "sentinel.txt" {
				t.Fatal("STOP: file outside fixed plan")
			}
			if disposition == windows.FILE_CREATE {
				if name == "alias.txt" || access != 0x120082 {
					t.Fatal("STOP: unauthorized create")
				}
			} else if disposition != windows.FILE_OPEN || (access != 0x120081 && access != 0x100080) {
				t.Fatal("STOP: unexpected file open rights")
			}
		}
		oa, err := managedTreeRelativeAttributes(parent, name)
		check(err)
		if oa.RootDirectory != parent || oa.Length != 48 || oa.Attributes != windows.OBJ_DONT_REPARSE || oa.ObjectName == nil || oa.ObjectName.Length != uint16(len(utf16.Encode([]rune(name)))*2) {
			t.Fatal("STOP: OBJECT_ATTRIBUTES mismatch")
		}
		var h windows.Handle
		var iosb windows.IO_STATUS_BLOCK
		err = windows.NtCreateFile(&h, access, oa, &iosb, nil, 0, 7, disposition, options, 0, 0)
		runtime.KeepAlive(oa)
		a.events = append(a.events, map[string]any{"api": "NtCreateFile", "name": name, "access": access, "share": uint32(7), "options": options, "creationDisposition": disposition, "error": fmt.Sprint(err), "iosbStatus": fmt.Sprintf("0x%08X", uint32(iosb.Status)), "iosbInformation": iosb.Information})
		h, err = a.own(h, err)
		check(err)
		want := uintptr(1)
		if disposition == windows.FILE_CREATE {
			want = 2
		}
		if iosb.Status != 0 || iosb.Information != want {
			t.Fatal("STOP: NT create/open completion mismatch")
		}
		return h
	}
	var parents [2]windows.Handle
	for i := range parents {
		root := roots[i+1]
		component := root.components[len(root.components)-1]
		ancestor := root.components[len(root.components)-2]
		parents[i] = ntOpen(ancestor.handle, filepath.Base(component.lexicalPath), 0x200a3, windows.FILE_OPEN, true)
		id, err := a.FileIdentity(parents[i])
		check(err)
		fs, err := a.FileSystem(parents[i])
		check(err)
		if fs != "NTFS" || id != component.identity || id.VolumeSerialNumber != baseComponent.identity.VolumeSerialNumber {
			t.Fatal("STOP: new directory identity/NTFS/volume mismatch")
		}
		mask := uint32(0x1200a7)
		if i == 1 {
			mask = 0x1200a3
		}
		security(parents[i], true, mask)
	}
	create := func(parent windows.Handle, name, content string) {
		h := ntOpen(parent, name, 0x120082, windows.FILE_CREATE, false)
		security(h, false, 0)
		var n uint32
		check(windows.WriteFile(h, []byte(content), &n, nil))
		if int(n) != len(content) {
			t.Fatal("STOP: short initial write")
		}
		check(a.CloseHandle(h))
	}
	create(parents[0], "target.txt", fmt.Sprintf("B1 unique harmless target %x\n", nonce))
	create(parents[1], "sentinel.txt", fmt.Sprintf("B1 independent sentinel %x\n", nonce))
	identityJSON := func(id managedRootFileIdentity) map[string]string {
		return map[string]string{"volume": fmt.Sprintf("%d", id.VolumeSerialNumber), "fileId": fmt.Sprintf("%x", id.FileID)}
	}
	snapshot := func(parent windows.Handle, name, path string) (map[string]any, managedRootFileIdentity, root05caStandardInfo) {
		t.Helper()
		h := ntOpen(parent, name, 0x120081, windows.FILE_OPEN, false)
		defer func() {
			if err := a.CloseHandle(h); err != nil {
				t.Error("snapshot close", err)
			}
		}()
		id, err := a.FileIdentity(h)
		check(err)
		attr, err := a.AttributeTag(h)
		check(err)
		check(validateManagedTreeAttribute(attr))
		final, err := a.FinalPath(h)
		check(err)
		final, err = normalizeManagedRootFinalPath(final)
		check(err)
		if id.VolumeSerialNumber != baseComponent.identity.VolumeSerialNumber || isZeroFileID(id.FileID) || !strings.EqualFold(final, path) || attr.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0 {
			t.Fatal("STOP: snapshot escaped object/path/type")
		}
		info, err := root05caQueryStandard(h, 24)
		check(err)
		if info.Directory != 0 || info.DeletePending != 0 {
			t.Fatal("STOP: directory or delete-pending")
		}
		sddl := security(h, false, 0)
		digest := sha256.New()
		var data [4096]byte
		total := 0
		for {
			var n uint32
			err := windows.ReadFile(h, data[:], &n, nil)
			if err != nil && !errors.Is(err, windows.ERROR_HANDLE_EOF) {
				check(err)
			}
			if n == 0 {
				break
			}
			digest.Write(data[:n])
			total += int(n)
			if total > 65536 {
				t.Fatal("STOP: fixture size bound")
			}
		}
		if int64(total) != info.EndOfFile {
			t.Fatal("STOP: incomplete hash/size")
		}
		check(compareManagedTreeMetadata(a, h, id, attr))
		return map[string]any{"path": final, "identity": identityJSON(id), "standard": info, "sddl": sddl, "sha256": fmt.Sprintf("%x", digest.Sum(nil))}, id, info
	}
	scan := func() []managedTreeEntry {
		t.Helper()
		var result []managedTreeEntry
		for page := 0; page < managedTreeMaxPages; page++ {
			entries, done, err := a.ReadDirectory(parents[0], page == 0)
			check(err)
			if done {
				if len(entries) != 0 {
					t.Fatal("STOP: ambiguous scan completion")
				}
				return result
			}
			if len(entries) == 0 || len(result)+len(entries) > managedTreeMaxChildren {
				t.Fatal("STOP: incomplete scan")
			}
			result = append(result, entries...)
		}
		t.Fatal("STOP: scan page bound")
		return nil
	}
	initial, targetID, info := snapshot(parents[0], "target.txt", filepath.Join(fixture, "target.txt"))
	sentinel, sentinelID, sentinelInfo := snapshot(parents[1], "sentinel.txt", filepath.Join(evidence, "sentinel.txt"))
	if info.NumberOfLinks != 1 || sentinelInfo.NumberOfLinks != 1 {
		t.Fatal("STOP: initial hard-link count is not one")
	}
	entries := scan()
	if len(entries) != 1 || entries[0].Name != "target.txt" || entries[0].FileID != targetID.FileID {
		t.Fatal("STOP: initial inventory or alias collision")
	}
	fixtureSDDL, evidenceSDDL := security(parents[0], true, 0x1200a7), security(parents[1], true, 0x1200a3)
	stages = append(stages, map[string]any{"stage": "initial", "target": initial, "sentinel": sentinel, "entries": entries, "fixtureIdentity": identityJSON(roots[1].components[len(roots[1].components)-1].identity), "evidenceIdentity": identityJSON(roots[2].components[len(roots[2].components)-1].identity), "fixtureSDDL": fixtureSDDL, "evidenceSDDL": evidenceSDDL})
	// The live source and destination are retained across the only NtSet call.
	source := ntOpen(parents[0], "target.txt", 0x100080, windows.FILE_OPEN, false)
	id, err := a.FileIdentity(source)
	check(err)
	attr, err := a.AttributeTag(source)
	check(err)
	check(validateManagedTreeAttribute(attr))
	if id != targetID || attr.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0 {
		t.Fatal("STOP: source substituted")
	}
	check(base.Revalidate())
	check(roots[1].Revalidate())
	check(roots[2].Revalidate())
	if tokenFrame() != initialToken || security(parents[0], true, 0x1200a7) != fixtureSDDL || security(parents[1], true, 0x1200a3) != evidenceSDDL {
		t.Fatal("STOP: token/security changed before link")
	}
	targetNow, currentID, currentInfo := snapshot(parents[0], "target.txt", filepath.Join(fixture, "target.txt"))
	sentinelNow, currentSentinelID, currentSentinelInfo := snapshot(parents[1], "sentinel.txt", filepath.Join(evidence, "sentinel.txt"))
	if currentID != targetID || currentInfo.NumberOfLinks != 1 || !reflect.DeepEqual(initial, targetNow) ||
		currentSentinelID != sentinelID || currentSentinelInfo != sentinelInfo || !reflect.DeepEqual(sentinel, sentinelNow) {
		t.Fatal("STOP: changed target/sentinel before NT11")
	}
	entries = scan()
	if len(entries) != 1 || entries[0].Name != "target.txt" || entries[0].FileID != targetID.FileID {
		t.Fatal("STOP: alias destination no longer absent")
	}
	sourceInfo, err := root05caQueryStandard(source, 24)
	check(err)
	if sourceInfo.NumberOfLinks != 1 || sourceInfo.DeletePending != 0 || sourceInfo.Directory != 0 {
		t.Fatal("STOP: source standard metadata changed")
	}
	backing, buffer, err = root05cb1LinkBuffer(parents[0])
	check(err)
	var iosb windows.IO_STATUS_BLOCK
	callStarted := time.Now()
	attempts++ // One call, no retry/fallback on any status.
	err = windows.NtSetInformationFile(source, &iosb, &buffer[0], uint32(len(buffer)), root05cb1ClassicLinkClass)
	if nt, ok := err.(windows.NTStatus); ok {
		status = uint32(nt)
	} else if err != nil {
		status = 0xffffffff
	}
	if status == 0x00000103 {
		// Defensive lifetime handling only. A synchronous-source pending result is
		// unexpected and can never become PASS or trigger a second mutation.
		wait, waitErr := windows.WaitForSingleObject(source, 5000)
		if waitErr != nil || wait != windows.WAIT_OBJECT_0 {
			pendingHandle = source
			root05cb1PendingLifetime = append(root05cb1PendingLifetime, backing, buffer, &iosb, source)
		}
	}
	runtime.KeepAlive(backing)
	runtime.KeepAlive(buffer)
	stages = append(stages, map[string]any{"stage": "NtSetInformationFile", "class": root05cb1ClassicLinkClass, "ntstatus": fmt.Sprintf("0x%08X", status), "iosbStatus": fmt.Sprintf("0x%08X", uint32(iosb.Status)), "iosbInformation": iosb.Information, "elapsedMS": time.Since(callStarted).Milliseconds(), "replaceIfExists": false, "destinationParent": identityJSON(roots[1].components[len(roots[1].components)-1].identity), "name": "alias.txt", "sourceAccess": "0x00100080", "sourceShare": 7})
	check(err)
	if time.Since(callStarted) > 5*time.Second || iosb.Status != 0 || attempts != 1 || backing[0] != 0xa5a5a5a5a5a5a5a5 || backing[6] != 0xa5a5a5a5a5a5a5a5 {
		t.Fatal("STOP: link completion/canary/budget mismatch")
	}
	final, finalID, finalInfo := snapshot(parents[0], "target.txt", filepath.Join(fixture, "target.txt"))
	alias, aliasID, aliasInfo := snapshot(parents[0], "alias.txt", filepath.Join(fixture, "alias.txt"))
	sentinelFinal, sidFinal, siFinal := snapshot(parents[1], "sentinel.txt", filepath.Join(evidence, "sentinel.txt"))
	if finalID != targetID || aliasID != targetID || finalInfo.NumberOfLinks != 2 || aliasInfo.NumberOfLinks != 2 ||
		final["sha256"] != initial["sha256"] || alias["sha256"] != initial["sha256"] || final["sddl"] != initial["sddl"] || alias["sddl"] != initial["sddl"] ||
		sidFinal != sentinelID || siFinal != sentinelInfo || !reflect.DeepEqual(sentinel, sentinelFinal) {
		t.Fatal("STOP: link identity/count/hash/DACL/sentinel postcondition")
	}
	entries = scan()
	seen := make(map[string]bool)
	for _, entry := range entries {
		if (entry.Name != "target.txt" && entry.Name != "alias.txt") || seen[entry.Name] || entry.FileID != targetID.FileID {
			t.Fatal("STOP: unexpected final namespace")
		}
		seen[entry.Name] = true
		check(validateManagedTreeAttribute(entry.Attribute))
	}
	if len(entries) != 2 || !seen["target.txt"] || !seen["alias.txt"] {
		t.Fatal("STOP: incomplete final inventory")
	}
	check(base.Revalidate())
	check(roots[1].Revalidate())
	check(roots[2].Revalidate())
	if tokenFrame() != initialToken || security(parents[0], true, 0x1200a7) != fixtureSDDL || security(parents[1], true, 0x1200a3) != evidenceSDDL {
		t.Fatal("STOP: final token/parent security changed")
	}
	stages = append(stages, map[string]any{"stage": "final", "target": final, "alias": alias, "sentinel": sentinelFinal, "entries": entries, "sentinelUnchanged": true, "parentSecurityUnchanged": true})
	// Feed only the observed link count to deterministic model data. Native file
	// handles/IDs never become simulation handles or productive authority.
	if !t.Run("observed_multi_link_rejected", func(st *testing.T) { root05cb1RejectMultipleLinks(st, finalInfo.NumberOfLinks) }) {
		t.Fatal("STOP: observed multi-link rejection failed")
	}
	stages = append(stages, map[string]any{"stage": "simulation_rejected", "observedLinks": finalInfo.NumberOfLinks, "simulatedDispositionCalls": 0, "realCompleted": false})
}

type root04R1ID struct {
	Volume uint64 `json:"volume"`
	FileID string `json:"fileIdHex"`
}

type root04R1Link struct {
	Kind     string     `json:"kind"`
	Parent   string     `json:"parent"`
	Name     string     `json:"name"`
	Target   string     `json:"target"`
	Identity root04R1ID `json:"identity"`
	Tag      uint32     `json:"reparseTag"`
}

// Link preparation is external and separate from these read-only probes.
// ROOT04R1 requires its own explicit opt-in and never creates/deletes links.
func TestHUWIN002EROOT04R1NativeReparse(t *testing.T) {
	if os.Getenv("MANUS_ROOT04R1_NATIVE") != "1" {
		t.Skip("ROOT04R1 native opt-in not enabled")
	}
	anchor, err := windows.KnownFolderPath(windows.FOLDERID_LocalAppData, windows.KF_FLAG_DEFAULT)
	if err != nil {
		t.Fatal(err)
	}
	run := os.Getenv("MANUS_ROOT04R1_RUN_ROOT")
	base := filepath.Base(run)
	if !strings.HasPrefix(base, "ManusRoot04R1-") || len(base) != len("ManusRoot04R1-")+32 || !strings.EqualFold(filepath.Clean(run), filepath.Join(anchor, "Temp", base)) {
		t.Fatal("invalid ROOT04R1 exclusive TEMP scope")
	}
	root04NoReparseChain(t, run)
	marker, err := os.ReadFile(filepath.Join(run, "operation.txt"))
	if err != nil || string(marker) != strings.TrimPrefix(base, "ManusRoot04R1-") {
		t.Fatal("operation marker mismatch")
	}
	var elevated, returned uint32
	if err := windows.GetTokenInformation(windows.GetCurrentProcessToken(), windows.TokenElevation, (*byte)(unsafe.Pointer(&elevated)), 4, &returned); err != nil || returned != 4 || elevated != 0 {
		t.Fatal("native probes require verified non-elevated token")
	}
	var manifest struct {
		Run     string         `json:"run"`
		Links   []root04R1Link `json:"links"`
		Initial struct {
			Root     root04R1ID            `json:"root"`
			Parents  map[string]root04R1ID `json:"parents"`
			Targets  map[string]root04R1ID `json:"targets"`
			Sentinel struct {
				Identity root04R1ID `json:"identity"`
				SHA256   string     `json:"sha256"`
			} `json:"sentinel"`
		} `json:"initial"`
	}
	data, err := os.ReadFile(filepath.Join(run, "links.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.Run != run || len(manifest.Links) != 3 {
		t.Fatal("preparation manifest mismatch")
	}
	api := nativeManagedTreeAPI{}
	closeHandle := func(st *testing.T, h windows.Handle) {
		st.Helper()
		if validManagedRootHandle(h) {
			if err := api.CloseHandle(h); err != nil {
				st.Errorf("close probe handle: %v", err)
			}
		}
	}
	matches := func(actual managedRootFileIdentity, expected root04R1ID) bool {
		return actual.VolumeSerialNumber == expected.Volume && fmt.Sprintf("%x", actual.FileID) == expected.FileID
	}
	openPath := func(st *testing.T, path string, expected root04R1ID) windows.Handle {
		st.Helper()
		h, err := api.OpenDirectory(path, managedRootDesiredAccess, managedRootShareMode, managedRootCreationMode, managedRootOpenFlags)
		if err != nil {
			closeHandle(st, h)
			st.Fatal(err)
		}
		id, err := api.FileIdentity(h)
		if err != nil || !matches(id, expected) {
			closeHandle(st, h)
			st.Fatalf("fixture identity mismatch: %s %v", path, err)
		}
		return h
	}
	guard := openPath(t, run, manifest.Initial.Root)
	defer closeHandle(t, guard)
	sentinel := filepath.Join(run, "sentinel", "sentinel.txt")
	sentinelHandle := openPath(t, sentinel, manifest.Initial.Sentinel.Identity)
	defer closeHandle(t, sentinelHandle)
	// Sentinel content is measured only outside all observer cases. It is never
	// a link target and no observer is given its path or handle.
	before, err := os.ReadFile(sentinel)
	if err != nil {
		t.Fatal(err)
	}
	initialHash := sha256.Sum256(before)
	if fmt.Sprintf("%x", initialHash) != manifest.Initial.Sentinel.SHA256 {
		t.Fatal("initial sentinel hash mismatch")
	}
	root04Evidence(t, "R1_sentinel_initial", map[string]any{"identity": manifest.Initial.Sentinel.Identity, "sha256": fmt.Sprintf("%x", initialHash)})
	t.Cleanup(func() {
		final, err := os.ReadFile(sentinel)
		if err != nil {
			t.Error(err)
			return
		}
		hash := sha256.Sum256(final)
		// Handles are closed by function defers before testing cleanup; re-open
		// by the independent, exact sentinel path solely for final evidence.
		h := openPath(t, sentinel, manifest.Initial.Sentinel.Identity)
		defer closeHandle(t, h)
		root04Evidence(t, "R1_sentinel_final", map[string]any{"sha256": fmt.Sprintf("%x", hash), "identity": manifest.Initial.Sentinel.Identity, "unchanged": hash == initialHash})
		if hash != initialHash {
			t.Error("STOP: sentinel changed")
		}
	})
	version := windows.RtlGetVersion()
	root04Evidence(t, "R1_host", map[string]any{"build": version.BuildNumber, "elevated": false, "run": run})
	newParent := func(st *testing.T, name string) *managedRootObservation {
		st.Helper()
		path := filepath.Join(run, name)
		root04NoReparseChain(st, path)
		relative, err := filepath.Rel(anchor, path)
		if err != nil {
			st.Fatal(err)
		}
		root, err := observeManagedRootIdentity(nativeManagedRootIdentityAPI{}, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: relative})
		if err != nil {
			st.Fatal(err)
		}
		st.Cleanup(func() {
			if err := root.Close(); err != nil {
				st.Error(err)
			}
		})
		last := root.components[len(root.components)-1]
		if !matches(last.identity, manifest.Initial.Parents[name]) {
			st.Fatal("parent does not match initial identity")
		}
		fs, err := api.FileSystem(last.handle)
		if err != nil || fs != "NTFS" {
			st.Fatal("filesystem not proved NTFS")
		}
		return root
	}
	checkLink := func(st *testing.T, h windows.Handle, link root04R1Link) {
		st.Helper()
		id, err := api.FileIdentity(h)
		if err != nil || !matches(id, link.Identity) {
			st.Fatal("STOP: link identity mismatch or target followed")
		}
		attr, err := api.AttributeTag(h)
		if err != nil || attr.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT == 0 || attr.ReparseTag != link.Tag {
			st.Fatal("STOP: expected reparse object not observed")
		}
		path, err := api.FinalPath(h)
		if err != nil {
			st.Fatal(err)
		}
		path, err = normalizeManagedRootFinalPath(path)
		if err != nil || !strings.EqualFold(path, filepath.Join(run, link.Parent, link.Name)) {
			st.Fatal("STOP: effective link path escaped")
		}
		buffer := make([]byte, windows.MAXIMUM_REPARSE_DATA_BUFFER_SIZE)
		var size uint32
		if err := windows.DeviceIoControl(h, windows.FSCTL_GET_REPARSE_POINT, nil, 0, &buffer[0], uint32(len(buffer)), &size, nil); err != nil {
			st.Fatal(err)
		}
		if size < 16 || size > uint32(len(buffer)) {
			st.Fatal("invalid reparse buffer size")
		}
		buffer = buffer[:size]
		tag := binary.LittleEndian.Uint32(buffer[:4])
		length := int(binary.LittleEndian.Uint16(buffer[4:6]))
		if tag != link.Tag || length+8 > len(buffer) {
			st.Fatal("invalid reparse header")
		}
		offset := int(binary.LittleEndian.Uint16(buffer[8:10]))
		count := int(binary.LittleEndian.Uint16(buffer[10:12]))
		start := 16
		if tag == windows.IO_REPARSE_TAG_SYMLINK {
			if len(buffer) < 20 || binary.LittleEndian.Uint32(buffer[16:20]) != 0 {
				st.Fatal("unexpected relative symbolic link")
			}
			start = 20
		}
		if offset%2 != 0 || count%2 != 0 || count == 0 || start+offset+count > length+8 {
			st.Fatal("invalid reparse name bounds")
		}
		encoded := make([]uint16, count/2)
		for i := range encoded {
			encoded[i] = binary.LittleEndian.Uint16(buffer[start+offset+i*2:])
		}
		substitute := string(utf16.Decode(encoded))
		if substitute != `\??\`+link.Target {
			st.Fatal("STOP: reparse destination changed or outside fixture")
		}
		root04Evidence(st, "R1_link_observed", map[string]any{"kind": link.Kind, "identity": id, "attribute": attr, "finalPath": path, "substituteName": substitute})
	}
	probe := func(st *testing.T, parent windows.Handle, link root04R1Link, variant string) {
		st.Helper()
		directory := link.Kind != "file_symlink"
		access, options := managedTreeOpenMode(directory)
		var h windows.Handle
		var err error
		var iosb windows.IO_STATUS_BLOCK
		flags := uint32(managedTreeObjectFlags)
		if variant == "combined_adapter" {
			h, err = api.OpenRelative(parent, link.Name, access, managedTreeShare, flags, windows.FILE_OPEN, options)
		} else {
			if variant == "open_reparse_only" {
				flags = 0
			} else {
				options &^= windows.FILE_OPEN_REPARSE_POINT
			}
			oa, oaErr := managedTreeRelativeAttributes(parent, link.Name)
			if oaErr != nil {
				st.Fatal(oaErr)
			}
			oa.Attributes = flags
			err = windows.NtCreateFile(&h, access, oa, &iosb, nil, 0, managedTreeShare, windows.FILE_OPEN, options, 0, 0)
		}
		defer closeHandle(st, h)
		status := "0x0"
		var nt windows.NTStatus
		if errors.As(err, &nt) {
			status = fmt.Sprintf("%#x", uint32(nt))
		}
		root04Evidence(st, "R1_NtCreateFile", map[string]any{"kind": link.Kind, "variant": variant, "access": fmt.Sprintf("%#x", access), "share": managedTreeShare, "objectFlags": fmt.Sprintf("%#x", flags), "options": fmt.Sprintf("%#x", options), "ntstatus": status, "error": fmt.Sprint(err), "ioStatus": fmt.Sprintf("%#x", uint32(iosb.Status)), "information": iosb.Information, "iosbAvailable": variant != "combined_adapter"})
		if err != nil {
			if !errors.Is(err, windows.STATUS_REPARSE_POINT_ENCOUNTERED) {
				st.Fatalf("unexpected no-follow NTSTATUS: %v", err)
			}
			return
		}
		if !validManagedRootHandle(h) || (variant != "combined_adapter" && (iosb.Status != 0 || iosb.Information != 1)) {
			st.Fatal("native open not confirmed")
		}
		checkLink(st, h, link)
	}
	runCase := func(name string, fn func(*testing.T)) {
		t.Helper()
		if !t.Run(name, func(st *testing.T) {
			start := time.Now()
			defer func() {
				root04Evidence(st, "R1_case", map[string]any{"name": name, "failed": st.Failed(), "elapsedMS": time.Since(start).Milliseconds()})
			}()
			fn(st)
		}) {
			t.FailNow()
		}
	}
	runCase("valid_parent_control", func(st *testing.T) {
		root := newParent(st, "control-parent")
		result, err := observeManagedTreeChildren(api, root)
		if err != nil || result == nil || len(result.Children) != 2 {
			st.Fatal("regular fixture observation failed", err)
		}
	})
	for index, expected := range []struct {
		kind, parent, name, target string
		tag                        uint32
	}{
		{"file_symlink", "file-parent", "link", filepath.Join(run, "targets", "file.txt"), windows.IO_REPARSE_TAG_SYMLINK},
		{"directory_symlink", "directory-parent", "link", filepath.Join(run, "targets", "directory"), windows.IO_REPARSE_TAG_SYMLINK},
		{"junction_current", "junction-parent", "current", filepath.Join(run, "targets", "directory"), windows.IO_REPARSE_TAG_MOUNT_POINT},
	} {
		link := manifest.Links[index]
		if link.Kind != expected.kind || link.Parent != expected.parent || link.Name != expected.name || link.Target != expected.target || link.Tag != expected.tag {
			t.Fatal("untrusted fixture manifest entry")
		}
		runCase(expected.kind, func(st *testing.T) {
			root := newParent(st, link.Parent)
			parent := root.components[len(root.components)-1].handle
			for _, variant := range []string{"combined_adapter", "open_reparse_only", "dont_reparse_only"} {
				probe(st, parent, link, variant)
			}
			result, err := observeManagedTreeChildren(api, root)
			if err == nil || result != nil || !strings.Contains(err.Error(), "reparse") {
				st.Fatal("reparse did not fail closed for the expected reason", err)
			}
			root04Evidence(st, "R1_policy_rejection", map[string]any{"kind": link.Kind, "resultNil": result == nil, "error": err.Error()})
		})
	}
	runCase("target_unavailable_by_sharing_without_ACL_change", func(st *testing.T) {
		target := filepath.Join(run, "targets", "directory")
		pointer, err := windows.UTF16PtrFromString(target)
		if err != nil {
			st.Fatal(err)
		}
		h, err := windows.CreateFile(pointer, windows.FILE_LIST_DIRECTORY|windows.FILE_READ_ATTRIBUTES, 0, nil, windows.OPEN_EXISTING, managedRootOpenFlags, 0)
		if err != nil {
			st.Fatal(err)
		}
		defer closeHandle(st, h)
		id, err := api.FileIdentity(h)
		if err != nil || !matches(id, manifest.Initial.Targets["directory"]) {
			st.Fatal("locked target identity changed")
		}
		relative, err := filepath.Rel(anchor, filepath.Join(run, "targets"))
		if err != nil {
			st.Fatal(err)
		}
		targets, err := observeManagedRootIdentity(nativeManagedRootIdentityAPI{}, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: relative})
		if err != nil {
			st.Fatal(err)
		}
		defer func() {
			if err := targets.Close(); err != nil {
				st.Error(err)
			}
		}()
		access, options := managedTreeOpenMode(true)
		blocked, blockedErr := api.OpenRelative(targets.components[len(targets.components)-1].handle, "directory", access, managedTreeShare, managedTreeObjectFlags, windows.FILE_OPEN, options)
		defer closeHandle(st, blocked)
		if !errors.Is(blockedErr, windows.NTStatus(0xC0000043)) {
			st.Fatal("target did not demonstrate sharing denial", blockedErr)
		}
		root04Evidence(st, "R1_target_blocked", map[string]any{"ntstatus": "0xc0000043", "error": blockedErr.Error()})
		for _, link := range manifest.Links[1:] {
			root := newParent(st, link.Parent)
			parent := root.components[len(root.components)-1].handle
			probe(st, parent, link, "combined_adapter")
			result, err := observeManagedTreeChildren(api, root)
			if err == nil || result != nil || !strings.Contains(err.Error(), "reparse") {
				st.Fatal("blocked target link did not fail closed", err)
			}
		}
	})
	runCase("sharing_conflict_and_recovery", func(st *testing.T) {
		root := newParent(st, "control-parent")
		pointer, err := windows.UTF16PtrFromString(filepath.Join(run, "control-parent", "locked"))
		if err != nil {
			st.Fatal(err)
		}
		h, err := windows.CreateFile(pointer, windows.FILE_LIST_DIRECTORY|windows.FILE_READ_ATTRIBUTES, 0, nil, windows.OPEN_EXISTING, managedRootOpenFlags, 0)
		if err != nil {
			st.Fatal(err)
		}
		closed := false
		defer func() {
			if !closed {
				closeHandle(st, h)
			}
		}()
		result, err := observeManagedTreeChildren(api, root)
		if result != nil || !errors.Is(err, windows.NTStatus(0xC0000043)) {
			st.Fatal("sharing conflict did not block observation", err)
		}
		root04Evidence(st, "R1_sharing_fail_closed", map[string]any{"ntstatus": "0xc0000043", "resultNil": result == nil})
		closed = true
		if err := api.CloseHandle(h); err != nil {
			st.Fatal(err)
		}
		result, err = observeManagedTreeChildren(api, root)
		if err != nil || result == nil {
			st.Fatal("failed to recover after closing own lock", err)
		}
	})
	finalRoot, err := api.FileIdentity(guard)
	if err != nil || !matches(finalRoot, manifest.Initial.Root) {
		t.Fatal("final run identity mismatch")
	}
	root04Evidence(t, "R1_root_final", finalRoot)
}

// R3 queries access only. This helper never sets information or requests rights.
type root05cb1R3AccessInformation struct {
	AccessFlags uint32
}

func root05cb1R3DecodeAccess(data []byte) (uint32, error) {
	var value root05cb1R3AccessInformation
	if runtime.GOARCH != "amd64" || unsafe.Sizeof(value) != 4 || unsafe.Alignof(value) != 4 ||
		unsafe.Offsetof(value.AccessFlags) != 0 || len(data) != 4 {
		return 0, errors.New("unsupported or incomplete FILE_ACCESS_INFORMATION ABI")
	}
	return binary.LittleEndian.Uint32(data), nil
}

type root05cb1R3QueryBuffer struct {
	Canaries [3]uint32
	IOSB     windows.IO_STATUS_BLOCK
}

// If an unexpected pending query occurs, retain its buffers and handle until
// process exit; the caller must not close that in-flight handle or retry.
var root05cb1R3PendingQueries []*root05cb1R3QueryBuffer

func root05cb1R3QueryAccess(h windows.Handle) (uint32, map[string]any, error) {
	if !validManagedRootHandle(h) {
		return 0, nil, errors.New("invalid access-query handle")
	}
	if _, err := root05cb1R3DecodeAccess(make([]byte, 4)); err != nil {
		return 0, nil, err
	}
	proc := windows.NewLazySystemDLL("ntdll.dll").NewProc("NtQueryInformationFile")
	if err := proc.Find(); err != nil {
		return 0, nil, err
	}
	query := &root05cb1R3QueryBuffer{Canaries: [3]uint32{0xa5a5a5a5, 0, 0x5a5a5a5a}}
	if unsafe.Sizeof(query.IOSB) != 16 || unsafe.Offsetof(query.IOSB.Information) != 8 ||
		uintptr(unsafe.Pointer(&query.Canaries[1]))%4 != 0 {
		return 0, nil, errors.New("access query alignment/IOSB ABI mismatch")
	}
	started := time.Now()
	result, _, _ := proc.Call(uintptr(h), uintptr(unsafe.Pointer(&query.IOSB)),
		uintptr(unsafe.Pointer(&query.Canaries[1])), 4, 8)
	status := uint32(result) // NTSTATUS, never GetLastError.
	detail := map[string]any{"api": "NtQueryInformationFile", "class": 8, "length": 4,
		"alignment": 4, "ntstatus": fmt.Sprintf("0x%08X", status),
		"iosbStatus":    fmt.Sprintf("0x%08X", uint32(query.IOSB.Status)),
		"returnedBytes": query.IOSB.Information, "elapsedMS": time.Since(started).Milliseconds(),
		"iosbValid": status == 0}
	if status == 0x103 {
		root05cb1R3PendingQueries = append(root05cb1R3PendingQueries, query)
		return 0, detail, errors.New("unexpected pending access query; retained until process exit; no retry")
	}
	runtime.KeepAlive(query)
	if status != 0 {
		return 0, detail, windows.NTStatus(status)
	}
	if query.IOSB.Status != 0 || query.IOSB.Information != 4 ||
		query.Canaries[0] != 0xa5a5a5a5 || query.Canaries[2] != 0x5a5a5a5a {
		return 0, detail, errors.New("incomplete access query or changed canary")
	}
	var data [4]byte
	binary.LittleEndian.PutUint32(data[:], query.Canaries[1])
	value, err := root05cb1R3DecodeAccess(data[:])
	detail["grantedAccess"] = fmt.Sprintf("0x%08X", value)
	return value, detail, err
}

func TestHUWIN002EROOT05CB1R3NativeGrantedAccess(t *testing.T) {
	if os.Getenv("MANUS_ROOT05CB1R3_NATIVE") != "1" {
		t.Skip("B1-R3 GrantedAccess read-only native opt-in not enabled")
	}
	if err := root05caCheckABI(); err != nil {
		t.Fatal("STOP: ABI", err)
	}
	for _, proc := range []struct{ dll, name string }{{"kernel32.dll", "GetFileInformationByHandleEx"}, {"ntdll.dll", "NtCreateFile"}, {"ntdll.dll", "NtQueryInformationFile"}} {
		if err := windows.NewLazySystemDLL(proc.dll).NewProc(proc.name).Find(); err != nil {
			t.Fatal("STOP: API unavailable", proc.name, err)
		}
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	started := time.Now()
	a := &root05caAudit{live: make(map[windows.Handle]bool)}
	var roots []*managedRootObservation
	var stages []map[string]any
	var pendingHandle windows.Handle
	defer func() {
		for i := len(roots) - 1; i >= 0; i-- {
			if err := roots[i].Close(); err != nil {
				t.Error("STOP: ROOT-01 close", err)
			}
		}
		if len(a.live) != 0 {
			t.Error("STOP: unexpected outstanding handles", len(a.live))
			for h := range a.live {
				if h == pendingHandle {
					continue
				}
				if err := a.CloseHandle(h); err != nil {
					t.Error("cleanup close only", err)
				}
			}
		}
		deleteRequests := 0
		for _, event := range a.events {
			if access, ok := event["access"].(uint32); ok && access&windows.DELETE != 0 {
				deleteRequests++
			}
		}
		if deleteRequests != 0 || a.closeErrors != 0 || a.opened != a.closed {
			t.Error("STOP: access/close accounting failed")
		}
		data, err := json.Marshal(map[string]any{"phase": "HU-WIN-002E-ROOT-05C-B1-R3-INSTRUMENTATION", "failed": t.Failed(), "outcome": "observation-only; no disposition", "abiSize": 24, "abiOffsets": []int{0, 8, 16, 20, 21}, "windowsBuild": windows.RtlGetVersion().BuildNumber, "stages": stages, "events": a.events, "handlesOpened": a.opened, "closeAttempts": a.closed, "closeErrors": a.closeErrors, "remainingHandles": len(a.live), "elapsedMS": time.Since(started).Milliseconds(), "deleteRequests": deleteRequests, "namespaceMutations": 0, "ntSetInformationCalls": 0, "historicalHandles": false, "limitations": "new equivalent handles only; historical NT11 cause UNKNOWN; no namespace exclusion"})
		if err != nil {
			t.Error(err)
		} else {
			t.Logf("ROOT05CB1R3_REPORT %s", data)
		}
	}()
	check := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal("STOP:", err)
		}
		if time.Since(started) > 30*time.Second {
			t.Fatal("STOP: soft operation budget exceeded; no implied I/O cancellation")
		}
	}
	// This is a query-only process-token pseudo-handle. No product process is opened.
	tokenFrame := func() string {
		t.Helper()
		thread, err := windows.GetCurrentThread()
		check(err)
		var impersonation windows.Token
		err = windows.OpenThreadToken(thread, windows.TOKEN_QUERY, true, &impersonation)
		if err == nil {
			check(errors.Join(errors.New("impersonation rejected"), impersonation.Close()))
		}
		if !errors.Is(err, windows.ERROR_NO_TOKEN) {
			check(err)
		}
		tok := windows.GetCurrentProcessToken()
		scalar := func(class uint32) uint32 {
			var value, n uint32
			check(windows.GetTokenInformation(tok, class, (*byte)(unsafe.Pointer(&value)), 4, &n))
			if n != 4 {
				t.Fatal("STOP: incomplete token scalar")
			}
			return value
		}
		buffer := func(class uint32) []byte {
			buf := make([]byte, 65536)
			var n uint32
			check(windows.GetTokenInformation(tok, class, &buf[0], uint32(len(buf)), &n))
			if n == 0 || n > uint32(len(buf)) {
				t.Fatal("STOP: incomplete token buffer")
			}
			return buf[:n]
		}
		inBuffer := func(buf []byte, sid *windows.SID) bool {
			start := uintptr(unsafe.Pointer(&buf[0]))
			p := uintptr(unsafe.Pointer(sid))
			return sid != nil && p >= start && p+8 <= start+uintptr(len(buf)) && sid.IsValid() && p+uintptr(sid.Len()) <= start+uintptr(len(buf))
		}
		groups := func(class uint32) []map[string]any {
			buf := buffer(class)
			offset := unsafe.Offsetof(windows.Tokengroups{}.Groups)
			if uintptr(len(buf)) < offset {
				t.Fatal("STOP: truncated groups")
			}
			g := (*windows.Tokengroups)(unsafe.Pointer(&buf[0]))
			if offset+uintptr(g.GroupCount)*unsafe.Sizeof(windows.SIDAndAttributes{}) > uintptr(len(buf)) {
				t.Fatal("STOP: truncated group entries")
			}
			rows := make([]map[string]any, 0, g.GroupCount)
			for _, item := range g.AllGroups() {
				if !inBuffer(buf, item.Sid) {
					t.Fatal("STOP: invalid group SID")
				}
				rows = append(rows, map[string]any{"sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(item.Sid.String()))), "attributes": item.Attributes})
			}
			runtime.KeepAlive(buf)
			return rows
		}
		kind, elevation, session := scalar(windows.TokenType), scalar(windows.TokenElevation), scalar(windows.TokenSessionId)
		integrity := buffer(windows.TokenIntegrityLevel)
		if len(integrity) < int(unsafe.Sizeof(windows.Tokenmandatorylabel{})) {
			t.Fatal("STOP: truncated integrity")
		}
		label := (*windows.Tokenmandatorylabel)(unsafe.Pointer(&integrity[0]))
		if kind != windows.TokenPrimary || elevation != 0 || session == 0 || !inBuffer(integrity, label.Label.Sid) || label.Label.Sid.String() != "S-1-16-8192" {
			t.Fatal("STOP: non-elevated interactive primary Medium token required")
		}
		runtime.KeepAlive(integrity)
		restricted := groups(windows.TokenRestrictedSids)
		if len(restricted) != 0 {
			t.Fatal("STOP: restricted token outside fixture contract")
		}
		user, err := tok.GetTokenUser()
		check(err)
		if user.User.Sid == nil || !user.User.Sid.IsValid() {
			t.Fatal("STOP: invalid user SID")
		}
		data, err := json.Marshal(map[string]any{"sidSHA256": fmt.Sprintf("%x", sha256.Sum256([]byte(user.User.Sid.String()))), "type": kind, "elevation": elevation, "elevationType": scalar(windows.TokenElevationType), "session": session, "integrity": "Medium", "groups": groups(windows.TokenGroups), "restrictedSIDs": restricted, "impersonation": false})
		check(err)
		return string(data)
	}
	initialToken := tokenFrame()
	stages = append(stages, map[string]any{"stage": "token", "frame": json.RawMessage(initialToken)})
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	check(err)
	if fmt.Sprintf("%x", sha256.Sum256([]byte(user.User.Sid.String()))) != "e24a12cc55cabbe6b85340bcf725244bb5c283ab4ab2fd2a7ee3ee64374fad34" {
		t.Fatal("STOP: R3 owner token changed")
	}
	anchor, err := windows.KnownFolderPath(windows.FOLDERID_LocalAppData, windows.KF_FLAG_DEFAULT)
	check(err)
	const suffix = "7b77b143d5f4a7ac40c1cef8dd21e613"
	fixture := filepath.Join(anchor, "Temp", "ManusRoot05CB1-fixture-"+suffix)
	evidence := filepath.Join(anchor, "Temp", "ManusRoot05CB1-evidence-"+suffix)
	root04NoReparseChain(t, fixture)
	root04NoReparseChain(t, evidence)
	for _, relative := range []string{filepath.Join("Temp", filepath.Base(fixture)), filepath.Join("Temp", filepath.Base(evidence))} {
		root, err := observeManagedRootIdentity(a, managedRootIdentityRequest{Anchor: managedRootLocalAppData, RelativePath: relative})
		check(err)
		roots = append(roots, root)
	}
	identityJSON := func(id managedRootFileIdentity) map[string]string {
		return map[string]string{"volume": fmt.Sprintf("%d", id.VolumeSerialNumber), "fileId": fmt.Sprintf("%x", id.FileID)}
	}
	security := func(h windows.Handle, directory bool, mask uint32) string {
		t.Helper()
		sd, err := windows.GetSecurityInfo(h, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
		check(err)
		if !sd.IsValid() {
			t.Fatal("STOP: invalid security descriptor")
		}
		owner, _, err := sd.Owner()
		check(err)
		control, _, err := sd.Control()
		check(err)
		if owner == nil || !owner.Equals(user.User.Sid) || (control&windows.SE_DACL_PROTECTED != 0) != directory {
			t.Fatal("STOP: owner/protection changed")
		}
		acl, _, err := sd.DACL()
		check(err)
		wants := []struct {
			mask  uint32
			flags uint8
		}{{mask, windows.INHERITED_ACE}}
		if directory {
			wants = []struct {
				mask  uint32
				flags uint8
			}{{mask, 0}, {0x120083, windows.OBJECT_INHERIT_ACE | windows.INHERIT_ONLY_ACE}}
		}
		if acl == nil || int(acl.AceCount) != len(wants) {
			t.Fatal("STOP: missing DACL or unexpected ACE count")
		}
		for i, want := range wants {
			var ace *windows.ACCESS_ALLOWED_ACE
			check(windows.GetAce(acl, uint32(i), &ace))
			if ace == nil || ace.Header.AceType != windows.ACCESS_ALLOWED_ACE_TYPE || ace.Header.AceSize < 12 || uint32(ace.Mask) != want.mask || ace.Header.AceFlags != want.flags {
				t.Fatal("STOP: ACE contract changed")
			}
			sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart))
			if !sid.IsValid() || sid.Len()+8 > int(ace.Header.AceSize) || !sid.Equals(user.User.Sid) {
				t.Fatal("STOP: external or invalid ACE")
			}
		}
		sddl := sd.String()
		if sddl == "" {
			t.Fatal("STOP: missing SDDL")
		}
		runtime.KeepAlive(sd)
		return sddl
	}

	// FILE_OPEN only. Exact B1 measurement masks are separate from hash readers.
	ntOpen := func(parent windows.Handle, name string, access uint32, directory bool) windows.Handle {
		t.Helper()
		if !a.live[parent] || access&windows.DELETE != 0 {
			t.Fatal("STOP: unowned parent or DELETE request")
		}
		options := uint32(windows.FILE_OPEN_REPARSE_POINT | windows.FILE_NON_DIRECTORY_FILE | windows.FILE_SYNCHRONOUS_IO_NONALERT)
		if directory {
			if (name != filepath.Base(fixture) && name != filepath.Base(evidence)) ||
				(access != 0x20081 && access != 0x200a3) {
				t.Fatal("STOP: directory outside fixed observation plan")
			}
			options = windows.FILE_OPEN_REPARSE_POINT | windows.FILE_DIRECTORY_FILE
		} else if (name != "target.txt" && name != "sentinel.txt") ||
			(access != 0x120081 && access != 0x100080) {
			t.Fatal("STOP: file outside fixed observation plan")
		}
		oa, err := managedTreeRelativeAttributes(parent, name)
		check(err)
		var h windows.Handle
		var iosb windows.IO_STATUS_BLOCK
		err = windows.NtCreateFile(&h, access, oa, &iosb, nil, 0, 7, windows.FILE_OPEN, options, 0, 0)
		runtime.KeepAlive(oa)
		status := uint32(0)
		if err != nil {
			var nt windows.NTStatus
			if errors.As(err, &nt) {
				status = uint32(nt)
			}
		}
		a.events = append(a.events, map[string]any{"api": "NtCreateFile", "name": name,
			"access": access, "share": uint32(7), "objectFlags": oa.Attributes,
			"rootDirectory": uint64(parent), "options": options, "disposition": uint32(windows.FILE_OPEN),
			"ntstatus": fmt.Sprintf("0x%08X", status), "error": fmt.Sprint(err)})
		h, err = a.own(h, err)
		check(err)
		if iosb.Status != 0 || iosb.Information != 1 || oa.RootDirectory != parent ||
			oa.Attributes != windows.OBJ_DONT_REPARSE {
			t.Fatal("STOP: FILE_OPEN or relative attribute mismatch")
		}
		return h
	}
	open := func(parent windows.Handle, name string, directory, acl bool) windows.Handle {
		access := uint32(0x120081)
		if directory {
			access = 0x20081
		}
		if !acl {
			t.Fatal("STOP: observation plan requires security metadata")
		}
		return ntOpen(parent, name, access, directory)
	}
	var parents [2]windows.Handle
	for i, root := range roots {
		component := root.components[len(root.components)-1]
		ancestor := root.components[len(root.components)-2]
		parents[i] = open(ancestor.handle, filepath.Base(component.lexicalPath), true, true)
		id, err := a.FileIdentity(parents[i])
		check(err)
		wantID := "5fe10500000008000000000000000000"
		if i == 1 {
			wantID = "6fe10500000003000000000000000000"
		}
		fs, err := a.FileSystem(parents[i])
		check(err)
		if fmt.Sprintf("%x", id.FileID) != wantID || id.VolumeSerialNumber != 5518860861372801062 || id != component.identity || fs != "NTFS" {
			t.Fatal("STOP: retained R3 directory identity/filesystem changed")
		}
		mask := uint32(0x1200a7)
		if i == 1 {
			mask = 0x1200a3
		}
		security(parents[i], true, mask) // Validate protected parent before reading contents.
	}
	// Relative FILE_OPEN read handles provide bounded hashes, security and identity.
	snapshot := func(index int, name, wantID, wantHash string, mask uint32) map[string]any {
		t.Helper()
		root := roots[index]
		check(root.Revalidate())
		path := filepath.Join(root.components[len(root.components)-1].lexicalPath, name)
		h := ntOpen(parents[index], name, 0x120081, false)
		defer func() {
			if err := a.CloseHandle(h); err != nil {
				t.Error("snapshot close", err)
			}
		}()
		id, err := a.FileIdentity(h)
		check(err)
		attr, err := a.AttributeTag(h)
		check(err)
		check(validateManagedTreeAttribute(attr))
		final, err := a.FinalPath(h)
		check(err)
		final, err = normalizeManagedRootFinalPath(final)
		check(err)
		if !strings.EqualFold(final, path) || fmt.Sprintf("%x", id.FileID) != wantID || id.VolumeSerialNumber != 5518860861372801062 || attr.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0 {
			t.Fatal("STOP: snapshot identity/path/type changed")
		}
		sddl := security(h, false, mask)
		standard, err := root05caQueryStandard(h, 24)
		check(err)
		if standard.Directory != 0 || standard.DeletePending != 0 || standard.NumberOfLinks != 1 {
			t.Fatal("STOP: changed standard metadata")
		}
		digest := sha256.New()
		var buf [4096]byte
		total := 0
		for {
			var n uint32
			err := windows.ReadFile(h, buf[:], &n, nil)
			if err != nil && !errors.Is(err, windows.ERROR_HANDLE_EOF) {
				check(err)
			}
			if n == 0 {
				break
			}
			digest.Write(buf[:n])
			total += int(n)
			if total > 65536 {
				t.Fatal("STOP: fixture file exceeds bound")
			}
		}
		hash := fmt.Sprintf("%x", digest.Sum(nil))
		if hash != wantHash {
			t.Fatal("STOP: historical hash mismatch", name)
		}
		check(compareManagedTreeMetadata(a, h, id, attr))
		check(root.Revalidate())
		return map[string]any{"path": final, "identity": identityJSON(id), "sha256": hash, "sddl": sddl, "size": total, "standard": standard}
	}
	const targetID = "71e10500000003000000000000000000"
	const targetHash = "e0188a41038108bfc12df0c3e72d3f911bfaef3caccec7c58b64f31a8e89a936"
	const sentinelID = "73e10500000003000000000000000000"
	const sentinelHash = "8b9bc9b35460a75019115462b021dafedd158fea525edcbdf45638ac2f32134c"
	state := func() map[string]any {
		check(roots[0].Revalidate())
		check(roots[1].Revalidate())
		return map[string]any{"target": snapshot(0, "target.txt", targetID, targetHash, 0x120083), "sentinel": snapshot(1, "sentinel.txt", sentinelID, sentinelHash, 0x120083), "fixtureSDDL": security(parents[0], true, 0x1200a7), "evidenceSDDL": security(parents[1], true, 0x1200a3)}
	}
	// Complete bounded scans of both preserved directories, before and after.
	scan := func(index int) []managedTreeEntry {
		t.Helper()
		var entries []managedTreeEntry
		complete := false
		for page := 0; page < managedTreeMaxPages; page++ {
			batch, done, err := a.ReadDirectory(parents[index], page == 0)
			check(err)
			if done {
				if len(batch) != 0 {
					t.Fatal("STOP: ambiguous enumeration")
				}
				complete = true
				break
			}
			if len(batch) == 0 || len(entries)+len(batch) > managedTreeMaxChildren {
				t.Fatal("STOP: partial enumeration")
			}
			entries = append(entries, batch...)
		}
		name, id := "target.txt", targetID
		if index == 1 {
			name, id = "sentinel.txt", sentinelID
		}
		if !complete || len(entries) != 1 || entries[0].Name != name ||
			fmt.Sprintf("%x", entries[0].FileID) != id {
			t.Fatal("STOP: preserved inventory changed or alias present")
		}
		return entries
	}
	initial := state()
	stages = append(stages, map[string]any{"stage": "initial", "state": initial})
	stages = append(stages, map[string]any{"stage": "initial_enumeration", "fixture": scan(0), "evidence": scan(1), "complete": true})

	// Exact new equivalents of the original B1 source/destination handles.
	// The source keeps SYNCHRONIZE and NONALERT; the destination intentionally
	// omits SYNCHRONIZE and NONALERT, matching B1. No access is inferred from DACL.
	ancestor := roots[0].components[len(roots[0].components)-2]
	destination := ntOpen(ancestor.handle, filepath.Base(fixture), 0x000200a3, true)
	source := ntOpen(parents[0], "target.txt", 0x00100080, false)
	for _, item := range []struct {
		role      string
		handle    windows.Handle
		requested uint32
		id        string
		directory bool
	}{{"source", source, 0x00100080, targetID, false},
		{"destination", destination, 0x000200a3, "5fe10500000008000000000000000000", true}} {
		check(roots[0].Revalidate())
		if tokenFrame() != initialToken {
			t.Fatal("STOP: token changed before access query")
		}
		id, err := a.FileIdentity(item.handle)
		check(err)
		attr, err := a.AttributeTag(item.handle)
		check(err)
		check(validateManagedTreeAttribute(attr))
		finalPath, err := a.FinalPath(item.handle)
		check(err)
		finalPath, err = normalizeManagedRootFinalPath(finalPath)
		check(err)
		wantPath := fixture
		if !item.directory {
			wantPath = filepath.Join(fixture, "target.txt")
		}
		fs, err := a.FileSystem(item.handle)
		check(err)
		if fmt.Sprintf("%x", id.FileID) != item.id || id.VolumeSerialNumber != 5518860861372801062 ||
			!strings.EqualFold(finalPath, wantPath) || fs != "NTFS" ||
			(attr.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0) != item.directory {
			t.Fatal("STOP: measured handle changed identity/type/namespace")
		}
		granted, detail, err := root05cb1R3QueryAccess(item.handle)
		if detail != nil && detail["ntstatus"] == "0x00000103" {
			pendingHandle = item.handle
		}
		stages = append(stages, map[string]any{"stage": "granted_access", "role": item.role,
			"requestedAccess": fmt.Sprintf("0x%08X", item.requested), "share": 7,
			"query": detail, "identity": identityJSON(id), "path": finalPath,
			"synchronizeGranted": granted&windows.SYNCHRONIZE != 0,
			"matchesRequested":   granted == item.requested})
		check(err)
		if granted != item.requested || granted&windows.DELETE != 0 {
			t.Fatal("STOP: unexpected granted access; no permission expansion/retry")
		}
		check(compareManagedTreeMetadata(a, item.handle, id, attr))
		if !item.directory {
			standard, err := root05caQueryStandard(item.handle, 24)
			check(err)
			if standard.NumberOfLinks != 1 || standard.DeletePending != 0 || standard.Directory != 0 {
				t.Fatal("STOP: measured source standard metadata changed")
			}
		}
		check(a.CloseHandle(item.handle))
	}
	stages = append(stages, map[string]any{"stage": "final_enumeration",
		"fixture": scan(0), "evidence": scan(1), "complete": true})
	final := state()
	if !reflect.DeepEqual(initial, final) || tokenFrame() != initialToken {
		t.Fatal("STOP: final token/security/identity/hash changed")
	}
	stages = append(stages, map[string]any{"stage": "final", "state": final, "unchanged": true})
	for _, h := range parents {
		check(a.CloseHandle(h))
	}
}
