package main

// Native 14.4a evidence observer. It reads only, through the P0-B read-only
// capability boundary (installAdmissionIO), and produces the
// installTransitionEvidence that classifyInstallTransition cross-checks against
// an exact allowlist entry. It never writes, decrypts or changes state.
//
// Evidence contract (schema manus-update-evidence/v1):
//   - Agent payload digest: installTransitionPayloadDigest over every regular
//     file of a version root, with paths relative to that root. Installed: the
//     files under VersionsRoot\<installed version> (bundle tree plus
//     ManusTerminalSetup.exe). Candidate: the P0-B candidate inventory under the
//     target VersionRoot (embedded bundle plus this executable).
//   - POS payload digest: the same over the POS version root. Installed: the
//     directory the POS current junction targets. Candidate: the P0-B candidate
//     inventory under the target POSVersionRoot, already checked against the
//     embedded pos-manifest.json.
//   - Candidate artifact SHA-256: the digest of this installer executable.
//   - QA environment digest: see installTransitionQAEnvironmentDigest.
// Any missing, unreadable, reparse-point, ambiguous or inconsistent input fails
// closed with an error; nothing is guessed.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
)

const installTransitionQAEnvironmentSchema = "manus-qa-environment/v1"

// installTransitionQAEnvironment is the non-secret identity of the enrollment
// environment an Agent belongs to. The signing public key itself and every
// secret stay out of it; the key is identified by its operator-provisioned ID.
type installTransitionQAEnvironment struct {
	Endpoint string
	Audience string
	KeyID    string
}

var installTransitionKeyIDPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

func installTransitionConfigString(config map[string]any, key string) (string, error) {
	value, ok := config[key]
	if !ok || value == nil {
		return "", nil
	}
	text, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("qa_environment_%s_not_string", key)
	}
	return strings.TrimSpace(text), nil
}

// parseInstallTransitionQAEnvironment reads endpoint, audience and key ID from an
// Agent config document. requireKeyID is true for the installed host config,
// where the operator provisioned trust; packaged configs carry no trust.
func parseInstallTransitionQAEnvironment(data []byte, requireKeyID bool) (installTransitionQAEnvironment, error) {
	var config map[string]any
	if err := json.Unmarshal(data, &config); err != nil || config == nil {
		return installTransitionQAEnvironment{}, errors.New("qa_environment_config_invalid")
	}
	rawEndpoint, err := installTransitionConfigString(config, "enrollmentApiBaseUrl")
	if err != nil {
		return installTransitionQAEnvironment{}, err
	}
	audience, err := installTransitionConfigString(config, "enrollmentAudience")
	if err != nil {
		return installTransitionQAEnvironment{}, err
	}
	keyID, err := installTransitionConfigString(config, "enrollmentSigningKeyId")
	if err != nil {
		return installTransitionQAEnvironment{}, err
	}
	parsed, err := url.Parse(rawEndpoint)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.Opaque != "" {
		return installTransitionQAEnvironment{}, errors.New("qa_environment_endpoint_invalid")
	}
	endpoint := "https://" + strings.ToLower(parsed.Host) + strings.TrimRight(parsed.EscapedPath(), "/")
	if audience == "" || strings.ContainsAny(audience, "\r\n\x00") || len(audience) > 256 {
		return installTransitionQAEnvironment{}, errors.New("qa_environment_audience_invalid")
	}
	if requireKeyID && !installTransitionKeyIDPattern.MatchString(keyID) {
		return installTransitionQAEnvironment{}, errors.New("qa_environment_key_id_invalid")
	}
	if !requireKeyID && keyID != "" {
		return installTransitionQAEnvironment{}, errors.New("qa_environment_packaged_trust_present")
	}
	if !requireKeyID {
		if pem, err := installTransitionConfigString(config, "enrollmentSigningPublicKeyPem"); err != nil || pem != "" {
			return installTransitionQAEnvironment{}, errors.New("qa_environment_packaged_trust_present")
		}
	}
	return installTransitionQAEnvironment{Endpoint: endpoint, Audience: audience, KeyID: keyID}, nil
}

// installTransitionQAEnvironmentDigest is SHA-256 over the schema label and the
// normalized endpoint, audience and key ID, one per line. An allowlist entry pins
// it, so a candidate admitted for QA cannot update a host enrolled elsewhere.
func installTransitionQAEnvironmentDigest(env installTransitionQAEnvironment) string {
	sum := sha256.Sum256([]byte(installTransitionQAEnvironmentSchema + "\n" + env.Endpoint + "\n" + env.Audience + "\n" + env.KeyID + "\n"))
	return hex.EncodeToString(sum[:])
}

// observeInstallTransitionQAEnvironment derives the digest from the retained host
// config and requires the candidate's packaged endpoint and audience to match it.
func observeInstallTransitionQAEnvironment(hostConfig, candidateConfig []byte) (string, error) {
	host, err := parseInstallTransitionQAEnvironment(hostConfig, true)
	if err != nil {
		return "", fmt.Errorf("host %w", err)
	}
	candidate, err := parseInstallTransitionQAEnvironment(candidateConfig, false)
	if err != nil {
		return "", fmt.Errorf("candidate %w", err)
	}
	if candidate.Endpoint != host.Endpoint || candidate.Audience != host.Audience {
		return "", errors.New("qa_environment_candidate_mismatch")
	}
	return installTransitionQAEnvironmentDigest(host), nil
}

// installTransitionExpectedDigest selects the candidate inventory entries under
// root and digests them with paths relative to root.
func installTransitionExpectedDigest(files []installAdmissionExpectedFile, root string) (string, error) {
	var payload []installTransitionFile
	for _, file := range files {
		if !pathWithinRoot(file.Path, root) || installTransitionSamePath(file.Path, root) {
			continue
		}
		relative, err := filepath.Rel(root, file.Path)
		if err != nil {
			return "", err
		}
		payload = append(payload, installTransitionFile{RelativePath: relative, Size: file.Size, SHA256: strings.ToLower(file.SHA256)})
	}
	return installTransitionPayloadDigest(payload)
}

// installTransitionInstalledDigest hashes every file of an installed root via the
// read-only boundary, which rejects reparse points and files that change while
// they are read.
func installTransitionInstalledDigest(api installAdmissionIO, root, versionsRoot string) (string, error) {
	if !pathWithinRoot(root, versionsRoot) || installTransitionSamePath(root, versionsRoot) ||
		!installTransitionSamePath(filepath.Dir(root), versionsRoot) {
		return "", errors.New("installed_root_outside_versions")
	}
	info, err := api.Path(root, versionsRoot)
	if err != nil {
		return "", err
	}
	if info.Presence != installEvidencePresent || !info.Directory || info.Target != "" {
		return "", errors.New("installed_root_not_plain_directory")
	}
	paths, err := api.Files(root)
	if err != nil {
		return "", err
	}
	payload := make([]installTransitionFile, 0, len(paths))
	for _, path := range paths {
		size, digest, _, err := api.HashFile(path)
		if err != nil {
			return "", err
		}
		relative, err := filepath.Rel(root, path)
		if err != nil || strings.HasPrefix(relative, "..") {
			return "", errors.New("installed_file_outside_root")
		}
		payload = append(payload, installTransitionFile{RelativePath: relative, Size: size, SHA256: digest})
	}
	return installTransitionPayloadDigest(payload)
}

type installTransitionEvidenceSources struct {
	api             installAdmissionIO
	protected       func() ([]installTransitionProtectedItem, error)
	hostConfig      func() ([]byte, error)
	candidateConfig func() ([]byte, error)
}

func observeInstallTransitionEvidence(m installerManifest, l runtimeLayout, s installTransitionEvidenceSources) (installTransitionEvidence, error) {
	if s.api == nil || s.protected == nil || s.hostConfig == nil || s.candidateConfig == nil {
		return installTransitionEvidence{}, errors.New("evidence_sources_missing")
	}
	snapshot, err := observeInstallAdmission(m, l, s.api)
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("admission_snapshot: %w", err)
	}
	if !validInstallAdmissionVersion(snapshot.Version) || snapshot.Version == m.Version {
		return installTransitionEvidence{}, errors.New("installed_version_not_a_transition_source")
	}
	sourceAgentRoot := filepath.Join(l.VersionsRoot, snapshot.Version)
	if !installTransitionSamePath(snapshot.Current.Target, sourceAgentRoot) {
		return installTransitionEvidence{}, errors.New("installed_agent_activation_ambiguous")
	}
	sourcePOSRoot := snapshot.POSCurrent.Target
	if sourcePOSRoot == "" || !installTransitionSamePath(filepath.Dir(sourcePOSRoot), l.POSVersionsRoot) {
		return installTransitionEvidence{}, errors.New("installed_pos_activation_ambiguous")
	}
	sourcePOSVersion := filepath.Base(sourcePOSRoot)
	if !validInstallAdmissionVersion(sourcePOSVersion) {
		return installTransitionEvidence{}, errors.New("installed_pos_version_invalid")
	}
	installedAgent, err := installTransitionInstalledDigest(s.api, sourceAgentRoot, l.VersionsRoot)
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("installed_agent_digest: %w", err)
	}
	installedPOS, err := installTransitionInstalledDigest(s.api, sourcePOSRoot, l.POSVersionsRoot)
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("installed_pos_digest: %w", err)
	}
	expected, _, err := s.api.Candidate(m, l)
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("candidate_inventory: %w", err)
	}
	candidateAgent, err := installTransitionExpectedDigest(expected, l.VersionRoot)
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("candidate_agent_digest: %w", err)
	}
	candidatePOS, err := installTransitionExpectedDigest(expected, l.POSVersionRoot)
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("candidate_pos_digest: %w", err)
	}
	artifact := ""
	for _, file := range expected {
		if installTransitionSamePath(file.Path, l.ServiceExe) {
			artifact = strings.ToLower(file.SHA256)
		}
	}
	if !installTransitionHex64(artifact) {
		return installTransitionEvidence{}, errors.New("candidate_artifact_digest_missing")
	}
	targetAgent, err := s.api.Path(l.VersionRoot, l.VersionsRoot)
	if err != nil {
		return installTransitionEvidence{}, err
	}
	targetPOS, err := s.api.Path(l.POSVersionRoot, l.POSVersionsRoot)
	if err != nil {
		return installTransitionEvidence{}, err
	}
	hostConfig, err := s.hostConfig()
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("host_config: %w", err)
	}
	candidateConfig, err := s.candidateConfig()
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("candidate_config: %w", err)
	}
	environment, err := observeInstallTransitionQAEnvironment(hostConfig, candidateConfig)
	if err != nil {
		return installTransitionEvidence{}, err
	}
	protected, err := s.protected()
	if err != nil {
		return installTransitionEvidence{}, fmt.Errorf("protected_state: %w", err)
	}
	return installTransitionEvidence{
		CandidateArtifactSHA256: artifact,
		InstalledAgent:          installTransitionArtifact{Version: snapshot.Version, PayloadDigest: installedAgent},
		CandidateAgent:          installTransitionArtifact{Version: m.Version, PayloadDigest: candidateAgent},
		InstalledPOS:            installTransitionArtifact{Version: sourcePOSVersion, PayloadDigest: installedPOS},
		CandidatePOS:            installTransitionArtifact{Version: m.PosVersion, PayloadDigest: candidatePOS},
		Service:                 snapshot.Service,
		AgentCurrent:            snapshot.Current,
		POSCurrent:              snapshot.POSCurrent,
		TargetAgentRoot:         targetAgent,
		TargetPOSRoot:           targetPOS,
		Registration:            snapshot.Registration,
		QAEnvironment:           environment,
		ProtectedState:          protected,
	}, nil
}

// observeNativeInstallTransitionEvidence wires the read-only native sources.
func observeNativeInstallTransitionEvidence(m installerManifest, l runtimeLayout) (installTransitionEvidence, error) {
	system, err := newNativeInstallTransitionSystem(m, nil)
	if err != nil {
		return installTransitionEvidence{}, err
	}
	api := nativeInstallAdmissionIO{}
	return observeInstallTransitionEvidence(m, l, installTransitionEvidenceSources{
		api:       api,
		protected: system.ProtectedState,
		hostConfig: func() ([]byte, error) {
			data, _, err := api.ReadFile(filepath.Join(l.ConfigRoot, "agent.config.local.json"))
			return data, err
		},
		candidateConfig: func() ([]byte, error) {
			return embeddedAssets.ReadFile(m.BundleRoot + "/config/agent.config.local.json")
		},
	})
}
