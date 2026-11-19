package main

// Task 14.4a deterministic tests. Synthetic fixture versions only; no real
// qa.16/qa.17 identity, host path, service, registry, ACL or device is used.

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows/svc"
)

func txDigest(label string) string {
	sum := sha256.Sum256([]byte("14.4a-fixture:" + label))
	return hex.EncodeToString(sum[:])
}

func txFixtureLayout() runtimeLayout {
	root := `C:\Fixture Program Files\Manus`
	return runtimeLayout{
		InstallRoot:     root + `\PeripheralAgent`,
		VersionsRoot:    root + `\PeripheralAgent\versions`,
		CurrentRoot:     root + `\PeripheralAgent\current`,
		VersionRoot:     root + `\PeripheralAgent\versions\9.0.0-fixture.2`,
		POSInstallRoot:  root + `\POS`,
		POSVersionsRoot: root + `\POS\versions`,
		POSCurrentRoot:  root + `\POS\current`,
		POSVersionRoot:  root + `\POS\versions\9.1.0-fixture.2`,
	}
}

func txFixtureManifest() installerManifest {
	return installerManifest{
		Version:         "9.0.0-fixture.2",
		PosVersion:      "9.1.0-fixture.2",
		ServiceName:     serviceName,
		ServiceAccount:  "NT AUTHORITY\\LocalService",
		ServiceArgs:     []string{"service"},
		DisplayName:     "Fixture",
		VersionFileName: "VERSION.json",
	}
}

func txFixtureApproval() installTransitionApproval {
	return installTransitionApproval{
		ID:                      "fixture-1-to-2",
		CandidateArtifactSHA256: txDigest("artifact-2"),
		SourceAgent:             installTransitionArtifact{Version: "9.0.0-fixture.1", PayloadDigest: txDigest("agent-1")},
		TargetAgent:             installTransitionArtifact{Version: "9.0.0-fixture.2", PayloadDigest: txDigest("agent-2")},
		SourcePOS:               installTransitionArtifact{Version: "9.1.0-fixture.1", PayloadDigest: txDigest("pos-1")},
		TargetPOS:               installTransitionArtifact{Version: "9.1.0-fixture.2", PayloadDigest: txDigest("pos-2")},
		ServiceAccount:          "NT AUTHORITY\\LocalService",
		QAEnvironment:           txDigest("qa-environment"),
	}
}

func txFixtureProtected() []installTransitionProtectedItem {
	items := make([]installTransitionProtectedItem, 0, len(installTransitionRequiredProtected))
	for _, kind := range installTransitionRequiredProtected {
		items = append(items, installTransitionProtectedItem{Kind: kind, Presence: installEvidencePresent, SHA256: txDigest("protected-" + string(kind))})
	}
	return items
}

func txFixtureEvidence(m installerManifest, l runtimeLayout, a installTransitionApproval) installTransitionEvidence {
	sourceRoot := filepath.Join(l.VersionsRoot, a.SourceAgent.Version)
	sourcePOS := filepath.Join(l.POSVersionsRoot, a.SourcePOS.Version)
	command := buildUninstallMetadata(l, m, time.Time{})["UninstallString"]
	return installTransitionEvidence{
		CandidateArtifactSHA256: a.CandidateArtifactSHA256,
		InstalledAgent:          a.SourceAgent,
		CandidateAgent:          a.TargetAgent,
		InstalledPOS:            a.SourcePOS,
		CandidatePOS:            a.TargetPOS,
		Service: installAdmissionService{
			Presence: installEvidencePresent,
			Account:  "NT AUTHORITY\\LocalService",
			Binary:   buildServiceBinaryPath(filepath.Join(sourceRoot, "ManusTerminalSetup.exe"), "service"),
			State:    svc.Running,
			PID:      4242,
		},
		AgentCurrent:    installAdmissionPath{Presence: installEvidencePresent, Directory: true, Target: sourceRoot, Fingerprint: "agent-current"},
		POSCurrent:      installAdmissionPath{Presence: installEvidencePresent, Directory: true, Target: sourcePOS, Fingerprint: "pos-current"},
		TargetAgentRoot: installAdmissionPath{Presence: installEvidenceAbsent, Fingerprint: "absent:agent-target"},
		TargetPOSRoot:   installAdmissionPath{Presence: installEvidenceAbsent, Fingerprint: "absent:pos-target"},
		Registration: installAdmissionRegistration{
			Presence:  installEvidencePresent,
			Version:   a.SourceAgent.Version,
			Location:  l.CurrentRoot,
			Uninstall: command,
			Quiet:     command,
		},
		QAEnvironment:  a.QAEnvironment,
		ProtectedState: txFixtureProtected(),
	}
}

func txFixture() (installerManifest, runtimeLayout, []installTransitionApproval, installTransitionEvidence) {
	m, l, a := txFixtureManifest(), txFixtureLayout(), txFixtureApproval()
	return m, l, []installTransitionApproval{a}, txFixtureEvidence(m, l, a)
}

func txCloneEvidence(ev installTransitionEvidence) installTransitionEvidence {
	ev.ProtectedState = append([]installTransitionProtectedItem(nil), ev.ProtectedState...)
	return ev
}

func txAssertRejected(t *testing.T, approvals []installTransitionApproval, l runtimeLayout, d installTransitionDecision, err error, state installAdmissionState, reason string) {
	t.Helper()
	if err == nil {
		t.Fatalf("rejection expected, got eligible decision %+v", d)
	}
	if d.State != state || d.Reason != reason || d.Eligible || d.ExecutionPermitted || d.ApprovalID != "" {
		t.Fatalf("decision=%+v error=%v, want %s/%s", d, err, state, reason)
	}
	var admission *installAdmissionError
	if !errors.As(err, &admission) || admission.State != state || admission.Reason != reason {
		t.Fatalf("error does not carry decision: %v", err)
	}
	plan, planErr := buildInstallTransitionPlan(d, approvals, l)
	if planErr == nil || !reflect.DeepEqual(plan, installTransitionPlan{}) {
		t.Fatalf("rejected decision produced a plan: %+v", plan)
	}
	if requireInstallTransitionExecution(d) == nil {
		t.Fatal("rejected decision permitted execution")
	}
}

func TestHUWIN144aProductionAllowlistEmptyAndExecutionDisabled(t *testing.T) {
	if len(approvedInstallTransitions) != 0 {
		t.Fatalf("production allowlist must stay empty until C-2, 14.4b and 14.4c: %d entries", len(approvedInstallTransitions))
	}
	if installTransitionExecutionEnabled {
		t.Fatal("update execution must stay disabled in 14.4a")
	}
	m, l, _, ev := txFixture()
	d, err := classifyInstallTransition(approvedInstallTransitions, m, l, ev)
	txAssertRejected(t, approvedInstallTransitions, l, d, err, installAdmissionUnknown, "transition_unproven")
}

func TestHUWIN144aRealQA16ToQA17RemainsUnsupported(t *testing.T) {
	m, l, approvals, ev := txFixture()
	m.Version, m.PosVersion = "0.1.1-qa.17", "0.1.0"
	ev.InstalledAgent = installTransitionArtifact{Version: "0.1.1-qa.16", PayloadDigest: txDigest("observed-qa16")}
	ev.CandidateAgent = installTransitionArtifact{Version: "0.1.1-qa.17", PayloadDigest: txDigest("observed-qa17")}
	ev.InstalledPOS = installTransitionArtifact{Version: "0.1.0", PayloadDigest: txDigest("observed-pos-16")}
	ev.CandidatePOS = installTransitionArtifact{Version: "0.1.0", PayloadDigest: txDigest("observed-pos-17")}
	for _, list := range [][]installTransitionApproval{approvedInstallTransitions, approvals} {
		d, err := classifyInstallTransition(list, m, l, ev)
		txAssertRejected(t, list, l, d, err, installAdmissionUnknown, "pos_label_collision")
	}
}

// C-2 determination for the frozen Build 09 candidate: the installed Build 07 (qa.16) and
// Build 09 (qa.18, sha256 863bfe99...) both ship POS 0.1.0 with different bytes, so the
// pair is unsupported and a certifiable target needs a distinct, hash-pinned POS identity.
func TestHUWIN144aRealQA16ToQA18RemainsUnsupported(t *testing.T) {
	m, l, approvals, ev := txFixture()
	m.Version, m.PosVersion = "0.1.1-qa.18", "0.1.0"
	ev.InstalledAgent = installTransitionArtifact{Version: "0.1.1-qa.16", PayloadDigest: txDigest("observed-qa16")}
	ev.CandidateAgent = installTransitionArtifact{Version: "0.1.1-qa.18", PayloadDigest: txDigest("observed-qa18")}
	ev.InstalledPOS = installTransitionArtifact{Version: "0.1.0", PayloadDigest: txDigest("observed-pos-16")}
	ev.CandidatePOS = installTransitionArtifact{Version: "0.1.0", PayloadDigest: txDigest("observed-pos-18")}
	for _, list := range [][]installTransitionApproval{approvedInstallTransitions, approvals} {
		d, err := classifyInstallTransition(list, m, l, ev)
		txAssertRejected(t, list, l, d, err, installAdmissionUnknown, "pos_label_collision")
	}
}

// C-2 compatibility with the independent POS version contract: an installed POS 0.1.0
// (qa.16) moving to the distinct POS 0.1.1 is not a label collision. With an exact fixture
// approval it is only eligible; execution stays disabled, and the empty production
// allowlist still rejects it.
func TestHUWIN144aDistinctPOSLabelsAreEligibleButNotExecutable(t *testing.T) {
	m, l, approvals, ev := txFixture()
	a := approvals[0]
	a.SourcePOS = installTransitionArtifact{Version: "0.1.0", PayloadDigest: txDigest("pos-qa16")}
	a.TargetPOS = installTransitionArtifact{Version: "0.1.1", PayloadDigest: txDigest("pos-next")}
	m.PosVersion = a.TargetPOS.Version
	l.POSVersionRoot = filepath.Join(l.POSVersionsRoot, a.TargetPOS.Version)
	ev.InstalledPOS, ev.CandidatePOS = a.SourcePOS, a.TargetPOS
	ev.POSCurrent.Target = filepath.Join(l.POSVersionsRoot, a.SourcePOS.Version)
	approved := []installTransitionApproval{a}
	d, err := classifyInstallTransition(approved, m, l, ev)
	if err != nil || d.State != installAdmissionUpdate || d.Reason != "approved_exact_pair" || !d.Eligible {
		t.Fatalf("distinct POS labels: decision=%+v error=%v", d, err)
	}
	if d.ExecutionPermitted {
		t.Fatal("eligibility must not permit execution")
	}
	var admission *installAdmissionError
	if err := requireInstallTransitionExecution(d); !errors.As(err, &admission) || admission.Reason != "update_execution_disabled" {
		t.Fatalf("execution gate = %v", err)
	}
	if d, err := classifyInstallTransition(approvedInstallTransitions, m, l, ev); err == nil || d.Eligible {
		t.Fatalf("empty production allowlist must reject: decision=%+v error=%v", d, err)
	}
	// The same POS 0.1.0 label with other bytes remains a collision.
	m.PosVersion = a.SourcePOS.Version
	l.POSVersionRoot = filepath.Join(l.POSVersionsRoot, a.SourcePOS.Version)
	ev.CandidatePOS = installTransitionArtifact{Version: a.SourcePOS.Version, PayloadDigest: txDigest("pos-other-bytes")}
	d, err = classifyInstallTransition(approved, m, l, ev)
	txAssertRejected(t, approved, l, d, err, installAdmissionUnknown, "pos_label_collision")
}

func TestHUWIN144aAcceptsSyntheticExactPairWithoutExecution(t *testing.T) {
	m, l, approvals, ev := txFixture()
	for _, state := range []svc.State{svc.Running, svc.Stopped} {
		candidate := txCloneEvidence(ev)
		candidate.Service.State = state
		if state == svc.Stopped {
			candidate.Service.PID = 0
		}
		d, err := classifyInstallTransition(approvals, m, l, candidate)
		if err != nil || d.State != installAdmissionUpdate || d.Reason != "approved_exact_pair" || !d.Eligible || d.ApprovalID != "fixture-1-to-2" {
			t.Fatalf("state %v: decision=%+v error=%v", state, d, err)
		}
		if d.ExecutionPermitted {
			t.Fatal("eligibility must not permit execution")
		}
		var admission *installAdmissionError
		if err := requireInstallTransitionExecution(d); !errors.As(err, &admission) || admission.Reason != "update_execution_disabled" {
			t.Fatalf("execution gate = %v", err)
		}
	}
	// A legacy quiet command is observed only; it is never consent.
	legacy := txCloneEvidence(ev)
	legacy.Registration.Quiet += " --remove-data"
	if d, err := classifyInstallTransition(approvals, m, l, legacy); err != nil || !d.Eligible {
		t.Fatalf("legacy quiet observation: %+v %v", d, err)
	}
}

func TestHUWIN144aRejectionMatrix(t *testing.T) {
	m, l, approvals, base := txFixture()
	a := approvals[0]
	cases := []struct {
		name   string
		mutate func(*installTransitionEvidence, *installerManifest)
		state  installAdmissionState
		reason string
	}{
		{"unknown_source_version", func(e *installTransitionEvidence, _ *installerManifest) {
			e.InstalledAgent.Version = "9.0.0-fixture.0"
		}, installAdmissionUnknown, "transition_unproven"},
		{"unknown_target_version", func(e *installTransitionEvidence, m *installerManifest) {
			e.CandidateAgent.Version, m.Version = "9.0.0-fixture.3", "9.0.0-fixture.3"
		}, installAdmissionUnknown, "target_unapproved"},
		{"candidate_metadata_disagrees_with_manifest", func(e *installTransitionEvidence, _ *installerManifest) {
			e.CandidateAgent.Version = "9.0.0-fixture.3"
		}, installAdmissionUnknown, "candidate_metadata_mismatch"},
		{"same_agent_version_is_repair_territory", func(e *installTransitionEvidence, _ *installerManifest) {
			e.InstalledAgent = e.CandidateAgent
		}, installAdmissionUnknown, "transition_not_update"},
		{"source_agent_hash_mismatch", func(e *installTransitionEvidence, _ *installerManifest) {
			e.InstalledAgent.PayloadDigest = txDigest("tampered-agent-1")
		}, installAdmissionUnknown, "source_bytes_differ"},
		{"candidate_agent_hash_mismatch", func(e *installTransitionEvidence, _ *installerManifest) {
			e.CandidateAgent.PayloadDigest = txDigest("tampered-agent-2")
		}, installAdmissionUnknown, "candidate_bytes_differ"},
		{"source_pos_other_version", func(e *installTransitionEvidence, _ *installerManifest) {
			e.InstalledPOS.Version = "9.1.0-fixture.0"
		}, installAdmissionUnknown, "pos_source_mismatch"},
		{"source_pos_hash_mismatch", func(e *installTransitionEvidence, _ *installerManifest) {
			e.InstalledPOS.PayloadDigest = txDigest("tampered-pos-1")
		}, installAdmissionUnknown, "pos_source_bytes_differ"},
		{"target_pos_unapproved", func(e *installTransitionEvidence, m *installerManifest) {
			e.CandidatePOS.Version, m.PosVersion = "9.1.0-fixture.3", "9.1.0-fixture.3"
		}, installAdmissionUnknown, "pos_target_unapproved"},
		{"candidate_pos_hash_mismatch", func(e *installTransitionEvidence, _ *installerManifest) {
			e.CandidatePOS.PayloadDigest = txDigest("tampered-pos-2")
		}, installAdmissionUnknown, "pos_candidate_bytes_differ"},
		{"pos_byte_collision_same_label", func(e *installTransitionEvidence, m *installerManifest) {
			e.CandidatePOS.Version, m.PosVersion = e.InstalledPOS.Version, e.InstalledPOS.Version
		}, installAdmissionUnknown, "pos_label_collision"},
		{"pos_label_collision_case_insensitive", func(e *installTransitionEvidence, m *installerManifest) {
			e.InstalledPOS.Version = "9.1.0-FIXTURE.2"
		}, installAdmissionUnknown, "pos_label_collision"},
		{"pos_identity_unchanged", func(e *installTransitionEvidence, m *installerManifest) {
			e.CandidatePOS, m.PosVersion = e.InstalledPOS, e.InstalledPOS.Version
		}, installAdmissionUnknown, "pos_identity_unchanged"},
		{"artifact_provenance_mismatch", func(e *installTransitionEvidence, _ *installerManifest) {
			e.CandidateArtifactSHA256 = txDigest("other-artifact")
		}, installAdmissionUnknown, "artifact_provenance_mismatch"},
		{"qa_environment_mismatch", func(e *installTransitionEvidence, _ *installerManifest) {
			e.QAEnvironment = txDigest("prd-environment")
		}, installAdmissionUnknown, "qa_environment_mismatch"},
		{"service_identity_local_system", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Service.Account = "LocalSystem"
		}, installAdmissionPartial, "service_identity_changed"},
		{"service_identity_network_service", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Service.Account = "NT AUTHORITY\\NetworkService"
		}, installAdmissionPartial, "service_identity_changed"},
		{"service_binary_target_version", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Service.Binary = buildServiceBinaryPath(filepath.Join(l.VersionsRoot, a.TargetAgent.Version, "ManusTerminalSetup.exe"), "service")
		}, installAdmissionPartial, "service_registration_mismatch"},
		{"service_pending", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Service.State = svc.StartPending
		}, installAdmissionUnknown, "service_state_uncertain"},
		{"service_running_without_pid", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Service.PID = 0
		}, installAdmissionUnknown, "service_state_uncertain"},
		{"service_stopped_with_pid", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Service.State = svc.Stopped
		}, installAdmissionUnknown, "service_state_uncertain"},
		{"service_absent", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Service = installAdmissionService{Presence: installEvidenceAbsent}
		}, installAdmissionPartial, "incomplete_footprints"},
		{"service_unknown", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Service.Presence = installEvidenceUnknown
		}, installAdmissionUnknown, "system_observation_incomplete"},
		{"agent_junction_substituted", func(e *installTransitionEvidence, _ *installerManifest) {
			e.AgentCurrent.Target = filepath.Join(l.VersionsRoot, a.TargetAgent.Version)
		}, installAdmissionPartial, "activation_mismatch"},
		{"agent_junction_outside_versions", func(e *installTransitionEvidence, _ *installerManifest) {
			e.AgentCurrent.Target = `C:\Elsewhere\9.0.0-fixture.1`
		}, installAdmissionPartial, "activation_mismatch"},
		{"agent_junction_not_directory", func(e *installTransitionEvidence, _ *installerManifest) {
			e.AgentCurrent.Directory = false
		}, installAdmissionPartial, "activation_mismatch"},
		{"agent_junction_empty_target", func(e *installTransitionEvidence, _ *installerManifest) {
			e.AgentCurrent.Target = ""
		}, installAdmissionPartial, "activation_mismatch"},
		{"pos_junction_substituted", func(e *installTransitionEvidence, _ *installerManifest) {
			e.POSCurrent.Target = filepath.Join(l.POSVersionsRoot, a.TargetPOS.Version)
		}, installAdmissionPartial, "pos_activation_mismatch"},
		{"agent_junction_absent", func(e *installTransitionEvidence, _ *installerManifest) {
			e.AgentCurrent = installAdmissionPath{Presence: installEvidenceAbsent, Fingerprint: "absent"}
		}, installAdmissionPartial, "incomplete_footprints"},
		{"junction_unknown", func(e *installTransitionEvidence, _ *installerManifest) {
			e.POSCurrent.Presence = installEvidenceUnknown
		}, installAdmissionUnknown, "path_observation_incomplete"},
		{"junction_identity_missing", func(e *installTransitionEvidence, _ *installerManifest) {
			e.AgentCurrent.Fingerprint = ""
		}, installAdmissionUnknown, "path_observation_incomplete"},
		{"registration_version", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Registration.Version = a.TargetAgent.Version
		}, installAdmissionPartial, "registration_mismatch"},
		{"registration_location", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Registration.Location = `C:\Other`
		}, installAdmissionPartial, "registration_mismatch"},
		{"registration_command", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Registration.Uninstall += " --other"
		}, installAdmissionPartial, "registration_command_mismatch"},
		{"registration_quiet_unexpected", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Registration.Quiet += " --unexpected"
		}, installAdmissionPartial, "registration_command_mismatch"},
		{"registration_absent", func(e *installTransitionEvidence, _ *installerManifest) {
			e.Registration = installAdmissionRegistration{Presence: installEvidenceAbsent}
		}, installAdmissionPartial, "incomplete_footprints"},
		{"target_agent_root_present", func(e *installTransitionEvidence, _ *installerManifest) {
			e.TargetAgentRoot = installAdmissionPath{Presence: installEvidencePresent, Directory: true, Fingerprint: "present"}
		}, installAdmissionPartial, "target_root_present"},
		{"target_pos_root_present", func(e *installTransitionEvidence, _ *installerManifest) {
			e.TargetPOSRoot = installAdmissionPath{Presence: installEvidencePresent, Directory: true, Fingerprint: "present"}
		}, installAdmissionPartial, "target_root_present"},
		{"target_root_unknown", func(e *installTransitionEvidence, _ *installerManifest) {
			e.TargetAgentRoot.Presence = installEvidenceUnknown
		}, installAdmissionUnknown, "path_observation_incomplete"},
		{"protected_state_empty", func(e *installTransitionEvidence, _ *installerManifest) {
			e.ProtectedState = nil
		}, installAdmissionUnknown, "protected_state_incomplete"},
		{"protected_state_duplicate", func(e *installTransitionEvidence, _ *installerManifest) {
			e.ProtectedState = append(e.ProtectedState, e.ProtectedState[0])
		}, installAdmissionUnknown, "protected_state_incomplete"},
		{"protected_state_unsupported_kind", func(e *installTransitionEvidence, _ *installerManifest) {
			e.ProtectedState = append(e.ProtectedState, installTransitionProtectedItem{Kind: "secret_plaintext", Presence: installEvidencePresent, SHA256: txDigest("x")})
		}, installAdmissionUnknown, "protected_state_incomplete"},
		{"evidence_digest_malformed", func(e *installTransitionEvidence, _ *installerManifest) {
			e.InstalledAgent.PayloadDigest = strings.ToUpper(e.InstalledAgent.PayloadDigest)
		}, installAdmissionUnknown, "transition_evidence_incomplete"},
		{"evidence_version_malformed", func(e *installTransitionEvidence, _ *installerManifest) {
			e.InstalledPOS.Version = `..\9.1.0`
		}, installAdmissionUnknown, "transition_evidence_incomplete"},
		{"evidence_artifact_missing", func(e *installTransitionEvidence, _ *installerManifest) {
			e.CandidateArtifactSHA256 = ""
		}, installAdmissionUnknown, "transition_evidence_incomplete"},
		{"evidence_qa_environment_missing", func(e *installTransitionEvidence, _ *installerManifest) {
			e.QAEnvironment = ""
		}, installAdmissionUnknown, "transition_evidence_incomplete"},
		{"manifest_service_account_changed", func(_ *installTransitionEvidence, m *installerManifest) {
			m.ServiceAccount = "LocalSystem"
		}, installAdmissionUnknown, "candidate_unproven"},
		{"manifest_service_name_changed", func(_ *installTransitionEvidence, m *installerManifest) {
			m.ServiceName = "OtherService"
		}, installAdmissionUnknown, "candidate_unproven"},
	}
	for _, kind := range installTransitionRequiredProtected {
		kind := kind
		cases = append(cases,
			struct {
				name   string
				mutate func(*installTransitionEvidence, *installerManifest)
				state  installAdmissionState
				reason string
			}{"protected_missing_" + string(kind), func(e *installTransitionEvidence, _ *installerManifest) {
				kept := e.ProtectedState[:0]
				for _, item := range e.ProtectedState {
					if item.Kind != kind {
						kept = append(kept, item)
					}
				}
				e.ProtectedState = kept
			}, installAdmissionUnknown, "protected_state_incomplete"},
			struct {
				name   string
				mutate func(*installTransitionEvidence, *installerManifest)
				state  installAdmissionState
				reason string
			}{"protected_absent_" + string(kind), func(e *installTransitionEvidence, _ *installerManifest) {
				for i := range e.ProtectedState {
					if e.ProtectedState[i].Kind == kind {
						e.ProtectedState[i].Presence = installEvidenceAbsent
					}
				}
			}, installAdmissionUnknown, "protected_state_incomplete"},
			struct {
				name   string
				mutate func(*installTransitionEvidence, *installerManifest)
				state  installAdmissionState
				reason string
			}{"protected_digest_malformed_" + string(kind), func(e *installTransitionEvidence, _ *installerManifest) {
				for i := range e.ProtectedState {
					if e.ProtectedState[i].Kind == kind {
						e.ProtectedState[i].SHA256 = "not-a-digest"
					}
				}
			}, installAdmissionUnknown, "protected_state_incomplete"},
		)
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ev, manifest := txCloneEvidence(base), m
			tc.mutate(&ev, &manifest)
			d, err := classifyInstallTransition(approvals, manifest, l, ev)
			txAssertRejected(t, approvals, l, d, err, tc.state, tc.reason)
		})
	}
}

func TestHUWIN144aInvalidAllowlistFailsClosed(t *testing.T) {
	m, l, _, ev := txFixture()
	cases := map[string]func([]installTransitionApproval) []installTransitionApproval{
		"empty_id": func(a []installTransitionApproval) []installTransitionApproval { a[0].ID = " "; return a },
		"duplicate_id": func(a []installTransitionApproval) []installTransitionApproval {
			b := a[0]
			b.SourceAgent.Version = "9.0.0-fixture.0"
			return append(a, b)
		},
		"ambiguous_source": func(a []installTransitionApproval) []installTransitionApproval {
			b := a[0]
			b.ID = "other"
			return append(a, b)
		},
		"artifact_not_hex": func(a []installTransitionApproval) []installTransitionApproval {
			a[0].CandidateArtifactSHA256 = "abc"
			return a
		},
		"qa_environment_not_hex": func(a []installTransitionApproval) []installTransitionApproval { a[0].QAEnvironment = ""; return a },
		"agent_same_version": func(a []installTransitionApproval) []installTransitionApproval {
			a[0].TargetAgent.Version = a[0].SourceAgent.Version
			return a
		},
		"agent_same_digest": func(a []installTransitionApproval) []installTransitionApproval {
			a[0].TargetAgent.PayloadDigest = a[0].SourceAgent.PayloadDigest
			return a
		},
		"pos_same_label": func(a []installTransitionApproval) []installTransitionApproval {
			a[0].TargetPOS.Version = a[0].SourcePOS.Version
			return a
		},
		"pos_same_label_case": func(a []installTransitionApproval) []installTransitionApproval {
			a[0].TargetPOS.Version = strings.ToUpper(a[0].SourcePOS.Version)
			return a
		},
		"pos_same_digest": func(a []installTransitionApproval) []installTransitionApproval {
			a[0].TargetPOS.PayloadDigest = a[0].SourcePOS.PayloadDigest
			return a
		},
		"non_localservice": func(a []installTransitionApproval) []installTransitionApproval {
			a[0].ServiceAccount = "LocalSystem"
			return a
		},
		"malformed_version": func(a []installTransitionApproval) []installTransitionApproval {
			a[0].SourceAgent.Version = "latest"
			return a
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			approvals := mutate([]installTransitionApproval{txFixtureApproval()})
			d, err := classifyInstallTransition(approvals, m, l, txCloneEvidence(ev))
			txAssertRejected(t, approvals, l, d, err, installAdmissionUnknown, "transition_policy_invalid")
		})
	}
}

func TestHUWIN144aConfirmRejectsObservationFailureAndDrift(t *testing.T) {
	m, l, approvals, base := txFixture()
	observer := func(sequence ...func(*installTransitionEvidence) error) (func() (installTransitionEvidence, error), *int) {
		calls := 0
		return func() (installTransitionEvidence, error) {
			ev := txCloneEvidence(base)
			index := calls
			calls++
			if index < len(sequence) && sequence[index] != nil {
				if err := sequence[index](&ev); err != nil {
					return installTransitionEvidence{}, err
				}
			}
			return ev, nil
		}, &calls
	}
	fail := func(*installTransitionEvidence) error { return errors.New("access denied") }
	cases := []struct {
		name   string
		steps  []func(*installTransitionEvidence) error
		reason string
		calls  int
	}{
		{"first_observation_fails", []func(*installTransitionEvidence) error{fail}, "observation_failed", 1},
		{"second_observation_fails", []func(*installTransitionEvidence) error{nil, fail}, "revalidation_failed", 2},
		{"service_pid_drift", []func(*installTransitionEvidence) error{nil, func(e *installTransitionEvidence) error { e.Service.PID = 9999; return nil }}, "evidence_changed", 2},
		{"junction_drift", []func(*installTransitionEvidence) error{nil, func(e *installTransitionEvidence) error { e.AgentCurrent.Fingerprint = "replaced"; return nil }}, "evidence_changed", 2},
		{"protected_digest_drift", []func(*installTransitionEvidence) error{nil, func(e *installTransitionEvidence) error { e.ProtectedState[0].SHA256 = txDigest("changed"); return nil }}, "evidence_changed", 2},
		{"target_root_appears", []func(*installTransitionEvidence) error{nil, func(e *installTransitionEvidence) error {
			e.TargetAgentRoot = installAdmissionPath{Presence: installEvidencePresent, Directory: true, Fingerprint: "raced"}
			return nil
		}}, "evidence_changed", 2},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			observe, calls := observer(tc.steps...)
			d, err := confirmInstallTransition(approvals, m, l, observe)
			txAssertRejected(t, approvals, l, d, err, installAdmissionUnknown, tc.reason)
			if *calls != tc.calls {
				t.Fatalf("observer calls=%d want %d", *calls, tc.calls)
			}
		})
	}
	t.Run("rejected_first_observation_is_not_revalidated", func(t *testing.T) {
		observe, calls := observer(func(e *installTransitionEvidence) error { e.InstalledAgent.Version = "9.0.0-fixture.0"; return nil })
		d, err := confirmInstallTransition(approvals, m, l, observe)
		txAssertRejected(t, approvals, l, d, err, installAdmissionUnknown, "transition_unproven")
		if *calls != 1 {
			t.Fatalf("observer calls=%d", *calls)
		}
	})
	t.Run("observer_missing", func(t *testing.T) {
		d, err := confirmInstallTransition(approvals, m, l, nil)
		txAssertRejected(t, approvals, l, d, err, installAdmissionUnknown, "observer_missing")
	})
	t.Run("protected_order_only_is_stable", func(t *testing.T) {
		observe, _ := observer(nil, func(e *installTransitionEvidence) error {
			for i, j := 0, len(e.ProtectedState)-1; i < j; i, j = i+1, j-1 {
				e.ProtectedState[i], e.ProtectedState[j] = e.ProtectedState[j], e.ProtectedState[i]
			}
			return nil
		})
		if d, err := confirmInstallTransition(approvals, m, l, observe); err != nil || !d.Eligible || d.ExecutionPermitted {
			t.Fatalf("decision=%+v error=%v", d, err)
		}
	})
}

func TestHUWIN144aClassificationIsPureAndDeterministic(t *testing.T) {
	m, l, approvals, ev := txFixture()
	approvalsBefore := append([]installTransitionApproval(nil), approvals...)
	evBefore := txCloneEvidence(ev)
	manifestBefore := txFixtureManifest()
	layoutBefore := txFixtureLayout()
	first, firstErr := classifyInstallTransition(approvals, m, l, ev)
	second, secondErr := classifyInstallTransition(approvals, m, l, ev)
	if firstErr != nil || secondErr != nil || first != second {
		t.Fatalf("non-deterministic: %+v/%v vs %+v/%v", first, firstErr, second, secondErr)
	}
	if !reflect.DeepEqual(approvals, approvalsBefore) || !reflect.DeepEqual(ev, evBefore) || !reflect.DeepEqual(m, manifestBefore) || !reflect.DeepEqual(l, layoutBefore) {
		t.Fatal("classification mutated its inputs")
	}
	if len(approvedInstallTransitions) != 0 {
		t.Fatal("classification changed the production allowlist")
	}
}

// The policy file must stay effect-free: only pure imports, no OS/process/
// registry/service-control/network calls. This is a structural guard, not a
// substitute for 14.4b native tests.
func TestHUWIN144aPolicySourceHasNoEffectCapableDependencies(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "install_transition_admission_windows.go", nil, parser.ImportsOnly)
	if err != nil {
		t.Fatal(err)
	}
	allowed := map[string]bool{
		"crypto/sha256": true, "encoding/hex": true, "errors": true, "fmt": true, "path/filepath": true,
		"reflect": true, "sort": true, "strings": true, "time": true, "golang.org/x/sys/windows/svc": true,
	}
	for _, spec := range file.Imports {
		path, _ := strconv.Unquote(spec.Path.Value)
		if !allowed[path] {
			t.Fatalf("policy imports effect-capable package %q", path)
		}
	}
	full, err := parser.ParseFile(token.NewFileSet(), "install_transition_admission_windows.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	forbiddenCalls := map[string]bool{
		"installPOSPayload": true, "copyBundleToVersion": true, "ensureCurrentJunction": true, "configureService": true,
		"startService": true, "stopService": true, "ensureServicePermissions": true, "writeUninstallMetadata": true,
		"emitRollback": true, "rollbackPOSPayload": true, "rollbackToPreviousVersion": true, "applyManagedAcl": true,
		"setManagedPathACL": true, "ensureLocalConfig": true, "ensureBaseDirectories": true, "observeInstallAdmission": true,
	}
	ast.Inspect(full, func(node ast.Node) bool {
		if call, ok := node.(*ast.CallExpr); ok {
			if ident, ok := call.Fun.(*ast.Ident); ok && forbiddenCalls[ident.Name] {
				t.Errorf("policy calls effectful function %s", ident.Name)
			}
		}
		return true
	})
}

// 14.4a adds no product caller: FRESH/REPAIR admission and the installer entry
// point must not reference the transition policy.
func TestHUWIN144aNotWiredAndP0BUnchanged(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "main_windows.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	ast.Inspect(file, func(node ast.Node) bool {
		if ident, ok := node.(*ast.Ident); ok {
			switch ident.Name {
			case "classifyInstallTransition", "confirmInstallTransition", "buildInstallTransitionPlan",
				"requireInstallTransitionExecution", "approvedInstallTransitions", "installTransitionExecutionEnabled":
				t.Errorf("main_windows.go references 14.4a policy identifier %s", ident.Name)
			}
		}
		return true
	})
	m, l, f := p0BAdmissionFixture(t)
	base, err := observeInstallAdmission(m, l, f)
	if err != nil {
		t.Fatal(err)
	}
	if d, e := classifyInstallAdmission(m, l, base); e != nil || d.State != installAdmissionRepair || d.Reason != "same_candidate" {
		t.Fatalf("REPAIR changed: %+v %v", d, e)
	}
	s := base
	s.Version = "0.1.1-qa.16"
	s.Current.Target = filepath.Join(l.VersionsRoot, s.Version)
	s.Registration.Version = s.Version
	s.Service.Binary = buildServiceBinaryPath(filepath.Join(s.Current.Target, "ManusTerminalSetup.exe"), "service")
	if d, e := classifyInstallAdmission(m, l, s); e == nil || d.State != installAdmissionUnknown || d.Reason != "transition_unproven" {
		t.Fatalf("P0-B must still reject version transitions: %+v %v", d, e)
	}
	p0BMakeFresh(l, f)
	for _, p := range []string{l.ProgramDataRoot, l.ConfigRoot, l.LogsRoot, l.StateRoot} {
		f.paths[p] = installAdmissionPath{Presence: installEvidenceAbsent, Fingerprint: "absent:" + p}
	}
	fresh, err := observeInstallAdmission(m, l, f)
	if err != nil {
		t.Fatal(err)
	}
	if d, e := classifyInstallAdmission(m, l, fresh); e != nil || d.State != installAdmissionFresh || d.Reason != "proven_absent" {
		t.Fatalf("FRESH changed: %+v %v", d, e)
	}
}

func TestHUWIN144aPlanModelInvariants(t *testing.T) {
	m, l, approvals, ev := txFixture()
	d, err := classifyInstallTransition(approvals, m, l, ev)
	if err != nil {
		t.Fatal(err)
	}
	plan, err := buildInstallTransitionPlan(d, approvals, l)
	if err != nil {
		t.Fatalf("plan: %v", err)
	}
	if plan.Forward[installTransitionStepIndex(plan.Forward, txStepStopService)].Kind != txStepStopService {
		t.Fatal("stop step missing")
	}
	stop := installTransitionStepIndex(plan.Forward, txStepStopService)
	for _, kind := range []installTransitionStepKind{txStepRecordPlan, txStepRecordProtectedDigests, txStepVerifyRecord, txStepPreflightPOSClosed, txStepStageAgent, txStepStagePOS, txStepValidateStaging} {
		if index := installTransitionStepIndex(plan.Forward, kind); index < 0 || index >= stop {
			t.Fatalf("%s must precede service stop", kind)
		}
	}
	if installTransitionStepIndex(plan.Forward, txStepSwitchPOSJunction) > installTransitionStepIndex(plan.Forward, txStepSwitchAgentJunction) {
		t.Fatal("POS junction must switch before Agent junction")
	}
	for _, step := range append(append([]installTransitionStep(nil), plan.Forward...), plan.Rollback...) {
		if strings.Contains(string(step.Kind), "delete") || strings.Contains(string(step.Kind), "remove") {
			t.Fatalf("plan contains destructive step %s", step.Kind)
		}
	}
	if !reflect.DeepEqual(plan.RetainedPayloads, []string{plan.SourceAgentRoot, plan.SourcePOSRoot}) {
		t.Fatalf("retained payloads = %v", plan.RetainedPayloads)
	}

	mutations := map[string]func(*installTransitionPlan){
		"swap_stage_after_stop": func(p *installTransitionPlan) {
			p.Forward[4], p.Forward[7] = p.Forward[7], p.Forward[4]
		},
		"swap_junction_order": func(p *installTransitionPlan) {
			p.Forward[10], p.Forward[11] = p.Forward[11], p.Forward[10]
		},
		"drop_protected_digests": func(p *installTransitionPlan) {
			p.Forward = append(p.Forward[:1:1], p.Forward[2:]...)
		},
		"stage_into_source_agent": func(p *installTransitionPlan) { p.Forward[4].Target = p.SourceAgentRoot },
		"stage_into_source_pos":   func(p *installTransitionPlan) { p.Forward[5].Target = p.SourcePOSRoot },
		"mutate_inside_source": func(p *installTransitionPlan) {
			p.Forward[12].Target = filepath.Join(p.SourceAgentRoot, "ManusTerminalSetup.exe")
		},
		"retention_missing_pos": func(p *installTransitionPlan) { p.RetainedPayloads = []string{p.SourceAgentRoot} },
		"rollback_missing_pos_restore": func(p *installTransitionPlan) {
			p.Rollback = append(p.Rollback[:5:5], p.Rollback[6:]...)
		},
		"rollback_without_protected_verify": func(p *installTransitionPlan) {
			p.Rollback = p.Rollback[:len(p.Rollback)-3]
		},
		"rollback_restores_target":     func(p *installTransitionPlan) { p.Rollback[4].Target = p.TargetAgentRoot },
		"rollback_pos_restores_target": func(p *installTransitionPlan) { p.Rollback[5].Target = p.TargetPOSRoot },
		"rollback_binary_target": func(p *installTransitionPlan) {
			p.Rollback[3].Target = filepath.Join(p.TargetAgentRoot, "ManusTerminalSetup.exe")
		},
		"same_source_and_target_pos": func(p *installTransitionPlan) { p.TargetPOSRoot = p.SourcePOSRoot },
		"duplicate_step":             func(p *installTransitionPlan) { p.Forward[1] = p.Forward[0] },
		"missing_identity":           func(p *installTransitionPlan) { p.ApprovalID = "" },
	}
	for name, mutate := range mutations {
		t.Run(name, func(t *testing.T) {
			candidate := plan
			candidate.Forward = append([]installTransitionStep(nil), plan.Forward...)
			candidate.Rollback = append([]installTransitionStep(nil), plan.Rollback...)
			candidate.RetainedPayloads = append([]string(nil), plan.RetainedPayloads...)
			mutate(&candidate)
			if err := validateInstallTransitionPlan(candidate); err == nil {
				t.Fatal("invalid plan accepted")
			}
		})
	}
	t.Run("plan_requires_known_approval", func(t *testing.T) {
		forged := d
		forged.ApprovalID = "forged"
		if p, err := buildInstallTransitionPlan(forged, approvals, l); err == nil || !reflect.DeepEqual(p, installTransitionPlan{}) {
			t.Fatal("plan built for unknown approval")
		}
		forgedState := d
		forgedState.State = installAdmissionRepair
		if _, err := buildInstallTransitionPlan(forgedState, approvals, l); err == nil {
			t.Fatal("plan built for non-update decision")
		}
	})
}

func TestHUWIN144aPayloadDigestCanonicalAndStrict(t *testing.T) {
	files := []installTransitionFile{
		{RelativePath: `app\main.js`, Size: 10, SHA256: txDigest("main")},
		{RelativePath: "runtime/node.exe", Size: 20, SHA256: txDigest("node")},
		{RelativePath: "VERSION.json", Size: 3, SHA256: txDigest("version")},
	}
	first, err := installTransitionPayloadDigest(files)
	if err != nil || !installTransitionHex64(first) {
		t.Fatalf("digest=%q err=%v", first, err)
	}
	reordered := []installTransitionFile{files[2], {RelativePath: "APP/MAIN.JS", Size: 10, SHA256: files[0].SHA256}, files[1]}
	if second, err := installTransitionPayloadDigest(reordered); err != nil || second != first {
		t.Fatalf("digest not order/case/separator independent: %q vs %q (%v)", second, first, err)
	}
	changed := append([]installTransitionFile(nil), files...)
	changed[1].Size = 21
	if third, _ := installTransitionPayloadDigest(changed); third == first {
		t.Fatal("size change not reflected")
	}
	invalid := map[string][]installTransitionFile{
		"empty":           nil,
		"absolute":        {{RelativePath: `C:\x`, Size: 1, SHA256: txDigest("x")}},
		"rooted":          {{RelativePath: `\x`, Size: 1, SHA256: txDigest("x")}},
		"escape":          {{RelativePath: `..\x`, Size: 1, SHA256: txDigest("x")}},
		"dot_segment":     {{RelativePath: `a\.\x`, Size: 1, SHA256: txDigest("x")}},
		"stream":          {{RelativePath: `x:ads`, Size: 1, SHA256: txDigest("x")}},
		"duplicate_case":  {{RelativePath: "a", Size: 1, SHA256: txDigest("a")}, {RelativePath: "A", Size: 1, SHA256: txDigest("a")}},
		"negative_size":   {{RelativePath: "a", Size: -1, SHA256: txDigest("a")}},
		"uppercase_hash":  {{RelativePath: "a", Size: 1, SHA256: strings.ToUpper(txDigest("a"))}},
		"empty_component": {{RelativePath: "a//b", Size: 1, SHA256: txDigest("a")}},
	}
	for name, list := range invalid {
		if digest, err := installTransitionPayloadDigest(list); err == nil || digest != "" {
			t.Fatalf("%s accepted: %q", name, digest)
		}
	}
}

// ---- 14.4b executor (stage 1): injected seams and TEMP-free in-memory fakes only ----

type txExecStore struct {
	journal   *installTransitionJournal
	locked    bool
	saves     int
	failSave  map[int]bool
	loadError error
}

func (s *txExecStore) Lock() (func() error, error) {
	if s.locked {
		return nil, errors.New("lock held")
	}
	s.locked = true
	return func() error { s.locked = false; return nil }, nil
}

func (s *txExecStore) Load() (installTransitionJournal, bool, error) {
	if s.loadError != nil {
		return installTransitionJournal{}, false, s.loadError
	}
	if s.journal == nil {
		return installTransitionJournal{}, false, nil
	}
	return txCopyJournal(*s.journal), true, nil
}

func (s *txExecStore) Save(j installTransitionJournal) error {
	s.saves++
	if s.failSave[s.saves] {
		return errors.New("disk full")
	}
	copy := txCopyJournal(j)
	s.journal = &copy
	return nil
}

func txCopyJournal(j installTransitionJournal) installTransitionJournal {
	j.Completed = append([]installTransitionStepKind(nil), j.Completed...)
	j.RollbackCompleted = append([]installTransitionStepKind(nil), j.RollbackCompleted...)
	j.ProtectedState = append([]installTransitionProtectedItem(nil), j.ProtectedState...)
	return j
}

// txExecSystem models one Windows host: service, junctions, payload roots and
// protected state. Faults: failOnce/failAlways by operation name, crashAt
// panics to simulate power loss, and hooks that drift state after a target start.
type txExecSystem struct {
	binary           string
	junctions        map[string]string
	running          bool
	portBusy         bool
	posRunning       bool
	posScopeErr      bool
	present          map[string]bool
	versions         map[string]string
	protected        []installTransitionProtectedItem
	installID        string
	failOnce         map[string]int
	failAlways       map[string]bool
	crashAt          string
	failAfter        map[string]int
	successes        map[string]int
	afterTargetStart func(*txExecSystem)
	afterSourceStart func(*txExecSystem)
	targetRoot       string
	sourceRoots      []string
	calls            []string
	mutatedSource    bool
}

func (f *txExecSystem) op(name string) error {
	f.calls = append(f.calls, name)
	if f.crashAt == name {
		panic("simulated power loss at " + name)
	}
	if f.failAlways[name] {
		return errors.New("injected " + name)
	}
	if f.failOnce[name] > 0 {
		f.failOnce[name]--
		return errors.New("injected " + name)
	}
	if limit, ok := f.failAfter[name]; ok && f.successes[name] >= limit {
		return errors.New("injected " + name + " after success")
	}
	f.successes[name]++
	return nil
}

func (f *txExecSystem) touchesSource(path string) {
	for _, root := range f.sourceRoots {
		if installTransitionSamePath(path, root) || pathWithinRoot(path, root) {
			f.mutatedSource = true
		}
	}
}

func (f *txExecSystem) POSProcessRunning() (bool, error) {
	if err := f.op("pos_running"); err != nil || f.posScopeErr {
		return false, errors.New("scope unknown")
	}
	return f.posRunning, nil
}
func (f *txExecSystem) ProtectedState() ([]installTransitionProtectedItem, error) {
	if err := f.op("protected_state"); err != nil {
		return nil, err
	}
	return append([]installTransitionProtectedItem(nil), f.protected...), nil
}
func (f *txExecSystem) InstallationID() (string, error) { return f.installID, f.op("installation_id") }
func (f *txExecSystem) ServiceBinary() (string, error)  { return f.binary, f.op("service_binary") }
func (f *txExecSystem) JunctionTarget(link string) (string, error) {
	return f.junctions[strings.ToLower(link)], f.op("junction_target")
}
func (f *txExecSystem) PathAbsent(path string) (bool, error) {
	return !f.present[strings.ToLower(path)], f.op("path_absent")
}
func (f *txExecSystem) StagePayload(kind, target string) error {
	if err := f.op("stage_" + kind); err != nil {
		return err
	}
	f.touchesSource(target)
	f.present[strings.ToLower(target)] = true
	return nil
}
func (f *txExecSystem) ValidateStaged(kind, target string) error {
	if err := f.op("validate_" + kind); err != nil {
		return err
	}
	if !f.present[strings.ToLower(target)] {
		return errors.New("staged payload missing")
	}
	return nil
}
func (f *txExecSystem) StopService() error {
	if err := f.op("stop_service"); err != nil {
		return err
	}
	f.running = false
	return nil
}
func (f *txExecSystem) ServiceStopped() (bool, error) { return !f.running, f.op("service_stopped") }
func (f *txExecSystem) PortReleased() (bool, error) {
	return !f.running && !f.portBusy, f.op("port_released")
}
func (f *txExecSystem) SetJunction(link, target string) error {
	if err := f.op("set_junction"); err != nil {
		return err
	}
	f.junctions[strings.ToLower(link)] = target
	return nil
}
func (f *txExecSystem) SetServiceBinary(path string) error {
	if err := f.op("set_service_binary"); err != nil {
		return err
	}
	f.binary = path
	return nil
}
func (f *txExecSystem) StartService() error {
	if err := f.op("start_service"); err != nil {
		return err
	}
	f.running = true
	if installTransitionSamePath(filepath.Dir(f.binary), f.targetRoot) {
		if f.afterTargetStart != nil {
			f.afterTargetStart(f)
		}
	} else if f.afterSourceStart != nil {
		f.afterSourceStart(f)
	}
	return nil
}
func (f *txExecSystem) Health() (string, string, error) {
	if err := f.op("health"); err != nil || !f.running {
		return "", "", errors.New("unhealthy")
	}
	return f.versions[strings.ToLower(filepath.Dir(f.binary))], f.installID, nil
}
func (f *txExecSystem) WriteUninstallMetadata(version string) error {
	return f.op("write_uninstall_metadata")
}
func (f *txExecSystem) PayloadIntact(root string) error {
	if err := f.op("payload_intact"); err != nil || !f.present[strings.ToLower(root)] {
		return errors.New("payload missing")
	}
	return nil
}

func txExecPermissiveGate(d installTransitionDecision) error {
	if d.State != installAdmissionUpdate || !d.Eligible {
		return errors.New("not eligible")
	}
	return nil
}

type txExecCase struct {
	d     installTransitionDecision
	p     installTransitionPlan
	t     installTransitionTarget
	sys   *txExecSystem
	store *txExecStore
}

func txExecFixture(t *testing.T) txExecCase {
	t.Helper()
	m, l, approvals, ev := txFixture()
	d, err := classifyInstallTransition(approvals, m, l, ev)
	if err != nil || !d.Eligible {
		t.Fatalf("fixture decision: %+v %v", d, err)
	}
	p, err := buildInstallTransitionPlan(d, approvals, l)
	if err != nil {
		t.Fatal(err)
	}
	a := approvals[0]
	sys := &txExecSystem{
		binary:      txServiceBinary(p.SourceAgentRoot),
		junctions:   map[string]string{strings.ToLower(l.CurrentRoot): p.SourceAgentRoot, strings.ToLower(l.POSCurrentRoot): p.SourcePOSRoot},
		running:     true,
		present:     map[string]bool{strings.ToLower(p.SourceAgentRoot): true, strings.ToLower(p.SourcePOSRoot): true},
		versions:    map[string]string{strings.ToLower(p.SourceAgentRoot): a.SourceAgent.Version, strings.ToLower(p.TargetAgentRoot): a.TargetAgent.Version},
		protected:   txFixtureProtected(),
		installID:   "fixture-installation-id",
		failOnce:    map[string]int{},
		failAlways:  map[string]bool{},
		failAfter:   map[string]int{},
		successes:   map[string]int{},
		targetRoot:  p.TargetAgentRoot,
		sourceRoots: []string{p.SourceAgentRoot, p.SourcePOSRoot},
	}
	target := installTransitionTarget{AgentCurrent: l.CurrentRoot, POSCurrent: l.POSCurrentRoot,
		SourceAgentVersion: a.SourceAgent.Version, TargetAgentVersion: a.TargetAgent.Version}
	return txExecCase{d: d, p: p, t: target, sys: sys, store: &txExecStore{failSave: map[int]bool{}}}
}

func (c txExecCase) run() (installTransitionResult, error) {
	return executeInstallTransition(c.d, c.p, c.t, c.sys, c.store, txExecPermissiveGate)
}

// txExecAssertSource requires the exact recorded source activation, a healthy
// source service, unchanged identity/protected state and intact source payloads.
func txExecAssertSource(t *testing.T, c txExecCase) {
	t.Helper()
	f := c.sys
	if !installTransitionSamePath(f.binary, txServiceBinary(c.p.SourceAgentRoot)) ||
		!installTransitionSamePath(f.junctions[strings.ToLower(c.t.AgentCurrent)], c.p.SourceAgentRoot) ||
		!installTransitionSamePath(f.junctions[strings.ToLower(c.t.POSCurrent)], c.p.SourcePOSRoot) {
		t.Fatalf("source activation not restored: binary=%s junctions=%v", f.binary, f.junctions)
	}
	if !f.running || f.installID != "fixture-installation-id" {
		t.Fatalf("source service not healthy: running=%v id=%s", f.running, f.installID)
	}
	if !f.present[strings.ToLower(c.p.SourceAgentRoot)] || !f.present[strings.ToLower(c.p.SourcePOSRoot)] || f.mutatedSource {
		t.Fatal("source payload lost or mutated")
	}
}

func TestHUWIN144bProductionGateRefusesWithoutAnyEffect(t *testing.T) {
	c := txExecFixture(t)
	r, err := executeInstallTransition(c.d, c.p, c.t, c.sys, c.store, requireInstallTransitionExecution)
	if err == nil || r.State != "REFUSED" || !strings.Contains(r.Reason, "update_execution_disabled") {
		t.Fatalf("production gate: %+v %v", r, err)
	}
	if len(c.sys.calls) != 0 || c.store.journal != nil || c.store.locked {
		t.Fatalf("refusal had effects: calls=%v journal=%v", c.sys.calls, c.store.journal)
	}
	if r, err := executeInstallTransition(c.d, c.p, c.t, c.sys, c.store, nil); err == nil || r.Reason != "execution_gate_missing" {
		t.Fatalf("nil gate: %+v %v", r, err)
	}
}

func TestHUWIN144bCommitsAdmittedUpdatePreservingIdentityAndSource(t *testing.T) {
	c := txExecFixture(t)
	r, err := c.run()
	if err != nil || r.State != txJournalCommitted {
		t.Fatalf("commit: %+v %v", r, err)
	}
	f := c.sys
	if !installTransitionSamePath(f.binary, txServiceBinary(c.p.TargetAgentRoot)) ||
		!installTransitionSamePath(f.junctions[strings.ToLower(c.t.AgentCurrent)], c.p.TargetAgentRoot) ||
		!installTransitionSamePath(f.junctions[strings.ToLower(c.t.POSCurrent)], c.p.TargetPOSRoot) || !f.running {
		t.Fatalf("target not active: %s %v running=%v", f.binary, f.junctions, f.running)
	}
	if f.mutatedSource || !f.present[strings.ToLower(c.p.SourceAgentRoot)] || !f.present[strings.ToLower(c.p.SourcePOSRoot)] {
		t.Fatal("source payload must be retained")
	}
	j := c.store.journal
	if j == nil || j.State != txJournalCommitted || len(j.Completed) != len(c.p.Forward) || j.InstallationID != "fixture-installation-id" ||
		!txProtectedEqual(j.ProtectedState, txFixtureProtected()) {
		t.Fatalf("journal: %+v", j)
	}
	for index, step := range c.p.Forward {
		if j.Completed[index] != step.Kind {
			t.Fatalf("checkpoint %d = %s, want %s", index, j.Completed[index], step.Kind)
		}
	}
	if c.store.locked {
		t.Fatal("lock must be released")
	}
}

func TestHUWIN144bDurableRecordIsWrittenAndReReadBeforeServiceStop(t *testing.T) {
	c := txExecFixture(t)
	if r, err := c.run(); err != nil || r.State != txJournalCommitted {
		t.Fatalf("%+v %v", r, err)
	}
	stop, verify := -1, -1
	for index, step := range c.store.journal.Completed {
		switch step {
		case txStepVerifyRecord:
			verify = index
		case txStepStopService:
			stop = index
		}
	}
	if verify < 0 || stop < 0 || verify > stop {
		t.Fatalf("record verification must precede stop: verify=%d stop=%d", verify, stop)
	}
	// A record that does not survive the re-read aborts before any live change.
	c2 := txExecFixture(t)
	tampered := &txTamperStore{txExecStore: c2.store, tamperAfter: 2}
	r, err := executeInstallTransition(c2.d, c2.p, c2.t, c2.sys, tampered, txExecPermissiveGate)
	if err == nil || r.State != txJournalAborted || r.Step != txStepVerifyRecord || !c2.sys.running {
		t.Fatalf("tampered record: %+v %v running=%v", r, err, c2.sys.running)
	}
}

type txTamperStore struct {
	*txExecStore
	tamperAfter int
}

func (s *txTamperStore) Load() (installTransitionJournal, bool, error) {
	j, ok, err := s.txExecStore.Load()
	if s.saves >= s.tamperAfter {
		j.InstallationID = "tampered"
	}
	return j, ok, err
}

func TestHUWIN144bFailuresBeforeStopAbortWithoutLiveChange(t *testing.T) {
	cases := []struct {
		name  string
		setup func(*txExecCase)
		step  installTransitionStepKind
	}{
		{"pos running", func(c *txExecCase) { c.sys.posRunning = true }, txStepPreflightPOSClosed},
		{"pos scope unknown", func(c *txExecCase) { c.sys.posScopeErr = true }, txStepPreflightPOSClosed},
		{"agent target not absent", func(c *txExecCase) { c.sys.present[strings.ToLower(c.p.TargetAgentRoot)] = true }, txStepStageAgent},
		{"locked agent payload", func(c *txExecCase) { c.sys.failAlways["stage_agent"] = true }, txStepStageAgent},
		{"locked pos payload", func(c *txExecCase) { c.sys.failAlways["stage_pos"] = true }, txStepStagePOS},
		{"staging validation", func(c *txExecCase) { c.sys.failAlways["validate_pos"] = true }, txStepValidateStaging},
		{"protected state incomplete", func(c *txExecCase) { c.sys.protected = c.sys.protected[:2] }, txStepRecordProtectedDigests},
		{"source activation mismatch", func(c *txExecCase) { c.sys.binary = `C:\Elsewhere\ManusTerminalSetup.exe` }, txStepRecordPlan},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := txExecFixture(t)
			tc.setup(&c)
			binary := c.sys.binary
			r, err := c.run()
			if err == nil || r.State != txJournalAborted || r.Step != tc.step {
				t.Fatalf("result %+v %v", r, err)
			}
			for _, call := range c.sys.calls {
				if call == "stop_service" || call == "set_junction" || call == "set_service_binary" {
					t.Fatalf("live change attempted before stop gate: %v", c.sys.calls)
				}
			}
			if !c.sys.running || c.sys.binary != binary || c.sys.mutatedSource {
				t.Fatal("source service or payload changed")
			}
			if c.store.journal != nil && c.store.journal.State != txJournalAborted {
				t.Fatalf("journal state %s", c.store.journal.State)
			}
		})
	}
}

func TestHUWIN144bActivationFaultsRollBackToVerifiedSource(t *testing.T) {
	restoreOnSource := func(f *txExecSystem) {
		f.installID = "fixture-installation-id"
		f.protected = txFixtureProtected()
	}
	cases := []struct {
		name  string
		setup func(*txExecCase)
	}{
		{"stop timeout", func(c *txExecCase) { c.sys.failOnce["stop_service"] = 1 }},
		{"port not released", func(c *txExecCase) { c.sys.failOnce["port_released"] = 1 }},
		{"pos junction switch", func(c *txExecCase) { c.sys.failOnce["set_junction"] = 1 }},
		{"service binary switch", func(c *txExecCase) { c.sys.failOnce["set_service_binary"] = 1 }},
		{"target start failure", func(c *txExecCase) { c.sys.failOnce["start_service"] = 1 }},
		{"health version mismatch", func(c *txExecCase) { c.sys.versions[strings.ToLower(c.p.TargetAgentRoot)] = "wrong" }},
		{"installation id changed", func(c *txExecCase) {
			c.sys.afterTargetStart = func(f *txExecSystem) { f.installID = "new-id" }
			c.sys.afterSourceStart = restoreOnSource
		}},
		{"protected digest changed", func(c *txExecCase) {
			c.sys.afterTargetStart = func(f *txExecSystem) { f.protected[1].SHA256 = txDigest("drift") }
			c.sys.afterSourceStart = restoreOnSource
		}},
		{"acl drift", func(c *txExecCase) {
			c.sys.afterTargetStart = func(f *txExecSystem) { f.protected[4].SHA256 = txDigest("acl-drift") }
			c.sys.afterSourceStart = restoreOnSource
		}},
		{"uninstall metadata", func(c *txExecCase) { c.sys.failOnce["write_uninstall_metadata"] = 1 }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := txExecFixture(t)
			tc.setup(&c)
			r, err := c.run()
			if err == nil || r.State != txJournalRolledBack {
				t.Fatalf("result %+v %v calls=%v", r, err, c.sys.calls)
			}
			txExecAssertSource(t, c)
			if j := c.store.journal; j == nil || j.State != txJournalRolledBack || len(j.RollbackCompleted) != len(c.p.Rollback) {
				t.Fatalf("journal %+v", j)
			}
		})
	}
}

func TestHUWIN144bRollbackFailureRecordsPartialNeverSuccess(t *testing.T) {
	cases := []struct {
		name  string
		setup func(*txExecCase)
	}{
		{"binary restore fails", func(c *txExecCase) {
			c.sys.failOnce["start_service"] = 1
			c.sys.failAfter["set_service_binary"] = 1
		}},
		{"persistent protected drift", func(c *txExecCase) {
			c.sys.afterTargetStart = func(f *txExecSystem) { f.protected[2].SHA256 = txDigest("persistent-drift") }
		}},
		{"source restart fails", func(c *txExecCase) {
			c.sys.failOnce["set_junction"] = 1
			c.sys.failAlways["start_service"] = true
		}},
		{"retained payload damaged", func(c *txExecCase) {
			c.sys.failOnce["write_uninstall_metadata"] = 1
			c.sys.failAlways["payload_intact"] = true
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := txExecFixture(t)
			tc.setup(&c)
			r, err := c.run()
			if err == nil || r.State != txJournalPartial {
				t.Fatalf("result %+v %v", r, err)
			}
			if c.store.journal == nil || c.store.journal.State != txJournalPartial || c.store.journal.Failure == "" {
				t.Fatalf("journal %+v", c.store.journal)
			}
			if c.sys.mutatedSource || !c.sys.present[strings.ToLower(c.p.SourceAgentRoot)] {
				t.Fatal("source payload must never be lost")
			}
		})
	}
}

func TestHUWIN144bInterruptionAtEveryStepRecoversToSourceOrAbort(t *testing.T) {
	probe := txExecFixture(t)
	if _, err := probe.run(); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	var ops []string
	for _, call := range probe.sys.calls {
		if !seen[call] {
			seen[call] = true
			ops = append(ops, call)
		}
	}
	for _, crash := range ops {
		t.Run(crash, func(t *testing.T) {
			c := txExecFixture(t)
			c.sys.crashAt = crash
			func() {
				defer func() { _ = recover() }()
				_, _ = c.run()
			}()
			c.store.locked = false // the process died; the OS releases its lock
			c.sys.crashAt = ""
			if c.store.journal == nil {
				if !c.sys.running || c.sys.mutatedSource {
					t.Fatal("crash before the first record must leave the source untouched")
				}
				return
			}
			before := c.store.journal.State
			r, err := recoverInstallTransition(c.p, c.t, c.sys, c.store)
			switch {
			case before != txJournalInProgress:
				if err != nil || r.Reason != "journal_terminal" {
					t.Fatalf("terminal journal must be left for review: %+v %v", r, err)
				}
			case r.State == txJournalAborted:
				if !c.sys.running || c.sys.mutatedSource {
					t.Fatal("abort must leave the source service untouched")
				}
			case r.State == txJournalRolledBack:
				txExecAssertSource(t, c)
			default:
				t.Fatalf("recovery result %+v %v", r, err)
			}
			// Recovery is idempotent: a second run sees a terminal journal.
			if again, err := recoverInstallTransition(c.p, c.t, c.sys, c.store); err != nil || again.Reason != "journal_terminal" {
				t.Fatalf("second recovery: %+v %v", again, err)
			}
		})
	}
}

func TestHUWIN144bConcurrencyAndExistingJournalAreRefused(t *testing.T) {
	c := txExecFixture(t)
	c.store.locked = true
	if r, err := c.run(); err == nil || r.Reason != "transition_lock_held" || len(c.sys.calls) != 0 {
		t.Fatalf("held lock: %+v %v calls=%v", r, err, c.sys.calls)
	}
	c.store.locked = false
	c.store.journal = &installTransitionJournal{Schema: installTransitionJournalSchema, ApprovalID: c.p.ApprovalID, State: txJournalInProgress}
	if r, err := c.run(); err == nil || r.Reason != "journal_present_requires_recovery_or_review" || len(c.sys.calls) != 0 {
		t.Fatalf("existing journal: %+v %v", r, err)
	}
	c.store.journal = nil
	c.store.loadError = errors.New("corrupt")
	if r, err := c.run(); err == nil || r.Reason != "journal_unreadable" {
		t.Fatalf("unreadable journal: %+v %v", r, err)
	}
	if r, err := recoverInstallTransition(c.p, c.t, c.sys, &txExecStore{}); err == nil || r.Reason != "journal_absent" {
		t.Fatalf("recover without journal: %+v %v", r, err)
	}
	mismatch := &txExecStore{journal: &installTransitionJournal{Schema: installTransitionJournalSchema, ApprovalID: "other", State: txJournalInProgress}}
	if r, err := recoverInstallTransition(c.p, c.t, c.sys, mismatch); err == nil || r.Reason != "journal_does_not_match_plan" {
		t.Fatalf("mismatched journal: %+v %v", r, err)
	}
}

func TestHUWIN144bJournalSaveFailureNeverReportsSuccess(t *testing.T) {
	probe := txExecFixture(t)
	if _, err := probe.run(); err != nil {
		t.Fatal(err)
	}
	for save := 1; save <= probe.store.saves; save++ {
		c := txExecFixture(t)
		c.store.failSave[save] = true
		r, _ := c.run()
		if r.State == txJournalCommitted {
			// A failure on a save after commit-critical steps must not be hidden.
			if c.store.journal == nil || c.store.journal.State != txJournalCommitted {
				t.Fatalf("save %d: committed result without a committed journal", save)
			}
			continue
		}
		if r.State != txJournalAborted && r.State != txJournalRolledBack && r.State != txJournalPartial {
			t.Fatalf("save %d: unexpected %+v", save, r)
		}
		if r.State == txJournalRolledBack {
			txExecAssertSource(t, c)
		}
		if c.sys.mutatedSource {
			t.Fatalf("save %d: source payload mutated", save)
		}
	}
}

func TestHUWIN144bExecutorSourceIsSeamOnlyAndNotWired(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "install_transition_executor_windows.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	allowed := map[string]bool{"errors": true, "fmt": true, "path/filepath": true}
	for _, spec := range file.Imports {
		path, _ := strconv.Unquote(spec.Path.Value)
		if !allowed[path] {
			t.Fatalf("executor imports effect-capable package %q", path)
		}
	}
	forbidden := map[string]bool{
		"installPOSPayload": true, "copyBundleToVersion": true, "ensureCurrentJunction": true, "configureService": true,
		"startService": true, "stopService": true, "stopServiceIfRunning": true, "writeUninstallMetadata": true,
		"emitRollback": true, "rollbackPOSPayload": true, "rollbackToPreviousVersion": true, "applyManagedAcl": true,
		"setManagedPathACL": true, "ensureLocalConfig": true, "uninstall": true, "removeRequestedAgentData": true,
	}
	ast.Inspect(file, func(node ast.Node) bool {
		if call, ok := node.(*ast.CallExpr); ok {
			if ident, ok := call.Fun.(*ast.Ident); ok && forbidden[ident.Name] {
				t.Errorf("executor calls %s", ident.Name)
			}
		}
		return true
	})
	main, err := parser.ParseFile(token.NewFileSet(), "main_windows.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	ast.Inspect(main, func(node ast.Node) bool {
		if ident, ok := node.(*ast.Ident); ok && (ident.Name == "executeInstallTransition" || ident.Name == "recoverInstallTransition") {
			t.Errorf("main_windows.go references 14.4b executor %s", ident.Name)
		}
		return true
	})
}
