//go:build windows

package main

import (
	"errors"
	"reflect"
	"sync"
	"testing"
)

// NATIVE-01 additions are test-local and never construct an authorization frame.
import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"os"
	"runtime"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// No memory-authority constructor or implementation exists in a non-test file.
// A fresh instance loses history: this is NOT durable/multiprocess antireplay.
type opFake01Slot struct {
	Machine, Instance operationIdentitySimulationID
	Generation        uint64
}
type opFake01Memory struct {
	mu        sync.Mutex
	epoch     operationIdentitySimulationID
	approvals map[operationIdentitySimulationID]operationIdentityApproval
	helpers   map[operationIdentitySimulationID]bool
	records   map[operationIdentitySimulationID]operationIdentitySimulationRecord
	slots     map[opFake01Slot]operationIdentitySimulationID
	nonces    map[operationIdentitySimulationID]operationIdentitySimulationID
}

func (*opFake01Memory) operationIdentitySimulationOnly() {}
func (a *opFake01Memory) approveSimulation(d operationIdentitySimulationID, p operationIdentityApproval) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if want, ok := a.approvals[d]; !ok || want != p {
		return errors.New("fake authority denied exact approval")
	}
	return nil
}
func opFake01HelperKey(d operationIdentitySimulationID, h operationIdentityProcessBinding, p operationIdentityHelperProof) operationIdentitySimulationID {
	sum, err := operationIdentityDigest(struct {
		D operationIdentitySimulationID
		H operationIdentityProcessBinding
		P operationIdentityHelperProof
	}{d, h, p})
	if err != nil {
		panic(err)
	} // All fields are fixed, JSON-supported test data.
	return sum
}
func (a *opFake01Memory) verifyHelperSimulation(d operationIdentitySimulationID, h operationIdentityProcessBinding, p operationIdentityHelperProof) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.helpers[opFake01HelperKey(d, h, p)] {
		return errors.New("fake peer evidence not granted")
	}
	return nil
}
func opFake01SlotFor(p operationIdentityPlan) opFake01Slot {
	return opFake01Slot{p.Installation.Machine, p.Installation.Instance, p.Installation.Generation}
}
func (a *opFake01Memory) reserveSimulation(r operationIdentitySimulationRecord) (operationIdentitySimulationRecord, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	_, approved := a.approvals[r.Intent]
	_, usedID := a.records[r.Plan.ID]
	_, busy := a.slots[opFake01SlotFor(r.Plan)]
	if !approved || usedID || busy || r.Plan.Installation.Epoch != a.epoch ||
		r.State != operationIdentityReserved || r.Revision != 1 {
		return operationIdentitySimulationRecord{}, errors.New("reservation collision or foreign epoch")
	}
	a.slots[opFake01SlotFor(r.Plan)] = r.Plan.ID
	a.records[r.Plan.ID] = cloneOperationIdentityRecord(r)
	return cloneOperationIdentityRecord(r), nil
}
func (a *opFake01Memory) loadSimulation(id operationIdentitySimulationID) (operationIdentitySimulationRecord, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	r, ok := a.records[id]
	if !ok {
		return r, errors.New("missing simulation record")
	}
	return cloneOperationIdentityRecord(r), nil
}
func (a *opFake01Memory) compareAndSwapSimulation(revision uint64, next operationIdentitySimulationRecord) (operationIdentitySimulationRecord, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	old, ok := a.records[next.Plan.ID]
	if !ok || old.Revision != revision || next.Revision != revision+1 || operationIdentityTerminal(old.State) ||
		old.Intent != next.Intent || old.Plan.Installation != next.Plan.Installation {
		return operationIdentitySimulationRecord{}, errors.New("CAS lost or invalid revision/identity")
	}
	if old.State == operationIdentityReserved && next.State == operationIdentityClaimed {
		if next.Nonce == (operationIdentitySimulationID{}) {
			return old, errors.New("missing nonce")
		}
		if _, used := a.nonces[next.Nonce]; used {
			return old, errors.New("nonce replay")
		}
		a.nonces[next.Nonce] = next.Plan.ID
	} else if old.Nonce != next.Nonce || old.Binding != next.Binding || old.Helper != next.Helper {
		return old, errors.New("claim rebinding")
	}
	a.records[next.Plan.ID] = cloneOperationIdentityRecord(next)
	return cloneOperationIdentityRecord(next), nil
}

type opFake01Clock struct {
	mu    sync.Mutex
	value operationIdentitySimulationTime
}

func (c *opFake01Clock) now() operationIdentitySimulationTime {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.value
}
func (c *opFake01Clock) set(v operationIdentitySimulationTime) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.value = v
}
func opFake01ID(n byte) (id operationIdentitySimulationID) { id[0] = n; return }
func opFake01Digest(v any) operationIdentitySimulationID {
	d, e := operationIdentityDigest(v)
	if e != nil {
		panic(e)
	}
	return d
}

type opFake01Fixture struct {
	p        operationIdentityPlan
	approval operationIdentityApproval
	h        operationIdentityProcessBinding
	proof    operationIdentityHelperProof
	a        *opFake01Memory
	clock    *opFake01Clock
	closes   int
	closeErr error
}

func opFake01FixtureNew() *opFake01Fixture {
	frame := operationIdentityFrame{Schema: 1, Source: operationIdentityTestEvidence, CompleteMask: operationIdentityFrameMask,
		Evidence: opFake01ID(10), SID: "fixture:interactive-not-a-Windows-SID", AuthenticationID: operationIdentityLUID{Low: 11},
		TokenID: operationIdentityLUID{Low: 12}, ModifiedID: operationIdentityLUID{Low: 13}, SessionID: 1, Type: operationIdentityPrimary,
		Integrity: operationIdentityMedium, Elevation: operationIdentityLimited, Interactive: true, ProfileKnown: true,
		Profile: opFake01ID(14), GroupsPrivileges: opFake01ID(15), LinkedTokenID: operationIdentityLUID{Low: 22}}
	i := operationIdentityProcessBinding{Evidence: opFake01ID(16), Ref: 1, PID: 101, Creation: 1001, Image: opFake01ID(17), Frame: frame}
	e := i
	e.Ref = 2
	e.PID = 102
	e.Creation = 1002
	e.Frame.TokenID = operationIdentityLUID{Low: 22}
	e.Frame.ModifiedID = operationIdentityLUID{Low: 23}
	e.Frame.Integrity = operationIdentityHigh
	e.Frame.Elevation = operationIdentityFull
	e.Frame.Elevated = true
	e.Frame.LinkedTokenID = i.Frame.TokenID
	e.Frame.GroupsPrivileges = opFake01ID(24)
	h := e
	h.Ref = 3
	h.PID = 103
	h.Creation = 1003
	h.Frame.TokenID = operationIdentityLUID{Low: 32}
	h.Image = opFake01ID(25)
	root := managedRootFileIdentity{VolumeSerialNumber: 5, FileID: [16]byte{1}}
	parent := root
	parent.FileID[0] = 2
	child := root
	child.FileID[0] = 3
	p := operationIdentityPlan{Schema: 1, ID: opFake01ID(1),
		Installation: operationIdentityInstallation{Machine: opFake01ID(2), Instance: opFake01ID(3), Epoch: opFake01ID(4), Evidence: opFake01ID(5), Generation: 1, Complete: true},
		Initiator:    i, Executor: e, Transition: operationIdentityLinkedElevation, TransitionProof: opFake01ID(6),
		ExpectedHelperImage: h.Image, Profile: frame.Profile, Mode: operationIdentityStandard, Issued: 10, Expires: 310,
		Targets: []operationIdentityTarget{{Name: "target.txt", Root: root, Parent: parent, Child: child, RootRef: 11, ParentRef: 12, Ancestors: opFake01ID(7)}}}
	f := &opFake01Fixture{p: p, h: h, clock: &opFake01Clock{value: operationIdentitySimulationTime{Seconds: 11, Epoch: p.Installation.Epoch}}}
	f.a = &opFake01Memory{epoch: p.Installation.Epoch, approvals: make(map[operationIdentitySimulationID]operationIdentityApproval),
		helpers: make(map[operationIdentitySimulationID]bool), records: make(map[operationIdentitySimulationID]operationIdentitySimulationRecord),
		slots: make(map[opFake01Slot]operationIdentitySimulationID), nonces: make(map[operationIdentitySimulationID]operationIdentitySimulationID)}
	f.reapprove()
	return f
}

// This explicit test setup grants simulated evidence; plan/digest alone cannot.
func (f *opFake01Fixture) reapprove() {
	f.p.ExpectedInitiator = opFake01Digest(f.p.Initiator)
	f.p.ExpectedExecutor = opFake01Digest(f.p.Executor)
	d := opFake01Digest(f.p)
	f.approval = operationIdentityApproval{Source: operationIdentityTestEvidence, Intent: d, Profile: f.p.Profile, ExplicitRemoveData: f.p.Mode == operationIdentityRemoveData}
	f.a.approvals[d] = f.approval
	f.proof = operationIdentityHelperProof{Source: operationIdentityTestEvidence, Evidence: opFake01ID(8), Intent: d,
		ExpectedHelper: opFake01Digest(f.h), ExpectedParent: opFake01Digest(f.p.Executor),
		DerivedFromExecutor: true, Nonce: opFake01ID(9), Epoch: f.p.Installation.Epoch, Issued: 11}
	f.a.helpers[opFake01HelperKey(d, f.h, f.proof)] = true
}
func (f *opFake01Fixture) open(t *testing.T) *operationIdentitySimulation {
	t.Helper()
	m, r, e := newOperationIdentitySimulation(f.a, f.p, f.approval, f.clock.now, func() error { f.closes++; return f.closeErr })
	if e != nil || r.State != operationIdentityAuthorized || !r.Simulated {
		t.Fatal("authorize", r, e)
	}
	t.Cleanup(func() { _ = m.Close(nil) })
	return m
}
func (f *opFake01Fixture) record(t *testing.T) operationIdentitySimulationRecord {
	t.Helper()
	r, e := f.a.loadSimulation(f.p.ID)
	if e != nil {
		t.Fatal(e)
	}
	return r
}
func opFake01Reserve(t *testing.T, m *operationIdentitySimulation) {
	t.Helper()
	r, e := m.Reserve()
	if e != nil || r.State != operationIdentityReserved {
		t.Fatal(r, e)
	}
}
func (f *opFake01Fixture) claim(t *testing.T, m *operationIdentitySimulation) {
	t.Helper()
	r, e := m.BindHelper(f.h, f.proof)
	if e != nil || r.State != operationIdentityClaimed {
		t.Fatal(r, e)
	}
}
func (f *opFake01Fixture) eventProof(t *testing.T) operationIdentityEventProof {
	t.Helper()
	r := f.record(t)
	return operationIdentityEventProof{Evidence: opFake01ID(90), Binding: r.Binding, ExpectedRevision: r.Revision,
		Parent: opFake01Digest(f.p.Executor), ParentWait: operationIdentityParentWaitExpectedHandleSignaled}
}
func (f *opFake01Fixture) advance(t *testing.T, m *operationIdentitySimulation, event operationIdentityEvent) operationIdentitySimulationResult {
	t.Helper()
	r, e := m.Advance(event, f.eventProof(t))
	if e != nil {
		t.Fatal(r, e)
	}
	return r
}
func (f *opFake01Fixture) running(t *testing.T, m *operationIdentitySimulation) {
	t.Helper()
	opFake01Reserve(t, m)
	f.claim(t, m)
	f.advance(t, m, operationIdentityAccept)
	f.advance(t, m, operationIdentityAck)
	f.advance(t, m, operationIdentityParentExited)
}

func TestHUWINOperationIDFake01Allowed(t *testing.T) {
	for _, name := range []string{"standard", "silent", "explicit_remove_data", "already_elevated"} {
		t.Run(name, func(t *testing.T) {
			f := opFake01FixtureNew()
			switch name {
			case "silent":
				f.p.Mode = operationIdentitySilent
			case "explicit_remove_data":
				f.p.Mode = operationIdentityRemoveData
			case "already_elevated":
				f.p.Initiator = f.p.Executor
				f.p.Transition = operationIdentityAlreadyElevated
			}
			f.reapprove()
			m := f.open(t)
			f.running(t, m)
			r := f.advance(t, m, operationIdentityEffect)
			if r.State != operationIdentityRunning {
				t.Fatal(r)
			}
			p := f.eventProof(t)
			p.Postconditions = operationIdentityPostconditions
			p.WorkerInactive = true
			p.MemoryResultSaved = true
			r, e := m.Advance(operationIdentityFinish, p)
			if e != nil || r.State != operationIdentityCompleted || !r.Simulated || string(r.State) == "completed" {
				t.Fatal(r, e)
			}
			before := f.record(t)
			_, e = m.Advance(operationIdentityFailure, f.eventProof(t))
			if e == nil || !reflect.DeepEqual(before, f.record(t)) {
				t.Fatal("terminal record regressed")
			}
		})
	}
}
func TestHUWINOperationIDFake01RejectPlan(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*opFake01Fixture)
	}{
		{"same_sid_other_session", func(f *opFake01Fixture) { f.p.Executor.Frame.SessionID++ }},
		{"same_sid_other_logon", func(f *opFake01Fixture) { f.p.Executor.Frame.AuthenticationID.Low++ }},
		{"other_credentials", func(f *opFake01Fixture) { f.p.Executor.Frame.SID = "fixture:other" }},
		{"missing_link", func(f *opFake01Fixture) { f.p.Initiator.Frame.LinkedTokenID = operationIdentityLUID{} }},
		{"wrong_reverse_link", func(f *opFake01Fixture) { f.p.Executor.Frame.LinkedTokenID.Low++ }},
		{"default_token", func(f *opFake01Fixture) { f.p.Initiator.Frame.Elevation = operationIdentityDefault }},
		{"impersonation", func(f *opFake01Fixture) { f.p.Initiator.Frame.Impersonating = true }},
		{"restricted", func(f *opFake01Fixture) { f.p.Executor.Frame.Restricted = true }},
		{"sandbox", func(f *opFake01Fixture) { f.p.Initiator.Frame.Sandboxed = true }},
		{"not_primary", func(f *opFake01Fixture) { f.p.Executor.Frame.Type = 2 }},
		{"profile_missing", func(f *opFake01Fixture) { f.p.Initiator.Frame.ProfileKnown = false }},
		{"profile_changed", func(f *opFake01Fixture) { f.p.Executor.Frame.Profile = opFake01ID(55) }},
		{"not_interactive", func(f *opFake01Fixture) { f.p.Initiator.Frame.Interactive = false }},
		{"SYSTEM", func(f *opFake01Fixture) { f.p.Initiator.Frame.SID = "S-1-5-18" }},
		{"LocalService", func(f *opFake01Fixture) { f.p.Initiator.Frame.SID = "S-1-5-19" }},
		{"low_integrity", func(f *opFake01Fixture) { f.p.Initiator.Frame.Integrity = 0 }},
		{"executor_not_elevated", func(f *opFake01Fixture) { f.p.Executor.Frame.Elevated = false }},
		{"metadata_incomplete", func(f *opFake01Fixture) { f.p.Executor.Frame.CompleteMask ^= 1 }},
		{"wrong_frame_schema", func(f *opFake01Fixture) { f.p.Initiator.Frame.Schema = 0 }},
		{"frame_origin_absent", func(f *opFake01Fixture) { f.p.Executor.Frame.Source = 0 }},
		{"frame_receipt_absent", func(f *opFake01Fixture) { f.p.Initiator.Frame.Evidence = operationIdentitySimulationID{} }},
		{"token_id_absent", func(f *opFake01Fixture) { f.p.Initiator.Frame.TokenID = operationIdentityLUID{} }},
		{"modified_id_absent", func(f *opFake01Fixture) { f.p.Executor.Frame.ModifiedID = operationIdentityLUID{} }},
		{"session_zero", func(f *opFake01Fixture) { f.p.Initiator.Frame.SessionID = 0 }},
		{"process_handle_invalid", func(f *opFake01Fixture) { f.p.Executor.Ref = 0 }},
		{"parent_creation_missing", func(f *opFake01Fixture) { f.p.Executor.Creation = 0 }},
		{"process_receipt_missing", func(f *opFake01Fixture) { f.p.Executor.Evidence = operationIdentitySimulationID{} }},
		{"operation_zero", func(f *opFake01Fixture) { f.p.ID = operationIdentitySimulationID{} }},
		{"machine_zero", func(f *opFake01Fixture) { f.p.Installation.Machine = operationIdentitySimulationID{} }},
		{"instance_zero", func(f *opFake01Fixture) { f.p.Installation.Instance = operationIdentitySimulationID{} }},
		{"generation_zero", func(f *opFake01Fixture) { f.p.Installation.Generation = 0 }},
		{"installation_incomplete", func(f *opFake01Fixture) { f.p.Installation.Complete = false }},
		{"epoch_changed", func(f *opFake01Fixture) { f.p.Installation.Epoch = opFake01ID(66) }},
		{"offer_expired", func(f *opFake01Fixture) {
			f.clock.set(operationIdentitySimulationTime{Seconds: 310, Epoch: f.p.Installation.Epoch})
		}},
		{"offer_too_long", func(f *opFake01Fixture) { f.p.Expires = 311 }},
		{"offer_reversed", func(f *opFake01Fixture) { f.p.Expires = 9 }},
		{"clock_before_offer", func(f *opFake01Fixture) { f.p.Issued = 12 }},
		{"mode_unknown", func(f *opFake01Fixture) { f.p.Mode = 0 }},
		{"targets_missing", func(f *opFake01Fixture) { f.p.Targets = nil }},
		{"traversal", func(f *opFake01Fixture) { f.p.Targets[0].Name = "../elsewhere" }},
		{"target_root_ref_invalid", func(f *opFake01Fixture) { f.p.Targets[0].RootRef = 0 }},
		{"target_volume_changed", func(f *opFake01Fixture) { f.p.Targets[0].Child.VolumeSerialNumber++ }},
		{"root_file_id_missing", func(f *opFake01Fixture) { f.p.Targets[0].Root.FileID = [16]byte{} }},
		{"ancestors_missing", func(f *opFake01Fixture) { f.p.Targets[0].Ancestors = operationIdentitySimulationID{} }},
		{"duplicate_target", func(f *opFake01Fixture) { f.p.Targets = append(f.p.Targets, f.p.Targets[0]) }},
		{"already_policy_not_high", func(f *opFake01Fixture) { f.p.Transition = operationIdentityAlreadyElevated }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := opFake01FixtureNew()
			tc.mutate(f)
			f.reapprove() // Trusted fake grant cannot waive policy.
			m, r, e := newOperationIdentitySimulation(f.a, f.p, f.approval, f.clock.now, func() error { f.closes++; return nil })
			if e == nil || m != nil || r.State != operationIdentityRejected || !r.Simulated || len(f.a.records) != 0 || f.closes != 1 {
				t.Fatal(r, e)
			}
		})
	}
}
func TestHUWINOperationIDFake01ApprovalAndProvenance(t *testing.T) {
	for _, name := range []string{"no_authority", "typed_nil", "missing_clock", "missing_lease", "mode_after_approval", "target_after_approval", "wrong_instance", "wrong_generation", "wrong_intent", "remove_without_consent", "generic_UAC_only", "authority_denied", "token_id_changed_unproved", "parent_PID_reused", "wrong_expected_image"} {
		t.Run(name, func(t *testing.T) {
			f := opFake01FixtureNew()
			var a operationIdentitySimulationClaims = f.a
			now := f.clock.now
			closeFn := func() error { f.closes++; return nil }
			switch name {
			case "no_authority":
				a = nil
			case "typed_nil":
				var missing *opFake01Memory
				a = missing
			case "missing_clock":
				now = nil
			case "missing_lease":
				closeFn = nil
			case "mode_after_approval":
				f.p.Mode = operationIdentitySilent
			case "target_after_approval":
				f.p.Targets[0].Name = "other.txt"
			case "wrong_instance":
				f.p.Installation.Instance = opFake01ID(99)
			case "wrong_generation":
				f.p.Installation.Generation++
			case "wrong_intent":
				f.approval.Intent = opFake01ID(99)
			case "remove_without_consent":
				f.p.Mode = operationIdentityRemoveData
				f.reapprove()
				f.approval.ExplicitRemoveData = false
			case "generic_UAC_only":
				f.p.Mode = operationIdentityRemoveData
				f.reapprove()
				f.approval.Profile = operationIdentitySimulationID{}
			case "authority_denied":
				delete(f.a.approvals, f.approval.Intent)
			case "token_id_changed_unproved":
				f.p.Executor.Frame.TokenID.Low++
			case "parent_PID_reused":
				f.p.Executor.Creation++
			case "wrong_expected_image":
				f.p.Executor.Image = opFake01ID(99)
			}
			m, r, e := newOperationIdentitySimulation(a, f.p, f.approval, now, closeFn)
			if e == nil || m != nil || r.State != operationIdentityRejected {
				t.Fatal(r, e)
			}
		})
	}
	t.Run("legitimate_token_ID_change_with_link_proof", func(t *testing.T) {
		f := opFake01FixtureNew()
		f.p.Executor.Frame.TokenID.Low = 202
		f.p.Initiator.Frame.LinkedTokenID.Low = 202
		f.reapprove()
		_ = f.open(t)
	})
}
func TestHUWINOperationIDFake01HelperRejection(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*opFake01Fixture)
	}{
		{"PID_reuse", func(f *opFake01Fixture) { f.h.Creation++ }},
		{"wrong_helper_image", func(f *opFake01Fixture) { f.h.Image = opFake01ID(81) }},
		{"wrong_helper_SID", func(f *opFake01Fixture) { f.h.Frame.SID = "fixture:foreign" }},
		{"wrong_helper_session", func(f *opFake01Fixture) { f.h.Frame.SessionID++ }},
		{"wrong_helper_logon", func(f *opFake01Fixture) { f.h.Frame.AuthenticationID.Low++ }},
		{"helper_not_high", func(f *opFake01Fixture) { f.h.Frame.Elevated = false }},
		{"helper_restricted", func(f *opFake01Fixture) { f.h.Frame.Restricted = true }},
		{"helper_invalid_handle", func(f *opFake01Fixture) { f.h.Ref = 0 }},
		{"helper_is_parent", func(f *opFake01Fixture) { f.h.PID = f.p.Executor.PID }},
		{"peer_proof_missing", func(f *opFake01Fixture) { f.proof.Evidence = operationIdentitySimulationID{} }},
		{"parent_spoof", func(f *opFake01Fixture) { f.proof.ExpectedParent = opFake01ID(81) }},
		{"helper_digest_spoof", func(f *opFake01Fixture) { f.proof.ExpectedHelper = opFake01ID(81) }},
		{"nonce_zero", func(f *opFake01Fixture) { f.proof.Nonce = operationIdentitySimulationID{} }},
		{"foreign_epoch", func(f *opFake01Fixture) { f.proof.Epoch = opFake01ID(81) }},
		{"future_challenge", func(f *opFake01Fixture) { f.proof.Issued = 12 }},
		{"stale_challenge", func(f *opFake01Fixture) {
			f.clock.set(operationIdentitySimulationTime{Seconds: 41, Epoch: f.p.Installation.Epoch})
		}},
		{"derived_proof_missing", func(f *opFake01Fixture) { f.proof.DerivedFromExecutor = false }},
		{"authority_proof_absent", func(f *opFake01Fixture) { f.a.helpers = make(map[operationIdentitySimulationID]bool) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := opFake01FixtureNew()
			m := f.open(t)
			opFake01Reserve(t, m)
			before := f.record(t)
			tc.mutate(f)
			r, e := m.BindHelper(f.h, f.proof)
			if e == nil || r.State != operationIdentityReserved || !reflect.DeepEqual(before, f.record(t)) {
				t.Fatal(r, e)
			}
		})
	}
}
func TestHUWINOperationIDFake01Claims(t *testing.T) {
	t.Run("sequential_replay_and_no_takeover", func(t *testing.T) {
		f := opFake01FixtureNew()
		m := f.open(t)
		opFake01Reserve(t, m)
		f.claim(t, m)
		before := f.record(t)
		if _, e := m.Reserve(); e == nil {
			t.Fatal("duplicate reservation")
		}
		if _, e := m.BindHelper(f.h, f.proof); e == nil {
			t.Fatal("claim replay")
		}
		if !reflect.DeepEqual(before, f.record(t)) {
			t.Fatal("winner changed")
		}
		f.p.ID = opFake01ID(111)
		f.reapprove()
		other := f.open(t)
		if _, e := other.Reserve(); e == nil {
			t.Fatal("generation takeover")
		}
	})
	t.Run("nonce_reuse_across_installations", func(t *testing.T) {
		f := opFake01FixtureNew()
		m := f.open(t)
		opFake01Reserve(t, m)
		f.claim(t, m)
		f.p.ID = opFake01ID(112)
		f.p.Installation.Instance = opFake01ID(113)
		f.reapprove()
		other := f.open(t)
		opFake01Reserve(t, other)
		before := f.record(t)
		if _, e := other.BindHelper(f.h, f.proof); e == nil {
			t.Fatal("nonce replay")
		}
		if !reflect.DeepEqual(before, f.record(t)) {
			t.Fatal("failed claim changed reservation")
		}
	})
	t.Run("simultaneous_reservation_one_winner", func(t *testing.T) {
		f := opFake01FixtureNew()
		const n = 32
		models := make([]*operationIdentitySimulation, n)
		for i := range models {
			models[i] = f.open(t)
		}
		gate := make(chan struct{})
		results := make(chan bool, n)
		var wg sync.WaitGroup
		for _, m := range models {
			wg.Add(1)
			go func(m *operationIdentitySimulation) {
				defer wg.Done()
				<-gate
				_, e := m.Reserve()
				results <- e == nil
			}(m)
		}
		close(gate)
		wg.Wait()
		close(results)
		wins := 0
		for ok := range results {
			if ok {
				wins++
			}
		}
		if wins != 1 {
			t.Fatal("reservation winners", wins)
		}
	})
	t.Run("simultaneous_final_claim_one_winner", func(t *testing.T) {
		f := opFake01FixtureNew()
		a := f.open(t)
		b := f.open(t)
		opFake01Reserve(t, a)
		gate := make(chan struct{})
		results := make(chan bool, 2)
		var wg sync.WaitGroup
		for _, m := range []*operationIdentitySimulation{a, b} {
			wg.Add(1)
			go func(m *operationIdentitySimulation) {
				defer wg.Done()
				<-gate
				_, e := m.BindHelper(f.h, f.proof)
				results <- e == nil
			}(m)
		}
		close(gate)
		wg.Wait()
		close(results)
		wins := 0
		for ok := range results {
			if ok {
				wins++
			}
		}
		if wins != 1 || len(f.a.nonces) != 1 {
			t.Fatal("claim winners", wins)
		}
	})
}
func TestHUWINOperationIDFake01Transitions(t *testing.T) {
	for _, name := range []string{"accept_before_claim", "effects_before_accept", "parent_before_ACK", "finish_from_pending", "wrong_revision", "foreign_binding", "parent_denied", "parent_reused", "missing_postcondition", "result_unsaved", "worker_unknown"} {
		t.Run(name, func(t *testing.T) {
			f := opFake01FixtureNew()
			m := f.open(t)
			opFake01Reserve(t, m)
			event := operationIdentityAccept
			switch name {
			case "accept_before_claim":
			case "effects_before_accept":
				f.claim(t, m)
				event = operationIdentityEffect
			case "parent_before_ACK", "finish_from_pending", "parent_denied", "parent_reused":
				f.claim(t, m)
				f.advance(t, m, operationIdentityAccept)
				event = operationIdentityParentExited
				if name == "finish_from_pending" {
					event = operationIdentityFinish
				}
				if name == "parent_denied" || name == "parent_reused" {
					f.advance(t, m, operationIdentityAck)
				}
			default:
				f.claim(t, m)
				f.advance(t, m, operationIdentityAccept)
				f.advance(t, m, operationIdentityAck)
				f.advance(t, m, operationIdentityParentExited)
				event = operationIdentityFinish
			}
			p := f.eventProof(t)
			p.Postconditions = operationIdentityPostconditions
			p.MemoryResultSaved = true
			p.WorkerInactive = true
			switch name {
			case "wrong_revision":
				p.ExpectedRevision++
			case "foreign_binding":
				p.Binding = opFake01ID(66)
			case "parent_denied":
				p.ParentWait = operationIdentityParentWaitOpenAccessDenied
			case "parent_reused":
				p.Parent = opFake01ID(66)
			case "missing_postcondition":
				p.Postconditions ^= 1
			case "result_unsaved":
				p.MemoryResultSaved = false
			case "worker_unknown":
				p.WorkerInactive = false
			}
			before := f.record(t)
			r, e := m.Advance(event, p)
			if e == nil || r.State == operationIdentityCompleted || !reflect.DeepEqual(before, f.record(t)) {
				t.Fatal(r, e)
			}
		})
	}
}

func TestHUWINOperationIDFake01ParentWaitOutcomes(t *testing.T) {
	cases := []struct {
		name   string
		result operationIdentityParentWaitEvidence
		mutate func(*operationIdentityEventProof)
	}{
		{"pid_not_found_is_not_exit_proof", operationIdentityParentWaitPIDNotFound, nil},
		{"open_process_access_denied", operationIdentityParentWaitOpenAccessDenied, nil},
		{"open_process_other_failure", operationIdentityParentWaitOpenFailed, nil},
		{"pid_reused_identity_mismatch", operationIdentityParentWaitIdentityMismatch, func(p *operationIdentityEventProof) { p.Parent = opFake01ID(99) }},
		{"wait_timeout", operationIdentityParentWaitTimedOut, nil},
		{"wait_failure", operationIdentityParentWaitFailed, nil},
		{"wait_unexpected_result", operationIdentityParentWaitUnexpected, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := opFake01FixtureNew()
			m := f.open(t)
			opFake01Reserve(t, m)
			f.claim(t, m)
			f.advance(t, m, operationIdentityAccept)
			f.advance(t, m, operationIdentityAck)
			p := f.eventProof(t)
			p.ParentWait = tc.result
			if tc.mutate != nil {
				tc.mutate(&p)
			}
			before := f.record(t)
			r, err := m.Advance(operationIdentityParentExited, p)
			if err == nil || r.State != operationIdentityAccepted || !reflect.DeepEqual(before, f.record(t)) {
				t.Fatalf("unconfirmed parent wait advanced state: result=%+v err=%v", r, err)
			}
			if r.State == operationIdentityRunning || before.Effects != operationIdentityEffectsNone {
				t.Fatal("unconfirmed parent wait permitted target effects")
			}
		})
	}

	t.Run("only_retained_expected_handle_signal_advances_after_ack", func(t *testing.T) {
		f := opFake01FixtureNew()
		m := f.open(t)
		opFake01Reserve(t, m)
		f.claim(t, m)
		f.advance(t, m, operationIdentityAccept)
		p := f.eventProof(t)
		if _, err := m.Advance(operationIdentityParentExited, p); err == nil {
			t.Fatal("parent wait advanced before ACK")
		}
		f.advance(t, m, operationIdentityAck)
		p = f.eventProof(t)
		p.ParentWait = operationIdentityParentWaitExpectedHandleSignaled
		r, err := m.Advance(operationIdentityParentExited, p)
		if err != nil || r.State != operationIdentityRunning || !r.Simulated {
			t.Fatalf("expected fake retained-handle exit after ACK, got %+v err=%v", r, err)
		}
	})
}

func TestHUWINOperationIDFake01Interruptions(t *testing.T) {
	for _, stage := range []string{"reserved", "claimed", "accepted", "running", "effects", "uncertain"} {
		for _, event := range []operationIdentityEvent{operationIdentityFailure, operationIdentityCrash, operationIdentityTimeout, operationIdentityReboot, operationIdentityCorruption} {
			for _, knownNone := range []bool{false, true} {
				name := stage + "/" + string(rune('A'+event)) + "/" + map[bool]string{true: "proved_no_effects", false: "uncertain"}[knownNone]
				t.Run(name, func(t *testing.T) {
					f := opFake01FixtureNew()
					m := f.open(t)
					opFake01Reserve(t, m)
					if stage != "reserved" {
						f.claim(t, m)
					}
					if stage != "reserved" && stage != "claimed" {
						f.advance(t, m, operationIdentityAccept)
					}
					if stage == "running" || stage == "effects" || stage == "uncertain" {
						f.advance(t, m, operationIdentityAck)
						f.advance(t, m, operationIdentityParentExited)
					}
					if stage == "effects" {
						f.advance(t, m, operationIdentityEffect)
					}
					if stage == "uncertain" {
						f.advance(t, m, operationIdentityEffectUncertain)
					}
					p := f.eventProof(t)
					p.NoEffectsProved = knownNone
					p.WorkerInactive = knownNone
					r, e := m.Advance(event, p)
					want := operationIdentityPartial
					if knownNone && stage != "effects" && stage != "uncertain" && event != operationIdentityReboot && event != operationIdentityCorruption {
						want = operationIdentityFailed
					}
					if e != nil || r.State != want {
						t.Fatal(r, e, "want", want)
					}
					if _, e = m.BindHelper(f.h, f.proof); e == nil {
						t.Fatal("restart replay")
					}
					if _, e = m.Reserve(); e == nil {
						t.Fatal("reservation takeover")
					}
				})
			}
		}
	}
}
func TestHUWINOperationIDFake01LifetimeAndCorruption(t *testing.T) {
	for _, name := range []string{"ACK_lost", "ACK_deadline", "parent_deadline", "offer_expired_after_claim", "clock_rollback", "reboot_epoch", "corrupt_record", "input_alias", "snapshot_alias", "close_once_with_primary_error", "constructor_error_with_close_error", "fresh_memory_not_durable"} {
		t.Run(name, func(t *testing.T) {
			f := opFake01FixtureNew()
			m := f.open(t)
			if name == "constructor_error_with_close_error" {
				primary := errors.New("approval")
				secondary := errors.New("close")
				f.closeErr = secondary
				delete(f.a.approvals, f.approval.Intent)
				// Return a recognizable primary error through a dedicated denying adapter.
				a := &opFake01Deny{opFake01Memory: f.a, err: primary}
				_, _, e := newOperationIdentitySimulation(a, f.p, f.approval, f.clock.now, func() error { f.closes++; return secondary })
				if !errors.Is(e, primary) || !errors.Is(e, secondary) {
					t.Fatal(e)
				}
				return
			}
			opFake01Reserve(t, m)
			f.claim(t, m)
			switch name {
			case "ACK_lost":
				f.advance(t, m, operationIdentityAccept)
				r := f.advance(t, m, operationIdentityAckLost)
				if r.State != operationIdentityAccepted {
					t.Fatal(r)
				}
				if _, e := m.Advance(operationIdentityParentExited, f.eventProof(t)); e == nil {
					t.Fatal("missing ACK")
				}
			case "ACK_deadline":
				f.clock.set(operationIdentitySimulationTime{Seconds: 41, Epoch: f.p.Installation.Epoch})
				if _, e := m.Advance(operationIdentityAccept, f.eventProof(t)); e == nil {
					t.Fatal("expired ACK")
				}
			case "parent_deadline":
				f.advance(t, m, operationIdentityAccept)
				f.advance(t, m, operationIdentityAck)
				f.clock.set(operationIdentitySimulationTime{Seconds: 41, Epoch: f.p.Installation.Epoch})
				if _, e := m.Advance(operationIdentityParentExited, f.eventProof(t)); e == nil {
					t.Fatal("parent timeout")
				}
			case "offer_expired_after_claim", "clock_rollback", "reboot_epoch":
				now := f.clock.now()
				if name == "offer_expired_after_claim" {
					now.Seconds = 310
				}
				if name == "clock_rollback" {
					now.Seconds = 10
				}
				if name == "reboot_epoch" {
					now.Epoch = opFake01ID(99)
				}
				f.clock.set(now)
				before := f.record(t)
				if r, e := m.Advance(operationIdentityAccept, f.eventProof(t)); e == nil || r.State == operationIdentityCompleted {
					t.Fatal(r, e)
				}
				if !reflect.DeepEqual(before, f.record(t)) {
					t.Fatal("uncertain record overwritten")
				}
			case "corrupt_record":
				f.a.mu.Lock()
				r := f.a.records[f.p.ID]
				r.Revision++
				f.a.records[f.p.ID] = r
				f.a.mu.Unlock()
				if _, e := m.Advance(operationIdentityAccept, f.eventProof(t)); e == nil {
					t.Fatal("corruption accepted")
				}
			case "input_alias":
				f.p.Targets[0].Name = "injected.txt"
				if _, e := m.Advance(operationIdentityAccept, f.eventProof(t)); e != nil {
					t.Fatal("caller alias modified owned plan", e)
				}
			case "snapshot_alias":
				r := f.record(t)
				r.Plan.Targets[0].Name = "injected.txt"
				if f.record(t).Plan.Targets[0].Name != "target.txt" {
					t.Fatal("snapshot aliases storage")
				}
			case "close_once_with_primary_error":
				primary := errors.New("primary")
				secondary := errors.New("close")
				f.closeErr = secondary
				e := m.Close(primary)
				if !errors.Is(e, primary) || !errors.Is(e, secondary) {
					t.Fatal(e)
				}
				_ = m.Close(nil)
				if f.closes != 1 {
					t.Fatal("duplicate evidence close")
				}
				if _, e = m.Reserve(); e == nil {
					t.Fatal("closed model used")
				}
			case "fresh_memory_not_durable":
				fresh := opFake01FixtureNew()
				other := fresh.open(t)
				opFake01Reserve(t, other)
				t.Log("NOT_PROVEN: fresh memory loses prior claims; no durable/multiprocess authentication assertion")
			}
		})
	}
}

type opFake01Deny struct {
	*opFake01Memory
	err error
}

func (a *opFake01Deny) approveSimulation(operationIdentitySimulationID, operationIdentityApproval) error {
	return a.err
}

// NATIVE-01 observes only this test process. No native value is passed to the
// simulation above. Microsoft contracts:
// https://learn.microsoft.com/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation
// https://learn.microsoft.com/windows/win32/api/winnt/ns-winnt-token_statistics
// https://learn.microsoft.com/windows/win32/api/winnt/ne-winnt-token_information_class
// https://learn.microsoft.com/windows/win32/api/winnt/ns-winnt-token_linked_token
// x/sys v0.41.0 lacks this later enum constant and TOKEN_STATISTICS.
const opNative01TokenIsAppContainer uint32 = 29

type opNative01Statistics struct {
	TokenID, AuthenticationID  windows.LUID
	Expiration                 int64
	TokenType, Impersonation   uint32
	DynamicCharged, Available  uint32
	GroupCount, PrivilegeCount uint32
	ModifiedID                 windows.LUID
}

func opNative01ABI() error {
	s := opNative01Statistics{}
	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" ||
		unsafe.Sizeof(uintptr(0)) != 8 || unsafe.Sizeof(windows.LUID{}) != 8 ||
		unsafe.Alignof(windows.LUID{}) != 4 || unsafe.Sizeof(s) != 56 || unsafe.Alignof(s) != 8 ||
		unsafe.Offsetof(s.AuthenticationID) != 8 || unsafe.Offsetof(s.Expiration) != 16 ||
		unsafe.Offsetof(s.TokenType) != 24 || unsafe.Offsetof(s.Impersonation) != 28 ||
		unsafe.Offsetof(s.DynamicCharged) != 32 || unsafe.Offsetof(s.Available) != 36 ||
		unsafe.Offsetof(s.GroupCount) != 40 || unsafe.Offsetof(s.PrivilegeCount) != 44 ||
		unsafe.Offsetof(s.ModifiedID) != 48 || unsafe.Sizeof(windows.Tokenuser{}) != 16 ||
		unsafe.Alignof(windows.Tokenuser{}) != 8 || unsafe.Sizeof(windows.Tokenmandatorylabel{}) != 16 ||
		unsafe.Offsetof(windows.SIDAndAttributes{}.Attributes) != 8 ||
		unsafe.Offsetof(windows.Tokengroups{}.Groups) != 8 || unsafe.Sizeof(uint32(0)) != 4 ||
		windows.TOKEN_QUERY != 0x0008 || windows.TokenStatistics != 10 ||
		windows.TokenLinkedToken != 19 || windows.TokenIntegrityLevel != 25 {
		return errors.New("NATIVE-01 unsupported ABI/constants")
	}
	return nil
}

// uint64 storage provides eight-byte alignment; returned embedded SID pointers
// remain valid only while this owning allocation is retained.
type opNative01Buffer struct {
	words []uint64
	used  uint32
}

func (b opNative01Buffer) data() []byte {
	if len(b.words) == 0 || uint64(b.used) > uint64(len(b.words))*8 {
		return nil
	}
	return unsafe.Slice((*byte)(unsafe.Pointer(&b.words[0])), len(b.words)*8)[:b.used]
}

type opNative01Query func(uint32, *byte, uint32, *uint32) error

// Fixed ABI classes are queried directly, as x/sys does for TokenElevation.
// Native TokenElevation rejects a zero-length sizing probe with ERROR_BAD_LENGTH
// (24) on this QA host. That is not evidence of access denial or a token change.
func opNative01Fixed(q opNative01Query, class, size uint32) (opNative01Buffer, error) {
	if size != 4 && size != 56 {
		return opNative01Buffer{}, errors.New("unsupported fixed token ABI size")
	}
	b := opNative01Buffer{words: make([]uint64, (size+7)/8)}
	var got uint32
	if err := q(class, (*byte)(unsafe.Pointer(&b.words[0])), size, &got); err != nil {
		return opNative01Buffer{}, fmt.Errorf("query class %d fixed ABI: %w", class, err)
	}
	if got != size {
		return opNative01Buffer{}, errors.New("fixed token metadata returned length mismatch")
	}
	b.used = got
	return b, nil
}

// R1: Jevan Saks, microsoft/win32metadata discussion 2308, 2026-09-15:
// https://github.com/microsoft/win32metadata/discussions/2308
// Maintainer clarification: BOOLEAN payload with DWORD-aligned pointer.
// Published TOKEN_INFORMATION_CLASS still says DWORD. This test accepts ONLY
// the observed one-byte variant, not a universal ABI or four-byte variant.
type opNative01Class21Storage struct {
	Before       uint32
	Payload      [4]byte
	After        uint32
	LengthBefore uint32
	Returned     uint32
	LengthAfter  uint32
}

func opNative01Class21(q opNative01Query) (uint32, error) {
	const before, after, lengthBefore, lengthAfter = uint32(0xA17C39D2), uint32(0xB28D40E3), uint32(0xC39E51F4), uint32(0xD40F6205)
	b := opNative01Class21Storage{Before: before, After: after, LengthBefore: lengthBefore, LengthAfter: lengthAfter}
	if unsafe.Sizeof(b) != 24 || unsafe.Alignof(b) != 4 || unsafe.Offsetof(b.Payload) != 4 ||
		unsafe.Offsetof(b.After) != 8 || unsafe.Offsetof(b.Returned) != 16 ||
		uintptr(unsafe.Pointer(&b.Payload[0]))%4 != 0 || uintptr(unsafe.Pointer(&b.Returned))%4 != 0 {
		return 0, errors.New("class 21 storage/alignment mismatch")
	}
	// Payload is zero-initialized; neither padding nor canaries are output data.
	primary := q(windows.TokenHasRestrictions, &b.Payload[0], 4, &b.Returned)
	var guardError error
	if b.Before != before || b.After != after || b.LengthBefore != lengthBefore || b.LengthAfter != lengthAfter {
		guardError = errors.New("class 21 output/ReturnLength canary changed")
	}
	if primary != nil || guardError != nil {
		return 0, errors.Join(primary, guardError)
	}
	if b.Returned != 1 {
		return 0, errors.New("class 21 unsupported returned length; only BOOLEAN length 1 accepted")
	}
	if b.Payload[0] > 1 {
		return 0, errors.New("class 21 BOOLEAN outside validated false/true variant")
	}
	// Bytes 1-3 are NOT consumed or interpreted, even if the caller sees zeros.
	return uint32(b.Payload[0]), nil
}

// Bounded retries handle changing variable-size metadata, never broaden access.
func opNative01Read(q opNative01Query, class uint32) (opNative01Buffer, error) {
	var n uint32
	err := q(class, nil, 0, &n)
	if !errors.Is(err, windows.ERROR_INSUFFICIENT_BUFFER) || n == 0 || n > 1<<20 {
		if err == nil {
			err = errors.New("missing sizing failure")
		}
		return opNative01Buffer{}, fmt.Errorf("query class %d sizing: %w", class, err)
	}
	for attempt := 0; attempt < 3; attempt++ {
		b := opNative01Buffer{words: make([]uint64, (n+7)/8)}
		var got uint32
		err = q(class, (*byte)(unsafe.Pointer(&b.words[0])), n, &got)
		if err == nil {
			if got == 0 || got > n {
				return opNative01Buffer{}, errors.New("invalid returned token buffer length")
			}
			b.used = got
			return b, nil
		}
		if !errors.Is(err, windows.ERROR_INSUFFICIENT_BUFFER) || got <= n || got > 1<<20 {
			return opNative01Buffer{}, fmt.Errorf("query class %d data: %w", class, err)
		}
		n = got
	}
	return opNative01Buffer{}, errors.New("token buffer never stabilized")
}
func opNative01DWORD(b opNative01Buffer) (uint32, error) {
	if len(b.data()) != 4 {
		return 0, errors.New("DWORD token metadata size mismatch")
	}
	return binary.LittleEndian.Uint32(b.data()), nil
}
func opNative01Stats(b opNative01Buffer) (opNative01Statistics, error) {
	if err := opUACP1R1CheckLayout(opUACP1R1ActualLayout()); err != nil {
		return opNative01Statistics{}, err
	}
	if len(b.data()) != 56 {
		return opNative01Statistics{}, &opUACP1R1StatsError{Code: opUACP1R1StatsSize}
	}
	if err := opUACP1R1CheckAlignment(uintptr(unsafe.Pointer(&b.words[0]))); err != nil {
		return opNative01Statistics{}, err
	}
	s := *(*opNative01Statistics)(unsafe.Pointer(&b.words[0]))
	if code := opUACP1R1StatisticsReason(s); code != "" {
		return opNative01Statistics{}, &opUACP1R1StatsError{Code: code}
	}
	return s, nil
}

// Test-local diagnostics, not a Windows security/authorization API. These
// reasons describe the exact decoder predicate, never the underlying token.
// Nonzero IDs and the 65536 count caps are this observer's existing bounded
// completeness contract; they are not universal Windows validity rules.
type opUACP1R1StatsReason string

const (
	opUACP1R1StatsLayout           opUACP1R1StatsReason = "stats_layout"
	opUACP1R1StatsSize             opUACP1R1StatsReason = "stats_size"
	opUACP1R1StatsAlignment        opUACP1R1StatsReason = "stats_alignment"
	opUACP1R1StatsTokenID          opUACP1R1StatsReason = "stats_token_id_missing"
	opUACP1R1StatsAuthenticationID opUACP1R1StatsReason = "stats_authentication_id_missing"
	opUACP1R1StatsModifiedID       opUACP1R1StatsReason = "stats_modified_id_missing"
	opUACP1R1StatsTokenType        opUACP1R1StatsReason = "stats_token_type_not_primary"
	opUACP1R1StatsGroupCount       opUACP1R1StatsReason = "stats_group_count_out_of_range"
	opUACP1R1StatsPrivilegeCount   opUACP1R1StatsReason = "stats_privilege_count_out_of_range"
)

type opUACP1R1StatsError struct{ Code opUACP1R1StatsReason }

func (e *opUACP1R1StatsError) Category() string {
	switch e.Code {
	case opUACP1R1StatsLayout, opUACP1R1StatsSize, opUACP1R1StatsAlignment:
		return "structure"
	default:
		return "observation_contract"
	}
}
func (e *opUACP1R1StatsError) Error() string {
	return "TOKEN_STATISTICS rejected: " + e.Category() + "/" + string(e.Code)
}

type opUACP1R1StatsLayoutInfo struct {
	AMD64Windows                     bool
	Size, Align, LUIDSize, LUIDAlign uintptr
	Primary, Impersonation           uint32
	Offsets                          [10]uintptr
}

func opUACP1R1ActualLayout() opUACP1R1StatsLayoutInfo {
	s := opNative01Statistics{}
	return opUACP1R1StatsLayoutInfo{
		AMD64Windows: runtime.GOOS == "windows" && runtime.GOARCH == "amd64",
		Size:         unsafe.Sizeof(s), Align: unsafe.Alignof(s),
		LUIDSize: unsafe.Sizeof(windows.LUID{}), LUIDAlign: unsafe.Alignof(windows.LUID{}),
		Primary: windows.TokenPrimary, Impersonation: windows.TokenImpersonation,
		Offsets: [10]uintptr{unsafe.Offsetof(s.TokenID), unsafe.Offsetof(s.AuthenticationID),
			unsafe.Offsetof(s.Expiration), unsafe.Offsetof(s.TokenType), unsafe.Offsetof(s.Impersonation),
			unsafe.Offsetof(s.DynamicCharged), unsafe.Offsetof(s.Available), unsafe.Offsetof(s.GroupCount),
			unsafe.Offsetof(s.PrivilegeCount), unsafe.Offsetof(s.ModifiedID)},
	}
}

func opUACP1R1CheckLayout(layout opUACP1R1StatsLayoutInfo) error {
	want := opUACP1R1StatsLayoutInfo{AMD64Windows: true, Size: 56, Align: 8, LUIDSize: 8, LUIDAlign: 4,
		Primary: 1, Impersonation: 2, Offsets: [10]uintptr{0, 8, 16, 24, 28, 32, 36, 40, 44, 48}}
	if layout != want {
		return &opUACP1R1StatsError{Code: opUACP1R1StatsLayout}
	}
	return nil
}

func opUACP1R1CheckAlignment(address uintptr) error {
	if address == 0 || address%8 != 0 {
		return &opUACP1R1StatsError{Code: opUACP1R1StatsAlignment}
	}
	return nil
}

// First failure wins: layout, size, alignment, then the original semantic OR
// predicate order below. No raw values, padding, SID, token or handle is stored.
// Impersonation=2 is a documented token type, but remains unsupported by this
// Primary-only observer. That rejection is not proof of a corrupt Windows ABI.
func opUACP1R1StatisticsReason(s opNative01Statistics) opUACP1R1StatsReason {
	switch {
	case s.TokenID == (windows.LUID{}):
		return opUACP1R1StatsTokenID
	case s.AuthenticationID == (windows.LUID{}):
		return opUACP1R1StatsAuthenticationID
	case s.ModifiedID == (windows.LUID{}):
		return opUACP1R1StatsModifiedID
	case s.TokenType != windows.TokenPrimary:
		return opUACP1R1StatsTokenType
	case s.GroupCount > 65536:
		return opUACP1R1StatsGroupCount
	case s.PrivilegeCount > 65536:
		return opUACP1R1StatsPrivilegeCount
	default:
		return ""
	}
}

// Bounds-check the embedded pointer before dereferencing any SID content.
// No account translation or SID string is requested or printed.
func opNative01SID(b opNative01Buffer, entry int) ([]byte, uint32, error) {
	data := b.data()
	if entry < 0 || entry > len(data)-16 {
		return nil, 0, errors.New("truncated SID_AND_ATTRIBUTES")
	}
	sa := (*windows.SIDAndAttributes)(unsafe.Pointer(&data[entry]))
	base, addr := uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(sa.Sid))
	if addr < base || addr-base > uintptr(len(data)-8) || addr%4 != 0 {
		return nil, 0, errors.New("SID pointer outside owning buffer")
	}
	off := int(addr - base)
	count := int(data[off+1])
	n := 8 + 4*count
	if data[off] != 1 || count == 0 || count > 15 || n > len(data)-off {
		return nil, 0, errors.New("invalid/truncated SID")
	}
	sid := append([]byte(nil), data[off:off+n]...)
	attributes := sa.Attributes
	runtime.KeepAlive(b.words)
	return sid, attributes, nil
}
func opNative01RestrictingCount(b opNative01Buffer) (uint32, error) {
	data := b.data()
	if len(data) < 4 {
		return 0, errors.New("truncated TOKEN_GROUPS")
	}
	n := binary.LittleEndian.Uint32(data)
	if n > 65536 || (n != 0 && uint64(8)+uint64(n)*16 > uint64(len(data))) {
		return 0, errors.New("truncated restricting SID array")
	}
	for i := uint32(0); i < n; i++ {
		if _, _, err := opNative01SID(b, 8+int(i)*16); err != nil {
			return 0, err
		}
	}
	return n, nil
}

// Exactly-once ownership for real or fake close functions; never closes a
// borrowed process/thread pseudohandle. Primary and secondary errors survive.
type opNative01Lease struct {
	closed   bool
	closeFn  func() error
	closeErr error
}

func (l *opNative01Lease) close(primary error) error {
	if !l.closed {
		l.closed = true
		l.closeErr = l.closeFn()
	}
	return errors.Join(primary, l.closeErr)
}

type opNative01Snapshot struct {
	stats                                                                             opNative01Statistics
	user                                                                              []byte
	session, integrity, elevation, elevationType, filtered, appContainer, restricting uint32
	linked                                                                            string
}

func opNative01SnapshotRead(q opNative01Query, linked func() (bool, error)) (s opNative01Snapshot, err error) {
	readStats := func() (opNative01Statistics, error) {
		b, e := opNative01Fixed(q, windows.TokenStatistics, 56)
		if e != nil {
			return opNative01Statistics{}, e
		}
		return opNative01Stats(b)
	}
	if s.stats, err = readStats(); err != nil {
		return s, err
	}
	dword := func(class uint32) (uint32, error) {
		b, e := opNative01Fixed(q, class, 4)
		if e != nil {
			return 0, e
		}
		return opNative01DWORD(b)
	}
	typeValue, e := dword(windows.TokenType)
	if e != nil {
		return s, e
	}
	if typeValue != windows.TokenPrimary || typeValue != s.stats.TokenType {
		return s, errors.New("token type inconsistent")
	}
	for _, field := range []struct {
		class uint32
		dest  *uint32
	}{
		{windows.TokenSessionId, &s.session}, {windows.TokenElevation, &s.elevation},
		{windows.TokenElevationType, &s.elevationType},
	} {
		if *field.dest, err = dword(field.class); err != nil {
			return s, err
		}
	}
	if s.filtered, err = opNative01Class21(q); err != nil {
		return s, err
	}
	if s.appContainer, err = dword(opNative01TokenIsAppContainer); err != nil {
		return s, err
	}
	b, e := opNative01Read(q, windows.TokenUser)
	if e != nil {
		return s, e
	}
	if s.user, _, err = opNative01SID(b, 0); err != nil {
		return s, err
	}
	b, e = opNative01Read(q, windows.TokenIntegrityLevel)
	if e != nil {
		return s, e
	}
	il, attrs, e := opNative01SID(b, 0)
	if e != nil {
		return s, e
	}
	if len(il) != 12 || !bytes.Equal(il[2:8], []byte{0, 0, 0, 0, 0, 16}) ||
		attrs&windows.SE_GROUP_INTEGRITY == 0 {
		return s, errors.New("integrity SID/attributes unsupported")
	}
	s.integrity = binary.LittleEndian.Uint32(il[8:])
	b, e = opNative01Read(q, windows.TokenRestrictedSids)
	if e != nil {
		return s, e
	}
	if s.restricting, err = opNative01RestrictingCount(b); err != nil {
		return s, err
	}
	// A filtered UAC token is not synonymous with a token containing restricting
	// SIDs. No group/privilege is enabled, adjusted, translated or enumerated.
	if s.session == 0 || s.integrity != 0x2000 || s.elevation != 0 || s.appContainer != 0 ||
		s.restricting != 0 || s.filtered > 1 || (s.elevationType != 1 && s.elevationType != 3) {
		return s, errors.New("QA token not non-elevated Medium/primary/unrestricted")
	}
	s.linked = "not-applicable-default"
	if s.elevationType == 3 {
		present, e := linked()
		if e != nil {
			return s, e
		}
		if !present {
			return s, errors.New("Limited token missing linked handle")
		}
		s.linked = "present-not-inspected"
	}
	end, e := readStats()
	if e != nil {
		return s, e
	}
	if !opNative01SamePrimaryStatistics(end, s.stats) {
		return s, errors.New("TOKEN_STATISTICS changed during observation")
	}
	return s, nil
}

// Observation consistency only, never evidence of UAC lineage or authorization.
// ImpersonationLevel is defined for impersonation tokens, not Primary tokens.
// Unsupported expiration and dynamic allocation accounting are not identity.
func opNative01SamePrimaryStatistics(a, b opNative01Statistics) bool {
	valid := func(s opNative01Statistics) bool {
		return s.TokenType == windows.TokenPrimary && s.TokenID != (windows.LUID{}) &&
			s.AuthenticationID != (windows.LUID{}) && s.ModifiedID != (windows.LUID{}) &&
			s.GroupCount <= 65536 && s.PrivilegeCount <= 65536
	}
	return valid(a) && valid(b) && a.TokenType == b.TokenType && a.TokenID == b.TokenID &&
		a.AuthenticationID == b.AuthenticationID && a.ModifiedID == b.ModifiedID &&
		a.GroupCount == b.GroupCount && a.PrivilegeCount == b.PrivilegeCount
}

func opNative01Consistent(a, b opNative01Snapshot) bool {
	// Query/ABI validation remains in SnapshotRead. Identical missing metadata
	// must not pass merely because both snapshots contain the same zero values.
	complete := func(s opNative01Snapshot) bool {
		return len(s.user) != 0 && s.session != 0 && s.integrity != 0 && s.elevation <= 1 &&
			s.filtered <= 1 && s.appContainer <= 1 &&
			((s.elevationType == 1 && s.linked == "not-applicable-default") ||
				(s.elevationType == 3 && s.linked == "present-not-inspected"))
	}
	return complete(a) && complete(b) && opNative01SamePrimaryStatistics(a.stats, b.stats) &&
		bytes.Equal(a.user, b.user) && a.session == b.session &&
		a.integrity == b.integrity && a.elevation == b.elevation && a.elevationType == b.elevationType &&
		a.filtered == b.filtered && a.appContainer == b.appContainer && a.restricting == b.restricting && a.linked == b.linked
}

// Entirely synthetic observations. No Windows token or SID is queried here.
func opUACP0Snapshot() opNative01Snapshot {
	return opNative01Snapshot{
		stats: opNative01Statistics{TokenID: windows.LUID{LowPart: 1}, AuthenticationID: windows.LUID{LowPart: 2},
			ModifiedID: windows.LUID{LowPart: 3}, TokenType: windows.TokenPrimary, GroupCount: 4, PrivilegeCount: 5},
		user: []byte("synthetic-user-not-a-native-SID"), session: 1, integrity: 0x2000,
		elevationType: 3, filtered: 1, restricting: 0, linked: "present-not-inspected",
	}
}

func TestHUWINOperationIDUACP0PrimaryStatistics(t *testing.T) {
	cases := []struct {
		name       string
		mutate     func(*opNative01Statistics)
		consistent bool
	}{
		{"unchanged", func(*opNative01Statistics) {}, true},
		{"Primary_impersonation_not_applicable", func(s *opNative01Statistics) { s.Impersonation = 0xffffffff }, true},
		{"expiration_not_supported", func(s *opNative01Statistics) { s.Expiration = -1 }, true},
		{"dynamic_charged_not_identity", func(s *opNative01Statistics) { s.DynamicCharged = 999 }, true},
		{"dynamic_available_not_identity", func(s *opNative01Statistics) { s.Available = 999 }, true},
		{"all_irrelevant_fields", func(s *opNative01Statistics) {
			s.Impersonation, s.Expiration, s.DynamicCharged, s.Available = 99, -1, 88, 77
		}, true},
		{"TokenId_low", func(s *opNative01Statistics) { s.TokenID.LowPart++ }, false},
		{"TokenId_high", func(s *opNative01Statistics) { s.TokenID.HighPart++ }, false},
		{"AuthenticationId_low", func(s *opNative01Statistics) { s.AuthenticationID.LowPart++ }, false},
		{"AuthenticationId_high", func(s *opNative01Statistics) { s.AuthenticationID.HighPart++ }, false},
		{"ModifiedId_low", func(s *opNative01Statistics) { s.ModifiedID.LowPart++ }, false},
		{"ModifiedId_high", func(s *opNative01Statistics) { s.ModifiedID.HighPart++ }, false},
		{"group_count", func(s *opNative01Statistics) { s.GroupCount++ }, false},
		{"privilege_count", func(s *opNative01Statistics) { s.PrivilegeCount++ }, false},
		{"impersonation_type", func(s *opNative01Statistics) { s.TokenType = windows.TokenImpersonation }, false},
		{"missing_type", func(s *opNative01Statistics) { s.TokenType = 0 }, false},
		{"missing_TokenId", func(s *opNative01Statistics) { s.TokenID = windows.LUID{} }, false},
		{"missing_AuthenticationId", func(s *opNative01Statistics) { s.AuthenticationID = windows.LUID{} }, false},
		{"missing_ModifiedId", func(s *opNative01Statistics) { s.ModifiedID = windows.LUID{} }, false},
		{"invalid_group_count", func(s *opNative01Statistics) { s.GroupCount = 65537 }, false},
		{"invalid_privilege_count", func(s *opNative01Statistics) { s.PrivilegeCount = 65537 }, false},
		{"irrelevant_fields_do_not_hide_TokenId_change", func(s *opNative01Statistics) {
			s.Impersonation = 99
			s.TokenID.LowPart++
		}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a, b := opUACP0Snapshot().stats, opUACP0Snapshot().stats
			tc.mutate(&b)
			if opNative01SamePrimaryStatistics(a, b) != tc.consistent ||
				opNative01SamePrimaryStatistics(b, a) != tc.consistent {
				t.Fatal("Primary identity comparison outcome")
			}
			if !tc.consistent && (b.TokenType != windows.TokenPrimary || b.TokenID == (windows.LUID{}) ||
				b.AuthenticationID == (windows.LUID{}) || b.ModifiedID == (windows.LUID{}) ||
				b.GroupCount > 65536 || b.PrivilegeCount > 65536) && opNative01SamePrimaryStatistics(b, b) {
				t.Fatal("identical invalid metadata accepted")
			}
		})
	}
}

func TestHUWINOperationIDUACP0SnapshotConsistency(t *testing.T) {
	cases := []struct {
		name       string
		mutate     func(*opNative01Snapshot)
		consistent bool
	}{
		{"unchanged_observation_only", func(*opNative01Snapshot) {}, true},
		{"Primary_non_invariants", func(s *opNative01Snapshot) {
			s.stats.Impersonation, s.stats.Expiration, s.stats.DynamicCharged, s.stats.Available = 99, -1, 88, 77
		}, true},
		{"same_SID_other_session", func(s *opNative01Snapshot) { s.session++ }, false},
		{"same_SID_other_LUID", func(s *opNative01Snapshot) { s.stats.AuthenticationID.LowPart++ }, false},
		{"same_logon_other_token", func(s *opNative01Snapshot) { s.stats.TokenID.LowPart++ }, false},
		{"same_token_modified", func(s *opNative01Snapshot) { s.stats.ModifiedID.LowPart++ }, false},
		{"other_SID", func(s *opNative01Snapshot) { s.user = []byte("other-synthetic-user") }, false},
		{"integrity_changed", func(s *opNative01Snapshot) { s.integrity = 0x3000 }, false},
		{"elevation_changed", func(s *opNative01Snapshot) { s.elevation = 1 }, false},
		{"elevation_type_changed", func(s *opNative01Snapshot) { s.elevationType = 1; s.linked = "not-applicable-default" }, false},
		{"filter_history_changed", func(s *opNative01Snapshot) { s.filtered = 0 }, false},
		{"restricting_count_changed", func(s *opNative01Snapshot) { s.restricting = 1 }, false},
		{"AppContainer_changed", func(s *opNative01Snapshot) { s.appContainer = 1 }, false},
		{"missing_user", func(s *opNative01Snapshot) { s.user = nil }, false},
		{"missing_session", func(s *opNative01Snapshot) { s.session = 0 }, false},
		{"missing_integrity", func(s *opNative01Snapshot) { s.integrity = 0 }, false},
		{"missing_elevation_type", func(s *opNative01Snapshot) { s.elevationType = 0 }, false},
		{"missing_link_observation", func(s *opNative01Snapshot) { s.linked = "" }, false},
		{"unsupported_link_observation", func(s *opNative01Snapshot) { s.linked = "lineage-proven-by-presence" }, false},
		{"invalid_boolean", func(s *opNative01Snapshot) { s.filtered = 2 }, false},
		{"missing_statistics", func(s *opNative01Snapshot) { s.stats = opNative01Statistics{} }, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a, b := opUACP0Snapshot(), opUACP0Snapshot()
			tc.mutate(&b)
			if opNative01Consistent(a, b) != tc.consistent || opNative01Consistent(b, a) != tc.consistent {
				t.Fatal("snapshot consistency outcome")
			}
		})
	}
	for _, name := range []string{"empty_snapshot", "missing_user", "missing_session", "missing_integrity", "missing_elevation_type", "missing_link"} {
		t.Run("identical_incomplete_"+name, func(t *testing.T) {
			s := opUACP0Snapshot()
			switch name {
			case "empty_snapshot":
				s = opNative01Snapshot{}
			case "missing_user":
				s.user = nil
			case "missing_session":
				s.session = 0
			case "missing_integrity":
				s.integrity = 0
			case "missing_elevation_type":
				s.elevationType = 0
			case "missing_link":
				s.linked = ""
			}
			if opNative01Consistent(s, s) {
				t.Fatal("matching incomplete observations accepted")
			}
		})
	}
}

func TestHUWINOperationIDUACP0ConservativeFakePolicy(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*opFake01Fixture)
	}{
		{"same_SID_other_session", func(f *opFake01Fixture) { f.p.Executor.Frame.SessionID++ }},
		{"same_SID_other_LUID", func(f *opFake01Fixture) { f.p.Executor.Frame.AuthenticationID.Low++ }},
		{"different_TokenId_unlinked", func(f *opFake01Fixture) { f.p.Executor.Frame.TokenID.Low++ }},
		{"linked_presence_not_reciprocal", func(f *opFake01Fixture) { f.p.Executor.Frame.LinkedTokenID = operationIdentityLUID{} }},
		{"missing_complete_metadata", func(f *opFake01Fixture) { f.p.Initiator.Frame.CompleteMask = 0 }},
		{"missing_origin", func(f *opFake01Fixture) { f.p.Initiator.Frame.Source = 0 }},
		{"missing_profile", func(f *opFake01Fixture) { f.p.Initiator.Frame.ProfileKnown = false }},
		{"restricted_policy_evidence", func(f *opFake01Fixture) { f.p.Executor.Frame.Restricted = true }},
		{"impersonating", func(f *opFake01Fixture) { f.p.Initiator.Frame.Impersonating = true }},
		{"wrong_token_type", func(f *opFake01Fixture) { f.p.Executor.Frame.Type = 2 }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := opFake01FixtureNew()
			tc.mutate(f)
			f.reapprove() // Even a fake approval cannot waive the existing policy.
			m, r, e := newOperationIdentitySimulation(f.a, f.p, f.approval, f.clock.now, func() error { f.closes++; return nil })
			if e == nil || m != nil || r.State != operationIdentityRejected || !r.Simulated || f.closes != 1 || len(f.a.records) != 0 {
				t.Fatal("conservative fake policy relaxed")
			}
		})
	}
	for _, filtered := range []uint32{0, 1} {
		t.Run(fmt.Sprintf("filtered_%d_zero_restricting_not_authority", filtered), func(t *testing.T) {
			s := opUACP0Snapshot()
			s.filtered, s.restricting = filtered, 0
			if !opNative01Consistent(s, s) {
				t.Fatal("filter history confused with restricting SIDs")
			}
			f := opFake01FixtureNew()
			// No native observation-to-policy conversion exists or is added here.
			m, r, e := newOperationIdentitySimulation(nil, f.p, f.approval, f.clock.now, func() error { f.closes++; return nil })
			if e == nil || m != nil || r.State != operationIdentityRejected || f.closes != 1 {
				t.Fatal("observation granted authority")
			}
		})
	}
	t.Run("different_token_ids_only_with_explicit_simulated_link_evidence", func(t *testing.T) {
		f := opFake01FixtureNew()
		f.p.Executor.Frame.TokenID.Low = 202
		f.p.Initiator.Frame.LinkedTokenID.Low = 202
		f.reapprove()
		_ = f.open(t) // Pure fake evidence; no assertion of actual UAC behavior.
	})
	t.Run("peer_not_proved_despite_consistent_observation", func(t *testing.T) {
		f := opFake01FixtureNew()
		m := f.open(t)
		opFake01Reserve(t, m)
		f.a.helpers = make(map[operationIdentitySimulationID]bool)
		before := f.record(t)
		_, e := m.BindHelper(f.h, f.proof)
		if e == nil || !reflect.DeepEqual(before, f.record(t)) {
			t.Fatal("unproved peer accepted")
		}
	})
}

func opNative01Fingerprint(domain string, data []byte) string {
	h := sha256.New()
	h.Write([]byte("MANUS-NATIVE01-observation/" + domain + "\x00"))
	h.Write(data)
	return fmt.Sprintf("%x", h.Sum(nil)[:12]) // Truncated one-way diagnostic, not an authority receipt.
}
func opNative01LUIDFingerprint(domain string, l windows.LUID) string {
	var b [8]byte
	binary.LittleEndian.PutUint32(b[:4], l.LowPart)
	binary.LittleEndian.PutUint32(b[4:], uint32(l.HighPart))
	return opNative01Fingerprint(domain, b[:])
}

func TestHUWINOperationIDNative01CurrentProcessToken(t *testing.T) {
	if os.Getenv("MANUS_OPERATION_ID_NATIVE01") != "1" {
		t.Skip("opt-in MANUS_OPERATION_ID_NATIVE01=1 required; no native query executed")
	}
	if e := opNative01ABI(); e != nil {
		t.Fatal(e)
	}
	for _, key := range os.Environ() {
		name, _, _ := strings.Cut(key, "=")
		if name != "MANUS_OPERATION_ID_NATIVE01" && strings.HasPrefix(name, "MANUS_") &&
			strings.Contains(name, "NATIVE") && os.Getenv(name) != "" {
			t.Fatal("another native opt-in is active")
		}
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	opened, closed := 0, 0
	t.Cleanup(func() {
		t.Logf("owned token handles opened=%d closed=%d; process/thread pseudohandles borrowed; DELETE=0 mutation=0", opened, closed)
		if opened != closed {
			t.Error("token handle close mismatch")
		}
	})
	// Inspect only this locked thread. A present impersonation token is closed
	// without inspection and stops the probe; no impersonation is performed.
	checkThread := func() error {
		var thread windows.Token
		err := windows.OpenThreadToken(windows.CurrentThread(), windows.TOKEN_QUERY, false, &thread)
		if errors.Is(err, windows.ERROR_NO_TOKEN) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("current-thread token Win32: %w", err)
		}
		opened++
		closeErr := thread.Close()
		if closeErr == nil {
			closed++
		}
		return errors.Join(errors.New("unexpected current-thread impersonation token"), closeErr)
	}
	if e := checkThread(); e != nil {
		t.Fatal(e)
	}
	var token windows.Token
	if e := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &token); e != nil {
		t.Fatal("current process TOKEN_QUERY:", e)
	}
	opened++
	lease := opNative01Lease{closeFn: func() error {
		e := token.Close()
		if e == nil {
			closed++
		}
		return e
	}}
	t.Cleanup(func() {
		if e := lease.close(nil); e != nil {
			t.Error("process token close:", e)
		}
	})
	q := func(class uint32, ptr *byte, n uint32, got *uint32) error {
		err := windows.GetTokenInformation(token, class, ptr, n, got)
		var code syscall.Errno
		if err != nil && !errors.As(err, &code) {
			return errors.New("non-Win32 token query error")
		}
		t.Logf("GetTokenInformation class=%d requestedBytes=%d returnedBytes=%d Win32=%d", class, n, *got, uint32(code))
		if class == windows.TokenHasRestrictions {
			t.Logf("class21 actual DWORD alignment: payload=%t ReturnLength=%t", uintptr(unsafe.Pointer(ptr))%4 == 0, uintptr(unsafe.Pointer(got))%4 == 0)
		}
		return err
	}
	linked := func() (bool, error) {
		// Fixed-size query prevents retrying a successful returned-handle query.
		// No OpenProcessToken/DuplicateToken or query is made on this handle.
		var other windows.Token
		var got uint32
		e := windows.GetTokenInformation(token, windows.TokenLinkedToken, (*byte)(unsafe.Pointer(&other)), 8, &got)
		var code syscall.Errno
		if e != nil && !errors.As(e, &code) {
			return false, errors.New("non-Win32 linked-token query error")
		}
		t.Logf("GetTokenInformation class=19 requestedBytes=8 returnedBytes=%d Win32=%d; linked handle never inspected", got, uint32(code))
		if e != nil {
			return false, fmt.Errorf("TokenLinkedToken Win32: %w", e)
		}
		if other == 0 {
			return false, errors.New("null linked token")
		}
		opened++
		l := opNative01Lease{closeFn: func() error {
			e := other.Close()
			if e == nil {
				closed++
			}
			return e
		}}
		var primary error
		if got != 8 {
			primary = errors.New("TOKEN_LINKED_TOKEN ABI length mismatch")
		}
		return true, l.close(primary)
	}
	a, e := opNative01SnapshotRead(q, linked)
	if e != nil {
		t.Fatal(e)
	}
	b, e := opNative01SnapshotRead(q, linked)
	if e != nil {
		t.Fatal(e)
	}
	if !opNative01Consistent(a, b) {
		t.Fatal("same retained token observations differ")
	}
	if e := checkThread(); e != nil {
		t.Fatal(e)
	}
	if e := lease.close(nil); e != nil {
		t.Fatal("process token close:", e)
	}
	t.Log("ABI AMD64: TOKEN_STATISTICS=56 align=8 offsets=0,8,16,24,28,32,36,40,44,48; LUID=8 align=4; SID_AND_ATTRIBUTES/TOKEN_USER/TOKEN_MANDATORY_LABEL=16; DWORD=4; TOKEN_LINKED_TOKEN=8")
	t.Log("class21 R1: capacity=4 zero-initialized; ReturnLength=1; DWORD-aligned payload/length; four canaries intact in both observations; only byte0 consumed; maintainer clarification, not universal ABI certification")
	t.Logf("TOKEN_QUERY=0x0008; Win32 queries success; two complete consistent observations; TokenType=Primary SessionId=%d Integrity=Medium(0x2000) Elevated=%d ElevationType=%d HasBeenFiltered=%d RestrictingSIDs=%d AppContainer=%d ThreadToken=absent LinkedToken=%s",
		a.session, a.elevation, a.elevationType, a.filtered, a.restricting, a.appContainer, a.linked)
	t.Logf("sanitized fingerprints: user=%s authentication=%s token=%s modified=%s",
		opNative01Fingerprint("SID", a.user), opNative01LUIDFingerprint("AuthenticationId", a.stats.AuthenticationID),
		opNative01LUIDFingerprint("TokenId", a.stats.TokenID), opNative01LUIDFingerprint("ModifiedId", a.stats.ModifiedID))
	t.Log("NOT_PROVEN/NOT_RUN: other-account UAC, linked-token relationship, other process/helper, profile/KnownFolders, IPC, installation identity, durable claims; no authorized production frame created")
}

func TestHUWINOperationIDNative01Decoders(t *testing.T) {
	if e := opNative01ABI(); e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"valid_DWORD", "sizing_denied", "unsupported_class", "zero_size", "oversize", "truncated_DWORD", "oversized_return", "growth_then_success", "unbounded_growth", "data_denied", "null_SID", "truncated_SID", "bad_SID_revision", "valid_SID", "restricting_array_truncated", "zero_restricting_SIDs", "statistics_truncated", "statistics_invariant", "close_once_joined_errors"} {
		t.Run(name, func(t *testing.T) {
			buffer := func(n uint32) opNative01Buffer { return opNative01Buffer{words: make([]uint64, (n+7)/8), used: n} }
			switch name {
			case "null_SID", "truncated_SID", "bad_SID_revision", "valid_SID":
				b := buffer(28)
				data := b.data()
				sa := (*windows.SIDAndAttributes)(unsafe.Pointer(&data[0]))
				if name != "null_SID" {
					sa.Sid = (*windows.SID)(unsafe.Pointer(&data[16]))
					data[16] = 1
					data[17] = 1
				}
				if name == "truncated_SID" {
					data[17] = 2
				}
				if name == "bad_SID_revision" {
					data[16] = 2
				}
				_, _, e := opNative01SID(b, 0)
				if (e == nil) != (name == "valid_SID") {
					t.Fatal("SID decoder outcome", e)
				}
			case "restricting_array_truncated", "zero_restricting_SIDs":
				b := buffer(8)
				if name == "restricting_array_truncated" {
					binary.LittleEndian.PutUint32(b.data(), 1)
				}
				_, e := opNative01RestrictingCount(b)
				if (e == nil) != (name == "zero_restricting_SIDs") {
					t.Fatal("group decoder outcome", e)
				}
			case "statistics_truncated", "statistics_invariant":
				n := uint32(56)
				if name == "statistics_truncated" {
					n = 48
				}
				_, e := opNative01Stats(buffer(n))
				if e == nil {
					t.Fatal("incomplete statistics accepted")
				}
			case "close_once_joined_errors":
				p, c := errors.New("primary"), errors.New("close")
				count := 0
				l := opNative01Lease{closeFn: func() error { count++; return c }}
				e := l.close(p)
				_ = l.close(nil)
				if count != 1 || !errors.Is(e, p) || !errors.Is(e, c) {
					t.Fatal("lost error or double close")
				}
			default:
				calls := 0
				q := func(_ uint32, p *byte, n uint32, got *uint32) error {
					calls++
					if p == nil {
						*got = 4
						switch name {
						case "sizing_denied":
							return windows.ERROR_ACCESS_DENIED
						case "unsupported_class":
							return windows.ERROR_INVALID_PARAMETER
						case "zero_size":
							*got = 0
						case "oversize":
							*got = 1 << 21
						}
						return windows.ERROR_INSUFFICIENT_BUFFER
					}
					*got = 4
					switch name {
					case "truncated_DWORD":
						*got = 2
					case "oversized_return":
						*got = n + 1
					case "growth_then_success":
						if calls == 2 {
							*got = 8
							return windows.ERROR_INSUFFICIENT_BUFFER
						}
					case "unbounded_growth":
						*got = n + 8
						return windows.ERROR_INSUFFICIENT_BUFFER
					case "data_denied":
						return windows.ERROR_ACCESS_DENIED
					}
					binary.LittleEndian.PutUint32(unsafe.Slice(p, 4), 7)
					return nil
				}
				b, e := opNative01Read(q, windows.TokenSessionId)
				if e == nil {
					_, e = opNative01DWORD(b)
				}
				ok := name == "valid_DWORD" || name == "growth_then_success"
				if (e == nil) != ok {
					t.Fatal("buffer handling outcome", e)
				}
			}
		})
	}
	// Comparison uses full values only in memory, not diagnostic fingerprints.
	t.Run("statistics_and_identity_consistency", func(t *testing.T) {
		a := opUACP0Snapshot()
		if !opNative01Consistent(a, a) {
			t.Fatal("same snapshot inconsistent")
		}
		for _, field := range []string{"token", "modified", "authentication", "session", "SID", "integrity", "linked"} {
			b := a
			switch field {
			case "token":
				b.stats.TokenID.LowPart++
			case "modified":
				b.stats.ModifiedID.LowPart++
			case "authentication":
				b.stats.AuthenticationID.LowPart++
			case "session":
				b.session++
			case "SID":
				b.user = []byte{2}
			case "integrity":
				b.integrity++
			case "linked":
				b.linked = "different"
			}
			if opNative01Consistent(a, b) {
				t.Fatal("changed snapshot accepted:", field)
			}
		}
	})
}

func TestHUWINOperationIDNative01FixedABIQueries(t *testing.T) {
	for _, name := range []string{"DWORD_direct", "statistics_direct", "bad_length", "truncated", "oversized", "denied", "unsupported_size"} {
		t.Run(name, func(t *testing.T) {
			size := uint32(4)
			if name == "statistics_direct" {
				size = 56
			}
			if name == "unsupported_size" {
				size = 12
			}
			calls := 0
			q := func(class uint32, ptr *byte, n uint32, got *uint32) error {
				calls++
				if class != windows.TokenElevation || ptr == nil || n != size || uintptr(unsafe.Pointer(ptr))%8 != 0 {
					t.Fatal("fixed query arguments/alignment")
				}
				*got = n
				switch name {
				case "bad_length":
					return windows.ERROR_BAD_LENGTH
				case "denied":
					return windows.ERROR_ACCESS_DENIED
				case "truncated":
					*got = n - 1
				case "oversized":
					*got = n + 1
				}
				return nil
			}
			_, e := opNative01Fixed(q, windows.TokenElevation, size)
			ok := name == "DWORD_direct" || name == "statistics_direct"
			if (e == nil) != ok {
				t.Fatal("fixed query result", e)
			}
			wantCalls := 1
			if name == "unsupported_size" {
				wantCalls = 0
			}
			if calls != wantCalls {
				t.Fatal("fixed query retry or sizing query")
			}
		})
	}
}

func TestHUWINOperationIDNative01R1Class21BOOLEAN(t *testing.T) {
	cases := []struct {
		name   string
		length uint32
		value  byte
		ok     bool
	}{
		{"false", 1, 0, true}, {"true", 1, 1, true}, {"aligned_zeroed", 1, 0, true},
		{"padding_ignored", 1, 0, true}, {"invalid_BOOLEAN", 1, 2, false},
		{"length0", 0, 0, false}, {"length2", 2, 0, false}, {"length3", 3, 0, false},
		{"DWORD_variant_not_supported", 4, 0, false}, {"over_capacity", 5, 0, false},
		{"canary_before", 1, 0, false}, {"canary_after", 1, 0, false},
		{"length_canary_before", 1, 0, false}, {"length_canary_after", 1, 0, false},
		{"access_denied", 1, 0, false}, {"API_unavailable", 1, 0, false},
		{"error_plus_canary", 1, 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			q := func(class uint32, p *byte, capacity uint32, got *uint32) error {
				calls++
				if class != 21 || capacity != 4 || p == nil || got == nil ||
					uintptr(unsafe.Pointer(p))%4 != 0 || uintptr(unsafe.Pointer(got))%4 != 0 {
					t.Fatal("class 21 request/alignment mismatch")
				}
				payload := unsafe.Slice(p, 4)
				if !bytes.Equal(payload, []byte{0, 0, 0, 0}) || *got != 0 {
					t.Fatal("output not zero-initialized")
				}
				*got = tc.length
				payload[0] = tc.value
				switch tc.name {
				case "padding_ignored":
					payload[1] = 0xA5
					payload[2] = 0x5A
					payload[3] = 0xFF
				case "canary_before":
					*(*byte)(unsafe.Add(unsafe.Pointer(p), -1)) ^= 0x01
				case "canary_after", "error_plus_canary":
					*(*byte)(unsafe.Add(unsafe.Pointer(p), 4)) ^= 0x01
				case "length_canary_before":
					*(*byte)(unsafe.Add(unsafe.Pointer(got), -1)) ^= 0x01
				case "length_canary_after":
					*(*byte)(unsafe.Add(unsafe.Pointer(got), 4)) ^= 0x01
				}
				switch tc.name {
				case "access_denied", "error_plus_canary":
					return windows.ERROR_ACCESS_DENIED
				case "API_unavailable":
					return windows.ERROR_CALL_NOT_IMPLEMENTED
				}
				return nil
			}
			value, err := opNative01Class21(q)
			if calls != 1 || (err == nil) != tc.ok || (tc.ok && value != uint32(tc.value)) {
				t.Fatal("class 21 decoder result", value, err)
			}
			if tc.name == "error_plus_canary" && (!errors.Is(err, windows.ERROR_ACCESS_DENIED) || !strings.Contains(err.Error(), "canary")) {
				t.Fatal("primary/canary error lost")
			}
		})
	}
}

func TestHUWINOperationIDNative01R1OtherDWORDsRemainStrict(t *testing.T) {
	for _, class := range []uint32{windows.TokenSessionId, windows.TokenElevation, windows.TokenElevationType, opNative01TokenIsAppContainer} {
		for _, length := range []uint32{0, 1, 2, 3, 4, 5} {
			t.Run(fmt.Sprintf("class%d_length%d", class, length), func(t *testing.T) {
				calls := 0
				q := func(actual uint32, p *byte, n uint32, got *uint32) error {
					calls++
					if actual != class || n != 4 || p == nil {
						t.Fatal("DWORD query changed")
					}
					*got = length
					return nil
				}
				b, err := opNative01Fixed(q, class, 4)
				if err == nil {
					_, err = opNative01DWORD(b)
				}
				if calls != 1 || (err == nil) != (length == 4) {
					t.Fatal("DWORD length validation weakened", err)
				}
			})
		}
	}
}

// UAC-P1 is test-local observation only. No native data enters the fake policy.
// SDK winternl.h: ObjectBasicInformation=0; PUBLIC_OBJECT_BASIC_INFORMATION.
// https://learn.microsoft.com/windows/win32/api/winternl/nf-winternl-ntqueryobject
type opUACP1ObjectBasic struct {
	Attributes, GrantedAccess, HandleCount, PointerCount uint32
	Reserved                                             [10]uint32
}

type opUACP1ObjectQuery func(*opUACP1ObjectBasic, *uint32) uint32

func opUACP1GrantedAccess(q opUACP1ObjectQuery) (uint32, error) {
	const canary = uint32(0xA51739C2)
	b := struct {
		Before uint32
		Info   opUACP1ObjectBasic
		After  uint32
	}{Before: canary, After: canary}
	if unsafe.Sizeof(b.Info) != 56 || unsafe.Alignof(b.Info) != 4 ||
		unsafe.Offsetof(b.Info.GrantedAccess) != 4 || unsafe.Offsetof(b.Info.Reserved) != 16 ||
		uintptr(unsafe.Pointer(&b.Info))%4 != 0 || q == nil {
		return 0, errors.New("P1 ObjectBasicInformation ABI/query invalid")
	}
	var got uint32
	status := q(&b.Info, &got)
	if status != 0 || got != 56 || b.Before != canary || b.After != canary {
		return 0, fmt.Errorf("P1 ObjectBasicInformation NTSTATUS=0x%08X length=%d guards=%t", status, got, b.Before == canary && b.After == canary)
	}
	if b.Info.GrantedAccess&windows.TOKEN_QUERY == 0 {
		return 0, errors.New("P1 returned token handle lacks TOKEN_QUERY; no escalation/fallback")
	}
	return b.Info.GrantedAccess, nil
}

// Unlike the old QA reader, this reader does not require Medium/Limited for
// every role. ABI decoders and P0 Primary identity comparison are reused.
// Completeness below concerns these observations, never a complete policy frame.
func opUACP1Complete(s opNative01Snapshot) bool {
	return opNative01SamePrimaryStatistics(s.stats, s.stats) && len(s.user) != 0 && s.session != 0 &&
		(s.integrity == 0x1000 || s.integrity == 0x2000 || s.integrity == 0x3000 || s.integrity == 0x4000) &&
		s.filtered <= 1 && s.appContainer <= 1 &&
		((s.elevation == 0 && (s.elevationType == 1 || s.elevationType == 3)) ||
			(s.elevation == 1 && s.elevationType == 2))
}

func opUACP1SameSnapshot(a, b opNative01Snapshot) bool {
	return opUACP1Complete(a) && opUACP1Complete(b) && opNative01SamePrimaryStatistics(a.stats, b.stats) &&
		bytes.Equal(a.user, b.user) && a.session == b.session && a.integrity == b.integrity &&
		a.elevation == b.elevation && a.elevationType == b.elevationType && a.filtered == b.filtered &&
		a.restricting == b.restricting && a.appContainer == b.appContainer
}

func opUACP1Read(q opNative01Query) (s opNative01Snapshot, err error) {
	if q == nil {
		return s, errors.New("P1 missing observation query")
	}
	stats := func() (opNative01Statistics, error) {
		b, e := opNative01Fixed(q, windows.TokenStatistics, 56)
		if e != nil {
			return opNative01Statistics{}, e
		}
		return opNative01Stats(b)
	}
	if s.stats, err = stats(); err != nil {
		return s, err
	}
	var tokenType uint32
	for _, f := range []struct {
		class uint32
		dest  *uint32
	}{
		{windows.TokenType, &tokenType}, {windows.TokenSessionId, &s.session},
		{windows.TokenElevation, &s.elevation}, {windows.TokenElevationType, &s.elevationType},
		{opNative01TokenIsAppContainer, &s.appContainer},
	} {
		b, e := opNative01Fixed(q, f.class, 4)
		if e != nil {
			return s, e
		}
		if *f.dest, err = opNative01DWORD(b); err != nil {
			return s, err
		}
	}
	if tokenType != windows.TokenPrimary || tokenType != s.stats.TokenType {
		return s, errors.New("P1 Primary token type mismatch")
	}
	if s.filtered, err = opNative01Class21(q); err != nil {
		return s, err
	}
	b, e := opNative01Read(q, windows.TokenUser)
	if e != nil {
		return s, e
	}
	if s.user, _, err = opNative01SID(b, 0); err != nil {
		return s, err
	}
	b, e = opNative01Read(q, windows.TokenIntegrityLevel)
	if e != nil {
		return s, e
	}
	il, attrs, e := opNative01SID(b, 0)
	if e != nil {
		return s, e
	}
	if len(il) != 12 || !bytes.Equal(il[2:8], []byte{0, 0, 0, 0, 0, 16}) || attrs&windows.SE_GROUP_INTEGRITY == 0 {
		return s, errors.New("P1 integrity metadata unsupported")
	}
	s.integrity = binary.LittleEndian.Uint32(il[8:])
	b, e = opNative01Read(q, windows.TokenRestrictedSids)
	if e != nil {
		return s, e
	}
	if s.restricting, err = opNative01RestrictingCount(b); err != nil {
		return s, err
	}
	end, e := stats()
	if e != nil {
		return s, e
	}
	if !opNative01SamePrimaryStatistics(s.stats, end) || !opUACP1Complete(s) {
		return s, errors.New("P1 incomplete/unstable observation")
	}
	return s, nil
}

// Strings contain only descriptive relations, never IDs or authorization.
func opUACP1Relations(a, b opNative01Snapshot) (map[string]string, error) {
	result := map[string]string{"SID": "UNKNOWN", "SessionId": "UNKNOWN", "AuthenticationId": "UNKNOWN", "TokenId": "UNKNOWN", "ModifiedId": "UNKNOWN"}
	if !opUACP1Complete(a) || !opUACP1Complete(b) {
		return result, errors.New("P1 incomplete relation observations")
	}
	for _, f := range []struct {
		name string
		same bool
	}{
		{"SID", bytes.Equal(a.user, b.user)}, {"SessionId", a.session == b.session},
		{"AuthenticationId", a.stats.AuthenticationID == b.stats.AuthenticationID},
		{"TokenId", a.stats.TokenID == b.stats.TokenID}, {"ModifiedId", a.stats.ModifiedID == b.stats.ModifiedID},
	} {
		result[f.name] = "DIFFERENT"
		if f.same {
			result[f.name] = "SAME"
		}
	}
	return result, nil
}

func TestHUWINOperationIDUACP1Pure(t *testing.T) {
	for _, name := range []string{"same", "SID", "SessionId", "AuthenticationId", "TokenId", "ModifiedId", "Full", "Default", "Primary_impersonation_ignored", "missing_user", "missing_stats", "missing_session", "missing_integrity", "bad_type", "bad_elevation", "filtered_without_restricting"} {
		t.Run("relations_"+name, func(t *testing.T) {
			a, b := opUACP0Snapshot(), opUACP0Snapshot()
			valid := true
			switch name {
			case "SID":
				b.user = []byte("other-synthetic-user")
			case "SessionId":
				b.session++
			case "AuthenticationId":
				b.stats.AuthenticationID.LowPart++
			case "TokenId":
				b.stats.TokenID.LowPart++
			case "ModifiedId":
				b.stats.ModifiedID.LowPart++
			case "Full":
				b.elevation, b.elevationType, b.integrity = 1, 2, 0x3000
			case "Default":
				b.elevationType = 1
			case "Primary_impersonation_ignored":
				b.stats.Impersonation = 0xffffffff
			case "filtered_without_restricting":
				b.filtered, b.restricting = 1, 0
			case "missing_user":
				b.user = nil
				valid = false
			case "missing_stats":
				b.stats = opNative01Statistics{}
				valid = false
			case "missing_session":
				b.session = 0
				valid = false
			case "missing_integrity":
				b.integrity = 0
				valid = false
			case "bad_type":
				b.stats.TokenType = windows.TokenImpersonation
				valid = false
			case "bad_elevation":
				b.elevation = 1
				valid = false
			}
			r, e := opUACP1Relations(a, b)
			if (e == nil) != valid {
				t.Fatal("relation completeness outcome")
			}
			if !valid {
				for _, v := range r {
					if v != "UNKNOWN" {
						t.Fatal("incomplete relation not UNKNOWN")
					}
				}
				return
			}
			for field, v := range r {
				want := "SAME"
				if field == name {
					want = "DIFFERENT"
				}
				if v != want {
					t.Fatal("relation mismatch", field)
				}
			}
			identitySame := name == "same" || name == "Primary_impersonation_ignored" || name == "filtered_without_restricting" || name == "Default"
			if opUACP1SameSnapshot(a, b) != (identitySame && name != "Default") {
				t.Fatal("per-role snapshot consistency mismatch")
			}
		})
	}
	for _, name := range []string{"query_only", "returned_extra_rights_not_exercised", "missing_query", "NTSTATUS_denied", "truncated", "oversize", "guard_changed", "nil_query"} {
		t.Run("rights_"+name, func(t *testing.T) {
			q := opUACP1ObjectQuery(func(b *opUACP1ObjectBasic, n *uint32) uint32 {
				b.GrantedAccess = 8
				*n = 56
				switch name {
				case "returned_extra_rights_not_exercised":
					b.GrantedAccess = 0x20008
				case "missing_query":
					b.GrantedAccess = 0x20000
				case "NTSTATUS_denied":
					return 0xc0000022
				case "truncated":
					*n = 52
				case "oversize":
					*n = 60
				case "guard_changed":
					*(*uint32)(unsafe.Add(unsafe.Pointer(b), 56)) = 0
				}
				return 0
			})
			if name == "nil_query" {
				q = nil
			}
			_, e := opUACP1GrantedAccess(q)
			if (e == nil) != (name == "query_only" || name == "returned_extra_rights_not_exercised") {
				t.Fatal("rights gate outcome")
			}
		})
	}
	for _, e := range []error{windows.ERROR_ACCESS_DENIED, windows.ERROR_NO_SUCH_LOGON_SESSION, windows.ERROR_INVALID_PARAMETER} {
		t.Run(fmt.Sprintf("query_error_%d", e.(syscall.Errno)), func(t *testing.T) {
			calls := 0
			_, got := opUACP1Read(func(uint32, *byte, uint32, *uint32) error { calls++; return e })
			if !errors.Is(got, e) || calls != 1 {
				t.Fatal("query error retried/hidden")
			}
		})
	}
	t.Run("absent_link_no_fallback", func(t *testing.T) {
		// Absence has no metadata and therefore no observed relationship.
		r, e := opUACP1Relations(opUACP0Snapshot(), opNative01Snapshot{})
		if e == nil {
			t.Fatal("absent linked token accepted")
		}
		for _, v := range r {
			if v != "UNKNOWN" {
				t.Fatal("invented link relation")
			}
		}
	})
	t.Run("nil_reader", func(t *testing.T) {
		if _, e := opUACP1Read(nil); e == nil {
			t.Fatal("nil query accepted")
		}
	})
}

func TestHUWINOperationIDUACP1Reader(t *testing.T) {
	for _, name := range []string{"Limited", "Full", "Default", "Primary_non_invariants", "TokenId_changed", "AuthenticationId_changed", "ModifiedId_changed", "type_changed", "DWORD_truncated", "class21_length4", "SID_truncated", "integrity_truncated", "groups_truncated", "last_statistics_denied"} {
		t.Run(name, func(t *testing.T) {
			s := opUACP0Snapshot()
			if name == "Full" {
				s.integrity, s.elevation, s.elevationType = 0x3000, 1, 2
			}
			if name == "Default" {
				s.elevationType = 1
			}
			statsCalls := 0
			q := func(class uint32, p *byte, n uint32, got *uint32) error {
				if class == windows.TokenStatistics {
					statsCalls++
					if statsCalls == 2 && name == "last_statistics_denied" {
						return windows.ERROR_ACCESS_DENIED
					}
					if p == nil || n != 56 {
						t.Fatal("stats query ABI")
					}
					v := s.stats
					if statsCalls == 2 {
						switch name {
						case "Primary_non_invariants":
							v.Impersonation, v.Expiration, v.DynamicCharged, v.Available = 99, -1, 88, 77
						case "TokenId_changed":
							v.TokenID.LowPart++
						case "AuthenticationId_changed":
							v.AuthenticationID.LowPart++
						case "ModifiedId_changed":
							v.ModifiedID.LowPart++
						}
					}
					*(*opNative01Statistics)(unsafe.Pointer(p)) = v
					*got = 56
					return nil
				}
				if class == windows.TokenUser || class == windows.TokenIntegrityLevel || class == windows.TokenRestrictedSids {
					size := uint32(28)
					if class == windows.TokenRestrictedSids {
						size = 8
					}
					*got = size
					if p == nil {
						return windows.ERROR_INSUFFICIENT_BUFFER
					}
					if n != size {
						t.Fatal("variable query ABI")
					}
					if class == windows.TokenRestrictedSids {
						if name == "groups_truncated" {
							binary.LittleEndian.PutUint32(unsafe.Slice(p, n), 1)
						}
						return nil
					}
					data := unsafe.Slice(p, n)
					sa := (*windows.SIDAndAttributes)(unsafe.Pointer(p))
					sa.Sid = (*windows.SID)(unsafe.Add(unsafe.Pointer(p), 16))
					data[16], data[17], data[23] = 1, 1, 5
					binary.LittleEndian.PutUint32(data[24:], 21)
					if class == windows.TokenIntegrityLevel {
						data[23], sa.Attributes = 16, windows.SE_GROUP_INTEGRITY
						binary.LittleEndian.PutUint32(data[24:], s.integrity)
					}
					if (name == "SID_truncated" && class == windows.TokenUser) || (name == "integrity_truncated" && class == windows.TokenIntegrityLevel) {
						*got = 20
					}
					return nil
				}
				if p == nil || n != 4 {
					t.Fatal("DWORD/BOOLEAN query ABI")
				}
				*got = 4
				var v uint32
				switch class {
				case windows.TokenType:
					v = windows.TokenPrimary
					if name == "type_changed" {
						v = windows.TokenImpersonation
					}
				case windows.TokenSessionId:
					v = s.session
				case windows.TokenElevation:
					v = s.elevation
				case windows.TokenElevationType:
					v = s.elevationType
				case opNative01TokenIsAppContainer:
					v = s.appContainer
				case windows.TokenHasRestrictions:
					*p, *got = byte(s.filtered), 1
					if name == "class21_length4" {
						*got = 4
					}
					return nil
				default:
					t.Fatal("unexpected fake query class", class)
				}
				binary.LittleEndian.PutUint32(unsafe.Slice(p, 4), v)
				if name == "DWORD_truncated" {
					*got = 1
				}
				return nil
			}
			got, e := opUACP1Read(q)
			valid := name == "Limited" || name == "Full" || name == "Default" || name == "Primary_non_invariants"
			if (e == nil) != valid {
				t.Fatal("fake reader outcome", e)
			}
			if valid && (!opUACP1Complete(got) || statsCalls != 2) {
				t.Fatal("incomplete fake snapshot")
			}
		})
	}
}

func TestHUWINOperationIDUACP1NativeLinkedToken(t *testing.T) {
	if os.Getenv("MANUS_OPERATION_ID_UAC_P1_NATIVE") != "1" {
		t.Skip("P1 native opt-in absent; zero native token queries")
	}
	if e := opNative01ABI(); e != nil {
		t.Fatal(e)
	}
	for _, v := range os.Environ() {
		name, _, _ := strings.Cut(v, "=")
		if strings.HasPrefix(name, "MANUS_") && strings.Contains(name, "NATIVE") && name != "MANUS_OPERATION_ID_UAC_P1_NATIVE" && os.Getenv(name) != "" {
			t.Fatal("another native opt-in active")
		}
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	opened, closed := 0, 0
	t.Cleanup(func() {
		t.Logf("owned token handles opened=%d closed=%d; zero mutation/elevation/duplication/impersonation", opened, closed)
		if opened != closed {
			t.Error("P1 owned handle closure mismatch")
		}
	})
	retain := func(token windows.Token) *opNative01Lease {
		opened++
		l := &opNative01Lease{closeFn: func() error {
			e := token.Close()
			if e == nil {
				closed++
			}
			return e
		}}
		t.Cleanup(func() {
			if e := l.close(nil); e != nil {
				t.Error("P1 token close:", e)
			}
		})
		return l
	}
	var current windows.Token
	if e := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &current); e != nil {
		t.Fatal("P1 current TOKEN_QUERY:", e)
	}
	currentLease := retain(current)
	proc := windows.NewLazySystemDLL("ntdll.dll").NewProc("NtQueryObject")
	if e := proc.Find(); e != nil {
		t.Fatal("P1 NtQueryObject unavailable")
	}
	access := func(role string, token windows.Token) uint32 {
		mask, e := opUACP1GrantedAccess(func(b *opUACP1ObjectBasic, n *uint32) uint32 {
			r, _, _ := proc.Call(uintptr(token), 0, uintptr(unsafe.Pointer(b)), 56, uintptr(unsafe.Pointer(n)))
			status := uint32(r)
			t.Logf("role=%s NtQueryObject class=0 bytes=56 returned=%d NTSTATUS=0x%08X", role, *n, status)
			runtime.KeepAlive(b)
			runtime.KeepAlive(n)
			return status
		})
		if e != nil {
			t.Fatal(role, e)
		}
		t.Logf("role=%s GrantedAccess=0x%08X; only TOKEN_QUERY exercised", role, mask)
		return mask
	}
	if mask := access("current", current); mask != windows.TOKEN_QUERY {
		t.Fatal("P1 current handle access differs from requested 0x0008")
	}
	query := func(role string, token windows.Token) opNative01Query {
		return func(class uint32, p *byte, n uint32, got *uint32) error {
			e := windows.GetTokenInformation(token, class, p, n, got)
			var code syscall.Errno
			if e != nil && !errors.As(e, &code) {
				return errors.New("P1 non-Win32 query error")
			}
			t.Logf("role=%s class=%d capacity=%d returned=%d Win32=%d", role, class, n, *got, uint32(code))
			return e
		}
	}
	qa, qb := query("current", current), opNative01Query(nil)
	a, e := opUACP1Read(qa)
	if e != nil {
		t.Fatal("P1 current initial:", e)
	}
	if a.integrity != 0x2000 || a.elevation != 0 || a.elevationType != 3 || a.appContainer != 0 || a.restricting != 0 {
		t.Fatal("P1 current QA preflight not Medium/Limited/primary without restricting SIDs/AppContainer")
	}
	var linked windows.Token
	var got uint32
	e = qa(windows.TokenLinkedToken, (*byte)(unsafe.Pointer(&linked)), 8, &got)
	var linkedLease *opNative01Lease
	if linked != 0 && linked != current {
		linkedLease = retain(linked)
	}
	if e != nil {
		t.Fatal("P1 linked availability/query:", e)
	}
	if got != 8 || linked == 0 || linked == current {
		t.Fatal("P1 TOKEN_LINKED_TOKEN ABI/handle invalid")
	}
	_ = access("linked", linked) // No additional rights requested, regardless of returned mask.
	qb = query("linked", linked)
	b, e := opUACP1Read(qb)
	if e != nil {
		t.Fatal("P1 linked initial:", e)
	}
	if b.integrity != 0x3000 || b.elevation != 1 || b.elevationType != 2 || b.appContainer != 0 || b.restricting != 0 {
		t.Fatal("P1 linked role outside expected Full/High primary observation")
	}
	r, e := opUACP1Relations(a, b)
	if e != nil {
		t.Fatal(e)
	}
	if r["SID"] != "SAME" || r["SessionId"] != "SAME" {
		t.Fatal("P1 unexpected account/session; no fallback")
	}
	a2, e := opUACP1Read(qa)
	if e != nil {
		t.Fatal("P1 current final:", e)
	}
	b2, e := opUACP1Read(qb)
	if e != nil {
		t.Fatal("P1 linked final:", e)
	}
	if !opUACP1SameSnapshot(a, a2) || !opUACP1SameSnapshot(b, b2) {
		t.Fatal("P1 retained token metadata unstable")
	}
	for _, row := range []struct {
		name string
		s    opNative01Snapshot
	}{{"current", a}, {"linked", b}} {
		t.Logf("role=%s type=Primary SessionId=present integrity=0x%04X elevated=%d elevationType=%d HasBeenFiltered=%d RestrictingSIDCount=%d AppContainer=%d per-role-repeat=PASS", row.name, row.s.integrity, row.s.elevation, row.s.elevationType, row.s.filtered, row.s.restricting, row.s.appContainer)
	}
	for _, field := range []string{"SID", "SessionId", "AuthenticationId", "TokenId", "ModifiedId"} {
		t.Logf("relation current-vs-linked %s=%s", field, r[field])
	}
	if e := errors.Join(linkedLease.close(nil), currentLease.close(nil)); e != nil {
		t.Fatal("P1 final close:", e)
	}
	t.Log("ABI AMD64: TOKEN_LINKED_TOKEN=8/align8; PUBLIC_OBJECT_BASIC_INFORMATION=56/align4 GrantedAccessOffset=4; TOKEN_STATISTICS=56/align8; class21 capacity4/ReturnLength1; other DWORDs=4")
	t.Log("NOT_PROVEN: UAC transition, reciprocal native linkage, executor/helper, authenticated peer, profile/groups/privileges, effective-thread impersonation, native authority or durable claims; no real completed")
}

// Synthetic little-endian bytes, not a capture of P1 or any native token.
func opUACP1R1SyntheticBlob(s opNative01Statistics) opNative01Buffer {
	b := opNative01Buffer{words: make([]uint64, 7), used: 56}
	d := b.data()
	for _, f := range []struct {
		off   int
		value windows.LUID
	}{{0, s.TokenID}, {8, s.AuthenticationID}, {48, s.ModifiedID}} {
		binary.LittleEndian.PutUint32(d[f.off:], f.value.LowPart)
		binary.LittleEndian.PutUint32(d[f.off+4:], uint32(f.value.HighPart))
	}
	binary.LittleEndian.PutUint64(d[16:], uint64(s.Expiration))
	for _, f := range []struct {
		off   int
		value uint32
	}{{24, s.TokenType}, {28, s.Impersonation}, {32, s.DynamicCharged}, {36, s.Available}, {40, s.GroupCount}, {44, s.PrivilegeCount}} {
		binary.LittleEndian.PutUint32(d[f.off:], f.value)
	}
	return b
}

func opUACP1R1AssertReason(t *testing.T, err error, want opUACP1R1StatsReason) {
	t.Helper()
	var diagnostic *opUACP1R1StatsError
	if !errors.As(err, &diagnostic) || diagnostic.Code != want {
		t.Fatal("wrong typed decoder reason; raw error intentionally omitted")
	}
	category := "observation_contract"
	if want == opUACP1R1StatsLayout || want == opUACP1R1StatsSize || want == opUACP1R1StatsAlignment {
		category = "structure"
	}
	if diagnostic.Category() != category || err.Error() != "TOKEN_STATISTICS rejected: "+category+"/"+string(want) {
		t.Fatal("unstable/unsanitized diagnostic")
	}
	// Wrapping retains the typed cause and never embeds decoded metadata.
	var wrapped *opUACP1R1StatsError
	if !errors.As(fmt.Errorf("synthetic phase: %w", err), &wrapped) || wrapped.Code != want {
		t.Fatal("typed cause lost")
	}
}

func TestHUWINOperationIDUACP1R1StatsReasons(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*opNative01Statistics)
		want   opUACP1R1StatsReason
	}{
		{"valid_Primary", func(*opNative01Statistics) {}, ""},
		{"valid_zero_counts", func(s *opNative01Statistics) { s.GroupCount, s.PrivilegeCount = 0, 0 }, ""},
		{"valid_max_counts", func(s *opNative01Statistics) { s.GroupCount, s.PrivilegeCount = 65536, 65536 }, ""},
		{"valid_high_part_only_IDs", func(s *opNative01Statistics) {
			s.TokenID = windows.LUID{HighPart: 1}
			s.AuthenticationID = windows.LUID{HighPart: 2}
			s.ModifiedID = windows.LUID{HighPart: 3}
		}, ""},
		{"valid_signed_high_parts", func(s *opNative01Statistics) {
			s.TokenID.HighPart = -1
			s.AuthenticationID.HighPart = -2
			s.ModifiedID.HighPart = -3
		}, ""},
		{"Primary_impersonation_not_applicable", func(s *opNative01Statistics) { s.Impersonation = 0xffffffff }, ""},
		{"expiration_not_supported", func(s *opNative01Statistics) { s.Expiration = -1 }, ""},
		{"dynamic_accounting_not_identity", func(s *opNative01Statistics) { s.DynamicCharged, s.Available = 0xffffffff, 0xffffffff }, ""},
		{"all_non_invariants", func(s *opNative01Statistics) {
			s.Impersonation, s.Expiration, s.DynamicCharged, s.Available = 99, -1, 88, 77
		}, ""},
		{"TokenId_zero", func(s *opNative01Statistics) { s.TokenID = windows.LUID{} }, opUACP1R1StatsTokenID},
		{"AuthenticationId_zero", func(s *opNative01Statistics) { s.AuthenticationID = windows.LUID{} }, opUACP1R1StatsAuthenticationID},
		{"ModifiedId_zero", func(s *opNative01Statistics) { s.ModifiedID = windows.LUID{} }, opUACP1R1StatsModifiedID},
		{"TokenType_missing", func(s *opNative01Statistics) { s.TokenType = 0 }, opUACP1R1StatsTokenType},
		{"TokenImpersonation_is_documented_but_unsupported_here", func(s *opNative01Statistics) { s.TokenType = windows.TokenImpersonation }, opUACP1R1StatsTokenType},
		{"TokenType_unknown", func(s *opNative01Statistics) { s.TokenType = 3 }, opUACP1R1StatsTokenType},
		{"TokenType_max", func(s *opNative01Statistics) { s.TokenType = 0xffffffff }, opUACP1R1StatsTokenType},
		{"GroupCount_limit_plus_one", func(s *opNative01Statistics) { s.GroupCount = 65537 }, opUACP1R1StatsGroupCount},
		{"GroupCount_max", func(s *opNative01Statistics) { s.GroupCount = 0xffffffff }, opUACP1R1StatsGroupCount},
		{"PrivilegeCount_limit_plus_one", func(s *opNative01Statistics) { s.PrivilegeCount = 65537 }, opUACP1R1StatsPrivilegeCount},
		{"PrivilegeCount_max", func(s *opNative01Statistics) { s.PrivilegeCount = 0xffffffff }, opUACP1R1StatsPrivilegeCount},
		{"precedence_TokenId_first", func(s *opNative01Statistics) {
			*s = opNative01Statistics{TokenType: 2, GroupCount: 65537, PrivilegeCount: 65537}
		}, opUACP1R1StatsTokenID},
		{"precedence_AuthenticationId_before_ModifiedId_and_type", func(s *opNative01Statistics) {
			s.AuthenticationID, s.ModifiedID = windows.LUID{}, windows.LUID{}
			s.TokenType = 2
		}, opUACP1R1StatsAuthenticationID},
		{"precedence_ModifiedId_before_type", func(s *opNative01Statistics) { s.ModifiedID = windows.LUID{}; s.TokenType = 2 }, opUACP1R1StatsModifiedID},
		{"precedence_type_before_counts", func(s *opNative01Statistics) { s.TokenType, s.GroupCount, s.PrivilegeCount = 2, 65537, 65537 }, opUACP1R1StatsTokenType},
		{"precedence_groups_before_privileges", func(s *opNative01Statistics) { s.GroupCount, s.PrivilegeCount = 65537, 65537 }, opUACP1R1StatsGroupCount},
		{"all_zero_blob", func(s *opNative01Statistics) { *s = opNative01Statistics{} }, opUACP1R1StatsTokenID},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := opUACP0Snapshot().stats
			tc.mutate(&s)
			// Exact previous acceptance predicate: diagnosis must not relax it.
			priorAccepted := s.TokenID != (windows.LUID{}) && s.AuthenticationID != (windows.LUID{}) &&
				s.ModifiedID != (windows.LUID{}) && s.TokenType == windows.TokenPrimary &&
				s.GroupCount <= 65536 && s.PrivilegeCount <= 65536
			b := opUACP1R1SyntheticBlob(s)
			before := append([]byte(nil), b.data()...)
			got, err := opNative01Stats(b)
			if (err == nil) != priorAccepted || priorAccepted != (tc.want == "") {
				t.Fatal("previous acceptance contract changed")
			}
			if !bytes.Equal(before, b.data()) {
				t.Fatal("decoder mutated synthetic input")
			}
			if err != nil {
				opUACP1R1AssertReason(t, err, tc.want)
				if got != (opNative01Statistics{}) {
					t.Fatal("rejected raw metadata escaped decoder")
				}
				return
			}
			if got != s {
				t.Fatal("valid synthetic blob decoded differently")
			}
		})
	}
}

func TestHUWINOperationIDUACP1R1StatsStructure(t *testing.T) {
	for _, length := range []uint32{0, 1, 4, 48, 55, 57, 64, 0xffffffff} {
		t.Run(fmt.Sprintf("size_%d", length), func(t *testing.T) {
			b := opUACP1R1SyntheticBlob(opUACP0Snapshot().stats)
			b.used = length
			_, err := opNative01Stats(b)
			opUACP1R1AssertReason(t, err, opUACP1R1StatsSize)
		})
	}
	for _, name := range []string{"nil_backing", "truncated_backing", "size_before_semantics"} {
		t.Run(name, func(t *testing.T) {
			b := opNative01Buffer{used: 56}
			if name == "truncated_backing" {
				b.words = make([]uint64, 6)
			}
			if name == "size_before_semantics" {
				b.words = make([]uint64, 7)
				b.used = 55
			}
			_, err := opNative01Stats(b)
			opUACP1R1AssertReason(t, err, opUACP1R1StatsSize)
		})
	}
	// Inject address integers into the guard, never construct/dereference an
	// invalid or misaligned Go slice. The decoder calls this same guard first.
	for _, address := range []uintptr{0, 1, 2, 3, 4, 5, 6, 7, 8, 16} {
		t.Run(fmt.Sprintf("alignment_%d", address), func(t *testing.T) {
			err := opUACP1R1CheckAlignment(address)
			if address != 0 && address%8 == 0 {
				if err != nil {
					t.Fatal("aligned synthetic guard rejected")
				}
				return
			}
			opUACP1R1AssertReason(t, err, opUACP1R1StatsAlignment)
		})
	}
	for _, name := range []string{"actual", "platform", "size", "alignment", "LUID_size", "LUID_alignment", "Primary_constant", "Impersonation_constant", "offset_0", "offset_1", "offset_2", "offset_3", "offset_4", "offset_5", "offset_6", "offset_7", "offset_8", "offset_9"} {
		t.Run("layout_"+name, func(t *testing.T) {
			layout := opUACP1R1ActualLayout()
			switch name {
			case "actual":
			case "platform":
				layout.AMD64Windows = false
			case "size":
				layout.Size++
			case "alignment":
				layout.Align++
			case "LUID_size":
				layout.LUIDSize++
			case "LUID_alignment":
				layout.LUIDAlign++
			case "Primary_constant":
				layout.Primary++
			case "Impersonation_constant":
				layout.Impersonation++
			default:
				var index int
				if _, err := fmt.Sscanf(name, "offset_%d", &index); err != nil {
					t.Fatal("synthetic layout case")
				}
				layout.Offsets[index]++
			}
			err := opUACP1R1CheckLayout(layout)
			if name == "actual" {
				if err != nil {
					t.Fatal("actual ABI rejected")
				}
				return
			}
			opUACP1R1AssertReason(t, err, opUACP1R1StatsLayout)
		})
	}
}

func TestHUWINOperationIDUACP1R1StatsNeverAuthorizes(t *testing.T) {
	for _, name := range []string{"TokenId", "AuthenticationId", "ModifiedId", "type", "groups", "privileges"} {
		t.Run("incomplete_"+name, func(t *testing.T) {
			s := opUACP0Snapshot()
			switch name {
			case "TokenId":
				s.stats.TokenID = windows.LUID{}
			case "AuthenticationId":
				s.stats.AuthenticationID = windows.LUID{}
			case "ModifiedId":
				s.stats.ModifiedID = windows.LUID{}
			case "type":
				s.stats.TokenType = windows.TokenImpersonation
			case "groups":
				s.stats.GroupCount = 65537
			case "privileges":
				s.stats.PrivilegeCount = 65537
			}
			if opNative01Consistent(s, s) || opUACP1SameSnapshot(s, s) || opUACP1Complete(s) {
				t.Fatal("identical incomplete observations accepted")
			}
			if _, err := opNative01Stats(opUACP1R1SyntheticBlob(s.stats)); err == nil {
				t.Fatal("decoder and snapshot checks diverge")
			}
		})
	}
	t.Run("accepted_synthetic_statistics_are_not_authority", func(t *testing.T) {
		if _, err := opNative01Stats(opUACP1R1SyntheticBlob(opUACP0Snapshot().stats)); err != nil {
			t.Fatal("valid synthetic blob rejected")
		}
		f := opFake01FixtureNew()
		m, r, err := newOperationIdentitySimulation(nil, f.p, f.approval, f.clock.now, func() error { f.closes++; return nil })
		if err == nil || m != nil || r.State != operationIdentityRejected || f.closes != 1 {
			t.Fatal("decoded observation granted authority")
		}
	})
	t.Run("typed_reason_and_secondary_error_survive", func(t *testing.T) {
		_, primary := opNative01Stats(opUACP1R1SyntheticBlob(opNative01Statistics{}))
		secondary := errors.New("synthetic close error")
		calls := 0
		l := opNative01Lease{closeFn: func() error { calls++; return secondary }}
		err := l.close(primary)
		_ = l.close(nil)
		var diagnostic *opUACP1R1StatsError
		if !errors.As(err, &diagnostic) || diagnostic.Code != opUACP1R1StatsTokenID || !errors.Is(err, secondary) || calls != 1 {
			t.Fatal("primary/secondary cause lost or double close")
		}
	})
}

// R4 classifies only a four-byte TOKEN_TYPE. It never constructs a snapshot,
// authorization frame or policy result. Existing decoders remain unchanged.
func opUACP1R4DecodeTokenType(data []byte, returned uint32) (uint32, error) {
	if len(data) != 4 || returned != 4 {
		return 0, errors.New("R4 structure/type_length")
	}
	if uintptr(unsafe.Pointer(&data[0]))%4 != 0 {
		return 0, errors.New("R4 structure/type_alignment")
	}
	value := binary.LittleEndian.Uint32(data)
	if value != windows.TokenPrimary && value != windows.TokenImpersonation {
		return 0, errors.New("R4 observation_contract/unknown_type; no reinterpretation")
	}
	return value, nil
}

func opUACP1R4QueryTokenType(q opNative01Query) (uint32, error) {
	const before, after, lengthBefore, lengthAfter = uint32(0xA51739C2), uint32(0xB62840D3), uint32(0xC73951E4), uint32(0xD84062F5)
	b := struct{ Before, Value, After, LengthBefore, Returned, LengthAfter uint32 }{
		Before: before, After: after, LengthBefore: lengthBefore, LengthAfter: lengthAfter,
	}
	if unsafe.Sizeof(b) != 24 || unsafe.Alignof(b) != 4 || unsafe.Offsetof(b.Value) != 4 ||
		unsafe.Offsetof(b.After) != 8 || unsafe.Offsetof(b.Returned) != 16 ||
		uintptr(unsafe.Pointer(&b.Value))%4 != 0 || uintptr(unsafe.Pointer(&b.Returned))%4 != 0 {
		return 0, errors.New("R4 structure/storage_ABI")
	}
	if q == nil {
		return 0, errors.New("R4 preflight/missing_query")
	}
	primary := q(windows.TokenType, (*byte)(unsafe.Pointer(&b.Value)), 4, &b.Returned) // Exactly once; no sizing query/retry.
	var guard error
	if b.Before != before || b.After != after || b.LengthBefore != lengthBefore || b.LengthAfter != lengthAfter {
		guard = errors.New("R4 structure/type_query_canary")
	}
	if primary != nil || guard != nil {
		return 0, errors.Join(primary, guard)
	}
	return opUACP1R4DecodeTokenType(unsafe.Slice((*byte)(unsafe.Pointer(&b.Value)), 4), b.Returned)
}

func TestHUWINOperationIDUACP1R4TokenTypePure(t *testing.T) {
	for _, value := range []uint32{0, 1, 2, 3, 0xffffffff} {
		t.Run(fmt.Sprintf("enum_%d", value), func(t *testing.T) {
			b := opNative01Buffer{words: make([]uint64, 1), used: 4}
			binary.LittleEndian.PutUint32(b.data(), value)
			got, err := opUACP1R4DecodeTokenType(b.data(), 4)
			if (err == nil) != (value == 1 || value == 2) {
				t.Fatal("enum validation outcome")
			}
			if err == nil && got != value {
				t.Fatal("known enum changed")
			}
			if err != nil && got != 0 {
				t.Fatal("unknown enum reinterpreted")
			}
		})
	}
	for _, name := range []string{"nil", "short", "oversized", "misaligned"} {
		t.Run("buffer_"+name, func(t *testing.T) {
			b := opNative01Buffer{words: make([]uint64, 1), used: 8}
			data := b.data()[:4]
			switch name {
			case "nil":
				data = nil
			case "short":
				data = data[:3]
			case "oversized":
				data = b.data()
			case "misaligned":
				data = b.data()[1:5]
			}
			if got, err := opUACP1R4DecodeTokenType(data, 4); err == nil || got != 0 {
				t.Fatal("invalid storage accepted")
			}
		})
	}
	for _, name := range []string{"Primary", "Impersonation", "length0", "length1", "length2", "length3", "length5", "length8", "denied", "unsupported", "Before", "After", "LengthBefore", "LengthAfter", "error_plus_canary", "nil_query"} {
		t.Run("query_"+name, func(t *testing.T) {
			calls := 0
			primary := windows.ERROR_ACCESS_DENIED
			q := opNative01Query(func(class uint32, p *byte, n uint32, got *uint32) error {
				calls++
				if class != windows.TokenType || n != 4 || p == nil || uintptr(unsafe.Pointer(p))%4 != 0 || uintptr(unsafe.Pointer(got))%4 != 0 || *(*uint32)(unsafe.Pointer(p)) != 0 || *got != 0 {
					t.Fatal("query class/capacity/alignment/initialization")
				}
				binary.LittleEndian.PutUint32(unsafe.Slice(p, 4), windows.TokenPrimary)
				*got = 4
				switch name {
				case "Impersonation":
					binary.LittleEndian.PutUint32(unsafe.Slice(p, 4), windows.TokenImpersonation)
				case "length0":
					*got = 0
				case "length1":
					*got = 1
				case "length2":
					*got = 2
				case "length3":
					*got = 3
				case "length5":
					*got = 5
				case "length8":
					*got = 8
				case "denied":
					return primary
				case "unsupported":
					return windows.ERROR_INVALID_PARAMETER
				case "Before":
					*(*uint32)(unsafe.Add(unsafe.Pointer(p), -4)) = 0
				case "After":
					*(*uint32)(unsafe.Add(unsafe.Pointer(p), 4)) = 0
				case "LengthBefore":
					*(*uint32)(unsafe.Add(unsafe.Pointer(got), -4)) = 0
				case "LengthAfter":
					*(*uint32)(unsafe.Add(unsafe.Pointer(got), 4)) = 0
				case "error_plus_canary":
					*(*uint32)(unsafe.Add(unsafe.Pointer(p), 4)) = 0
					return primary
				}
				return nil
			})
			if name == "nil_query" {
				q = nil
			}
			got, err := opUACP1R4QueryTokenType(q)
			valid := name == "Primary" || name == "Impersonation"
			wantCalls := 1
			if name == "nil_query" {
				wantCalls = 0
			}
			if (err == nil) != valid || calls != wantCalls || (!valid && got != 0) {
				t.Fatal("query validation/retry outcome")
			}
			if name == "Impersonation" && got != 2 {
				t.Fatal("observed type2 converted to Primary")
			}
			if name == "error_plus_canary" && (!errors.Is(err, primary) || !strings.Contains(err.Error(), "type_query_canary")) {
				t.Fatal("primary/guard errors lost")
			}
		})
	}
	t.Run("close_once_preserves_errors", func(t *testing.T) {
		primary, secondary := errors.New("synthetic query"), errors.New("synthetic close")
		calls := 0
		l := opNative01Lease{closeFn: func() error { calls++; return secondary }}
		err := l.close(primary)
		_ = l.close(nil)
		if calls != 1 || !errors.Is(err, primary) || !errors.Is(err, secondary) {
			t.Fatal("close ownership/error loss")
		}
	})
	t.Run("type2_is_not_policy_authority", func(t *testing.T) {
		f := opFake01FixtureNew()
		f.p.Executor.Frame.Type = 2
		f.reapprove()
		m, r, err := newOperationIdentitySimulation(f.a, f.p, f.approval, f.clock.now, func() error { f.closes++; return nil })
		if err == nil || m != nil || r.State != operationIdentityRejected || f.closes != 1 {
			t.Fatal("diagnostic type acceptance relaxed policy")
		}
	})
}

func TestHUWINOperationIDUACP1R4NativeLinkedTokenType(t *testing.T) {
	const optin = "MANUS_OPERATION_ID_UAC_P1_R4_NATIVE"
	if os.Getenv(optin) != "1" {
		t.Skip("R4 native opt-in absent; zero native token queries")
	}
	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" || unsafe.Sizeof(windows.Token(0)) != 8 || unsafe.Alignof(windows.Token(0)) != 8 ||
		unsafe.Sizeof(uint32(0)) != 4 || unsafe.Alignof(uint32(0)) != 4 || windows.TOKEN_QUERY != 8 || windows.TokenType != 8 || windows.TokenLinkedToken != 19 || windows.TokenPrimary != 1 || windows.TokenImpersonation != 2 {
		t.Fatal("R4 preflight/ABI")
	}
	for _, entry := range os.Environ() {
		name, _, _ := strings.Cut(entry, "=")
		if name != optin && strings.HasPrefix(name, "MANUS_") && strings.Contains(name, "NATIVE") && os.Getenv(name) != "" {
			t.Fatal("R4 preflight/another_native_optin")
		}
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	opened, closed, typeCalls, linkCalls, objectCalls := 0, 0, 0, 0, 0
	t.Cleanup(func() {
		t.Logf("R4 handles acquired=%d closed=%d; class19 calls=%d class8 calls=%d NtQueryObject calls=%d", opened, closed, linkCalls, typeCalls, objectCalls)
		if opened != closed || typeCalls > 1 || linkCalls > 1 || objectCalls > 2 {
			t.Error("R4 ownership/API budget violation")
		}
	})
	retain := func(token windows.Token) *opNative01Lease {
		opened++
		l := &opNative01Lease{closeFn: func() error {
			err := token.Close()
			if err == nil {
				closed++
			}
			return err
		}}
		t.Cleanup(func() {
			if err := l.close(nil); err != nil {
				t.Error("R4 close:", err)
			}
		})
		return l
	}
	code := func(err error) uint32 {
		var number syscall.Errno
		if err != nil && !errors.As(err, &number) {
			t.Fatal("R4 api/non_Win32_error")
		}
		return uint32(number)
	}
	var current windows.Token
	err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &current)
	t.Logf("R4 phase=open_current desired=0x00000008 Win32=%d", code(err))
	if err != nil {
		t.Fatal("R4 api/open_current")
	}
	if current == 0 {
		t.Fatal("R4 structure/null_current_handle")
	}
	currentLease := retain(current)
	proc := windows.NewLazySystemDLL("ntdll.dll").NewProc("NtQueryObject")
	if err := proc.Find(); err != nil {
		t.Fatal("R4 api/NtQueryObject_unavailable; no fallback")
	}
	access := func(role string, token windows.Token) uint32 {
		mask, err := opUACP1GrantedAccess(func(b *opUACP1ObjectBasic, n *uint32) uint32 {
			objectCalls++
			r, _, _ := proc.Call(uintptr(token), 0, uintptr(unsafe.Pointer(b)), 56, uintptr(unsafe.Pointer(n)))
			status := uint32(r)
			t.Logf("R4 phase=rights role=%s NTSTATUS=0x%08X returned=%d", role, status, *n)
			runtime.KeepAlive(b)
			runtime.KeepAlive(n)
			return status
		})
		if err != nil {
			t.Fatal("R4 rights:", err)
		}
		t.Logf("R4 phase=rights role=%s GrantedAccess=0x%08X", role, mask)
		return mask
	}
	if access("current", current) != windows.TOKEN_QUERY {
		t.Fatal("R4 rights/unexpected_current_access")
	}
	var linked windows.Token
	var length uint32
	linkCalls++
	err = windows.GetTokenInformation(current, windows.TokenLinkedToken, (*byte)(unsafe.Pointer(&linked)), 8, &length)
	var linkedLease *opNative01Lease
	if linked != 0 && linked != current {
		linkedLease = retain(linked)
	}
	t.Logf("R4 phase=get_linked class=19 capacity=8 returned=%d Win32=%d", length, code(err))
	if err != nil {
		t.Fatal("R4 api/get_linked; no retry/fallback")
	}
	if length != 8 || linked == 0 || linked == current {
		t.Fatal("R4 structure/linked_handle_ABI")
	}
	_ = access("linked", linked) // Returned rights are observed, never expanded/exercised beyond query.
	value, err := opUACP1R4QueryTokenType(func(class uint32, p *byte, n uint32, got *uint32) error {
		typeCalls++
		if typeCalls != 1 || class != windows.TokenType || n != 4 {
			return errors.New("R4 preflight/type_query_budget")
		}
		err := windows.GetTokenInformation(linked, class, p, n, got)
		t.Logf("R4 phase=linked_type class=8 capacity=4 returned=%d Win32=%d payloadAligned=%t lengthAligned=%t", *got, code(err), uintptr(unsafe.Pointer(p))%4 == 0, uintptr(unsafe.Pointer(got))%4 == 0)
		return err
	})
	if err != nil {
		t.Fatal("R4 phase=linked_type TokenType=UNKNOWN:", err)
	}
	t.Logf("R4 phase=linked_type category=observation TokenType=%d; length=4 four_canaries=intact; no authorization", value)
	if typeCalls != 1 || linkCalls != 1 || objectCalls != 2 {
		t.Fatal("R4 preflight/incomplete_API_budget")
	}
	if err := errors.Join(linkedLease.close(nil), currentLease.close(nil)); err != nil {
		t.Fatal("R4 close:", err)
	}
	t.Log("R4 NOT_PROVEN: previous R2 numeric type, UAC transition, SID/logon/session relationships, executor/helper identity, authorization or durable claims; P1 remains BLOCKED")
}

// R5 is a pure diagnostic model, deliberately disconnected from native readers
// and operationIdentityFrame. A successful observation never grants authority.
type opUACP1R5Error struct{ Category, Reason string }

func (e *opUACP1R5Error) Error() string {
	return "R5 observation rejected: " + e.Category + "/" + e.Reason
}

func opUACP1R5Reject(category, reason string) error {
	return &opUACP1R5Error{category, reason}
}

// Parsing establishes ABI only. Type-dependent interpretation is separate.
// Input is an owned, synthetic byte slice; this function makes no API call.
func opUACP1R5ParseStatistics(data []byte) (opNative01Statistics, error) {
	var s opNative01Statistics
	if opUACP1R1CheckLayout(opUACP1R1ActualLayout()) != nil {
		return s, opUACP1R5Reject("structure", "stats_layout")
	}
	if len(data) != 56 {
		return s, opUACP1R5Reject("structure", "stats_size")
	}
	if uintptr(unsafe.Pointer(&data[0]))%8 != 0 {
		return s, opUACP1R5Reject("structure", "stats_alignment")
	}
	luid := func(off int) windows.LUID {
		return windows.LUID{LowPart: binary.LittleEndian.Uint32(data[off:]), HighPart: int32(binary.LittleEndian.Uint32(data[off+4:]))}
	}
	s.TokenID, s.AuthenticationID, s.ModifiedID = luid(0), luid(8), luid(48)
	s.Expiration = int64(binary.LittleEndian.Uint64(data[16:]))
	s.TokenType, s.Impersonation = binary.LittleEndian.Uint32(data[24:]), binary.LittleEndian.Uint32(data[28:])
	s.DynamicCharged, s.Available = binary.LittleEndian.Uint32(data[32:]), binary.LittleEndian.Uint32(data[36:])
	s.GroupCount, s.PrivilegeCount = binary.LittleEndian.Uint32(data[40:]), binary.LittleEndian.Uint32(data[44:])
	return s, nil
}

// First-failure precedence: essential IDs, type, applicable level, then counts.
// Bounds and nonzero IDs retain the existing observation contract, not a claim
// that every Windows token must satisfy this limited QA model.
func opUACP1R5StatisticsSemantics(s opNative01Statistics) error {
	reason := ""
	switch {
	case s.TokenID == (windows.LUID{}):
		reason = "stats_token_id_missing"
	case s.AuthenticationID == (windows.LUID{}):
		reason = "stats_authentication_id_missing"
	case s.ModifiedID == (windows.LUID{}):
		reason = "stats_modified_id_missing"
	case s.TokenType != windows.TokenPrimary && s.TokenType != windows.TokenImpersonation:
		reason = "stats_token_type_unknown"
	case s.TokenType == windows.TokenImpersonation && s.Impersonation > 3:
		reason = "stats_impersonation_level_unknown"
	case s.GroupCount > 65536:
		reason = "stats_group_count_out_of_range"
	case s.PrivilegeCount > 65536:
		reason = "stats_privilege_count_out_of_range"
	}
	if reason != "" {
		return opUACP1R5Reject("observation_contract", reason)
	}
	return nil
}

func opUACP1R5DecodeStatistics(data []byte) (opNative01Statistics, error) {
	s, err := opUACP1R5ParseStatistics(data)
	if err == nil {
		err = opUACP1R5StatisticsSemantics(s)
	}
	if err != nil {
		return opNative01Statistics{}, err
	}
	return s, nil
}

// These bits describe observations, not the production/fake authorization mask.
// Explicit presence distinguishes a valid zero flag/count from missing data.
const opUACP1R5AllObserved uint16 = (1 << 10) - 1

type opUACP1R5Snapshot struct {
	Fields        opNative01Snapshot
	Observed      uint16
	ObservedType  uint32
	RetainedLabel uint64 // Injected same-handle correlation label, never a HANDLE or proof.
}

func opUACP1R5SIDComplete(sid []byte) bool {
	return len(sid) >= 8 && sid[0] == 1 && sid[1] >= 1 && sid[1] <= 15 && len(sid) == 8+4*int(sid[1])
}

func opUACP1R5Complete(s opUACP1R5Snapshot) error {
	if s.Observed != opUACP1R5AllObserved || s.RetainedLabel == 0 {
		return opUACP1R5Reject("observation_contract", "snapshot_incomplete")
	}
	if err := opUACP1R5StatisticsSemantics(s.Fields.stats); err != nil {
		return err
	}
	f := s.Fields
	switch {
	case s.ObservedType != f.stats.TokenType:
		return opUACP1R5Reject("observation_contract", "snapshot_type_mismatch")
	case !opUACP1R5SIDComplete(f.user):
		return opUACP1R5Reject("observation_contract", "snapshot_sid_incomplete")
	case f.session == 0:
		return opUACP1R5Reject("observation_contract", "snapshot_session_missing")
	case f.integrity != 0x1000 && f.integrity != 0x2000 && f.integrity != 0x3000 && f.integrity != 0x4000:
		return opUACP1R5Reject("observation_contract", "snapshot_integrity_unsupported")
	case f.filtered > 1 || f.appContainer > 1 || f.restricting > 65536:
		return opUACP1R5Reject("observation_contract", "snapshot_restrictions_invalid")
	case !((f.elevation == 0 && (f.elevationType == 1 || f.elevationType == 3)) || (f.elevation == 1 && f.elevationType == 2)):
		return opUACP1R5Reject("observation_contract", "snapshot_elevation_inconsistent")
	}
	// HasRestrictions (filtering history) and restricting SID count stay separate.
	// A count of zero, AppContainer=false or a SID match confers no authority.
	return nil
}

func opUACP1R5SameSnapshot(a, b opUACP1R5Snapshot) (string, error) {
	if err := opUACP1R5Complete(a); err != nil {
		return "UNKNOWN", err
	}
	if err := opUACP1R5Complete(b); err != nil {
		return "UNKNOWN", err
	}
	if a.RetainedLabel != b.RetainedLabel {
		return "UNKNOWN", opUACP1R5Reject("correlation", "retained_token_unproven")
	}
	x, y := a.Fields, b.Fields
	p, q := x.stats, y.stats
	statisticsSame := false
	if p.TokenType == windows.TokenPrimary && q.TokenType == windows.TokenPrimary {
		statisticsSame = opNative01SamePrimaryStatistics(p, q) // P0 unchanged.
	} else if p.TokenType == windows.TokenImpersonation && q.TokenType == windows.TokenImpersonation {
		statisticsSame = p.TokenID == q.TokenID && p.AuthenticationID == q.AuthenticationID &&
			p.ModifiedID == q.ModifiedID && p.GroupCount == q.GroupCount && p.PrivilegeCount == q.PrivilegeCount &&
			p.Impersonation == q.Impersonation
	}
	// Unsupported expiration and dynamic allocation accounting are not identity.
	if !statisticsSame || !bytes.Equal(x.user, y.user) || x.session != y.session || x.integrity != y.integrity ||
		x.elevation != y.elevation || x.elevationType != y.elevationType || x.filtered != y.filtered ||
		x.restricting != y.restricting || x.appContainer != y.appContainer {
		return "DIFFERENT", nil
	}
	return "SAME", nil
}

// Cross-role relations are descriptive only. They neither require equal logon
// IDs nor permit different logon IDs in the unchanged authorization policy.
func opUACP1R5Relations(a, b *opUACP1R5Snapshot) (map[string]string, error) {
	r := map[string]string{"SID": "UNKNOWN", "SessionId": "UNKNOWN", "AuthenticationId": "UNKNOWN", "TokenId": "UNKNOWN", "ModifiedId": "UNKNOWN", "TokenType": "UNKNOWN", "ImpersonationLevel": "UNKNOWN"}
	if a == nil || b == nil {
		return r, opUACP1R5Reject("observation_contract", "linked_observation_missing")
	}
	if err := opUACP1R5Complete(*a); err != nil {
		return r, err
	}
	if err := opUACP1R5Complete(*b); err != nil {
		return r, err
	}
	x, y := a.Fields, b.Fields
	for _, row := range []struct {
		name string
		same bool
	}{{"SID", bytes.Equal(x.user, y.user)}, {"SessionId", x.session == y.session},
		{"AuthenticationId", x.stats.AuthenticationID == y.stats.AuthenticationID}, {"TokenId", x.stats.TokenID == y.stats.TokenID},
		{"ModifiedId", x.stats.ModifiedID == y.stats.ModifiedID}, {"TokenType", x.stats.TokenType == y.stats.TokenType}} {
		r[row.name] = "DIFFERENT"
		if row.same {
			r[row.name] = "SAME"
		}
	}
	if x.stats.TokenType == windows.TokenImpersonation && y.stats.TokenType == windows.TokenImpersonation {
		r["ImpersonationLevel"] = "DIFFERENT"
		if x.stats.Impersonation == y.stats.Impersonation {
			r["ImpersonationLevel"] = "SAME"
		}
	}
	return r, nil
}

// All values below are synthetic. No native token, logon or SID is sampled.
func opUACP1R5Fixture(kind uint32) opUACP1R5Snapshot {
	s := opUACP1R5Snapshot{Fields: opUACP0Snapshot(), Observed: opUACP1R5AllObserved, ObservedType: kind, RetainedLabel: 1}
	s.Fields.stats.TokenType = kind
	s.Fields.user = []byte{1, 1, 0, 0, 0, 0, 0, 5, 42, 0, 0, 0}
	return s
}

func opUACP1R5AssertReason(t *testing.T, err error, category, reason string) {
	t.Helper()
	var diagnostic *opUACP1R5Error
	if !errors.As(err, &diagnostic) || diagnostic.Category != category || diagnostic.Reason != reason ||
		err.Error() != "R5 observation rejected: "+category+"/"+reason {
		t.Fatal("wrong or unsanitized R5 diagnostic; raw metadata omitted")
	}
}

func TestHUWINOperationIDUACP1R5Statistics(t *testing.T) {
	for _, row := range []struct {
		name        string
		kind, level uint32
		reason      string
	}{{"Primary", 1, 0, ""}, {"Primary_level_inapplicable", 1, 0xffffffff, ""},
		{"Anonymous", 2, 0, ""}, {"Identification", 2, 1, ""}, {"Impersonation", 2, 2, ""}, {"Delegation", 2, 3, ""},
		{"unknown_level_4", 2, 4, "stats_impersonation_level_unknown"}, {"unknown_level_max", 2, 0xffffffff, "stats_impersonation_level_unknown"},
		{"unknown_type_0", 0, 0, "stats_token_type_unknown"}, {"unknown_type_3", 3, 0, "stats_token_type_unknown"}, {"unknown_type_max", 0xffffffff, 0, "stats_token_type_unknown"}} {
		t.Run(row.name, func(t *testing.T) {
			s := opUACP1R5Fixture(row.kind).Fields.stats
			s.Impersonation = row.level
			b := opUACP1R1SyntheticBlob(s)
			parsed, err := opUACP1R5ParseStatistics(b.data())
			if err != nil || parsed != s {
				t.Fatal("structural parser changed synthetic fields")
			}
			got, err := opUACP1R5DecodeStatistics(b.data())
			if row.reason == "" {
				if err != nil || got != s {
					t.Fatal("valid diagnostic type rejected")
				}
			} else {
				opUACP1R5AssertReason(t, err, "observation_contract", row.reason)
				if got != (opNative01Statistics{}) {
					t.Fatal("rejection leaked a usable snapshot")
				}
			}
		})
	}
	for _, kind := range []uint32{1, 2} {
		for _, row := range []struct {
			name, reason string
			mutate       func(*opNative01Statistics)
		}{{"TokenId", "stats_token_id_missing", func(s *opNative01Statistics) { s.TokenID = windows.LUID{} }},
			{"AuthenticationId", "stats_authentication_id_missing", func(s *opNative01Statistics) { s.AuthenticationID = windows.LUID{} }},
			{"ModifiedId", "stats_modified_id_missing", func(s *opNative01Statistics) { s.ModifiedID = windows.LUID{} }},
			{"groups", "stats_group_count_out_of_range", func(s *opNative01Statistics) { s.GroupCount = 65537 }},
			{"privileges", "stats_privilege_count_out_of_range", func(s *opNative01Statistics) { s.PrivilegeCount = 65537 }},
			{"first_error_precedence", "stats_token_id_missing", func(s *opNative01Statistics) { s.TokenID = windows.LUID{}; s.TokenType = 99; s.GroupCount = 65537 }}} {
			t.Run(fmt.Sprintf("kind_%d_%s", kind, row.name), func(t *testing.T) {
				s := opUACP1R5Fixture(kind).Fields.stats
				row.mutate(&s)
				b := opUACP1R1SyntheticBlob(s)
				_, err := opUACP1R5DecodeStatistics(b.data())
				opUACP1R5AssertReason(t, err, "observation_contract", row.reason)
			})
		}
	}
	for _, size := range []int{0, 1, 55, 57, 64} {
		t.Run(fmt.Sprintf("size_%d", size), func(t *testing.T) {
			_, err := opUACP1R5DecodeStatistics(make([]byte, size))
			opUACP1R5AssertReason(t, err, "structure", "stats_size")
		})
	}
	t.Run("misalignment", func(t *testing.T) {
		words := make([]uint64, 8)
		data := unsafe.Slice((*byte)(unsafe.Pointer(&words[0])), 64)[1:57]
		_, err := opUACP1R5DecodeStatistics(data)
		opUACP1R5AssertReason(t, err, "structure", "stats_alignment")
	})
	t.Run("count_boundaries", func(t *testing.T) {
		for _, kind := range []uint32{1, 2} {
			s := opUACP1R5Fixture(kind).Fields.stats
			s.GroupCount, s.PrivilegeCount = 65536, 65536
			b := opUACP1R1SyntheticBlob(s)
			if _, err := opUACP1R5DecodeStatistics(b.data()); err != nil {
				t.Fatal("existing count boundary rejected")
			}
		}
	})
}

func TestHUWINOperationIDUACP1R5SnapshotConsistency(t *testing.T) {
	for _, kind := range []uint32{1, 2} {
		for _, row := range []struct {
			name, want string
			mutate     func(*opUACP1R5Snapshot)
		}{{"stable", "SAME", func(*opUACP1R5Snapshot) {}},
			{"TokenId", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.stats.TokenID.LowPart++ }},
			{"AuthenticationId", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.stats.AuthenticationID.LowPart++ }},
			{"ModifiedId", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.stats.ModifiedID.LowPart++ }},
			{"groups", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.stats.GroupCount++ }},
			{"privileges", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.stats.PrivilegeCount++ }},
			{"SID", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.user[8]++ }},
			{"SessionId", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.session++ }},
			{"integrity", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.integrity = 0x3000 }},
			{"elevation", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.elevation, s.Fields.elevationType = 1, 2 }},
			{"filtering_history", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.filtered = 0 }},
			{"restricting_count", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.restricting++ }},
			{"app_container", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.appContainer = 1 }},
			{"dynamic_accounting", "SAME", func(s *opUACP1R5Snapshot) {
				s.Fields.stats.DynamicCharged++
				s.Fields.stats.Available++
				s.Fields.stats.Expiration = -1
			}},
			{"type_changed", "DIFFERENT", func(s *opUACP1R5Snapshot) { s.Fields.stats.TokenType = 3 - kind; s.ObservedType = 3 - kind }}} {
			t.Run(fmt.Sprintf("kind_%d_%s", kind, row.name), func(t *testing.T) {
				a, b := opUACP1R5Fixture(kind), opUACP1R5Fixture(kind)
				row.mutate(&b)
				got, err := opUACP1R5SameSnapshot(a, b)
				if err != nil || got != row.want {
					t.Fatal("wrong snapshot relation; metadata omitted")
				}
			})
		}
	}
	for _, kind := range []uint32{1, 2} {
		for _, level := range []uint32{0, 1, 2, 3} {
			t.Run(fmt.Sprintf("kind_%d_level_%d", kind, level), func(t *testing.T) {
				a, b := opUACP1R5Fixture(kind), opUACP1R5Fixture(kind)
				b.Fields.stats.Impersonation = level
				want := "SAME"
				if kind == 2 && level != 0 {
					want = "DIFFERENT"
				}
				got, err := opUACP1R5SameSnapshot(a, b)
				if err != nil || got != want {
					t.Fatal("type-dependent level comparison wrong")
				}
				if kind == 1 && !opNative01SamePrimaryStatistics(a.Fields.stats, b.Fields.stats) {
					t.Fatal("P0 compatibility changed")
				}
			})
		}
	}
}

func TestHUWINOperationIDUACP1R5Incomplete(t *testing.T) {
	for _, row := range []struct {
		name, reason string
		mutate       func(*opUACP1R5Snapshot)
	}{{"missing_label", "snapshot_incomplete", func(s *opUACP1R5Snapshot) { s.RetainedLabel = 0 }},
		{"type_disagrees", "snapshot_type_mismatch", func(s *opUACP1R5Snapshot) { s.ObservedType = 2 }},
		{"empty_SID", "snapshot_sid_incomplete", func(s *opUACP1R5Snapshot) { s.Fields.user = nil }},
		{"SID_revision", "snapshot_sid_incomplete", func(s *opUACP1R5Snapshot) { s.Fields.user[0] = 2 }},
		{"SID_truncated", "snapshot_sid_incomplete", func(s *opUACP1R5Snapshot) { s.Fields.user = s.Fields.user[:11] }},
		{"SID_count", "snapshot_sid_incomplete", func(s *opUACP1R5Snapshot) { s.Fields.user[1] = 16 }},
		{"session", "snapshot_session_missing", func(s *opUACP1R5Snapshot) { s.Fields.session = 0 }},
		{"integrity", "snapshot_integrity_unsupported", func(s *opUACP1R5Snapshot) { s.Fields.integrity = 0 }},
		{"filtered", "snapshot_restrictions_invalid", func(s *opUACP1R5Snapshot) { s.Fields.filtered = 2 }},
		{"appContainer", "snapshot_restrictions_invalid", func(s *opUACP1R5Snapshot) { s.Fields.appContainer = 2 }},
		{"restricting_count", "snapshot_restrictions_invalid", func(s *opUACP1R5Snapshot) { s.Fields.restricting = 65537 }},
		{"elevation", "snapshot_elevation_inconsistent", func(s *opUACP1R5Snapshot) { s.Fields.elevation = 1 }},
		{"elevation_enum", "snapshot_elevation_inconsistent", func(s *opUACP1R5Snapshot) { s.Fields.elevationType = 99 }},
		{"missing_statistics", "stats_token_id_missing", func(s *opUACP1R5Snapshot) { s.Fields.stats = opNative01Statistics{} }}} {
		t.Run(row.name, func(t *testing.T) {
			a, b := opUACP1R5Fixture(1), opUACP1R5Fixture(1)
			row.mutate(&b)
			got, err := opUACP1R5SameSnapshot(a, b)
			if got != "UNKNOWN" {
				t.Fatal("incomplete observation produced a relation")
			}
			opUACP1R5AssertReason(t, err, "observation_contract", row.reason)
			r, err := opUACP1R5Relations(&a, &b)
			if err == nil {
				t.Fatal("incomplete cross-role observation accepted")
			}
			for _, value := range r {
				if value != "UNKNOWN" {
					t.Fatal("partial identity relation escaped")
				}
			}
		})
	}
	for bit := uint16(1); bit <= 1<<9; bit <<= 1 {
		t.Run(fmt.Sprintf("missing_observation_%d", bit), func(t *testing.T) {
			s := opUACP1R5Fixture(2)
			s.Observed &^= bit
			opUACP1R5AssertReason(t, opUACP1R5Complete(s), "observation_contract", "snapshot_incomplete")
		})
	}
	t.Run("retention_not_proven", func(t *testing.T) {
		a, b := opUACP1R5Fixture(2), opUACP1R5Fixture(2)
		b.RetainedLabel++
		got, err := opUACP1R5SameSnapshot(a, b)
		if got != "UNKNOWN" {
			t.Fatal("uncorrelated repeat accepted")
		}
		opUACP1R5AssertReason(t, err, "correlation", "retained_token_unproven")
	})
}

func TestHUWINOperationIDUACP1R5RelationsAndAuthority(t *testing.T) {
	for _, field := range []string{"same", "SID", "SessionId", "AuthenticationId", "TokenId", "ModifiedId", "TokenType", "ImpersonationLevel", "absent_linked"} {
		t.Run(field, func(t *testing.T) {
			a, b := opUACP1R5Fixture(2), opUACP1R5Fixture(2)
			switch field {
			case "SID":
				b.Fields.user[8]++
			case "SessionId":
				b.Fields.session++
			case "AuthenticationId":
				b.Fields.stats.AuthenticationID.LowPart++
			case "TokenId":
				b.Fields.stats.TokenID.LowPart++
			case "ModifiedId":
				b.Fields.stats.ModifiedID.LowPart++
			case "TokenType":
				b.Fields.stats.TokenType, b.ObservedType = 1, 1
			case "ImpersonationLevel":
				b.Fields.stats.Impersonation++
			}
			other := &b
			if field == "absent_linked" {
				other = nil
			}
			r, err := opUACP1R5Relations(&a, other)
			if other == nil {
				opUACP1R5AssertReason(t, err, "observation_contract", "linked_observation_missing")
				for _, value := range r {
					if value != "UNKNOWN" {
						t.Fatal("absent linked observation inferred")
					}
				}
				return
			}
			if err != nil {
				t.Fatal("valid synthetic relations rejected")
			}
			for name, got := range r {
				want := "SAME"
				if name == field {
					want = "DIFFERENT"
				}
				if field == "TokenType" && name == "ImpersonationLevel" {
					want = "UNKNOWN"
				}
				if got != want {
					t.Fatal("wrong descriptive relation")
				}
			}
		})
	}
	t.Run("Primary_level_relation_not_applicable", func(t *testing.T) {
		a, b := opUACP1R5Fixture(1), opUACP1R5Fixture(1)
		b.Fields.stats.Impersonation = 0xffffffff
		r, err := opUACP1R5Relations(&a, &b)
		if err != nil || r["ImpersonationLevel"] != "UNKNOWN" {
			t.Fatal("Primary level given meaning")
		}
	})
	t.Run("filtered_without_restricting_SIDs_is_only_observation", func(t *testing.T) {
		s := opUACP1R5Fixture(2)
		if s.Fields.filtered != 1 || s.Fields.restricting != 0 || opUACP1R5Complete(s) != nil {
			t.Fatal("filtering and restricting SID count conflated")
		}
		f := opFake01FixtureNew()
		f.p.Executor.Frame.Type = windows.TokenImpersonation
		f.reapprove()
		m, result, err := newOperationIdentitySimulation(f.a, f.p, f.approval, f.clock.now, func() error { f.closes++; return nil })
		if err == nil || m != nil || result.State != operationIdentityRejected || !result.Simulated || f.closes != 1 || len(f.a.records) != 0 {
			t.Fatal("Impersonation acquired fake-only authorization")
		}
	})
	t.Run("valid_observation_is_not_authority", func(t *testing.T) {
		for _, kind := range []uint32{1, 2} {
			s := opUACP1R5Fixture(kind)
			if opUACP1R5Complete(s) != nil {
				t.Fatal("invalid fixture")
			}
			f := opFake01FixtureNew()
			m, result, err := newOperationIdentitySimulation(nil, f.p, f.approval, f.clock.now, func() error { f.closes++; return nil })
			if err == nil || m != nil || result.State != operationIdentityRejected || f.closes != 1 {
				t.Fatal("observation bypassed explicit authority")
			}
		}
	})
}

func TestHUWINOperationIDUACP1R5ExistingContractsRemainStrict(t *testing.T) {
	for _, level := range []uint32{0, 1, 2, 3} {
		t.Run(fmt.Sprintf("stable_impersonation_level_%d", level), func(t *testing.T) {
			a, b := opUACP1R5Fixture(2), opUACP1R5Fixture(2)
			a.Fields.stats.Impersonation, b.Fields.stats.Impersonation = level, level
			got, err := opUACP1R5SameSnapshot(a, b)
			if err != nil || got != "SAME" {
				t.Fatal("valid same-token diagnostic repeat rejected")
			}
			blob := opUACP1R1SyntheticBlob(a.Fields.stats)
			_, oldErr := opNative01Stats(blob)
			opUACP1R1AssertReason(t, oldErr, opUACP1R1StatsTokenType)
			if opUACP1Complete(a.Fields) || opNative01SamePrimaryStatistics(a.Fields.stats, b.Fields.stats) {
				t.Fatal("existing Primary-only contract relaxed")
			}
		})
	}
	t.Run("Primary_opaque_level_preserves_P0", func(t *testing.T) {
		a, b := opUACP1R5Fixture(1), opUACP1R5Fixture(1)
		b.Fields.stats.Impersonation = 0xffffffff
		got, err := opUACP1R5SameSnapshot(a, b)
		if err != nil || got != "SAME" || !opNative01SamePrimaryStatistics(a.Fields.stats, b.Fields.stats) {
			t.Fatal("Primary inapplicable field became an invariant")
		}
	})
	t.Run("unknown_presence_bits_rejected", func(t *testing.T) {
		s := opUACP1R5Fixture(1)
		s.Observed |= 1 << 10
		opUACP1R5AssertReason(t, opUACP1R5Complete(s), "observation_contract", "snapshot_incomplete")
	})
}

// R6 is an independent test-only query adapter. Nothing calls it from P1, P0,
// the fake authorization policy or production. Native execution needs a future
// explicit per-run approval as well as its distinct environment opt-in.
type opUACP1R6Error struct {
	Phase, Category, Reason string
	Win32                   uint32
}

func (e *opUACP1R6Error) Error() string {
	return fmt.Sprintf("R6 %s %s/%s Win32=%d", e.Phase, e.Category, e.Reason, e.Win32)
}

func opUACP1R6Reject(phase, category, reason string) error {
	return &opUACP1R6Error{Phase: phase, Category: category, Reason: reason}
}

func opUACP1R6APIError(phase string, err error) error {
	var code syscall.Errno
	if !errors.As(err, &code) {
		return opUACP1R6Reject(phase, "api", "non_Win32_error")
	}
	return &opUACP1R6Error{Phase: phase, Category: "api", Reason: "query_failed", Win32: uint32(code)}
}

// One sizing call and one data call for variable metadata, no retries. Guard
// storage retains embedded SID pointers until the existing bounded decoder has
// copied the SID. A returned-size change fails closed rather than retrying.
func opUACP1R6Buffer(q opNative01Query, class, fixed uint32) (opNative01Buffer, error) {
	if q == nil {
		return opNative01Buffer{}, opUACP1R6Reject("query", "structure", "query_missing")
	}
	n := fixed
	const guard = uint32(0xB6517AC3)
	length := struct{ Before, Value, After uint32 }{Before: guard, After: guard}
	if fixed == 0 {
		err := q(class, nil, 0, &length.Value)
		if length.Before != guard || length.After != guard {
			return opNative01Buffer{}, opUACP1R6Reject("sizing", "structure", "length_canary")
		}
		if !errors.Is(err, windows.ERROR_INSUFFICIENT_BUFFER) {
			if err != nil {
				return opNative01Buffer{}, opUACP1R6APIError("sizing", err)
			}
			return opNative01Buffer{}, opUACP1R6Reject("sizing", "structure", "sizing_failure_missing")
		}
		n = length.Value
	} else if fixed != 4 && fixed != 56 {
		return opNative01Buffer{}, opUACP1R6Reject("query", "structure", "unsupported_fixed_size")
	}
	if n == 0 || n > 1<<20 {
		return opNative01Buffer{}, opUACP1R6Reject("query", "structure", "capacity_invalid")
	}
	words := make([]uint64, (int(n)+16+7)/8)
	raw := unsafe.Slice((*byte)(unsafe.Pointer(&words[0])), len(words)*8)
	before, after := raw[:8], raw[8+int(n):8+int(n)+8]
	for i := range before {
		before[i], after[i] = 0xA5, 0x5A
	}
	p := &raw[8]
	if uintptr(unsafe.Pointer(p))%8 != 0 || uintptr(unsafe.Pointer(&length.Value))%4 != 0 {
		return opNative01Buffer{}, opUACP1R6Reject("query", "structure", "alignment")
	}
	length.Value = 0
	primary := q(class, p, n, &length.Value)
	var guardErr error
	if !bytes.Equal(before, bytes.Repeat([]byte{0xA5}, 8)) || !bytes.Equal(after, bytes.Repeat([]byte{0x5A}, 8)) || length.Before != guard || length.After != guard {
		guardErr = opUACP1R6Reject("query", "structure", "output_canary")
	}
	if primary != nil || guardErr != nil {
		if primary != nil {
			primary = opUACP1R6APIError("data", primary)
		}
		return opNative01Buffer{}, errors.Join(primary, guardErr)
	}
	if length.Value != n {
		return opNative01Buffer{}, opUACP1R6Reject("query", "structure", "returned_length")
	}
	return opNative01Buffer{words: words[1 : 1+(int(n)+7)/8], used: n}, nil
}

// This builds diagnostic R5 observations only. No operationIdentityFrame is
// constructed. Class 9 is queried only for Impersonation, never for Primary.
func opUACP1R6Read(q opNative01Query, label uint64, ownPrimary bool) (opUACP1R5Snapshot, error) {
	s := opUACP1R5Snapshot{RetainedLabel: label}
	readStats := func() (opNative01Statistics, error) {
		b, err := opUACP1R6Buffer(q, windows.TokenStatistics, 56)
		if err != nil {
			return opNative01Statistics{}, err
		}
		return opUACP1R5DecodeStatistics(b.data())
	}
	var err error
	if s.Fields.stats, err = readStats(); err != nil {
		return opUACP1R5Snapshot{}, err
	}
	if ownPrimary && s.Fields.stats.TokenType != windows.TokenPrimary {
		return opUACP1R5Snapshot{}, opUACP1R6Reject("current", "observation_contract", "current_not_Primary")
	}
	for _, f := range []struct {
		class uint32
		dest  *uint32
	}{
		{windows.TokenType, &s.ObservedType}, {windows.TokenSessionId, &s.Fields.session},
		{windows.TokenElevation, &s.Fields.elevation}, {windows.TokenElevationType, &s.Fields.elevationType},
		{opNative01TokenIsAppContainer, &s.Fields.appContainer},
	} {
		b, e := opUACP1R6Buffer(q, f.class, 4)
		if e != nil {
			return opUACP1R5Snapshot{}, e
		}
		if *f.dest, err = opNative01DWORD(b); err != nil {
			return opUACP1R5Snapshot{}, opUACP1R6Reject("DWORD", "structure", "DWORD_decode")
		}
	}
	if s.ObservedType != s.Fields.stats.TokenType {
		return opUACP1R5Snapshot{}, opUACP1R6Reject("type", "observation_contract", "type_mismatch")
	}
	if s.ObservedType == windows.TokenImpersonation {
		b, e := opUACP1R6Buffer(q, windows.TokenImpersonationLevel, 4)
		if e != nil {
			return opUACP1R5Snapshot{}, e
		}
		level, _ := opNative01DWORD(b) // Buffer already requires exactly four bytes.
		if level > 3 || level != s.Fields.stats.Impersonation {
			return opUACP1R5Snapshot{}, opUACP1R6Reject("level", "observation_contract", "level_mismatch_or_unknown")
		}
	}
	if s.Fields.filtered, err = opNative01Class21(q); err != nil {
		// Preserve strict certified BOOLEAN/canary checks, never print its input.
		return opUACP1R5Snapshot{}, opUACP1R6Reject("class21", "observation_contract", "class21_rejected")
	}
	b, err := opUACP1R6Buffer(q, windows.TokenUser, 0)
	if err != nil {
		return opUACP1R5Snapshot{}, err
	}
	if s.Fields.user, _, err = opNative01SID(b, 0); err != nil {
		return opUACP1R5Snapshot{}, opUACP1R6Reject("user", "structure", "SID_decode")
	}
	b, err = opUACP1R6Buffer(q, windows.TokenIntegrityLevel, 0)
	if err != nil {
		return opUACP1R5Snapshot{}, err
	}
	il, attrs, err := opNative01SID(b, 0)
	if err != nil || len(il) != 12 || !bytes.Equal(il[2:8], []byte{0, 0, 0, 0, 0, 16}) || attrs&windows.SE_GROUP_INTEGRITY == 0 {
		return opUACP1R5Snapshot{}, opUACP1R6Reject("integrity", "structure", "integrity_decode")
	}
	s.Fields.integrity = binary.LittleEndian.Uint32(il[8:])
	b, err = opUACP1R6Buffer(q, windows.TokenRestrictedSids, 0)
	if err != nil {
		return opUACP1R5Snapshot{}, err
	}
	if s.Fields.restricting, err = opNative01RestrictingCount(b); err != nil {
		return opUACP1R5Snapshot{}, opUACP1R6Reject("restrictions", "structure", "restricting_SIDs_decode")
	}
	s.Observed = opUACP1R5AllObserved
	if err := opUACP1R5Complete(s); err != nil {
		return opUACP1R5Snapshot{}, err
	}
	end, err := readStats()
	if err != nil {
		return opUACP1R5Snapshot{}, err
	}
	last := s
	last.Fields.stats = end
	last.ObservedType = end.TokenType
	relation, err := opUACP1R5SameSnapshot(s, last)
	if err != nil {
		return opUACP1R5Snapshot{}, err
	}
	if relation != "SAME" {
		return opUACP1R5Snapshot{}, opUACP1R6Reject("statistics_repeat", "observation_contract", "statistics_changed")
	}
	return s, nil
}

// Ownership transfers to Observe even if an opener returns a source plus an
// error. Query is the only capability exposed; Close owns exactly one handle.
type opUACP1R6Source struct {
	Query  opNative01Query
	Access uint32
	Close  func() error
}

type opUACP1R6Result struct {
	Relations                            map[string]string
	CurrentType, LinkedType, LinkedLevel uint32
	Complete                             bool
	Owned, CloseAttempts, Closed         int
}

func opUACP1R6Observe(openCurrent func() (*opUACP1R6Source, error), openLinked func() (*opUACP1R6Source, error)) (r opUACP1R6Result, err error) {
	r.Relations, _ = opUACP1R5Relations(nil, nil)
	var leases []*opNative01Lease
	retain := func(s *opUACP1R6Source) {
		if s != nil && s.Close != nil {
			r.Owned++
			leases = append(leases, &opNative01Lease{closeFn: func() error {
				r.CloseAttempts++
				e := s.Close()
				if e == nil {
					r.Closed++
				} else {
					e = opUACP1R6Reject("close", "api", "close_failed")
				}
				return e
			}})
		}
	}
	defer func() {
		for i := len(leases) - 1; i >= 0; i-- {
			err = leases[i].close(err)
		}
		if err != nil {
			r.Complete = false
		}
	}()
	if openCurrent == nil || openLinked == nil {
		return r, opUACP1R6Reject("open", "structure", "opener_missing")
	}
	current, err := openCurrent()
	retain(current)
	if err != nil {
		return r, err
	}
	if current == nil || current.Query == nil || current.Close == nil || current.Access != windows.TOKEN_QUERY {
		return r, opUACP1R6Reject("current", "rights", "current_source_invalid")
	}
	a, err := opUACP1R6Read(current.Query, 1, true)
	if err != nil {
		return r, err
	}
	r.CurrentType = a.Fields.stats.TokenType
	if a.Fields.integrity != 0x2000 || a.Fields.elevation != 0 || a.Fields.elevationType != 3 || a.Fields.appContainer != 0 || a.Fields.restricting != 0 {
		return r, opUACP1R6Reject("current", "preflight", "QA_context_mismatch")
	}
	linked, err := openLinked()
	if linked == current {
		return r, errors.Join(err, opUACP1R6Reject("linked", "structure", "aliased_source"))
	}
	retain(linked)
	if err != nil {
		return r, err
	}
	if linked == nil || linked.Query == nil || linked.Close == nil || linked.Access&windows.TOKEN_QUERY == 0 {
		return r, opUACP1R6Reject("linked", "rights", "linked_source_invalid")
	}
	b, err := opUACP1R6Read(linked.Query, 2, false)
	if err != nil {
		return r, err
	}
	r.LinkedType, r.LinkedLevel = b.Fields.stats.TokenType, b.Fields.stats.Impersonation
	r.Relations, err = opUACP1R5Relations(&a, &b)
	if err != nil {
		return r, err
	}
	// Descriptive mismatches remain visible. Unexpected account/session stops
	// this bounded QA probe under the existing OpenSpec gate; no second pass.
	if r.Relations["SID"] != "SAME" || r.Relations["SessionId"] != "SAME" {
		return r, opUACP1R6Reject("relations", "preflight", "account_or_session_difference")
	}
	for _, item := range []struct {
		source  *opUACP1R6Source
		initial opUACP1R5Snapshot
		own     bool
	}{{current, a, true}, {linked, b, false}} {
		last, e := opUACP1R6Read(item.source.Query, item.initial.RetainedLabel, item.own)
		if e != nil {
			return r, e
		}
		relation, e := opUACP1R5SameSnapshot(item.initial, last)
		if e != nil {
			return r, e
		}
		if relation != "SAME" {
			return r, opUACP1R6Reject("snapshot_repeat", "observation_contract", "snapshot_changed")
		}
	}
	r.Complete = true // Complete observations only, never an authorized frame.
	return r, nil
}

func opUACP1R6OptIn(value string, environment []string) error {
	if value != "1" {
		return opUACP1R6Reject("preflight", "opt_in", "opt_in_absent")
	}
	for _, entry := range environment {
		name, value, _ := strings.Cut(entry, "=")
		if strings.HasPrefix(name, "MANUS_") && strings.Contains(name, "NATIVE") && name != "MANUS_OPERATION_ID_UAC_P1_R6_NATIVE" && value != "" {
			return opUACP1R6Reject("preflight", "opt_in", "another_opt_in_active")
		}
	}
	return nil
}

func TestHUWINOperationIDUACP1R6NativeTypeAware(t *testing.T) {
	if os.Getenv("MANUS_OPERATION_ID_UAC_P1_R6_NATIVE") != "1" {
		t.Skip("R6 opt-in absent; zero native queries; future per-run approval required")
	}
	if err := opUACP1R6OptIn(os.Getenv("MANUS_OPERATION_ID_UAC_P1_R6_NATIVE"), os.Environ()); err != nil {
		t.Fatal(err)
	}
	if err := opNative01ABI(); err != nil {
		t.Fatal("R6 structure/ABI")
	}
	if windows.TokenImpersonationLevel != 9 || windows.TokenType != 8 || windows.TokenPrimary != 1 || windows.TokenImpersonation != 2 {
		t.Fatal("R6 structure/enum_ABI")
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	proc := windows.NewLazySystemDLL("ntdll.dll").NewProc("NtQueryObject")
	if err := proc.Find(); err != nil {
		t.Fatal("R6 api/NtQueryObject_unavailable")
	}
	var current windows.Token
	query := func(role string, token windows.Token) opNative01Query {
		return func(class uint32, p *byte, n uint32, returned *uint32) error {
			switch class {
			case windows.TokenStatistics, windows.TokenType, windows.TokenImpersonationLevel, windows.TokenUser, windows.TokenSessionId,
				windows.TokenIntegrityLevel, windows.TokenElevation, windows.TokenElevationType, windows.TokenHasRestrictions, windows.TokenRestrictedSids, opNative01TokenIsAppContainer:
			default:
				return errors.New("R6 query/class_not_allowed")
			}
			err := windows.GetTokenInformation(token, class, p, n, returned)
			var code syscall.Errno
			if err != nil && !errors.As(err, &code) {
				return errors.New("R6 api/non_Win32_error")
			}
			t.Logf("R6 role=%s class=%d capacity=%d returned=%d Win32=%d", role, class, n, *returned, uint32(code))
			return err
		}
	}
	makeSource := func(role string, token windows.Token) (*opUACP1R6Source, error) {
		s := &opUACP1R6Source{Query: query(role, token), Close: token.Close}
		mask, err := opUACP1GrantedAccess(func(b *opUACP1ObjectBasic, n *uint32) uint32 {
			r, _, _ := proc.Call(uintptr(token), 0, uintptr(unsafe.Pointer(b)), 56, uintptr(unsafe.Pointer(n)))
			status := uint32(r)
			t.Logf("R6 role=%s rights NTSTATUS=0x%08X returned=%d", role, status, *n)
			runtime.KeepAlive(b)
			runtime.KeepAlive(n)
			return status
		})
		if err != nil {
			return s, opUACP1R6Reject("rights", "api", "object_query_rejected")
		}
		s.Access = mask
		t.Logf("R6 role=%s GrantedAccess=0x%08X; only query exercised", role, mask)
		return s, nil
	}
	r, err := opUACP1R6Observe(func() (*opUACP1R6Source, error) {
		err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &current)
		if err != nil {
			if current != 0 {
				return &opUACP1R6Source{Close: current.Close}, opUACP1R6APIError("open_current", err)
			}
			return nil, opUACP1R6APIError("open_current", err)
		}
		if current == 0 {
			return nil, opUACP1R6Reject("open_current", "structure", "null_handle")
		}
		return makeSource("current", current)
	}, func() (*opUACP1R6Source, error) {
		const guard = uint64(0xA179B258C367D476)
		storage := struct {
			Before uint64
			Token  windows.Token
			After  uint64
		}{Before: guard, After: guard}
		length := struct{ Before, Value, After uint32 }{Before: 0xA17C39D2, After: 0xB28D40E3}
		if unsafe.Sizeof(storage.Token) != 8 || unsafe.Offsetof(storage.Token) != 8 || unsafe.Alignof(storage) != 8 || uintptr(unsafe.Pointer(&length.Value))%4 != 0 {
			return nil, opUACP1R6Reject("linked", "structure", "linked_storage_ABI")
		}
		e := windows.GetTokenInformation(current, windows.TokenLinkedToken, (*byte)(unsafe.Pointer(&storage.Token)), 8, &length.Value)
		var s *opUACP1R6Source
		if storage.Token != 0 && storage.Token != current {
			s = &opUACP1R6Source{Close: storage.Token.Close}
		}
		var code syscall.Errno
		if e != nil {
			_ = errors.As(e, &code)
		}
		t.Logf("R6 phase=linked class=19 capacity=8 returned=%d Win32=%d", length.Value, uint32(code))
		if e != nil {
			return s, opUACP1R6APIError("linked", e)
		}
		if storage.Before != guard || storage.After != guard || length.Before != 0xA17C39D2 || length.After != 0xB28D40E3 || length.Value != 8 || s == nil {
			return s, opUACP1R6Reject("linked", "structure", "linked_output_invalid")
		}
		return makeSource("linked", storage.Token)
	})
	t.Logf("R6 owned=%d close_attempts=%d closed=%d complete=%t", r.Owned, r.CloseAttempts, r.Closed, r.Complete)
	if err != nil {
		t.Fatal("R6 stopped; no retry:", err)
	}
	if r.Owned != 2 || r.CloseAttempts != 2 || r.Closed != 2 || !r.Complete {
		t.Fatal("R6 incomplete closure/observation")
	}
	t.Logf("R6 current_type=%d linked_type=%d", r.CurrentType, r.LinkedType)
	if r.LinkedType == windows.TokenImpersonation {
		t.Logf("R6 linked_level=%d; not activated or impersonated", r.LinkedLevel)
	}
	for _, name := range []string{"SID", "SessionId", "AuthenticationId", "TokenId", "ModifiedId", "TokenType", "ImpersonationLevel"} {
		t.Logf("R6 relation %s=%s", name, r.Relations[name])
	}
	t.Log("R6 observation only; no E/H, UAC lineage, authorization, effective-thread proof, durable claim or completed uninstall. AppContainer/filtering values are not access decisions.")
}

// Query-only synthetic source. Pointers refer exclusively to the adapter's
// owned Go buffers; it has no windows.Token, HANDLE or native query capability.
type opUACP1R6Fake struct {
	Snapshot                           opUACP1R5Snapshot
	StatsCalls, LevelCalls, CloseCalls int
	Calls                              map[uint32]int
	Stats                              func(int, opNative01Statistics) opNative01Statistics
	After                              func(uint32, int, *byte, uint32, *uint32) error
	CloseErr                           error
}

func opUACP1R6FakeNew(kind uint32) *opUACP1R6Fake {
	f := &opUACP1R6Fake{Snapshot: opUACP1R5Fixture(kind), Calls: map[uint32]int{}}
	return f
}

func (f *opUACP1R6Fake) source(mask uint32) *opUACP1R6Source {
	return &opUACP1R6Source{Access: mask, Query: f.query, Close: func() error { f.CloseCalls++; return f.CloseErr }}
}

func (f *opUACP1R6Fake) query(class uint32, p *byte, n uint32, got *uint32) error {
	f.Calls[class]++
	finish := func() error {
		if f.After != nil {
			return f.After(class, f.Calls[class], p, n, got)
		}
		return nil
	}
	if class == windows.TokenStatistics {
		if p == nil || n != 56 {
			return windows.ERROR_BAD_LENGTH
		}
		f.StatsCalls++
		s := f.Snapshot.Fields.stats
		if f.Stats != nil {
			s = f.Stats(f.StatsCalls, s)
		}
		b := opUACP1R1SyntheticBlob(s)
		copy(unsafe.Slice(p, n), b.data())
		*got = 56
		return finish()
	}
	if class == windows.TokenUser || class == windows.TokenIntegrityLevel || class == windows.TokenRestrictedSids {
		size := uint32(28)
		if class == windows.TokenRestrictedSids {
			size = 8
		}
		*got = size
		if p == nil {
			if err := finish(); err != nil {
				return err
			}
			return windows.ERROR_INSUFFICIENT_BUFFER
		}
		if n != size {
			return windows.ERROR_BAD_LENGTH
		}
		if class == windows.TokenRestrictedSids {
			binary.LittleEndian.PutUint32(unsafe.Slice(p, n), f.Snapshot.Fields.restricting)
			return finish()
		}
		data := unsafe.Slice(p, n)
		sa := (*windows.SIDAndAttributes)(unsafe.Pointer(p))
		sa.Sid = (*windows.SID)(unsafe.Add(unsafe.Pointer(p), 16))
		copy(data[16:], f.Snapshot.Fields.user)
		if class == windows.TokenIntegrityLevel {
			copy(data[16:], []byte{1, 1, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0})
			sa.Attributes = windows.SE_GROUP_INTEGRITY
			binary.LittleEndian.PutUint32(data[24:], f.Snapshot.Fields.integrity)
		}
		return finish()
	}
	if p == nil || n != 4 {
		return windows.ERROR_BAD_LENGTH
	}
	*got = 4
	var value uint32
	switch class {
	case windows.TokenType:
		value = f.Snapshot.ObservedType
	case windows.TokenImpersonationLevel:
		f.LevelCalls++
		value = f.Snapshot.Fields.stats.Impersonation
	case windows.TokenSessionId:
		value = f.Snapshot.Fields.session
	case windows.TokenElevation:
		value = f.Snapshot.Fields.elevation
	case windows.TokenElevationType:
		value = f.Snapshot.Fields.elevationType
	case opNative01TokenIsAppContainer:
		value = f.Snapshot.Fields.appContainer
	case windows.TokenHasRestrictions:
		*p, *got = byte(f.Snapshot.Fields.filtered), 1
		return finish()
	default:
		return windows.ERROR_INVALID_PARAMETER
	}
	binary.LittleEndian.PutUint32(unsafe.Slice(p, n), value)
	return finish()
}

func TestHUWINOperationIDUACP1R6PureValid(t *testing.T) {
	for _, row := range []struct {
		name        string
		kind, level uint32
	}{
		{"linked_Primary", 1, 0}, {"Primary_inapplicable_level", 1, 0xffffffff},
		{"Anonymous", 2, 0}, {"Identification", 2, 1}, {"Impersonation", 2, 2}, {"Delegation", 2, 3},
	} {
		t.Run(row.name, func(t *testing.T) {
			a, b := opUACP1R6FakeNew(1), opUACP1R6FakeNew(row.kind)
			b.Snapshot.Fields.stats.Impersonation = row.level
			b.Snapshot.Fields.stats.TokenID.LowPart++
			b.Snapshot.Fields.integrity, b.Snapshot.Fields.elevation, b.Snapshot.Fields.elevationType = 0x3000, 1, 2
			r, err := opUACP1R6Observe(func() (*opUACP1R6Source, error) { return a.source(8), nil }, func() (*opUACP1R6Source, error) { return b.source(0xF01FF), nil })
			if err != nil || !r.Complete || r.Owned != 2 || r.CloseAttempts != 2 || r.Closed != 2 || a.CloseCalls != 1 || b.CloseCalls != 1 {
				t.Fatal("valid synthetic flow/closure failed; raw observations omitted")
			}
			if r.CurrentType != 1 || r.LinkedType != row.kind || r.Relations["TokenId"] != "DIFFERENT" || a.LevelCalls != 0 || a.StatsCalls != 4 || b.StatsCalls != 4 {
				t.Fatal("wrong type/query/identity relationship")
			}
			wantLevelCalls := 0
			if row.kind == 2 {
				wantLevelCalls = 2
			}
			if b.LevelCalls != wantLevelCalls {
				t.Fatal("class 9 used outside applicable token type")
			}
		})
	}
	for _, field := range []string{"SID", "SessionId", "AuthenticationId", "TokenId"} {
		t.Run("descriptive_"+field, func(t *testing.T) {
			a, b := opUACP1R6FakeNew(1), opUACP1R6FakeNew(2)
			switch field {
			case "SID":
				b.Snapshot.Fields.user[8]++
			case "SessionId":
				b.Snapshot.Fields.session++
			case "AuthenticationId":
				b.Snapshot.Fields.stats.AuthenticationID.LowPart++
			case "TokenId":
				b.Snapshot.Fields.stats.TokenID.LowPart++
			}
			r, err := opUACP1R6Observe(func() (*opUACP1R6Source, error) { return a.source(8), nil }, func() (*opUACP1R6Source, error) { return b.source(8), nil })
			stop := field == "SID" || field == "SessionId"
			if (err != nil) != stop || r.Complete == stop || r.Relations[field] != "DIFFERENT" || r.Closed != 2 {
				t.Fatal("descriptive mismatch/gate conflated with authority")
			}
			if stop && (a.StatsCalls != 2 || b.StatsCalls != 2) {
				t.Fatal("unexpected account/session did not stop before second snapshots")
			}
		})
	}
	t.Run("Imp_observation_does_not_authorize", func(t *testing.T) {
		a, b := opUACP1R6FakeNew(1), opUACP1R6FakeNew(2)
		r, err := opUACP1R6Observe(func() (*opUACP1R6Source, error) { return a.source(8), nil }, func() (*opUACP1R6Source, error) { return b.source(8), nil })
		if err != nil || !r.Complete {
			t.Fatal("synthetic observation failed")
		}
		f := opFake01FixtureNew()
		f.p.Executor.Frame.Type = 2
		f.reapprove()
		m, result, err := newOperationIdentitySimulation(f.a, f.p, f.approval, f.clock.now, func() error { return nil })
		if err == nil || m != nil || result.State != operationIdentityRejected {
			t.Fatal("diagnostic result bypassed unchanged Primary-only policy")
		}
	})
}

func TestHUWINOperationIDUACP1R6PureReadRejections(t *testing.T) {
	for _, row := range []struct {
		name   string
		mutate func(*opUACP1R6Fake)
	}{
		{"unknown_type", func(f *opUACP1R6Fake) { f.Snapshot.Fields.stats.TokenType = 99 }},
		{"unknown_level", func(f *opUACP1R6Fake) { f.Snapshot.Fields.stats.Impersonation = 4 }},
		{"missing_TokenId", func(f *opUACP1R6Fake) { f.Snapshot.Fields.stats.TokenID = windows.LUID{} }},
		{"missing_AuthenticationId", func(f *opUACP1R6Fake) { f.Snapshot.Fields.stats.AuthenticationID = windows.LUID{} }},
		{"missing_ModifiedId", func(f *opUACP1R6Fake) { f.Snapshot.Fields.stats.ModifiedID = windows.LUID{} }},
		{"group_count", func(f *opUACP1R6Fake) { f.Snapshot.Fields.stats.GroupCount = 65537 }},
		{"privilege_count", func(f *opUACP1R6Fake) { f.Snapshot.Fields.stats.PrivilegeCount = 65537 }},
		{"missing_SID", func(f *opUACP1R6Fake) { f.Snapshot.Fields.user = nil }},
		{"missing_session", func(f *opUACP1R6Fake) { f.Snapshot.Fields.session = 0 }},
		{"invalid_integrity", func(f *opUACP1R6Fake) { f.Snapshot.Fields.integrity = 0 }},
		{"incomplete_restricting_SIDs", func(f *opUACP1R6Fake) { f.Snapshot.Fields.restricting = 1 }},
		{"type_class_mismatch", func(f *opUACP1R6Fake) { f.Snapshot.ObservedType = 1 }},
		{"elevation_inconsistent", func(f *opUACP1R6Fake) { f.Snapshot.Fields.elevation = 1 }},
		{"class21_unknown", func(f *opUACP1R6Fake) { f.Snapshot.Fields.filtered = 2 }},
		{"level_class_mismatch", func(f *opUACP1R6Fake) {
			f.After = func(c uint32, _ int, p *byte, _ uint32, _ *uint32) error {
				if c == windows.TokenImpersonationLevel {
					*p = 3
				}
				return nil
			}
		}},
		{"class21_wrong_length", func(f *opUACP1R6Fake) {
			f.After = func(c uint32, _ int, _ *byte, _ uint32, got *uint32) error {
				if c == windows.TokenHasRestrictions {
					*got = 4
				}
				return nil
			}
		}},
		{"class21_canary", func(f *opUACP1R6Fake) {
			f.After = func(c uint32, _ int, p *byte, _ uint32, _ *uint32) error {
				if c == windows.TokenHasRestrictions {
					*(*byte)(unsafe.Add(unsafe.Pointer(p), 4)) = 0
				}
				return nil
			}
		}},
		{"type_changed_inside_snapshot", func(f *opUACP1R6Fake) {
			f.Stats = func(call int, s opNative01Statistics) opNative01Statistics {
				if call == 2 {
					s.TokenType = 1
				}
				return s
			}
		}},
		{"identity_changed_inside_snapshot", func(f *opUACP1R6Fake) {
			f.Stats = func(call int, s opNative01Statistics) opNative01Statistics {
				if call == 2 {
					s.TokenID.LowPart++
				}
				return s
			}
		}},
	} {
		t.Run(row.name, func(t *testing.T) {
			f := opUACP1R6FakeNew(2)
			row.mutate(f)
			s, err := opUACP1R6Read(f.query, 2, false)
			if err == nil || s.Observed != 0 || len(s.Fields.user) != 0 {
				t.Fatal("incomplete diagnostic snapshot escaped")
			}
		})
	}
	for _, class := range []uint32{windows.TokenStatistics, windows.TokenType, windows.TokenSessionId, windows.TokenElevation, windows.TokenElevationType,
		windows.TokenImpersonationLevel, windows.TokenHasRestrictions, windows.TokenUser, windows.TokenIntegrityLevel, windows.TokenRestrictedSids, opNative01TokenIsAppContainer} {
		t.Run(fmt.Sprintf("API_denied_class_%d", class), func(t *testing.T) {
			f := opUACP1R6FakeNew(2)
			f.After = func(c uint32, _ int, _ *byte, _ uint32, _ *uint32) error {
				if c == class {
					return windows.ERROR_ACCESS_DENIED
				}
				return nil
			}
			if _, err := opUACP1R6Read(f.query, 2, false); err == nil {
				t.Fatal("API failure became complete")
			}
		})
	}
	t.Run("own_token_must_be_Primary", func(t *testing.T) {
		f := opUACP1R6FakeNew(2)
		if _, err := opUACP1R6Read(f.query, 1, true); err == nil || f.StatsCalls != 1 || f.LevelCalls != 0 {
			t.Fatal("own token contract relaxed")
		}
	})
}

func TestHUWINOperationIDUACP1R6PureBuffers(t *testing.T) {
	for _, row := range []struct {
		name   string
		fixed  uint32
		fault  string
		reject bool
	}{
		{"DWORD", 4, "", false}, {"statistics", 56, "", false}, {"variable", 0, "", false},
		{"unsupported", 8, "", true}, {"short_fixed", 4, "short", true}, {"long_fixed", 56, "long", true},
		{"short_variable", 0, "short", true}, {"sizing_zero", 0, "zero", true}, {"sizing_excessive", 0, "excessive", true},
		{"sizing_success", 0, "sizing_success", true}, {"sizing_API_denied", 0, "sizing_denied", true},
		{"payload_before", 4, "before", true}, {"payload_after", 56, "after", true},
		{"length_canary", 4, "length", true}, {"sizing_length_canary", 0, "sizing_length", true},
		{"native_error", 4, "denied", true}, {"non_Win32_error", 4, "opaque", true},
		{"error_plus_canary", 4, "combined", true},
	} {
		t.Run(row.name, func(t *testing.T) {
			calls := 0
			b, err := opUACP1R6Buffer(func(_ uint32, p *byte, n uint32, got *uint32) error {
				calls++
				if uintptr(unsafe.Pointer(got))%4 != 0 {
					t.Fatal("ReturnLength alignment")
				}
				if p == nil {
					*got = 28
					switch row.fault {
					case "zero":
						*got = 0
					case "excessive":
						*got = (1 << 20) + 1
					case "sizing_success":
						return nil
					case "sizing_denied":
						return windows.ERROR_ACCESS_DENIED
					case "sizing_length":
						*(*uint32)(unsafe.Add(unsafe.Pointer(got), 4)) = 0
					}
					return windows.ERROR_INSUFFICIENT_BUFFER
				}
				if uintptr(unsafe.Pointer(p))%8 != 0 {
					t.Fatal("query payload alignment")
				}
				*got = n
				switch row.fault {
				case "short":
					*got = n - 1
				case "long":
					*got = n + 1
				case "before":
					*(*byte)(unsafe.Add(unsafe.Pointer(p), -1)) = 0
				case "after", "combined":
					*(*byte)(unsafe.Add(unsafe.Pointer(p), uintptr(n))) = 0
				case "length":
					*(*uint32)(unsafe.Add(unsafe.Pointer(got), 4)) = 0
				case "denied":
					return windows.ERROR_ACCESS_DENIED
				case "opaque":
					return errors.New("synthetic sensitive contents must not escape")
				}
				if row.fault == "combined" {
					return windows.ERROR_ACCESS_DENIED
				}
				return nil
			}, windows.TokenUser, row.fixed)
			if (err != nil) != row.reject {
				t.Fatal("wrong guarded buffer result")
			}
			if row.reject && len(b.data()) != 0 {
				t.Fatal("failed buffer remained usable")
			}
			if err != nil && strings.Contains(err.Error(), "sensitive") {
				t.Fatal("raw query error exposed")
			}
			if calls > 2 {
				t.Fatal("unexpected query retry")
			}
			if row.fault == "combined" {
				if !strings.Contains(err.Error(), "Win32=5") || !strings.Contains(err.Error(), "output_canary") {
					t.Fatal("primary/guard error lost")
				}
			}
		})
	}
	t.Run("nil_query", func(t *testing.T) {
		if _, err := opUACP1R6Buffer(nil, windows.TokenStatistics, 56); err == nil {
			t.Fatal("missing query accepted")
		}
	})
	t.Run("R5_misalignment_remains_strict", func(t *testing.T) {
		words := make([]uint64, 8)
		data := unsafe.Slice((*byte)(unsafe.Pointer(&words[0])), 64)[1:57]
		_, err := opUACP1R5DecodeStatistics(data)
		opUACP1R5AssertReason(t, err, "structure", "stats_alignment")
	})
}

func TestHUWINOperationIDUACP1R6PureLifecycle(t *testing.T) {
	for _, name := range []string{"current_rights_missing", "current_rights_excess", "linked_rights_missing", "current_open_error", "linked_absent", "linked_open_error_with_owned_source", "current_query_error", "linked_query_error", "close_current_error", "close_linked_error", "primary_plus_close_error", "linked_alias", "current_not_Primary", "QA_context", "token_type_changed_repeat", "TokenId_changed_repeat", "AuthenticationId_changed_repeat", "ModifiedId_changed_repeat", "level_changed_repeat", "metadata_changed_repeat", "Primary_non_invariants", "dynamic_accounting"} {
		t.Run(name, func(t *testing.T) {
			a, b := opUACP1R6FakeNew(1), opUACP1R6FakeNew(2)
			x, y := a.source(8), b.source(8)
			openedLinked := 0
			switch name {
			case "current_rights_missing":
				x.Access = 0
			case "current_rights_excess":
				x.Access = 0xF01FF
			case "linked_rights_missing":
				y.Access = 0
			case "current_query_error":
				a.After = func(uint32, int, *byte, uint32, *uint32) error { return windows.ERROR_ACCESS_DENIED }
			case "linked_query_error", "primary_plus_close_error":
				b.After = func(uint32, int, *byte, uint32, *uint32) error { return windows.ERROR_ACCESS_DENIED }
			case "current_not_Primary":
				a.Snapshot.Fields.stats.TokenType, a.Snapshot.ObservedType = 2, 2
			case "QA_context":
				a.Snapshot.Fields.integrity = 0x3000
			case "token_type_changed_repeat", "TokenId_changed_repeat", "AuthenticationId_changed_repeat", "ModifiedId_changed_repeat", "level_changed_repeat", "dynamic_accounting":
				b.Stats = func(call int, s opNative01Statistics) opNative01Statistics {
					if call >= 3 {
						switch name {
						case "token_type_changed_repeat":
							s.TokenType = 1
						case "TokenId_changed_repeat":
							s.TokenID.LowPart++
						case "AuthenticationId_changed_repeat":
							s.AuthenticationID.LowPart++
						case "ModifiedId_changed_repeat":
							s.ModifiedID.LowPart++
						case "level_changed_repeat":
							s.Impersonation = 1
						case "dynamic_accounting":
							s.DynamicCharged++
							s.Available++
							s.Expiration = -1
						}
					}
					return s
				}
				if name == "level_changed_repeat" {
					b.After = func(c uint32, call int, p *byte, _ uint32, _ *uint32) error {
						if c == windows.TokenImpersonationLevel && call == 2 {
							*p = 1
						}
						return nil
					}
				}
			case "metadata_changed_repeat":
				b.After = func(c uint32, call int, p *byte, _ uint32, _ *uint32) error {
					if c == windows.TokenSessionId && call == 2 {
						*p = 2
					}
					return nil
				}
			case "Primary_non_invariants":
				a.Stats = func(call int, s opNative01Statistics) opNative01Statistics {
					s.Impersonation = uint32(call) * 99
					return s
				}
			}
			if name == "close_current_error" {
				a.CloseErr = errors.New("synthetic close")
			}
			if name == "close_linked_error" || name == "primary_plus_close_error" {
				b.CloseErr = errors.New("synthetic close")
			}
			r, err := opUACP1R6Observe(func() (*opUACP1R6Source, error) {
				if name == "current_open_error" {
					return x, opUACP1R6Reject("open_current", "api", "denied")
				}
				return x, nil
			}, func() (*opUACP1R6Source, error) {
				openedLinked++
				switch name {
				case "linked_absent":
					return nil, opUACP1R6Reject("linked", "api", "absent")
				case "linked_open_error_with_owned_source":
					return y, opUACP1R6Reject("linked", "api", "query_denied")
				case "linked_alias":
					return x, nil
				}
				return y, nil
			})
			valid := name == "Primary_non_invariants" || name == "dynamic_accounting"
			if (err == nil) != valid || r.Complete != valid || a.CloseCalls != 1 || b.CloseCalls > 1 || r.CloseAttempts != r.Owned {
				t.Fatal("flow did not fail closed or close exactly once")
			}
			if name == "primary_plus_close_error" && (!strings.Contains(err.Error(), "query_failed") || !strings.Contains(err.Error(), "close_failed")) {
				t.Fatal("primary/secondary close errors lost")
			}
			if name == "current_query_error" && openedLinked != 0 {
				t.Fatal("continued after current observation failed")
			}
			if name == "linked_query_error" {
				for _, value := range r.Relations {
					if value != "UNKNOWN" {
						t.Fatal("incomplete token relation escaped")
					}
				}
			}
		})
	}
	t.Run("nil_openers", func(t *testing.T) {
		if r, err := opUACP1R6Observe(nil, nil); err == nil || r.Owned != 0 {
			t.Fatal("missing openers accepted")
		}
	})
	for _, row := range []struct {
		name, value string
		env         []string
		ok          bool
	}{
		{"absent", "", nil, false}, {"wrong_value", "true", nil, false}, {"only_R6", "1", []string{"MANUS_OPERATION_ID_UAC_P1_R6_NATIVE=1"}, true},
		{"old_P1", "1", []string{"MANUS_OPERATION_ID_UAC_P1_NATIVE=1"}, false}, {"mutator", "1", []string{"MANUS_ROOT05CB1_NATIVE=1"}, false},
	} {
		t.Run("gate_"+row.name, func(t *testing.T) {
			if (opUACP1R6OptIn(row.value, row.env) == nil) != row.ok {
				t.Fatal("native opt-in isolation failure")
			}
		})
	}
}
