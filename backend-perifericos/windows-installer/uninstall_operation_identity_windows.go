//go:build windows

package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"reflect"
	"sync"
)

// Everything in this file is a simulation. There are no native adapters, OS
// handles, persistence, entropy sources, timers, process launches or callers.
// Fake-only authority implementations belong in _test.go, never product code.
type operationIdentitySimulationID [32]byte

// Symbols supplied by tests, not parsed/validated Windows SIDs.
type operationIdentitySimulatedSID string
type operationIdentityEvidenceSource uint8

const operationIdentityTestEvidence operationIdentityEvidenceSource = 1

type operationIdentitySimulatedHandle uint64
type operationIdentityLUID struct {
	Low  uint32
	High int32
}

type operationIdentityState string

const (
	operationIdentityProposed   operationIdentityState = "proposed"
	operationIdentityAuthorized operationIdentityState = "authorized"
	operationIdentityReserved   operationIdentityState = "reserved"
	operationIdentityClaimed    operationIdentityState = "claimed"
	operationIdentityAccepted   operationIdentityState = "accepted/pending"
	operationIdentityRunning    operationIdentityState = "running"
	operationIdentityRejected   operationIdentityState = "rejected"
	operationIdentityFailed     operationIdentityState = "failed"
	operationIdentityPartial    operationIdentityState = "partial"
	operationIdentityCompleted  operationIdentityState = "completed-simulated"
)

type operationIdentityTokenType uint8

const operationIdentityPrimary operationIdentityTokenType = 1

type operationIdentityIntegrity uint8

const (
	operationIdentityMedium operationIdentityIntegrity = 1
	operationIdentityHigh   operationIdentityIntegrity = 2
)

type operationIdentityElevation uint8

const (
	operationIdentityDefault operationIdentityElevation = 1
	operationIdentityFull    operationIdentityElevation = 2
	operationIdentityLimited operationIdentityElevation = 3
)

type operationIdentityMode uint8

const (
	operationIdentityStandard   operationIdentityMode = 1
	operationIdentitySilent     operationIdentityMode = 2
	operationIdentityRemoveData operationIdentityMode = 3
)

type operationIdentityTransition uint8

const (
	operationIdentityLinkedElevation operationIdentityTransition = 1
	operationIdentityAlreadyElevated operationIdentityTransition = 2
)

// CompleteMask covers user/type/statistics/session/integrity/elevation/thread/
// restrictions/groups/profile. These are injected facts, not actual NT queries.
const operationIdentityFrameMask uint32 = (1 << 10) - 1

type operationIdentityFrame struct {
	Schema                                               uint16
	Source                                               operationIdentityEvidenceSource
	CompleteMask                                         uint32
	Evidence                                             operationIdentitySimulationID
	SID                                                  operationIdentitySimulatedSID
	AuthenticationID, TokenID, ModifiedID, LinkedTokenID operationIdentityLUID
	SessionID                                            uint32
	Type                                                 operationIdentityTokenType
	Integrity                                            operationIdentityIntegrity
	Elevation                                            operationIdentityElevation
	Elevated, Impersonating, Restricted, Sandboxed       bool
	Interactive, ProfileKnown                            bool
	Profile, GroupsPrivileges                            operationIdentitySimulationID
}

type operationIdentityProcessBinding struct {
	Evidence operationIdentitySimulationID
	Ref      operationIdentitySimulatedHandle // A label, never convertible authority.
	PID      uint32
	Creation uint64
	Image    operationIdentitySimulationID
	Frame    operationIdentityFrame
}
type operationIdentityInstallation struct {
	Machine, Instance, Epoch, Evidence operationIdentitySimulationID
	Generation                         uint64
	Complete                           bool
}
type operationIdentityTarget struct {
	Name                string
	Root, Parent, Child managedRootFileIdentity // Reuse ROOT-01 value identities.
	RootRef, ParentRef  operationIdentitySimulatedHandle
	Ancestors           operationIdentitySimulationID
}
type operationIdentityPlan struct {
	Schema                                               uint16
	ID                                                   operationIdentitySimulationID // Injected, not generated/CSPRNG-certified.
	Installation                                         operationIdentityInstallation
	Initiator, Executor                                  operationIdentityProcessBinding
	Transition                                           operationIdentityTransition
	TransitionProof, ExpectedInitiator, ExpectedExecutor operationIdentitySimulationID
	ExpectedHelperImage                                  operationIdentitySimulationID
	Targets                                              []operationIdentityTarget
	Profile                                              operationIdentitySimulationID
	Mode                                                 operationIdentityMode
	Issued, Expires                                      int64 // Injected monotonic seconds, never wall clock.
}
type operationIdentityApproval struct {
	Source             operationIdentityEvidenceSource
	Intent             operationIdentitySimulationID
	ExplicitRemoveData bool
	Profile            operationIdentitySimulationID
}
type operationIdentitySimulationTime struct {
	Seconds int64
	Epoch   operationIdentitySimulationID
}
type operationIdentityHelperProof struct {
	Source                                           operationIdentityEvidenceSource
	Evidence, Intent, ExpectedHelper, ExpectedParent operationIdentitySimulationID
	DerivedFromExecutor                              bool
	Nonce, Epoch                                     operationIdentitySimulationID // Injected challenge, not a secret.
	Issued                                           int64
}
type operationIdentityEffects uint8

const (
	operationIdentityEffectsUnknown operationIdentityEffects = iota
	operationIdentityEffectsNone
	operationIdentityEffectsPresent
)

type operationIdentitySimulationRecord struct {
	Plan              operationIdentityPlan
	Intent            operationIdentitySimulationID
	Revision          uint64
	State             operationIdentityState
	Helper            operationIdentityProcessBinding
	Binding, Nonce    operationIdentitySimulationID
	LastTick, PhaseAt int64
	Ack               bool
	Effects           operationIdentityEffects
	Seal              operationIdentitySimulationID
}
type operationIdentitySimulationResult struct {
	State     operationIdentityState
	From      operationIdentityState
	Revision  uint64
	Simulated bool
	Reason    string
}

// This interface is deliberately sealed by naming, not a native security
// boundary. Only test-memory implementations exist. No returned value is a
// Windows authorization capability or durable transaction receipt.
type operationIdentitySimulationClaims interface {
	operationIdentitySimulationOnly()
	approveSimulation(operationIdentitySimulationID, operationIdentityApproval) error
	verifyHelperSimulation(operationIdentitySimulationID, operationIdentityProcessBinding, operationIdentityHelperProof) error
	reserveSimulation(operationIdentitySimulationRecord) (operationIdentitySimulationRecord, error)
	loadSimulation(operationIdentitySimulationID) (operationIdentitySimulationRecord, error)
	compareAndSwapSimulation(uint64, operationIdentitySimulationRecord) (operationIdentitySimulationRecord, error)
}
type operationIdentitySimulation struct {
	mu            sync.Mutex
	claims        operationIdentitySimulationClaims
	plan          operationIdentityPlan
	intent        operationIdentitySimulationID
	now           func() operationIdentitySimulationTime
	closeEvidence func() error // Owned fake evidence lease; no borrowed refs closed.
	closed        bool
	closeErr      error
}

func operationIdentityDigest(v any) (operationIdentitySimulationID, error) {
	data, err := json.Marshal(v) // Only immutable, typed data; no I/O.
	if err != nil {
		return operationIdentitySimulationID{}, err
	}
	return sha256.Sum256(data), nil
}
func cloneOperationIdentityPlan(p operationIdentityPlan) operationIdentityPlan {
	p.Targets = append([]operationIdentityTarget(nil), p.Targets...)
	return p
}
func cloneOperationIdentityRecord(r operationIdentitySimulationRecord) operationIdentitySimulationRecord {
	r.Plan = cloneOperationIdentityPlan(r.Plan)
	return r
}
func sealOperationIdentityRecord(r operationIdentitySimulationRecord) (operationIdentitySimulationRecord, error) {
	r.Seal = operationIdentitySimulationID{}
	sum, err := operationIdentityDigest(r)
	r.Seal = sum
	return r, err
}
func validOperationIdentityFrame(f operationIdentityFrame) bool {
	return f.Schema == 1 && f.Source == operationIdentityTestEvidence && f.CompleteMask == operationIdentityFrameMask &&
		f.Evidence != (operationIdentitySimulationID{}) && f.SID != "" &&
		f.SID != "S-1-5-18" && f.SID != "S-1-5-19" &&
		f.AuthenticationID != (operationIdentityLUID{}) && f.TokenID != (operationIdentityLUID{}) &&
		f.ModifiedID != (operationIdentityLUID{}) && f.SessionID != 0 &&
		f.Type == operationIdentityPrimary && !f.Impersonating && !f.Restricted && !f.Sandboxed &&
		f.Interactive && f.ProfileKnown && f.Profile != (operationIdentitySimulationID{}) &&
		f.GroupsPrivileges != (operationIdentitySimulationID{})
}
func validOperationIdentityProcess(p operationIdentityProcessBinding) bool {
	return p.Evidence != (operationIdentitySimulationID{}) && p.Ref != 0 && p.PID != 0 &&
		p.Creation != 0 && p.Image != (operationIdentitySimulationID{}) && validOperationIdentityFrame(p.Frame)
}
func sameOperationIdentityUser(a, b operationIdentityFrame) bool {
	return a.SID == b.SID && a.AuthenticationID == b.AuthenticationID &&
		a.SessionID == b.SessionID && a.Profile == b.Profile
}
func operationIdentityIsHigh(f operationIdentityFrame) bool {
	return f.Integrity == operationIdentityHigh && f.Elevation == operationIdentityFull && f.Elevated
}

func validateOperationIdentityPlan(p operationIdentityPlan, approval operationIdentityApproval, now operationIdentitySimulationTime) (operationIdentitySimulationID, error) {
	zero := operationIdentitySimulationID{}
	i, e := p.Initiator, p.Executor
	if p.Schema != 1 || p.ID == zero || !p.Installation.Complete || p.Installation.Machine == zero ||
		p.Installation.Instance == zero || p.Installation.Generation == 0 ||
		p.Installation.Evidence == zero || p.Installation.Epoch == zero ||
		p.Installation.Epoch != now.Epoch || p.Issued < 0 || now.Seconds < p.Issued ||
		p.Expires <= p.Issued || p.Expires-p.Issued > 300 || now.Seconds >= p.Expires ||
		!validOperationIdentityProcess(i) || !validOperationIdentityProcess(e) ||
		!sameOperationIdentityUser(i.Frame, e.Frame) || !operationIdentityIsHigh(e.Frame) ||
		p.Profile != i.Frame.Profile || p.ExpectedHelperImage == zero || p.TransitionProof == zero {
		return zero, errors.New("incomplete, expired or incompatible simulation plan/frame")
	}
	di, err := operationIdentityDigest(i)
	if err != nil {
		return zero, err
	}
	de, err := operationIdentityDigest(e)
	if err != nil {
		return zero, err
	}
	if di != p.ExpectedInitiator || de != p.ExpectedExecutor {
		return zero, errors.New("unproved expected process/frame binding")
	}
	switch p.Transition {
	case operationIdentityLinkedElevation:
		if i.Frame.Integrity != operationIdentityMedium || i.Frame.Elevated ||
			i.Frame.Elevation != operationIdentityLimited || i.Frame.LinkedTokenID != e.Frame.TokenID ||
			e.Frame.LinkedTokenID != i.Frame.TokenID {
			return zero, errors.New("linked elevation not proved")
		}
	case operationIdentityAlreadyElevated:
		if !operationIdentityIsHigh(i.Frame) {
			return zero, errors.New("already-elevated policy not met")
		}
	default:
		return zero, errors.New("unsupported elevation policy")
	}
	if len(p.Targets) == 0 || len(p.Targets) > 16 {
		return zero, errors.New("incomplete target scope")
	}
	seen := make(map[operationIdentityTarget]bool)
	for _, t := range p.Targets {
		if validateManagedTreeName(t.Name) != nil || t.RootRef == 0 || t.ParentRef == 0 || t.Ancestors == zero ||
			t.Root.VolumeSerialNumber == 0 || t.Parent.VolumeSerialNumber != t.Root.VolumeSerialNumber ||
			t.Child.VolumeSerialNumber != t.Root.VolumeSerialNumber || isZeroFileID(t.Root.FileID) ||
			isZeroFileID(t.Parent.FileID) || isZeroFileID(t.Child.FileID) || seen[t] {
			return zero, errors.New("invalid, duplicate or incomplete root/target binding")
		}
		seen[t] = true
	}
	if p.Mode != operationIdentityStandard && p.Mode != operationIdentitySilent && p.Mode != operationIdentityRemoveData {
		return zero, errors.New("unsupported data mode")
	}
	sum, err := operationIdentityDigest(p)
	if err != nil {
		return zero, err
	}
	if approval.Source != operationIdentityTestEvidence || approval.Intent != sum || approval.Profile != p.Profile ||
		(p.Mode == operationIdentityRemoveData && !approval.ExplicitRemoveData) ||
		(p.Mode != operationIdentityRemoveData && approval.ExplicitRemoveData) {
		return zero, errors.New("exact intent/profile/mode approval missing")
	}
	return sum, nil
}

// closeEvidence transfers ownership of a TEST-only evidence lease, even on
// rejection. There is no constructor for a native claims implementation.
func newOperationIdentitySimulation(claims operationIdentitySimulationClaims, p operationIdentityPlan, approval operationIdentityApproval, now func() operationIdentitySimulationTime, closeEvidence func() error) (_ *operationIdentitySimulation, result operationIdentitySimulationResult, retErr error) {
	result = operationIdentitySimulationResult{From: operationIdentityProposed, State: operationIdentityRejected, Simulated: true}
	defer func() {
		if retErr != nil && closeEvidence != nil {
			retErr = errors.Join(retErr, closeEvidence())
		}
	}()
	if claims == nil || (reflect.ValueOf(claims).Kind() == reflect.Ptr && reflect.ValueOf(claims).IsNil()) ||
		now == nil || closeEvidence == nil {
		return nil, result, errors.New("fake authority, clock and owned fake evidence required")
	}
	p = cloneOperationIdentityPlan(p)
	sum, err := validateOperationIdentityPlan(p, approval, now())
	if err != nil {
		return nil, result, err
	}
	if err = claims.approveSimulation(sum, approval); err != nil {
		return nil, result, err
	}
	return &operationIdentitySimulation{claims: claims, plan: p, intent: sum, now: now, closeEvidence: closeEvidence},
		operationIdentitySimulationResult{From: operationIdentityProposed, State: operationIdentityAuthorized, Simulated: true}, nil
}
func (m *operationIdentitySimulation) Close(primary error) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.closed {
		m.closed = true
		m.closeErr = m.closeEvidence()
	}
	return errors.Join(primary, m.closeErr) // Idempotent closure; never unlock a claim.
}
func (m *operationIdentitySimulation) result(r operationIdentitySimulationRecord, reason string) operationIdentitySimulationResult {
	return operationIdentitySimulationResult{State: r.State, Revision: r.Revision, Simulated: true, Reason: reason}
}
func operationIdentityTerminal(s operationIdentityState) bool {
	return s == operationIdentityRejected || s == operationIdentityFailed || s == operationIdentityPartial || s == operationIdentityCompleted
}
func (m *operationIdentitySimulation) load() (operationIdentitySimulationRecord, operationIdentitySimulationTime, error) {
	if m.closed {
		return operationIdentitySimulationRecord{}, operationIdentitySimulationTime{}, errors.New("simulation closed")
	}
	r, err := m.claims.loadSimulation(m.plan.ID)
	if err != nil {
		return r, operationIdentitySimulationTime{}, err
	}
	sum, err := sealOperationIdentityRecord(r)
	if err != nil || sum.Seal != r.Seal || r.Revision == 0 || r.Intent != m.intent {
		return r, operationIdentitySimulationTime{}, errors.New("corrupt or foreign simulation record")
	}
	d, err := operationIdentityDigest(r.Plan)
	if err != nil || d != m.intent {
		return r, operationIdentitySimulationTime{}, errors.New("intent changed")
	}
	now := m.now()
	if now.Epoch != m.plan.Installation.Epoch || now.Seconds < r.LastTick || now.Seconds >= m.plan.Expires {
		return r, now, errors.New("expired, restarted or regressed simulation clock")
	}
	return r, now, nil
}
func (m *operationIdentitySimulation) Reserve() (operationIdentitySimulationResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return operationIdentitySimulationResult{State: operationIdentityRejected, Simulated: true}, errors.New("simulation closed")
	}
	now := m.now()
	if now.Epoch != m.plan.Installation.Epoch || now.Seconds < m.plan.Issued || now.Seconds >= m.plan.Expires {
		return operationIdentitySimulationResult{State: operationIdentityRejected, Simulated: true}, errors.New("expired/restarted offer")
	}
	r, err := sealOperationIdentityRecord(operationIdentitySimulationRecord{Plan: cloneOperationIdentityPlan(m.plan),
		Intent: m.intent, Revision: 1, State: operationIdentityReserved, LastTick: now.Seconds,
		Effects: operationIdentityEffectsNone})
	if err == nil {
		r, err = m.claims.reserveSimulation(r)
	}
	if err != nil {
		return operationIdentitySimulationResult{State: operationIdentityRejected, Simulated: true, Reason: "reservation rejected; winning record unchanged"}, err
	}
	return m.result(r, "reservation is not a claim or acceptance"), err
}
func (m *operationIdentitySimulation) commit(before, next operationIdentitySimulationRecord) (operationIdentitySimulationResult, error) {
	next.Revision = before.Revision + 1
	if next.Revision == 0 {
		return m.result(before, "revision overflow"), errors.New("revision overflow")
	}
	next, err := sealOperationIdentityRecord(next)
	if err == nil {
		next, err = m.claims.compareAndSwapSimulation(before.Revision, next)
	}
	if err != nil {
		return m.result(before, "claim unchanged; no retry authority"), err
	}
	result := m.result(next, "simulation only; no native authority")
	result.From = before.State
	return result, nil
}
func (m *operationIdentitySimulation) BindHelper(h operationIdentityProcessBinding, proof operationIdentityHelperProof) (operationIdentitySimulationResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, now, err := m.load()
	if err != nil {
		return operationIdentitySimulationResult{State: operationIdentityPartial, Simulated: true}, err
	}
	if r.State != operationIdentityReserved {
		return m.result(r, "invalid binding transition"), errors.New("claim already bound or terminal")
	}
	helperDigest, err := operationIdentityDigest(h)
	if err != nil {
		return m.result(r, "digest failed"), err
	}
	parentDigest, err := operationIdentityDigest(m.plan.Executor)
	if err != nil {
		return m.result(r, "digest failed"), err
	}
	zero := operationIdentitySimulationID{}
	if !validOperationIdentityProcess(h) || !operationIdentityIsHigh(h.Frame) ||
		!sameOperationIdentityUser(m.plan.Executor.Frame, h.Frame) || h.Image != m.plan.ExpectedHelperImage ||
		h.Ref == m.plan.Executor.Ref || h.PID == m.plan.Executor.PID ||
		proof.Source != operationIdentityTestEvidence || proof.Evidence == zero || !proof.DerivedFromExecutor || proof.Intent != m.intent ||
		proof.ExpectedHelper != helperDigest || proof.ExpectedParent != parentDigest ||
		proof.Nonce == zero || proof.Epoch != now.Epoch || proof.Issued < r.LastTick ||
		proof.Issued > now.Seconds || now.Seconds-proof.Issued >= 30 {
		return m.result(r, "helper/peer/challenge rejected"), errors.New("unproved helper or challenge")
	}
	if err = m.claims.verifyHelperSimulation(m.intent, h, proof); err != nil {
		return m.result(r, "helper evidence not approved by fake authority"), err
	}
	next := r
	next.Helper = h
	next.Nonce = proof.Nonce
	next.State = operationIdentityClaimed
	next.PhaseAt = proof.Issued
	next.LastTick = now.Seconds
	next.Binding, err = operationIdentityDigest(struct {
		Intent operationIdentitySimulationID
		Helper operationIdentityProcessBinding
		Nonce  operationIdentitySimulationID
	}{m.intent, h, proof.Nonce})
	if err != nil {
		return m.result(r, "binding digest failed"), err
	}
	return m.commit(r, next)
}

type operationIdentityEvent uint8

const (
	operationIdentityAccept operationIdentityEvent = iota + 1
	operationIdentityAck
	operationIdentityAckLost
	operationIdentityParentExited
	operationIdentityEffect
	operationIdentityEffectUncertain
	operationIdentityFinish
	operationIdentityFailure
	operationIdentityCrash
	operationIdentityTimeout
	operationIdentityReboot
	operationIdentityCorruption
)
const operationIdentityPostconditions uint32 = (1 << 7) - 1 // process/service/payload/retention/registry/TEMP/result.
type operationIdentityEventProof struct {
	Evidence, Binding, Parent                          operationIdentitySimulationID
	ExpectedRevision                                   uint64
	ParentWait                                         operationIdentityParentWaitEvidence
	NoEffectsProved, WorkerInactive, MemoryResultSaved bool
	Postconditions                                     uint32
}

// Parent wait outcomes are injected simulation evidence only. In particular,
// failed OpenProcess lookups never mean that the expected parent exited.
type operationIdentityParentWaitEvidence uint8

const (
	operationIdentityParentWaitUnknown operationIdentityParentWaitEvidence = iota
	operationIdentityParentWaitExpectedHandleSignaled
	operationIdentityParentWaitPIDNotFound
	operationIdentityParentWaitOpenAccessDenied
	operationIdentityParentWaitOpenFailed
	operationIdentityParentWaitIdentityMismatch
	operationIdentityParentWaitTimedOut
	operationIdentityParentWaitFailed
	operationIdentityParentWaitUnexpected
)

func (m *operationIdentitySimulation) Advance(event operationIdentityEvent, p operationIdentityEventProof) (operationIdentitySimulationResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, now, err := m.load()
	if err != nil {
		return operationIdentitySimulationResult{State: operationIdentityPartial, Simulated: true}, err
	}
	if operationIdentityTerminal(r.State) {
		return m.result(r, "terminal immutable"), errors.New("terminal replay")
	}
	if p.Evidence == (operationIdentitySimulationID{}) || p.ExpectedRevision != r.Revision || p.Binding != r.Binding {
		return m.result(r, "foreign/replayed event"), errors.New("event evidence/revision/binding mismatch")
	}
	next := r
	next.LastTick = now.Seconds
	invalid := func() (operationIdentitySimulationResult, error) {
		return m.result(r, "invalid transition"), errors.New("invalid or incomplete transition")
	}
	switch event {
	case operationIdentityAccept:
		if r.State != operationIdentityClaimed || now.Seconds-r.PhaseAt >= 30 {
			return invalid()
		}
		next.State = operationIdentityAccepted
	case operationIdentityAck:
		if r.State != operationIdentityAccepted || r.Ack || now.Seconds-r.PhaseAt >= 30 {
			return invalid()
		}
		next.Ack = true
		next.PhaseAt = now.Seconds // Bounded parent wait starts after ACK, not before it.
	case operationIdentityAckLost:
		if r.State != operationIdentityAccepted || r.Ack {
			return invalid()
		} // Still nonterminal, nonce consumed.
	case operationIdentityParentExited:
		parent, err := operationIdentityDigest(m.plan.Executor)
		if err != nil {
			return invalid()
		}
		if r.State != operationIdentityAccepted || !r.Ack ||
			p.ParentWait != operationIdentityParentWaitExpectedHandleSignaled || p.Parent != parent ||
			now.Seconds-r.PhaseAt >= 30 {
			return invalid()
		}
		next.State = operationIdentityRunning
	case operationIdentityEffect, operationIdentityEffectUncertain:
		if r.State != operationIdentityRunning {
			return invalid()
		}
		next.Effects = operationIdentityEffectsPresent
		if event == operationIdentityEffectUncertain || r.Effects == operationIdentityEffectsUnknown {
			next.Effects = operationIdentityEffectsUnknown
		}
	case operationIdentityFinish:
		if r.State != operationIdentityRunning || r.Effects == operationIdentityEffectsUnknown ||
			p.Postconditions != operationIdentityPostconditions || !p.WorkerInactive || !p.MemoryResultSaved {
			return invalid()
		}
		next.State = operationIdentityCompleted
	case operationIdentityFailure, operationIdentityCrash, operationIdentityTimeout, operationIdentityReboot, operationIdentityCorruption:
		next.State = operationIdentityPartial
		if event != operationIdentityReboot && event != operationIdentityCorruption &&
			p.NoEffectsProved && p.WorkerInactive && r.Effects == operationIdentityEffectsNone {
			next.State = operationIdentityFailed
		}
	default:
		return invalid()
	}
	return m.commit(r, next)
}
