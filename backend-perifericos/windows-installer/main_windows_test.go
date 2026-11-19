//go:build windows

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
)

const p0ObservationTest = "TestHUWINLifecycleP0NativeObservation"

// Test-only consent signal, NOT authentication or durable anti-replay authority.
// Future operator procedure (separate authorization required): audit source and
// candidate; compile an external test executable, pin its SHA256, select exactly
// this test with count=1, and supply a fresh 32-byte secret via a single stdin
// JSON receipt. Supply only its SHA256 in MANUS_P0_NATIVE_CONSENT_SHA256 and set
// MANUS_P0_NATIVE_OBSERVATION=1 for that process. Never log/reuse the receipt or
// secret. Issue a <=60s receipt with Scope=P0-OBSERVE-ONCE and the approved test
// ExecutableSHA256. EOF terminates the receipt. No installer CLI activates this.
// One-use is enforced within this process; no persistence/multiprocess replay
// protection is claimed. Operator must never reuse the receipt in another run.
// The flag/receipt alone never substitutes for authorization or provenance.
type p0ObservationConsent struct {
	Scope, Secret, ExecutableSHA256 string
	Issued, Expires                 time.Time
}

type p0ObservationGate struct {
	mu   sync.Mutex
	used bool
}

// Test-package memory only. Even testing CPU/repetition scheduling must not
// obtain a second consent in the same process. No initializer/native effects.
var p0NativeObservationGate p0ObservationGate

type p0ObservationPairError struct {
	Phase string
	Cause error
}

func (e *p0ObservationPairError) Error() string { return "observation_incomplete" }
func (e *p0ObservationPairError) Unwrap() error { return e.Cause }

func p0ObservationSelected(enable string, args []string) bool {
	if enable != "1" {
		return false
	}
	run, count := 0, 0
	for _, arg := range args {
		if strings.HasPrefix(arg, "-test.cpu=") || strings.HasPrefix(arg, "-test.bench=") || strings.HasPrefix(arg, "-test.fuzz=") {
			return false
		}
		if strings.HasPrefix(arg, "-test.run=") {
			if arg != "-test.run=^"+p0ObservationTest+"$" {
				return false
			}
			run++
		}
		if strings.HasPrefix(arg, "-test.count=") {
			if arg != "-test.count=1" {
				return false
			}
			count++
		}
	}
	return run == 1 && count == 1
}

func (g *p0ObservationGate) consume(enable, digest string, args []string, input io.Reader, now time.Time) (p0ObservationConsent, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	var c p0ObservationConsent
	if g.used {
		return c, errors.New("consent_consumed")
	}
	// Consume even failed attempts. No retry/fallback within the invocation.
	g.used = true
	if !p0ObservationSelected(enable, args) || len(digest) != 64 || strings.Trim(digest, "0123456789abcdef") != "" || input == nil {
		return c, errors.New("consent_missing")
	}
	b, err := io.ReadAll(io.LimitReader(input, 2049))
	if err != nil || len(b) > 2048 {
		return c, errors.New("consent_input")
	}
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.DisallowUnknownFields()
	if d.Decode(&c) != nil || d.Decode(new(any)) != io.EOF {
		return p0ObservationConsent{}, errors.New("consent_schema")
	}
	secret, err := hex.DecodeString(c.Secret)
	if err != nil || len(secret) != 32 || c.Scope != "P0-OBSERVE-ONCE" || c.Issued.After(now) || !c.Expires.After(now) || c.Expires.Sub(c.Issued) > time.Minute || c.Expires.Sub(c.Issued) <= 0 || now.Sub(c.Issued) > time.Minute || len(c.ExecutableSHA256) != 64 || strings.Trim(c.ExecutableSHA256, "0123456789abcdef") != "" {
		return p0ObservationConsent{}, errors.New("consent_invalid")
	}
	if fmt.Sprintf("%x", sha256.Sum256(secret)) != digest {
		return p0ObservationConsent{}, errors.New("consent_mismatch")
	}
	c.Secret = "" // Never propagate activation material to observation/reporting.
	return c, nil
}

// Pure orchestration. Returned cause remains in memory; never print err.Error(),
// snapshot structs, paths, commands, versions, fingerprints or raw config.
func p0ObservationPair(now func() time.Time, read func() (installAdmissionSnapshot, error)) ([2]installAdmissionSnapshot, time.Duration, error) {
	var pair [2]installAdmissionSnapshot
	start := now()
	for i := range pair {
		if now().Sub(start) >= 30*time.Second {
			return pair, now().Sub(start), &p0ObservationPairError{Phase: "budget", Cause: errors.New("observation_budget")}
		}
		s, err := read()
		pair[i] = s
		if err != nil {
			return pair, now().Sub(start), &p0ObservationPairError{Phase: fmt.Sprintf("snapshot_%d", i+1), Cause: err}
		}
		if now().Sub(start) >= 30*time.Second {
			return pair, now().Sub(start), &p0ObservationPairError{Phase: "budget", Cause: errors.New("observation_budget")}
		}
	}
	if pair[0] != pair[1] {
		return pair, now().Sub(start), &p0ObservationPairError{Phase: "comparison", Cause: errors.New("observation_changed")}
	}
	return pair, now().Sub(start), nil
}

func p0ObservationErrorCode(err error) (string, uint32) {
	var code syscall.Errno
	var admission *installAdmissionError
	var pair *p0ObservationPairError
	reason := "observation_error"
	if errors.As(err, &admission) {
		// Fixed allowlist. No arbitrary error/Reason strings reach output.
		switch admission.Reason {
		case "root_read", "activation_read", "registration_read", "service_read", "metadata_read", "metadata_invalid", "retained_config_read", "retained_config_invalid", "candidate_unproven", "payload_read", "payload_inventory_read", "path_revalidation_failed":
			reason = admission.Reason
		}
	}
	if errors.As(err, &pair) {
		switch pair.Phase {
		case "snapshot_1", "snapshot_2", "budget", "comparison":
			reason = pair.Phase + "/" + reason
		}
	}
	if errors.As(err, &code) {
		return reason, uint32(code)
	}
	return reason, 0
}

func p0ObservationPresence(p installAdmissionPresence) string {
	switch p {
	case installEvidencePresent:
		return "PRESENT"
	case installEvidenceAbsent:
		return "ABSENT_CONFIRMED"
	default:
		return "ERROR_OR_UNOBSERVED"
	}
}

func TestHUWINLifecycleP0NativeObservation(t *testing.T) {
	// This check MUST precede stdin, manifest/layout, adapter and host reads.
	enable := os.Getenv("MANUS_P0_NATIVE_OBSERVATION")
	if !p0ObservationSelected(enable, os.Args[1:]) {
		t.Skip("native observation disabled")
	}
	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" {
		t.Fatal("platform_unsupported")
	}
	for _, item := range os.Environ() {
		key, value, _ := strings.Cut(item, "=")
		if strings.HasPrefix(key, "MANUS_") && key != "MANUS_P0_NATIVE_OBSERVATION" && key != "MANUS_P0_NATIVE_CONSENT_SHA256" && (strings.Contains(key, "NATIVE") || strings.Contains(key, "ACL")) && value != "" {
			t.Fatal("other_optin_active")
		}
	}
	c, err := p0NativeObservationGate.consume(enable, os.Getenv("MANUS_P0_NATIVE_CONSENT_SHA256"), os.Args[1:], os.Stdin, time.Now())
	if err != nil {
		t.Fatal("consent_rejected")
	}
	// Verify the approved QA test artifact, not an installer release. Candidate()
	// hashes this executable too: repair equality against an installed installer
	// is NOT established by a test executable. No substitution/fallback is allowed.
	self, err := os.Executable()
	if err != nil {
		t.Fatal("artifact_path_unavailable")
	}
	_, hash, _, err := (nativeInstallAdmissionIO{}).HashFile(self)
	if err != nil || hash != c.ExecutableSHA256 {
		t.Fatal("artifact_unproven")
	}
	manifest, err := loadManifest() // Embedded-only; no fabricated manifest.
	if err != nil {
		t.Fatal("embedded_candidate_unavailable")
	}
	// No environment redirection into a protected LocalService profile/user tree.
	pf, pd := os.Getenv("ProgramFiles"), os.Getenv("ProgramData")
	if len(pf) < 3 || len(pd) < 3 || !admissionLocalPath(pf) || !admissionLocalPath(pd) || !strings.EqualFold(pf[2:], `\Program Files`) || !strings.EqualFold(pd[2:], `\ProgramData`) {
		t.Fatal("roots_unproven")
	}
	layout := buildLayout(manifest)
	pair, elapsed, err := p0ObservationPair(time.Now, func() (installAdmissionSnapshot, error) {
		return observeInstallAdmission(manifest, layout, nativeInstallAdmissionIO{})
	})
	// No goroutine timeout: never abandon a live reader. The 30s budget is checked
	// between synchronous calls; stalled kernel I/O cannot be forcibly bounded.
	if err != nil {
		phase, code := p0ObservationErrorCode(err)
		t.Fatalf("observation_incomplete phase=%s win32=%d elapsed_ms=%d", phase, code, elapsed.Milliseconds())
	}
	decision, _ := classifyInstallAdmission(manifest, layout, pair[1])
	t.Logf("snapshots=2 consistent=true classification=%s elapsed_ms=%d", decision.State, elapsed.Milliseconds())
	for i, s := range pair {
		t.Logf("snapshot=%d agent=%s pos=%s current=%s pos_current=%s registration=%s service=%s metadata_present=%t binary_present=%t", i+1, p0ObservationPresence(s.Roots[0].Presence), p0ObservationPresence(s.Roots[1].Presence), p0ObservationPresence(s.Current.Presence), p0ObservationPresence(s.POSCurrent.Presence), p0ObservationPresence(s.Registration.Presence), p0ObservationPresence(s.Service.Presence), s.MetadataPresent, s.Service.Binary != "")
	}
	// Observation only. Never run a decision, installWithObserver or logger.
}

func TestHUWINLifecycleP0ObservationConsentPure(t *testing.T) {
	now := time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC)
	secret := strings.Repeat("31", 32) // Synthetic fixture, NOT an activation secret.
	bytes, _ := hex.DecodeString(secret)
	digest := fmt.Sprintf("%x", sha256.Sum256(bytes))
	args := []string{"-test.run=^" + p0ObservationTest + "$", "-test.count=1"}
	base := p0ObservationConsent{Scope: "P0-OBSERVE-ONCE", Secret: secret, ExecutableSHA256: strings.Repeat("a", 64), Issued: now, Expires: now.Add(time.Minute)}
	for _, name := range []string{"valid", "absent", "wrong_enable", "missing_digest", "wrong_digest", "generic_run", "missing_count", "repeat_count", "duplicate_run", "cpu_repetition", "benchmark", "fuzz", "expired", "future", "long_lifetime", "bad_scope", "bad_secret", "bad_artifact", "invalid_json", "unknown_field", "trailing", "oversize", "read_error"} {
		t.Run(name, func(t *testing.T) {
			c, enable, sha, argv := base, "1", digest, append([]string(nil), args...)
			switch name {
			case "absent":
				enable = ""
			case "wrong_enable":
				enable = "true"
			case "missing_digest":
				sha = ""
			case "wrong_digest":
				sha = strings.Repeat("b", 64)
			case "generic_run":
				argv[0] = "-test.run=Test"
			case "missing_count":
				argv = argv[:1]
			case "repeat_count":
				argv[1] = "-test.count=2"
			case "duplicate_run":
				argv = append(argv, args[0])
			case "cpu_repetition":
				argv = append(argv, "-test.cpu=1,2")
			case "benchmark":
				argv = append(argv, "-test.bench=.")
			case "fuzz":
				argv = append(argv, "-test.fuzz=.")
			case "expired":
				c.Expires = now
			case "future":
				c.Issued = now.Add(time.Second)
			case "long_lifetime":
				c.Expires = now.Add(2 * time.Minute)
			case "bad_scope":
				c.Scope = "install"
			case "bad_secret":
				c.Secret = "no"
			case "bad_artifact":
				c.ExecutableSHA256 = "no"
			}
			data, _ := json.Marshal(c)
			switch name {
			case "invalid_json":
				data = []byte("{")
			case "unknown_field":
				data = append(data[:len(data)-1], []byte(`,"extra":true}`)...)
			case "trailing":
				data = append(data, []byte(` {}`)...)
			case "oversize":
				data = []byte(strings.Repeat("x", 2049))
			}
			reader := &p0ObservationCountingReader{Reader: strings.NewReader(string(data))}
			if name == "read_error" {
				reader.err = errors.New("synthetic_private_error")
			}
			var g p0ObservationGate
			got, err := g.consume(enable, sha, argv, reader, now)
			reads := 0
			if err == nil {
				_, _, err = p0ObservationPair(func() time.Time { return now }, func() (installAdmissionSnapshot, error) { reads++; return installAdmissionSnapshot{}, nil })
			}
			if name == "valid" {
				if err != nil || reads != 2 || got.Secret != "" {
					t.Fatal("valid simulated consent rejected")
				}
			} else if err == nil || reads != 0 {
				t.Fatal("unapproved read reached observer")
			}
			if !p0ObservationSelected(enable, argv) && reader.calls != 0 {
				t.Fatal("disabled gate read input")
			}
			if _, err := g.consume(enable, sha, argv, reader, now); err == nil {
				t.Fatal("consent replay accepted")
			}
		})
	}
}

type p0ObservationCountingReader struct {
	io.Reader
	calls int
	err   error
}

func (r *p0ObservationCountingReader) Read(b []byte) (int, error) {
	r.calls++
	if r.err != nil {
		return 0, r.err
	}
	return r.Reader.Read(b)
}

func TestHUWINLifecycleP0ObservationPairPure(t *testing.T) {
	for _, name := range []string{"same", "first_error", "second_error", "changed", "budget"} {
		t.Run(name, func(t *testing.T) {
			reads := 0
			now := time.Unix(1, 0)
			original := errors.New("private path and secret")
			_, _, err := p0ObservationPair(func() time.Time { return now }, func() (installAdmissionSnapshot, error) {
				reads++
				s := installAdmissionSnapshot{}
				if (name == "first_error" && reads == 1) || (name == "second_error" && reads == 2) {
					return s, original
				}
				if name == "changed" && reads == 2 {
					s.Version = "different"
				}
				if name == "budget" {
					now = now.Add(30 * time.Second)
				}
				return s, nil
			})
			if (err == nil) != (name == "same") {
				t.Fatal("pair acceptance changed")
			}
			if (name == "first_error" || name == "budget") && reads != 1 {
				t.Fatal("reader retried")
			}
			if strings.Contains(name, "error") && !errors.Is(err, original) {
				t.Fatal("original cause lost")
			}
		})
	}
	for _, reason := range []string{"root_read", "sensitive_private_value"} {
		t.Run("sanitized_"+map[bool]string{true: "known", false: "unknown"}[reason == "root_read"], func(t *testing.T) {
			phase, code := p0ObservationErrorCode(&installAdmissionError{Reason: reason, Cause: syscall.Errno(5)})
			if code != 5 || (reason != "root_read" && phase != "observation_error") {
				t.Fatal("diagnostic not sanitized")
			}
		})
	}
}

func TestHUWINLifecycleP0ObservationConsentConcurrentPure(t *testing.T) {
	now := time.Unix(100, 0)
	secret := strings.Repeat("42", 32)
	b, _ := hex.DecodeString(secret)
	digest := fmt.Sprintf("%x", sha256.Sum256(b))
	c := p0ObservationConsent{Scope: "P0-OBSERVE-ONCE", Secret: secret, ExecutableSHA256: strings.Repeat("a", 64), Issued: now, Expires: now.Add(time.Minute)}
	data, _ := json.Marshal(c)
	var g p0ObservationGate
	start := make(chan struct{})
	out := make(chan bool, 16)
	for i := 0; i < 16; i++ {
		go func() {
			<-start
			_, e := g.consume("1", digest, []string{"-test.run=^" + p0ObservationTest + "$", "-test.count=1"}, strings.NewReader(string(data)), now)
			out <- e == nil
		}()
	}
	close(start)
	winners := 0
	for i := 0; i < 16; i++ {
		if <-out {
			winners++
		}
	}
	if winners != 1 {
		t.Fatal("consent did not have exactly one in-memory winner")
	}
}

func TestHUWINLifecycleP0ObservationReachabilityPure(t *testing.T) {
	f, e := parser.ParseFile(token.NewFileSet(), "main_windows_test.go", nil, 0)
	if e != nil {
		t.Fatal(e)
	}
	var probe *ast.FuncDecl
	for _, d := range f.Decls {
		if fn, ok := d.(*ast.FuncDecl); ok && fn.Name.Name == p0ObservationTest {
			probe = fn
		}
	}
	if probe == nil || len(probe.Body.List) < 3 {
		t.Fatal("probe missing")
	}
	// First statement may read only the specific environment variable. Second
	// statement must skip unselected invocations, before manifest/adapter/input.
	first, ok := probe.Body.List[0].(*ast.AssignStmt)
	if !ok || len(first.Rhs) != 1 {
		t.Fatal("gate not first")
	}
	call, ok := first.Rhs[0].(*ast.CallExpr)
	if !ok {
		t.Fatal("gate not first")
	}
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok || sel.Sel.Name != "Getenv" {
		t.Fatal("host read before gate")
	}
	guard, ok := probe.Body.List[1].(*ast.IfStmt)
	if !ok || len(guard.Body.List) != 1 {
		t.Fatal("skip guard missing")
	}
	stmt, ok := guard.Body.List[0].(*ast.ExprStmt)
	if !ok {
		t.Fatal("skip missing")
	}
	skip, ok := stmt.X.(*ast.CallExpr)
	if !ok {
		t.Fatal("skip missing")
	}
	skipSel, ok := skip.Fun.(*ast.SelectorExpr)
	if !ok || skipSel.Sel.Name != "Skip" {
		t.Fatal("ordinary test could reach native observer")
	}
	blocked := map[string]bool{"install": true, "installWithObserver": true, "newPreflightLogger": true, "ensureBaseDirectories": true, "newInstallLogger": true, "ensureElevated": true, "relaunchElevated": true, "uninstall": true, "writeUninstallMetadata": true, "printPreflight": true}
	ast.Inspect(probe.Body, func(n ast.Node) bool {
		if c, ok := n.(*ast.CallExpr); ok {
			if id, ok := c.Fun.(*ast.Ident); ok && blocked[id.Name] {
				t.Fatal("probe reaches an installer entrypoint/effect")
			}
		}
		return true
	})
}

func TestHUWINLifecycleP0AMetadata(t *testing.T) {
	paths := []struct {
		name, current, command string
	}{
		{"spaces", `C:\Program Files\Manus\PeripheralAgent\current`, `"C:\Program Files\Manus\PeripheralAgent\current\ManusTerminalSetup.exe" uninstall`},
		{"plain", `C:\QA\Manus\current`, `C:\QA\Manus\current\ManusTerminalSetup.exe uninstall`},
		{"unicode", `C:\QA POS\Terminal-Ω\current`, `"C:\QA POS\Terminal-Ω\current\ManusTerminalSetup.exe" uninstall`},
		{"trailing_separator", `C:\QA POS\current\`, `"C:\QA POS\current\ManusTerminalSetup.exe" uninstall`},
	}
	for _, operation := range []string{"install", "repair", "update"} {
		for _, path := range paths {
			t.Run(operation+"/"+path.name, func(t *testing.T) {
				version := "0.1.1-qa.13"
				if operation == "update" {
					version = "0.1.1-qa.14"
				}
				manifest := installerManifest{DisplayName: "Manus QA", Version: version}
				layout := runtimeLayout{CurrentRoot: path.current}
				got := buildUninstallMetadata(layout, manifest, time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC))
				for _, key := range []string{"UninstallString", "QuietUninstallString"} {
					if got[key] != path.command || strings.Contains(got[key], "--remove-data") {
						t.Fatalf("%s = %q, want conservative command %q", key, got[key], path.command)
					}
				}
				if len(got) != 8 || got["DisplayName"] != manifest.DisplayName || got["DisplayVersion"] != version || got["Publisher"] != publisher || got["InstallLocation"] != path.current || got["InstallDate"] != "20261020" || got["DisplayIcon"] != filepath.Join(path.current, "ManusTerminalSetup.exe") {
					t.Fatalf("registration metadata changed unexpectedly: %#v", got)
				}
				if layout.CurrentRoot != path.current || manifest.Version != version {
					t.Fatal("metadata generation mutated its inputs")
				}
			})
		}
	}
}

func TestHUWINLifecycleP0AUninstallArguments(t *testing.T) {
	// Parsing compatibility only. Never call uninstall, cleanup or a registry writer.
	cases := []struct {
		name   string
		args   []string
		remove bool
	}{
		{"default", nil, false},
		{"quiet_long", []string{"--quiet"}, false},
		{"quiet_slash", []string{"/quiet"}, false},
		{"quiet_no_restart", []string{"/quiet", "/norestart"}, false},
		{"silent_long", []string{"--silent"}, false},
		{"silent_slash", []string{"/silent"}, false},
		{"short_silent", []string{"/S"}, false},
		{"very_silent", []string{"/VERYSILENT"}, false},
		{"quiet_value", []string{"--quiet=true"}, false},
		{"false_value_not_opt_in", []string{"--remove-data=false"}, false},
		{"numeric_value_not_supported", []string{"--remove-data=1"}, false},
		{"embedded_text_not_opt_in", []string{"--quiet=--remove-data"}, false},
		{"prefix_not_opt_in", []string{"--remove-data-extra"}, false},
		{"spaces_not_exact_arg", []string{" --remove-data "}, false},
		{"normal_command", []string{"uninstall"}, false},
		{"legacy_explicit", []string{"--remove-data"}, true},
		{"explicit_alias", []string{"/remove-data"}, true},
		{"explicit_case", []string{"--REMOVE-DATA"}, true},
		{"quiet_with_explicit_request", []string{"/quiet", "--remove-data"}, true},
		{"duplicate_explicit", []string{"--remove-data", "/remove-data"}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			remove := containsArg(tc.args, "--remove-data", "/remove-data")
			if remove != tc.remove {
				t.Fatalf("explicit argument detection = %v, want %v", remove, tc.remove)
			}
			layout := runtimeLayout{InstallRoot: `C:\QA Payload`, ProgramDataRoot: `C:\QA Retained Data`, POSInstallRoot: `C:\QA POS`}
			args := uninstallCleanupArgs(1234, layout, remove)
			pid, installRoot, dataRoot, posRoot, parsed, err := parseUninstallCleanupArgs(args)
			if err != nil || pid != 1234 || installRoot != layout.InstallRoot || dataRoot != layout.ProgramDataRoot || posRoot != layout.POSInstallRoot || parsed != tc.remove {
				t.Fatalf("pure cleanup-argument round trip failed: explicit=%v err=%v", parsed, err)
			}
			// An explicit legacy argument remains parseable, not verified consent.
			metadata := buildUninstallMetadata(runtimeLayout{CurrentRoot: layout.InstallRoot}, installerManifest{}, time.Time{})
			if metadata["QuietUninstallString"] != metadata["UninstallString"] || strings.Contains(metadata["QuietUninstallString"], "--remove-data") {
				t.Fatal("caller arguments leaked into default registered commands")
			}
		})
	}
}

func TestHUWINLifecycleP0AMetadataHasNoSharedMutableState(t *testing.T) {
	for _, key := range []string{"UninstallString", "QuietUninstallString", "DisplayVersion"} {
		t.Run(key, func(t *testing.T) {
			layout := runtimeLayout{CurrentRoot: `C:\QA POS\current`}
			manifest := installerManifest{Version: "qa"}
			first := buildUninstallMetadata(layout, manifest, time.Time{})
			want := first[key]
			first[key] = "changed by a caller"
			if got := buildUninstallMetadata(layout, manifest, time.Time{})[key]; got != want {
				t.Fatalf("metadata leaked mutable state: %q", got)
			}
		})
	}
}

func TestHUWINLifecycleP0ASharedWriterUsesPureMetadata(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "main_windows.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok {
			continue
		}
		ast.Inspect(fn.Body, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			if name, ok := call.Fun.(*ast.Ident); ok {
				if fn.Name.Name == "writeUninstallMetadata" && name.Name == "buildUninstallMetadata" {
					counts["shared_builder"]++
				}
				if fn.Name.Name == "installWithObserver" && name.Name == "writeUninstallMetadata" {
					counts["shared_writer"]++
				}
			}
			if fn.Name.Name == "buildUninstallMetadata" {
				selector, ok := call.Fun.(*ast.SelectorExpr)
				if !ok {
					t.Fatal("metadata builder contains an unexpected call")
				}
				base, ok := selector.X.(*ast.Ident)
				if !ok {
					t.Fatal("metadata builder contains an unexpected receiver")
				}
				allowed := map[string]bool{"filepath.Join": true, "fmt.Sprintf": true, "syscall.EscapeArg": true, "installedAt.Format": true}
				if !allowed[base.Name+"."+selector.Sel.Name] {
					t.Fatalf("metadata builder calls unexpected capability %s.%s", base.Name, selector.Sel.Name)
				}
				counts["pure_calls"]++
			}
			return true
		})
	}
	if counts["shared_builder"] != 1 || counts["shared_writer"] != 1 || counts["pure_calls"] != 4 {
		t.Fatalf("install/repair/update registration bypasses the shared pure policy: %#v", counts)
	}
}

// All P0-B evidence below is synthetic. No nativeInstallAdmissionIO is invoked.
type fakeP0BAdmissionIO struct {
	paths        map[string]installAdmissionPath
	data         map[string][]byte
	identities   map[string]string
	registration installAdmissionRegistration
	service      installAdmissionService
	expected     []installAdmissionExpectedFile
	fail         map[string]error
	hook         func(string, string)
	ops          []string
}

func (f *fakeP0BAdmissionIO) call(op, path string) error {
	f.ops = append(f.ops, op+":"+path)
	if f.hook != nil {
		f.hook(op, path)
	}
	if e := f.fail[op+":"+path]; e != nil {
		return e
	}
	return f.fail[op]
}
func (f *fakeP0BAdmissionIO) Path(path, versions string) (installAdmissionPath, error) {
	if e := f.call("path", path); e != nil {
		return installAdmissionPath{}, e
	}
	return f.paths[path], nil
}
func (f *fakeP0BAdmissionIO) ReadFile(path string) ([]byte, string, error) {
	if e := f.call("read", path); e != nil {
		return nil, "", e
	}
	d, ok := f.data[path]
	if !ok {
		return nil, "", os.ErrNotExist
	}
	return append([]byte(nil), d...), "file:" + path + f.identities[path], nil
}
func (f *fakeP0BAdmissionIO) HashFile(path string) (int64, string, string, error) {
	if e := f.call("hash", path); e != nil {
		return 0, "", "", e
	}
	d, ok := f.data[path]
	if !ok {
		return 0, "", "", os.ErrNotExist
	}
	return int64(len(d)), fmt.Sprintf("%x", sha256.Sum256(d)), "file:" + path + f.identities[path], nil
}
func (f *fakeP0BAdmissionIO) Files(root string) ([]string, error) {
	if e := f.call("files", root); e != nil {
		return nil, e
	}
	var paths []string
	for p := range f.data {
		if pathWithinRoot(p, root) {
			paths = append(paths, p)
		}
	}
	sort.Strings(paths)
	return paths, nil
}
func (f *fakeP0BAdmissionIO) Registration(path string) (installAdmissionRegistration, error) {
	if e := f.call("registry", path); e != nil {
		return installAdmissionRegistration{}, e
	}
	return f.registration, nil
}
func (f *fakeP0BAdmissionIO) Service(name string) (installAdmissionService, error) {
	if e := f.call("service", name); e != nil {
		return installAdmissionService{}, e
	}
	return f.service, nil
}
func (f *fakeP0BAdmissionIO) Candidate(m installerManifest, l runtimeLayout) ([]installAdmissionExpectedFile, string, error) {
	if e := f.call("candidate", ""); e != nil {
		return nil, "", e
	}
	return append([]installAdmissionExpectedFile(nil), f.expected...), "synthetic-candidate", nil
}

func p0BAdmissionFixture(t *testing.T) (installerManifest, runtimeLayout, *fakeP0BAdmissionIO) {
	t.Helper()
	t.Setenv("ProgramFiles", `C:\QA Program Files`)
	t.Setenv("ProgramData", `C:\QA Retained Data`)
	m := installerManifest{Version: "0.1.1-qa.13", PosVersion: "0.1.0", VersionFileName: "VERSION.json", ServiceName: serviceName, ServiceAccount: `NT AUTHORITY\LocalService`, ServiceArgs: []string{"service"}}
	l := buildLayout(m)
	f := &fakeP0BAdmissionIO{paths: map[string]installAdmissionPath{}, data: map[string][]byte{}, identities: map[string]string{}, fail: map[string]error{}}
	for _, p := range []string{l.InstallRoot, l.POSInstallRoot, l.ProgramDataRoot, l.ConfigRoot, l.LogsRoot, l.StateRoot} {
		f.paths[p] = installAdmissionPath{Presence: installEvidencePresent, Directory: true, Fingerprint: "dir:" + p}
	}
	f.paths[l.CurrentRoot] = installAdmissionPath{Presence: installEvidencePresent, Directory: true, Target: l.VersionRoot, Fingerprint: "current"}
	f.paths[l.POSCurrentRoot] = installAdmissionPath{Presence: installEvidencePresent, Directory: true, Target: l.POSVersionRoot, Fingerprint: "pos-current"}
	f.data[filepath.Join(l.VersionRoot, "VERSION.json")] = []byte(`{"version":"0.1.1-qa.13","agent":"manus-pos-peripheral-agent","platform":"win32","architecture":"x64","runtime":"v22","packaging":"portable-node-runtime"}`)
	for _, p := range []string{l.ServiceExe, filepath.Join(l.VersionRoot, "runtime", "node.exe"), filepath.Join(l.VersionRoot, "app", "main.js"), filepath.Join(l.POSVersionRoot, "Manus POS.exe"), filepath.Join(l.POSVersionRoot, "resources", "app.asar"), filepath.Join(l.POSVersionRoot, "resources", "manus-shell.config.json")} {
		f.data[p] = []byte("synthetic payload")
	}
	for p, d := range f.data {
		f.expected = append(f.expected, installAdmissionExpectedFile{Path: p, Size: int64(len(d)), SHA256: fmt.Sprintf("%x", sha256.Sum256(d))})
	}
	sort.Slice(f.expected, func(i, j int) bool { return f.expected[i].Path < f.expected[j].Path })
	command := buildUninstallMetadata(l, m, time.Time{})["UninstallString"]
	f.registration = installAdmissionRegistration{Presence: installEvidencePresent, Version: m.Version, Location: l.CurrentRoot, Uninstall: command, Quiet: command}
	f.service = installAdmissionService{Presence: installEvidencePresent, Account: m.ServiceAccount, Binary: buildServiceBinaryPath(l.ServiceExe, "service"), State: svc.Stopped}
	return m, l, f
}

func p0BMakeFresh(l runtimeLayout, f *fakeP0BAdmissionIO) {
	for _, p := range []string{l.InstallRoot, l.POSInstallRoot, l.CurrentRoot, l.POSCurrentRoot} {
		f.paths[p] = installAdmissionPath{Presence: installEvidenceAbsent, Fingerprint: "absent:" + p}
	}
	f.registration = installAdmissionRegistration{Presence: installEvidenceAbsent}
	f.service = installAdmissionService{Presence: installEvidenceAbsent}
}

func TestHUWINLifecycleP0BStrictVersion(t *testing.T) {
	cases := []struct{ name, data, version string }{
		{"minimal", `{"version":"2.0.1"}`, "2.0.1"},
		{"qa", `{"version":"0.1.1-qa.13"}`, "0.1.1-qa.13"},
		{"production", `{"version":"0.1.1-prd.2"}`, "0.1.1-prd.2"},
		{"empty", "", ""}, {"plain_text", "0.1.1-qa.13", ""}, {"invalid_json", `{"version":`, ""}, {"null", "null", ""}, {"array", "[]", ""}, {"missing", `{}`, ""},
		{"empty_version", `{"version":""}`, ""}, {"nonstring", `{"version":13}`, ""}, {"duplicate", `{"version":"1.0.0","version":"2.0.0"}`, ""},
		{"case_alias", `{"Version":"1.0.0"}`, ""}, {"unknown_field", `{"version":"1.0.0","newSchema":1}`, ""}, {"trailing_object", `{"version":"1.0.0"}{}`, ""}, {"trailing_text", `{"version":"1.0.0"}x`, ""},
		{"traversal", `{"version":"../1.0.0"}`, ""}, {"backslash", `{"version":"..\\1.0.0"}`, ""}, {"drive", `{"version":"C:1.0.0"}`, ""}, {"ADS", `{"version":"1.0.0:stream"}`, ""}, {"space", `{"version":"1.0.0 "}`, ""}, {"unknown_format", `{"version":"qa"}`, ""}, {"leading_zero", `{"version":"01.0.0"}`, ""},
		{"other_agent", `{"version":"1.0.0","agent":"other"}`, ""}, {"other_platform", `{"version":"1.0.0","platform":"linux"}`, ""}, {"other_arch", `{"version":"1.0.0","architecture":"arm64"}`, ""}, {"other_packaging", `{"version":"1.0.0","packaging":"unknown"}`, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			v, e := decodeInstallAdmissionVersion([]byte(tc.data))
			if tc.version != "" {
				if e != nil || v != tc.version {
					t.Fatalf("valid metadata rejected: %v", e)
				}
			} else if e == nil {
				t.Fatal("unsupported metadata accepted")
			}
		})
	}
}

func TestHUWINLifecycleP0BClassifications(t *testing.T) {
	m, l, f := p0BAdmissionFixture(t)
	base, e := observeInstallAdmission(m, l, f)
	if e != nil {
		t.Fatal(e)
	}
	cases := []struct {
		name   string
		mutate func(*installAdmissionSnapshot)
		state  installAdmissionState
		reason string
	}{
		{"repair_stopped", func(s *installAdmissionSnapshot) {}, installAdmissionRepair, "same_candidate"},
		{"repair_running", func(s *installAdmissionSnapshot) { s.Service.State = svc.Running; s.Service.PID = 1234 }, installAdmissionRepair, "same_candidate"},
		{"legacy_quiet_observed_only", func(s *installAdmissionSnapshot) { s.Registration.Quiet += " --remove-data" }, installAdmissionRepair, "same_candidate"},
		{"root_absent", func(s *installAdmissionSnapshot) { s.Roots[0].Presence = installEvidenceAbsent }, installAdmissionPartial, "incomplete_footprints"},
		{"POS_root_absent", func(s *installAdmissionSnapshot) { s.Roots[1].Presence = installEvidenceAbsent }, installAdmissionPartial, "incomplete_footprints"},
		{"current_absent", func(s *installAdmissionSnapshot) { s.Current.Presence = installEvidenceAbsent }, installAdmissionPartial, "incomplete_footprints"},
		{"metadata_missing", func(s *installAdmissionSnapshot) { s.MetadataPresent = false }, installAdmissionPartial, "incomplete_footprints"},
		{"metadata_invalid", func(s *installAdmissionSnapshot) { s.Version = "../bad" }, installAdmissionUnknown, "metadata_invalid"},
		{"orphan_target_is_not_active", func(s *installAdmissionSnapshot) { s.Current.Target = "" }, installAdmissionPartial, "activation_mismatch"},
		{"activation_wrong_version", func(s *installAdmissionSnapshot) { s.Current.Target = filepath.Join(l.VersionsRoot, "0.1.1-qa.9") }, installAdmissionPartial, "activation_mismatch"},
		{"registry_absent", func(s *installAdmissionSnapshot) {
			s.Registration = installAdmissionRegistration{Presence: installEvidenceAbsent}
		}, installAdmissionPartial, "incomplete_footprints"},
		{"registry_version", func(s *installAdmissionSnapshot) { s.Registration.Version = "0.1.1-qa.9" }, installAdmissionPartial, "registration_mismatch"},
		{"registry_location", func(s *installAdmissionSnapshot) { s.Registration.Location = `C:\Other` }, installAdmissionPartial, "registration_mismatch"},
		{"registry_command", func(s *installAdmissionSnapshot) { s.Registration.Uninstall += " --other" }, installAdmissionPartial, "registration_command_mismatch"},
		{"registry_quiet", func(s *installAdmissionSnapshot) { s.Registration.Quiet += " --unexpected" }, installAdmissionPartial, "registration_command_mismatch"},
		{"service_absent", func(s *installAdmissionSnapshot) {
			s.Service = installAdmissionService{Presence: installEvidenceAbsent}
		}, installAdmissionPartial, "incomplete_footprints"},
		{"service_other_account", func(s *installAdmissionSnapshot) { s.Service.Account = "SYSTEM" }, installAdmissionPartial, "service_registration_mismatch"},
		{"service_other_binary", func(s *installAdmissionSnapshot) { s.Service.Binary = `C:\Other.exe service` }, installAdmissionPartial, "service_registration_mismatch"},
		{"service_pending", func(s *installAdmissionSnapshot) { s.Service.State = svc.StartPending }, installAdmissionUnknown, "service_state_uncertain"},
		{"service_PID_missing", func(s *installAdmissionSnapshot) { s.Service.State = svc.Running }, installAdmissionUnknown, "service_state_uncertain"},
		{"same_label_different_bytes", func(s *installAdmissionSnapshot) { s.Payload = "different" }, installAdmissionUnknown, "candidate_bytes_differ"},
		{"missing_payload", func(s *installAdmissionSnapshot) { s.Payload = "missing" }, installAdmissionPartial, "payload_missing"},
		{"payload_unobserved", func(s *installAdmissionSnapshot) { s.Payload = "" }, installAdmissionUnknown, "payload_unproven"},
		{"POS_other_release", func(s *installAdmissionSnapshot) { s.POSCurrent.Target = filepath.Join(l.POSVersionsRoot, "0.2.0") }, installAdmissionUnknown, "pos_transition_unproven"},
		{"path_unknown", func(s *installAdmissionSnapshot) { s.Roots[0].Presence = installEvidenceUnknown }, installAdmissionUnknown, "path_observation_incomplete"},
		{"identity_missing", func(s *installAdmissionSnapshot) { s.Current.Fingerprint = "" }, installAdmissionUnknown, "path_observation_incomplete"},
		{"retained_reparse_or_file", func(s *installAdmissionSnapshot) { s.Roots[3].Directory = false }, installAdmissionPartial, "path_not_directory"},
		{"system_unknown", func(s *installAdmissionSnapshot) { s.Service.Presence = installEvidenceUnknown }, installAdmissionUnknown, "system_observation_incomplete"},
		{"candidate_unknown", func(s *installAdmissionSnapshot) { s.CandidateFingerprint = "" }, installAdmissionUnknown, "candidate_unproven"},
		{"contradictory_absence", func(s *installAdmissionSnapshot) { s.Service.Presence = installEvidenceAbsent }, installAdmissionUnknown, "contradictory_absence"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := base
			tc.mutate(&s)
			d, e := classifyInstallAdmission(m, l, s)
			if d.State != tc.state || d.Reason != tc.reason || (e == nil) != (tc.state == installAdmissionRepair) {
				t.Fatalf("state/reason=%s/%s error=%v", d.State, d.Reason, e)
			}
		})
	}
	for _, version := range []string{"0.1.1-qa.9", "0.1.1-qa.14", "0.1.1-prd.2", "1.0.0", "0.0.1"} {
		t.Run("no_update_"+version, func(t *testing.T) {
			s := base
			s.Version = version
			s.Current.Target = filepath.Join(l.VersionsRoot, version)
			s.Registration.Version = version
			s.Service.Binary = buildServiceBinaryPath(filepath.Join(s.Current.Target, "ManusTerminalSetup.exe"), "service")
			d, e := classifyInstallAdmission(m, l, s)
			if e == nil || d.State != installAdmissionUnknown || d.Reason != "transition_unproven" {
				t.Fatalf("unaccredited transition admitted: %v", e)
			}
		})
	}
}

func TestHUWINLifecycleP0BReadOnlyCollector(t *testing.T) {
	cases := []struct {
		name   string
		change func(runtimeLayout, *fakeP0BAdmissionIO)
		state  installAdmissionState
		reason string
	}{
		{"repair_equal", func(runtimeLayout, *fakeP0BAdmissionIO) {}, installAdmissionRepair, "same_candidate"},
		{"fresh_clean", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			p0BMakeFresh(l, f)
			for _, p := range []string{l.ProgramDataRoot, l.ConfigRoot, l.LogsRoot, l.StateRoot} {
				f.paths[p] = installAdmissionPath{Presence: installEvidenceAbsent, Fingerprint: "absent:" + p}
			}
		}, installAdmissionFresh, "proven_absent"},
		{"fresh_retained_data", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			p0BMakeFresh(l, f)
			f.data[filepath.Join(l.ConfigRoot, "agent.config.local.json")] = []byte(`{"retainedSetting":"preserve"}`)
		}, installAdmissionFresh, "proven_absent"},
		{"current_missing_orphan_present", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			f.paths[l.CurrentRoot] = installAdmissionPath{Presence: installEvidenceAbsent, Fingerprint: "current absent"}
		}, installAdmissionPartial, "incomplete_footprints"},
		{"only_service", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			service := f.service
			p0BMakeFresh(l, f)
			f.service = service
		}, installAdmissionPartial, "incomplete_footprints"},
		{"only_registry", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			reg := f.registration
			p0BMakeFresh(l, f)
			f.registration = reg
		}, installAdmissionPartial, "incomplete_footprints"},
		{"only_POS", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			pos := f.paths[l.POSInstallRoot]
			p0BMakeFresh(l, f)
			f.paths[l.POSInstallRoot] = pos
		}, installAdmissionPartial, "incomplete_footprints"},
		{"metadata_missing", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			delete(f.data, filepath.Join(l.VersionRoot, "VERSION.json"))
		}, installAdmissionPartial, "incomplete_footprints"},
		{"invalid_json_is_not_text_version", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			f.data[filepath.Join(l.VersionRoot, "VERSION.json")] = []byte(`{"version":`)
		}, installAdmissionUnknown, "metadata_invalid"},
		{"config_invalid", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			f.data[filepath.Join(l.ConfigRoot, "agent.config.local.json")] = []byte(`null`)
		}, installAdmissionUnknown, "retained_config_invalid"},
		{"same_version_altered_file", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			f.data[filepath.Join(l.VersionRoot, "app", "main.js")] = []byte("different bytes")
		}, installAdmissionUnknown, "candidate_bytes_differ"},
		{"same_version_extra_file", func(l runtimeLayout, f *fakeP0BAdmissionIO) {
			f.data[filepath.Join(l.POSVersionRoot, "extra.js")] = []byte("unexpected")
		}, installAdmissionUnknown, "candidate_bytes_differ"},
		{"payload_missing", func(l runtimeLayout, f *fakeP0BAdmissionIO) { delete(f.data, l.ServiceExe) }, installAdmissionPartial, "payload_missing"},
		{"empty_candidate", func(l runtimeLayout, f *fakeP0BAdmissionIO) { f.expected = nil }, installAdmissionUnknown, "candidate_unproven"},
		{"duplicate_candidate", func(l runtimeLayout, f *fakeP0BAdmissionIO) { f.expected = append(f.expected, f.expected[0]) }, installAdmissionUnknown, "candidate_inventory_invalid"},
		{"candidate_outside", func(l runtimeLayout, f *fakeP0BAdmissionIO) { f.expected[0].Path = `C:\Unrelated\file.exe` }, installAdmissionUnknown, "candidate_inventory_invalid"},
		{"candidate_bad_hash", func(l runtimeLayout, f *fakeP0BAdmissionIO) { f.expected[0].SHA256 = "not SHA-256" }, installAdmissionUnknown, "candidate_inventory_invalid"},
		{"candidate_negative_size", func(l runtimeLayout, f *fakeP0BAdmissionIO) { f.expected[0].Size = -1 }, installAdmissionUnknown, "candidate_inventory_invalid"},
		{"candidate_huge_size", func(l runtimeLayout, f *fakeP0BAdmissionIO) { f.expected[0].Size = 1 << 31 }, installAdmissionUnknown, "candidate_inventory_invalid"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m, l, f := p0BAdmissionFixture(t)
			tc.change(l, f)
			before := map[string]string{}
			for p, data := range f.data {
				before[p] = string(data)
			}
			reads := 0
			d, e := confirmInstallAdmission(m, l, func() (installAdmissionSnapshot, error) { reads++; return observeInstallAdmission(m, l, f) })
			if d.State != tc.state || d.Reason != tc.reason {
				t.Fatalf("%s/%s error=%v", d.State, d.Reason, e)
			}
			accepted := tc.state == installAdmissionFresh || tc.state == installAdmissionRepair
			if (e == nil) != accepted {
				t.Fatalf("admission error mismatch: %v", e)
			}
			if accepted && reads != 2 {
				t.Fatalf("successful admission used %d snapshots", reads)
			}
			if !accepted && reads != 1 {
				t.Fatalf("rejected input retried %d times", reads)
			}
			for p, data := range f.data {
				if before[p] != string(data) {
					t.Fatal("observer mutated fixture data")
				}
			}
		})
	}
}

func TestHUWINLifecycleP0BReadErrorsRemainUnknown(t *testing.T) {
	m, l, _ := p0BAdmissionFixture(t)
	operations := []string{"path:" + l.InstallRoot, "path:" + l.POSInstallRoot, "path:" + l.ProgramDataRoot, "path:" + l.ConfigRoot, "path:" + l.LogsRoot, "path:" + l.StateRoot, "path:" + l.CurrentRoot, "path:" + l.POSCurrentRoot, "read:" + filepath.Join(l.VersionRoot, "VERSION.json"), "read:" + filepath.Join(l.ConfigRoot, "agent.config.local.json"), "registry:" + l.RegistryKey, "service:" + m.ServiceName, "candidate:", "hash:" + l.ServiceExe, "files:" + l.VersionRoot, "files:" + l.POSVersionRoot}
	for i, operation := range operations {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			m, l, f := p0BAdmissionFixture(t)
			primary := windows.ERROR_ACCESS_DENIED
			closeErr := errors.New("synthetic close failure")
			f.fail[operation] = errors.Join(primary, closeErr)
			d, e := confirmInstallAdmission(m, l, func() (installAdmissionSnapshot, error) { return observeInstallAdmission(m, l, f) })
			if d.State != installAdmissionUnknown || e == nil || !errors.Is(e, primary) || !errors.Is(e, closeErr) {
				t.Fatalf("lost read/close error or false absence: %s %v", d.State, e)
			}
			var diagnostic *installAdmissionError
			if !errors.As(e, &diagnostic) || strings.Contains(e.Error(), l.InstallRoot) || strings.Contains(e.Error(), "synthetic close") {
				t.Fatal("diagnostic leaked underlying detail")
			}
		})
	}
}

type p0BAdmissionSink func(installerCoreEvent)

func (sink p0BAdmissionSink) Emit(event installerCoreEvent) { sink(event) }

func TestHUWINLifecycleP0BRevalidationBeforeEffects(t *testing.T) {
	cases := []string{"stable_repair", "stable_fresh", "preflight_error", "first_read_error", "second_read_error", "root_identity", "current_identity", "metadata_identity", "service_state", "registry", "candidate_identity", "payload_identity", "retained_config", "callback_change", "first_partial", "missing_observer"}
	for _, name := range cases {
		t.Run(name, func(t *testing.T) {
			m, l, f := p0BAdmissionFixture(t)
			if name == "stable_fresh" {
				p0BMakeFresh(l, f)
			}
			var sequence uint64
			reads := 0
			primary := errors.New("synthetic observation failure")
			effects := map[string]int{"logger": 0, "directories": 0, "service": 0, "registry": 0, "ACL": 0, "data": 0}
			var order []string
			preflight := func() error {
				order = append(order, "preflight")
				if name == "preflight_error" {
					return primary
				}
				return nil
			}
			observe := func() (installAdmissionSnapshot, error) {
				reads++
				order = append(order, fmt.Sprintf("observe%d", reads))
				if (name == "first_read_error" && reads == 1) || (name == "second_read_error" && reads == 2) {
					return installAdmissionSnapshot{}, primary
				}
				s, e := observeInstallAdmission(m, l, f)
				if reads == 1 && name == "first_partial" {
					s.MetadataPresent = false
				}
				if reads == 2 {
					switch name {
					case "root_identity":
						s.Roots[0].Fingerprint += "changed"
					case "current_identity":
						s.Current.Fingerprint += "changed"
					case "metadata_identity", "payload_identity", "retained_config":
						s.Fingerprint += "changed"
					case "service_state":
						s.Service.State = svc.Running
						s.Service.PID = 1234
					case "registry":
						s.Registration.Location += `\other`
					case "candidate_identity":
						s.CandidateFingerprint += "changed"
					}
				}
				return s, e
			}
			if name == "missing_observer" {
				observe = nil
			}
			sink := p0BAdmissionSink(func(event installerCoreEvent) {
				order = append(order, string(event.Type))
				if event.Type == eventStepSucceeded && name == "callback_change" {
					f.registration.Version = "0.1.1-qa.9"
				}
			})
			d, e := verifyInstallAdmissionStep(m, l, sink, &sequence, preflight, observe)
			if e == nil {
				for key := range effects {
					effects[key]++
				}
				order = append(order, "first_effect")
			}
			accepted := name == "stable_repair" || name == "stable_fresh"
			if (e == nil) != accepted {
				t.Fatalf("unexpected admission %s: %v", d.State, e)
			}
			for key, count := range effects {
				if !accepted && count != 0 {
					t.Fatalf("rejection reached %s", key)
				}
			}
			if accepted {
				if reads != 2 || order[len(order)-2] != "observe2" || order[len(order)-1] != "first_effect" {
					t.Fatalf("callback/effect after last observation: %v", order)
				}
			} else if name == "preflight_error" || name == "first_read_error" || name == "second_read_error" {
				if !errors.Is(e, primary) {
					t.Fatal("original error lost")
				}
			}
			if !accepted && name != "first_partial" && d.State != installAdmissionUnknown {
				t.Fatalf("uncertainty became %s", d.State)
			}
		})
	}
}

func TestHUWINLifecycleP0BRevalidationReportsExistingCoreFailure(t *testing.T) {
	for _, failure := range []string{"changed", "read_error"} {
		t.Run(failure, func(t *testing.T) {
			m, l, f := p0BAdmissionFixture(t)
			state := newInstallerCoreState()
			var sequence uint64
			reads := 0
			sink := p0BAdmissionSink(func(event installerCoreEvent) {
				if !applyInstallerCoreEvent(&state, event) {
					t.Fatalf("existing Core rejected %s", event.Type)
				}
			})
			emitCoreStep(sink, &sequence, eventInstallStarted, "", nil)
			_, e := verifyInstallAdmissionStep(m, l, sink, &sequence, func() error { return nil }, func() (installAdmissionSnapshot, error) {
				reads++
				if reads == 2 && failure == "read_error" {
					return installAdmissionSnapshot{}, os.ErrPermission
				}
				snapshot, err := observeInstallAdmission(m, l, f)
				if reads == 2 {
					snapshot.Fingerprint += "changed"
				}
				return snapshot, err
			})
			if e == nil || state.Phase != coreFailedSafe || !coreCloseAllowed(state) {
				t.Fatalf("revalidation failure was not visible/closable: phase=%s err=%v", state.Phase, e)
			}
		})
	}
}

func TestHUWINLifecycleP0BChangesDuringObservation(t *testing.T) {
	for _, kind := range []string{"root", "current", "registry", "service"} {
		t.Run(kind, func(t *testing.T) {
			m, l, f := p0BAdmissionFixture(t)
			calls := 0
			f.hook = func(op, path string) {
				match := (kind == "root" && op == "path" && path == l.InstallRoot) || (kind == "current" && op == "path" && path == l.CurrentRoot) || (kind == "registry" && op == "registry") || (kind == "service" && op == "service")
				if !match {
					return
				}
				calls++
				if calls != 2 {
					return
				}
				switch kind {
				case "root":
					p := f.paths[l.InstallRoot]
					p.Fingerprint += "changed"
					f.paths[l.InstallRoot] = p
				case "current":
					p := f.paths[l.CurrentRoot]
					p.Target = `C:\Other`
					f.paths[l.CurrentRoot] = p
				case "registry":
					f.registration.Version = "0.1.1-qa.9"
				case "service":
					f.service.Binary = "other"
				}
			}
			d, e := confirmInstallAdmission(m, l, func() (installAdmissionSnapshot, error) { return observeInstallAdmission(m, l, f) })
			if e == nil || d.State != installAdmissionUnknown {
				t.Fatal("changed observation admitted")
			}
		})
	}
}

func TestHUWINLifecycleP0BBoundariesAndLegacy(t *testing.T) {
	for _, scope := range []string{"service", "account", "registry", "version"} {
		t.Run("scope_"+scope, func(t *testing.T) {
			m, l, f := p0BAdmissionFixture(t)
			switch scope {
			case "service":
				m.ServiceName = "UnrelatedService"
			case "account":
				m.ServiceAccount = "SYSTEM"
			case "registry":
				l.RegistryKey = "UnrelatedKey"
			case "version":
				m.Version = "../outside"
			}
			if _, e := observeInstallAdmission(m, l, f); e == nil || len(f.ops) != 0 {
				t.Fatal("invalid scope reached a reader")
			}
		})
	}
	for _, path := range []string{`relative\file`, `\\server\share\file`, `\\?\C:\device`, `C:\QA\..\Other`, `C:\QA\file:ADS`} {
		t.Run("nonlocal_"+fmt.Sprint(len(path)), func(t *testing.T) {
			if admissionLocalPath(path) {
				t.Fatal("unsupported namespace accepted")
			}
		})
	}
	for i, path := range []string{"../outside", "a/../b", "/absolute", `C:\absolute`, `file:stream`, "name.", "name ", "a?b"} {
		t.Run(fmt.Sprintf("relative_%d", i), func(t *testing.T) {
			if _, e := admissionRelativeFile(path); e == nil {
				t.Fatal("ambiguous payload name accepted")
			}
		})
	}
	for _, path := range []string{`C:\QA\file`, `D:\QA Program Files\Manus\POS`} {
		if !admissionLocalPath(path) {
			t.Fatal("valid local path rejected")
		}
	}
	m, l, f := p0BAdmissionFixture(t)
	l.VersionRoot = `C:\Other`
	if _, e := observeInstallAdmission(m, l, f); e == nil || len(f.ops) != 0 {
		t.Fatal("incoherent layout reached a reader")
	}
	var tag struct{ Attributes, Tag uint32 }
	if unsafe.Sizeof(tag) != 8 || unsafe.Alignof(tag) != 4 || unsafe.Offsetof(tag.Tag) != 4 || windows.FileAttributeTagInfo != 9 {
		t.Fatal("attribute-tag layout changed")
	}
	contract := reflect.TypeOf((*installAdmissionIO)(nil)).Elem()
	if contract.NumMethod() != 7 {
		t.Fatal("read-only capability changed")
	}
	for i := 0; i < contract.NumMethod(); i++ {
		method := contract.Method(i).Name
		if !map[string]bool{"Path": true, "ReadFile": true, "HashFile": true, "Files": true, "Registration": true, "Service": true, "Candidate": true}[method] {
			t.Fatal("mutation capability added")
		}
	}
	for _, err := range []error{io.ErrUnexpectedEOF, os.ErrPermission} {
		n, digest, e := admissionHash(p0BErrorReader{err})
		if !errors.Is(e, err) || n != 0 || digest != "" {
			t.Fatal("hash errors were hidden")
		}
	}
	n, digest, e := admissionHash(strings.NewReader("synthetic"))
	if e != nil || n != 9 || digest != fmt.Sprintf("%x", sha256.Sum256([]byte("synthetic"))) {
		t.Fatal("hash primitive mismatch")
	}
}

func TestHUWINLifecycleP0BNativeAdapterIsReadOnly(t *testing.T) {
	file, e := parser.ParseFile(token.NewFileSet(), "main_windows.go", nil, 0)
	if e != nil {
		t.Fatal(e)
	}
	// windows.Handle is a type conversion, not a native operation.
	allowed := map[string]bool{"os.Lstat": true, "os.NewFile": true, "os.Readlink": true, "os.Executable": true, "windows.Handle": true, "windows.GetFileInformationByHandle": true, "windows.UTF16PtrFromString": true, "windows.CreateFile": true, "windows.CloseHandle": true, "windows.GetFinalPathNameByHandle": true, "windows.UTF16ToString": true, "windows.GetFileInformationByHandleEx": true, "windows.OpenSCManager": true, "windows.CloseServiceHandle": true, "windows.OpenService": true, "registry.OpenKey": true}
	inside := false
	checked := 0
	for _, declaration := range file.Decls {
		fn, ok := declaration.(*ast.FuncDecl)
		if !ok {
			continue
		}
		if fn.Name.Name == "admissionReparse" {
			inside = true
		}
		if fn.Name.Name == "currentInstalledVersion" {
			inside = false
		}
		if !inside {
			continue
		}
		checked++
		ast.Inspect(fn.Body, func(node ast.Node) bool {
			selector, ok := node.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			base, ok := selector.X.(*ast.Ident)
			if !ok {
				return true
			}
			if base.Name == "windows" && map[string]bool{"DELETE": true, "GENERIC_WRITE": true, "WRITE_DAC": true, "SERVICE_ALL_ACCESS": true, "SC_MANAGER_ALL_ACCESS": true, "FILE_DELETE_ON_CLOSE": true}[selector.Sel.Name] {
				t.Fatalf("excess native rights %s", selector.Sel.Name)
			}
			return true
		})
		ast.Inspect(fn.Body, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			base, ok := selector.X.(*ast.Ident)
			if !ok {
				return true
			}
			if map[string]bool{"os": true, "windows": true, "registry": true, "exec": true, "mgr": true}[base.Name] && !allowed[base.Name+"."+selector.Sel.Name] {
				t.Fatalf("unexpected native capability %s.%s", base.Name, selector.Sel.Name)
			}
			return true
		})
	}
	if checked < 10 {
		t.Fatal("native adapter escaped structural audit")
	}
}

type p0BErrorReader struct{ err error }

func (r p0BErrorReader) Read([]byte) (int, error) { return 0, r.err }

func TestHUWINLifecycleP0BProductionGateOrdering(t *testing.T) {
	file, e := parser.ParseFile(token.NewFileSet(), "main_windows.go", nil, 0)
	if e != nil {
		t.Fatal(e)
	}
	var fn *ast.FuncDecl
	for _, d := range file.Decls {
		if f, ok := d.(*ast.FuncDecl); ok && f.Name.Name == "installWithObserver" {
			fn = f
		}
	}
	if fn == nil {
		t.Fatal("installer entrypoint missing")
	}
	gate, logger, prepare := -1, -1, -1
	for i, statement := range fn.Body.List {
		ast.Inspect(statement, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			name, ok := call.Fun.(*ast.Ident)
			if !ok {
				return true
			}
			switch name.Name {
			case "verifyInstallAdmissionStep":
				gate = i
			case "newPreflightLogger":
				logger = i
			case "ensureBaseDirectories":
				prepare = i
			case "currentInstalledVersion", "posPayloadValid":
				t.Fatal("legacy inference bypasses admission")
			}
			return true
		})
	}
	if gate < 0 || logger <= gate || prepare <= logger {
		t.Fatalf("effect order gate=%d logger=%d prepare=%d", gate, logger, prepare)
	}
	guard, ok := fn.Body.List[gate+1].(*ast.IfStmt)
	if !ok {
		t.Fatal("gate error is not checked immediately")
	}
	if _, ok := guard.Body.List[len(guard.Body.List)-1].(*ast.ReturnStmt); !ok {
		t.Fatal("gate error can fall through")
	}
	allowedBefore := map[string]bool{"buildLayout": true, "emitCoreStep": true, "verifyInstallAdmissionStep": true, "ensureSupportedHost": true, "ensureElevated": true, "preflightInstallCoexistence": true, "preflightAgentPort": true, "observeInstallAdmission": true}
	for _, statement := range fn.Body.List[:gate+1] {
		ast.Inspect(statement, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			if name, ok := call.Fun.(*ast.Ident); ok && !allowedBefore[name.Name] {
				t.Fatalf("unexpected pre-gate call: %s", name.Name)
			}
			return true
		})
	}
}

func TestEmbeddedAssetsIncludeLeadingUnderscoreFiles(t *testing.T) {
	manifestBytes, err := embeddedAssets.ReadFile("assets/manifest.json")
	if err != nil {
		t.Fatalf("embedded installer manifest missing: %v", err)
	}
	var manifest installerManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		t.Fatalf("embedded installer manifest invalid: %v", err)
	}
	_, err = embeddedAssets.ReadFile(filepath.ToSlash(filepath.Join(manifest.BundleRoot, "node_modules/readable-stream/lib/_stream_readable.js")))
	if err != nil {
		t.Fatalf("embedded asset missing: %v", err)
	}
}

func TestBuildAgentEnvironmentUsesPersistedConfigOverInheritedPeripheralValues(t *testing.T) {
	base := []string{
		"PATH=C:\\Windows\\System32",
		"PERIPHERALS_MODE=MOCK",
		"PERIPHERALS_ENABLE_REAL_ADAPTERS=false",
		"PERIPHERALS_CONFIG_PATH=C:\\old\\config.json",
		"PERIPHERALS_VERSION=old",
		"PERIPHERALS_ENROLLMENT_API_BASE_URL=https://attacker.invalid/api",
		"PERIPHERALS_ENROLLMENT_SIGNING_PUBLIC_KEY_PEM=attacker-key",
		"PERIPHERALS_ENROLLMENT_AUDIENCE=attacker-audience",
		"PERIPHERALS_ENROLLMENT_SIGNING_KEY_ID=attacker-id",
	}

	env := buildAgentEnvironment(base, `C:\ProgramData\Manus\PeripheralAgent\config\agent.config.local.json`, "0.1.1-qa.9")
	joined := strings.Join(env, "\n")
	if strings.Contains(joined, "PERIPHERALS_MODE=MOCK") {
		t.Fatal("inherited MOCK mode must not reach the service child")
	}
	if strings.Contains(joined, "PERIPHERALS_ENABLE_REAL_ADAPTERS=false") {
		t.Fatal("inherited adapter flag must not reach the service child")
	}
	for _, forbidden := range []string{"attacker.invalid", "attacker-key", "attacker-audience", "attacker-id"} {
		if strings.Contains(joined, forbidden) {
			t.Fatalf("inherited enrollment trust configuration must not reach the service child: %s", forbidden)
		}
	}
	if !strings.Contains(joined, "PERIPHERALS_CONFIG_PATH=C:\\ProgramData\\Manus\\PeripheralAgent\\config\\agent.config.local.json") {
		t.Fatal("service config path must be explicit")
	}
	if !strings.Contains(joined, "PERIPHERALS_VERSION=0.1.1-qa.9") {
		t.Fatal("service version must be explicit")
	}
	if !strings.Contains(joined, "PATH=C:\\Windows\\System32") {
		t.Fatal("unrelated environment must be preserved")
	}
}

func TestServiceIdentityAcceptsLocalServiceFormsOnly(t *testing.T) {
	if !sameWindowsIdentity(`NT AUTHORITY\LocalService`, `LocalService`) {
		t.Fatal("LocalService aliases must match")
	}
	if sameWindowsIdentity(`NT AUTHORITY\LocalService`, `SYSTEM`) {
		t.Fatal("SYSTEM must not match LocalService")
	}
}

func TestListenerBelongsToServiceAcceptsServicePID(t *testing.T) {
	owned, err := listenerBelongsToService(100, 100, func(uint32) (uint32, error) {
		t.Fatal("parent lookup must not run for the service PID")
		return 0, nil
	})
	if err != nil || !owned {
		t.Fatalf("service PID must be accepted: owned=%v err=%v", owned, err)
	}
}

func TestListenerBelongsToServiceAcceptsDirectChild(t *testing.T) {
	parents := map[uint32]uint32{200: 100}
	owned, err := listenerBelongsToService(200, 100, mapParentLookup(parents))
	if err != nil || !owned {
		t.Fatalf("direct child must be accepted: owned=%v err=%v", owned, err)
	}
}

func TestListenerBelongsToServiceAcceptsDeeperDescendant(t *testing.T) {
	parents := map[uint32]uint32{300: 200, 200: 100}
	owned, err := listenerBelongsToService(300, 100, mapParentLookup(parents))
	if err != nil || !owned {
		t.Fatalf("deeper descendant must be accepted: owned=%v err=%v", owned, err)
	}
}

func TestListenerBelongsToServiceRejectsUnrelatedPID(t *testing.T) {
	parents := map[uint32]uint32{300: 250}
	owned, err := listenerBelongsToService(300, 100, mapParentLookup(parents))
	if err == nil || owned {
		t.Fatalf("unrelated process must fail closed: owned=%v err=%v", owned, err)
	}
}

func TestListenerBelongsToServiceRejectsBrokenAncestryAndCycles(t *testing.T) {
	for name, parents := range map[string]map[uint32]uint32{
		"missing parent": {300: 0},
		"cycle":          {300: 200, 200: 300},
	} {
		t.Run(name, func(t *testing.T) {
			owned, err := listenerBelongsToService(300, 100, mapParentLookup(parents))
			if err == nil || owned {
				t.Fatalf("broken ancestry must fail closed: owned=%v err=%v", owned, err)
			}
		})
	}
}

func TestValidateListenerOwnershipRequiresRunningService(t *testing.T) {
	err := validateListenerOwnership(serviceSnapshot{pid: 100}, []uint32{100}, nil)
	if err == nil {
		t.Fatal("listener with stopped service must fail closed")
	}
}

func TestValidateListenerOwnershipRejectsUnrelatedListener(t *testing.T) {
	service := serviceSnapshot{running: true, pid: 100}
	err := validateListenerOwnership(service, []uint32{300}, mapParentLookup(map[uint32]uint32{300: 250}))
	if err == nil {
		t.Fatal("unrelated listener must fail closed")
	}
}

func mapParentLookup(parents map[uint32]uint32) processParentLookup {
	return func(pid uint32) (uint32, error) {
		parent, ok := parents[pid]
		if !ok {
			return 0, fmt.Errorf("missing PID %d", pid)
		}
		return parent, nil
	}
}

func TestParseListeningPidsOnlyReturnsPort4050Listeners(t *testing.T) {
	output := "" +
		"  TCP    127.0.0.1:4050    0.0.0.0:0    LISTENING    1234\r\n" +
		"  TCP    127.0.0.1:4051    0.0.0.0:0    LISTENING    5678\r\n" +
		"  TCP    127.0.0.1:4050    0.0.0.0:0    TIME_WAIT    9999\r\n"
	pids := parseListeningPids(output, "4050")
	if len(pids) != 1 || pids[0] != 1234 {
		t.Fatalf("unexpected 4050 listeners: %#v", pids)
	}
}

func TestBackupsForAclFailureIncludesPartiallyChangedPath(t *testing.T) {
	backups := []aclBackup{
		{path: `C:\one`, file: `C:\backup\one.acl`},
		{path: `C:\two`, file: `C:\backup\two.acl`},
		{path: `C:\three`, file: `C:\backup\three.acl`},
	}

	rollback := backupsForAclFailure(backups, 1)
	if len(rollback) != 2 || rollback[1].path != `C:\two` {
		t.Fatalf("rollback must include failing path: %#v", rollback)
	}
}

func TestEnableAclInheritanceRetriesWithTemporaryOwnership(t *testing.T) {
	path := filepath.Join(t.TempDir(), "service.log")
	if err := os.WriteFile(path, []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}

	originalRunner := runACLCommand
	t.Cleanup(func() { runACLCommand = originalRunner })
	var calls []string
	icaclsCalls := 0
	runACLCommand = func(name string, args ...string) ([]byte, error) {
		calls = append(calls, name+" "+strings.Join(args, " "))
		if name == "icacls.exe" {
			icaclsCalls++
			if icaclsCalls == 1 {
				return []byte("Access is denied."), errors.New("exit status 5")
			}
		}
		return nil, nil
	}

	if err := enableOperationalAclInheritance(filepath.Dir(path)); err != nil {
		t.Fatal(err)
	}
	if len(calls) != 3 || calls[0] != "icacls.exe "+path+" /inheritance:e /C" || calls[1] != "takeown.exe /f "+path+" /a /d Y" || calls[2] != "icacls.exe "+path+" /inheritance:e /C" {
		t.Fatalf("unexpected ACL recovery command sequence: %#v", calls)
	}
}

func TestOperationalAclInheritanceRepairsProtectedEmptyFixture(t *testing.T) {
	if os.Getenv("MANUS_INSTALLER_ACL_INTEGRATION") != "1" {
		t.Skip("set MANUS_INSTALLER_ACL_INTEGRATION=1 in an elevated Windows test run")
	}

	root := t.TempDir()
	child := filepath.Join(root, "service.log")
	if err := os.WriteFile(child, []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}
	run := func(args ...string) {
		output, err := runACLCommand("icacls.exe", args...)
		if err != nil {
			t.Fatalf("icacls %v failed: %v (%s)", args, err, strings.TrimSpace(string(output)))
		}
	}
	run(root, "/inheritance:e", "/grant:r", "*S-1-5-18:(OI)(CI)(F)", "*S-1-5-32-544:(OI)(CI)(F)", "*S-1-5-19:(OI)(CI)(M)", "/C")
	run(child, "/inheritance:r", "/grant:r", "*S-1-5-19:(F)", "/C")
	run(child, "/remove:g", "*S-1-5-19", "/C")
	run(child, "/setowner", "*S-1-5-19", "/C")

	if err := enableOperationalAclInheritance(root); err != nil {
		t.Fatal(err)
	}
	sd, err := windows.GetNamedSecurityInfo(child, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	sddl := sd.String()
	if !strings.Contains(sddl, "AI") || !strings.Contains(sddl, "LS") || strings.Contains(sddl, "D:PAI") {
		t.Fatalf("fixture ACL was not safely inherited: %s", sddl)
	}
}

func TestAgentJobLimitInformationUsesFullWindowsLayout(t *testing.T) {
	var info windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION
	if got := unsafe.Sizeof(info); got != 144 {
		t.Fatalf("JOBOBJECT_EXTENDED_LIMIT_INFORMATION size = %d, want 144", got)
	}
	if got := unsafe.Offsetof(info.BasicLimitInformation.LimitFlags); got != 16 {
		t.Fatalf("LimitFlags offset = %d, want 16", got)
	}
}

func TestNativeServiceSnapshotIsIndependentOfLocalizedSCFields(t *testing.T) {
	for _, state := range []svc.State{svc.Running, svc.Stopped} {
		pid := uint32(1234)
		if state == svc.Stopped {
			pid = 0
		}
		got, err := nativeServiceSnapshot(svc.Status{State: state, ProcessId: pid}, `NT AUTHORITY\LocalService`)
		if err != nil || !got.exists || got.running != (state == svc.Running) || got.pid != pid || !sameWindowsIdentity(got.account, `NT AUTHORITY\LocalService`) {
			t.Fatalf("native snapshot: %+v %v", got, err)
		}
	}
	if _, err := nativeServiceSnapshot(svc.Status{State: svc.Running}, `NT AUTHORITY\LocalService`); err == nil {
		t.Fatal("missing running PID must fail closed")
	}
	if _, err := nativeServiceSnapshot(svc.Status{State: svc.Stopped}, ""); err == nil {
		t.Fatal("missing identity must fail closed")
	}
	foreign, err := nativeServiceSnapshot(svc.Status{State: svc.Running, ProcessId: 1234}, `NT AUTHORITY\NetworkService`)
	if err != nil || sameWindowsIdentity(foreign.account, `NT AUTHORITY\LocalService`) {
		t.Fatal("native query must not normalize foreign identities into LocalService")
	}
}

func TestNativeServiceSnapshotAbsent(t *testing.T) {
	aclFixtureIntegration(t)
	got, err := queryServiceSnapshot("Manus-QA-absent-" + fmt.Sprint(os.Getpid()))
	if err != nil || got.exists {
		t.Fatalf("absent native service snapshot: %+v %v", got, err)
	}
}

func TestAgentPortOwnershipBlocksUnmanagedProcess(t *testing.T) {
	if err := validateAgentPortOwnership(agentPortOwnership{PortAvailable: false}); err == nil {
		t.Fatal("unmanaged process occupying Agent port must block before mutation")
	}
}

func TestAgentPortOwnershipAllowsManagedServiceBeforeStop(t *testing.T) {
	if err := validateAgentPortOwnership(agentPortOwnership{
		PortAvailable:  false,
		ServicePresent: true,
		ServiceRunning: true,
	}); err != nil {
		t.Fatalf("running managed service should be eligible for controlled stop: %v", err)
	}
}

func TestAgentPortOwnershipBlocksStoppedServiceWithOccupiedPort(t *testing.T) {
	if err := validateAgentPortOwnership(agentPortOwnership{
		PortAvailable:  false,
		ServicePresent: true,
	}); err == nil {
		t.Fatal("occupied port with stopped service must remain blocked")
	}
}

func TestHealthInstallationMatchesExpectedIdentity(t *testing.T) {
	payload := map[string]any{"agentInstallationId": "installation-a"}
	if !healthInstallationMatches(payload, "installation-a") {
		t.Fatal("matching installation identity must pass")
	}
	if healthInstallationMatches(payload, "installation-b") {
		t.Fatal("different installation identity must fail")
	}
	if !healthInstallationMatches(payload) {
		t.Fatal("fresh install without previous identity must not require one")
	}
}

func TestPOSPayloadValidRequiresCurrentPayload(t *testing.T) {
	dir := t.TempDir()
	current := filepath.Join(dir, "POS", "current")
	if err := os.MkdirAll(filepath.Join(current, "resources"), 0o755); err != nil {
		t.Fatal(err)
	}
	files := map[string][]byte{
		"Manus POS.exe":                     []byte("fresh exe"),
		"resources/app.asar":                []byte("fresh asar"),
		"resources/manus-shell.config.json": []byte(`{"environment":"qa"}`),
	}
	manifestFiles := make([]posPayloadFile, 0, len(files))
	for relative, content := range files {
		path := filepath.Join(current, filepath.FromSlash(relative))
		if err := os.WriteFile(path, content, 0o600); err != nil {
			t.Fatal(err)
		}
		manifestFiles = append(manifestFiles, posPayloadFile{Path: relative, Size: int64(len(content)), SHA256: fmt.Sprintf("%x", sha256.Sum256(content))})
	}
	layout := runtimeLayout{POSCurrentRoot: current}
	manifest := posPayloadManifest{PosVersion: "0.1.0", Files: manifestFiles}
	if err := validateInstalledPOSPayload(layout, manifest); err != nil {
		t.Fatal("valid POS current payload should pass")
	}
	_ = os.Remove(filepath.Join(current, "Manus POS.exe"))
	if err := validateInstalledPOSPayload(layout, manifest); err == nil {
		t.Fatal("missing executable must fail validation")
	}
}

func TestPOSPayloadHashMismatchRequiresReplacement(t *testing.T) {
	dir := t.TempDir()
	current := filepath.Join(dir, "POS", "current")
	if err := os.MkdirAll(filepath.Join(current, "resources"), 0o755); err != nil {
		t.Fatal(err)
	}
	content := []byte("expected")
	path := filepath.Join(current, "Manus POS.exe")
	if err := os.WriteFile(path, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	manifest := posPayloadManifest{PosVersion: "0.1.0", Files: []posPayloadFile{{Path: "Manus POS.exe", Size: int64(len(content)), SHA256: fmt.Sprintf("%x", sha256.Sum256(content))}}}
	if err := validateInstalledPOSPayload(runtimeLayout{POSCurrentRoot: current}, manifest); err == nil {
		t.Fatal("hash mismatch must fail validation")
	}
}

func TestPOSPayloadUnsafeManifestPathFails(t *testing.T) {
	dir := t.TempDir()
	current := filepath.Join(dir, "POS", "current")
	if err := os.MkdirAll(current, 0o755); err != nil {
		t.Fatal(err)
	}
	manifest := posPayloadManifest{PosVersion: "0.1.0", Files: []posPayloadFile{{Path: "../outside", Size: 0, SHA256: ""}}}
	if err := validateInstalledPOSPayload(runtimeLayout{POSCurrentRoot: current}, manifest); err == nil {
		t.Fatal("unsafe manifest path must fail validation")
	}
}

func TestReadOnlyBridgeHealthAndDiscovery(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body := `{"status":"ok","mode":"REAL","version":"qa"}`
		if r.URL.Path == "/devices/discover" {
			body = `{"success":true,"mode":"REAL","devices":[{"id":"p1","type":"PRINTER","descriptor":{"nativeIdentifier":"USB\\\\VID_0483&PID_070B\\\\B82D3A880106"}}]}`
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	state, err := bridge.getInstallerState()
	if err != nil || state.Agent["mode"] != "REAL" {
		t.Fatalf("health bridge = %#v, %v", state, err)
	}
	devices, err := bridge.discoverDevices()
	if err != nil || len(devices) != 1 || devices[0]["id"] != "p1" {
		t.Fatalf("discovery bridge = %#v, %v", devices, err)
	}
	usb, ok := devices[0]["usb"].(map[string]any)
	if !ok || usb["vid"] != "0483" || usb["pid"] != "070B" {
		t.Fatalf("discovery USB identity = %#v", devices[0]["usb"])
	}
}

func TestProductiveBridgeWaitsForTargetAgentVersion(t *testing.T) {
	bridge := newInstallerReadOnlyBridgeForVersion("0.1.1-qa.9")
	bridge.baseURL = "http://test.local"
	attempts := 0
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		attempts++
		version := "0.1.1-qa.8"
		if attempts > 1 {
			version = "0.1.1-qa.9"
		}
		body := `{"status":"ok","mode":"REAL","version":"` + version + `"}`
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	state, err := bridge.getInstallerState()
	if err != nil || state.Agent["version"] != "0.1.1-qa.9" || attempts < 2 {
		t.Fatalf("target health gate = %#v attempts=%d err=%v", state, attempts, err)
	}
}

func TestProductiveBridgeListsCanonicalDevicesAfterDiscover(t *testing.T) {
	bridge := newInstallerReadOnlyBridgeForVersion("0.1.1-qa.9")
	bridge.baseURL = "http://test.local"
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body := `[]`
		if r.URL.Path == "/devices/discover" {
			body = `{"success":true,"mode":"REAL","devices":[{"id":"stale","type":"PRINTER"}]}`
		}
		if r.URL.Path == "/devices" {
			body = `[{"id":"canonical-1","type":"PRINTER"},{"id":"canonical-2","type":"PRINTER"}]`
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.discoverDevices(); err != nil {
		t.Fatal(err)
	}
	devices, err := bridge.listDevices()
	if err != nil || len(devices) != 2 || devices[0]["id"] != "canonical-1" {
		t.Fatalf("canonical device list = %#v err=%v", devices, err)
	}
}

func TestConfigureBridgeValidatesDiscoveredDeviceAndProfile(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		body := `{"success":true,"mode":"REAL","devices":[{"id":"p1","type":"PRINTER","terminalId":"local-terminal","metadata":{"usbRawCashDrawerPulseCertified":true}}]}`
		if r.Method == http.MethodPatch {
			body = `{"id":"p1","type":"PRINTER","profileId":"THERMAL_58MM","metadata":{"usbRawCashDrawerPulseCertified":true}}`
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.discoverDevices(); err != nil {
		t.Fatal(err)
	}
	if _, err := bridge.configureDevice("not-discovered", "THERMAL_58MM"); err == nil {
		t.Fatal("arbitrary device id accepted")
	}
	if _, err := bridge.configureDevice("p1", "UNKNOWN"); err == nil {
		t.Fatal("unknown profile accepted")
	}
	updated, err := bridge.configureDevice("p1", "THERMAL_58MM")
	if err != nil || updated["profileId"] != "THERMAL_58MM" {
		t.Fatalf("configure result = %#v, %v", updated, err)
	}
}

func TestScaleBridgeConfiguresReadsAndPersistsOperatorKGConfirmation(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.devices["scale-1"] = map[string]any{
		"id": "scale-1", "type": "SCALE", "connectionType": "SERIAL", "profileId": "ROCHI_A01E",
		"terminalId": "local-terminal", "serial": map[string]any{
			"port": "COM3", "baudRate": float64(9600), "dataBits": float64(8), "stopBits": float64(1),
			"parity": "none", "flowControl": "none", "pnp": map[string]any{"deviceId": "USB\\\\VID_1A86&PID_7523\\\\ROCHI"},
		},
	}
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method == http.MethodGet && r.URL.Path == "/scale/current-weight" {
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"deviceId":"scale-1","weight":0.245,"unit":null,"stable":null,"source":"REAL","unitVerified":false,"stabilityVerified":false,"timestamp":"2026-09-30T00:00:00Z"}`)), Header: make(http.Header)}, nil
		}
		if r.Method == http.MethodPatch {
			body, _ := io.ReadAll(r.Body)
			if !strings.Contains(string(body), `"unitVerification"`) && !strings.Contains(string(body), `"serial"`) {
				return nil, fmt.Errorf("expected serial or unit verification in PATCH")
			}
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"scale-1","type":"SCALE","connectionType":"SERIAL","profileId":"ROCHI_A01E","metadata":{"unitVerification":{"unit":"KG","method":"OPERATOR_CONFIRMATION","verifiedAt":"2026-09-30T00:00:00Z"}}}`)), Header: make(http.Header)}, nil
		}
		return nil, fmt.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
	})
	if _, err := bridge.saveDeviceConfiguration("scale-1", "ROCHI_A01E", "ROCHI RC-A01E"); err != nil {
		t.Fatal(err)
	}
	reading, err := bridge.testScaleReading("scale-1")
	if err != nil || reading["source"] != "REAL" || reading["unit"] != nil {
		t.Fatalf("REAL reading = %#v err=%v", reading, err)
	}
	updated, err := bridge.confirmScaleKilograms("scale-1")
	if err != nil {
		t.Fatal(err)
	}
	metadata, _ := updated["metadata"].(map[string]any)
	verification, _ := metadata["unitVerification"].(map[string]any)
	if verification["unit"] != "KG" || verification["method"] != "OPERATOR_CONFIRMATION" {
		t.Fatalf("operator verification = %#v", verification)
	}
}

func TestProductiveHarnessRendersROCHIReadAndExplicitKGConfirmation(t *testing.T) {
	html := appendProductiveDevicesHarness(true)
	for _, required := range []string{"ROCHI RC-A01E / USB-SERIAL CH340", "testScaleReading", "confirmScaleKilograms", "unidad no verificada", "Confirmo display en kilogramos"} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive ROCHI harness missing %q", required)
		}
	}
	for _, forbidden := range []string{"REAL_AVAILABLE=true", "stable=true", "homologada", "venta ponderada habilitada"} {
		if strings.Contains(html, forbidden) {
			t.Fatalf("productive ROCHI harness contains unsafe wording %q", forbidden)
		}
	}
}

func TestInstallerAutoDiscoveryRequiresExplicitDiscoveryConfig(t *testing.T) {
	tests := []struct {
		name string
		data string
		want bool
	}{
		{name: "production-enabled", data: `{"packageProfile":"production","enableRealAdapters":true,"discoverOnStartup":true}`, want: true},
		{name: "qa-real-adapters-manual-only", data: `{"packageProfile":"qa","enableRealAdapters":true,"discoverOnStartup":false}`, want: false},
		{name: "qa-env-or-json-cannot-enable-startup", data: `{"packageProfile":"qa","enableRealAdapters":true,"discoverOnStartup":true}`, want: false},
		{name: "adapters-disabled", data: `{"packageProfile":"production","enableRealAdapters":false,"discoverOnStartup":true}`, want: false},
		{name: "missing", data: `{}`, want: false},
		{name: "missing-discovery-policy", data: `{"packageProfile":"production","enableRealAdapters":true}`, want: false},
		{name: "missing-profile", data: `{"enableRealAdapters":true,"discoverOnStartup":true}`, want: false},
		{name: "malformed", data: `{"packageProfile":"production","enableRealAdapters":true,"discoverOnStartup":`, want: false},
		{name: "wrong-type", data: `{"packageProfile":"production","enableRealAdapters":true,"discoverOnStartup":"true"}`, want: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := agentConfigEnablesAutomaticDiscovery([]byte(test.data)); got != test.want {
				t.Fatalf("agentConfigEnablesAutomaticDiscovery() = %t, want %t", got, test.want)
			}
		})
	}

	qaHarness := appendProductiveDevicesHarness(false)
	if !strings.Contains(qaHarness, `window.__manusAutoDiscoveryEnabled=false;`) {
		t.Fatal("QA harness does not carry the disabled auto-discovery setting")
	}
	if !strings.Contains(qaHarness, `if(window.__manusAutoDiscoveryEnabled!==true||window.__manusInitialDiscoveryStarted`) {
		t.Fatal("initial discovery is not guarded by the packaged profile")
	}
	productionHarness := appendProductiveDevicesHarness(true)
	if !strings.Contains(productionHarness, `window.__manusAutoDiscoveryEnabled=true;`) {
		t.Fatal("production harness does not preserve enabled discovery")
	}

	manifest := installerManifest{BundleRoot: `assets/bundle/qa`, ConfigRelative: `config\agent.config.local.json`}
	if got, ok := embeddedAgentConfigPath(manifest); !ok || got != "assets/bundle/qa/config/agent.config.local.json" {
		t.Fatalf("Windows config path = %q, %t", got, ok)
	}
	for _, invalid := range []installerManifest{
		{BundleRoot: `assets/bundle/qa`, ConfigRelative: `..\outside.json`},
		{BundleRoot: `assets/other/qa`, ConfigRelative: `config\agent.config.local.json`},
	} {
		if got, ok := embeddedAgentConfigPath(invalid); ok {
			t.Fatalf("unsafe embedded config path accepted: %q", got)
		}
	}
}

func TestReadOnlyBootstrapUsesOnlyReadOperations(t *testing.T) {
	html := appendReadOnlyBootstrap("<html><body></body></html>", false, false, false)
	for _, required := range []string{"getInstallerState", "discoverDevices", "DOMContentLoaded", "DISCOVERY_RUNNING", "go('devices')", "Buscar nuevamente", "supportsCashDrawerPulse", "hideReadonlyComplete"} {
		if !strings.Contains(html, required) {
			t.Fatalf("bootstrap missing %s", required)
		}
	}
	for _, forbidden := range []string{"configureDevice", "testPrinter", "testCashDrawer", "installBundle", "PowerShell"} {
		if forbidden == "configureDevice" || forbidden == "testPrinter" || forbidden == "testCashDrawer" {
			continue
		}
		if strings.Contains(html, forbidden) {
			t.Fatalf("read-only bootstrap contains mutating operation %s", forbidden)
		}
	}
	if !strings.Contains(html, "const configEnabled=false") {
		t.Fatal("readonly bootstrap must disable configuration")
	}
	if !strings.Contains(html, "const printEnabled=false") {
		t.Fatal("readonly bootstrap must disable printing")
	}
	for _, forbidden := range []string{"XPrinter 80 mm", "DIG-E200I", "3 impresoras detectadas"} {
		if strings.Contains(html, forbidden) {
			t.Fatalf("read-only bootstrap contains fixture %s", forbidden)
		}
	}
}

func TestPrintBootstrapEnablesConfigurationButNotDrawer(t *testing.T) {
	html := appendReadOnlyBootstrap("<html><body></body></html>", true, true, false)
	if !strings.Contains(html, "const configEnabled=true") || !strings.Contains(html, "const printEnabled=true") {
		t.Fatal("print QA capabilities not enabled")
	}
}

func TestProductiveDevicesHarnessSupportsPersistenceAndZeroDevices(t *testing.T) {
	html := appendProductiveDevicesHarness(true)
	for _, required := range []string{
		"No se detectaron",
		"Buscar nuevamente",
		"Agregar dispositivo",
		"Continuar sin periféricos",
		"window.saveDeviceConfiguration",
		"window.assignDevice",
		"window.registerNetworkPrinter",
		"window.testPrinter",
		"window.assignCashDrawer",
		"window.associateWindowsQueue",
		"Impresora principal",
		"Falta cola/controlador de Windows",
		"Cajón monedero",
		"Vía impresora",
		"Probar apertura",
		"No detectada / Offline",
		"Detectada / No configurada",
	} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive devices harness missing %q", required)
		}
	}
	if strings.Contains(html, "http://127.0.0.1") || strings.Contains(html, "window.fetch") {
		t.Fatal("productive devices harness must use typed bridge only")
	}
	for _, required := range []string{"Array.isArray(result)", "Array.isArray(result.devices)", "No pudimos detectar los dispositivos."} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive devices harness missing discovery normalization %q", required)
		}
	}
	for _, required := range []string{"data-discover-retry", "Buscando...", "device.metadata", "queueInstalled", "VID/PID"} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive devices harness missing UX contract %q", required)
		}
	}
	for _, required := range []string{"Buscando dispositivos...", "attempt<2", "No se detectaron", "window.listDevices", "devices.request.start", "devices.request.success", "startInitialDiscovery", "__manusCoreComplete", "recordDeviceDiagnostic"} {
		if !strings.Contains(html, required) {
			t.Fatalf("productive discovery retry missing %q", required)
		}
	}
	for _, required := range []string{"__manusQueueInventory", "queueAvailable", "applyDrawerReadiness"} {
		if !strings.Contains(html, required) {
			t.Fatalf("canonical queue readiness missing %q", required)
		}
	}
	for _, required := range []string{"La cola no quedo persistida en el dispositivo fisico", "finally(function(){select.disabled=false;})", "usbRawCashDrawerPulseCertified"} {
		if !strings.Contains(html, required) {
			t.Fatalf("association/drawer guard missing %q", required)
		}
	}
	for _, required := range []string{"setCashDrawerCertification", "Habilitar apertura automatica mediante esta impresora", "Activalo solo si el cajon esta conectado fisicamente"} {
		if !strings.Contains(html, required) {
			t.Fatalf("drawer certification UI missing %q", required)
		}
	}
	for _, required := range []string{"Guardando", "window.listDevices", "window.__manusLastDevices=devices", "applyDrawerReadiness();", "Enviando pulso...", "Pulso enviado; confirma apertura física"} {
		if !strings.Contains(html, required) {
			t.Fatalf("drawer canonical state/update UI missing %q", required)
		}
	}
}

func TestCashDrawerBridgeTimeoutExceedsRawOperationBudget(t *testing.T) {
	if cashDrawerBridgeTimeout <= cashDrawerRawOperationTimeout {
		t.Fatalf("bridge timeout %s must exceed raw operation timeout %s", cashDrawerBridgeTimeout, cashDrawerRawOperationTimeout)
	}
}

func TestCashDrawerBridgeClassifiesLostAcknowledgementAsUnknownWithoutRetry(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.devices = map[string]map[string]any{
		"physical": {
			"id": "physical", "type": "PRINTER", "status": "CONNECTED", "profileId": "THERMAL_58MM",
			"usb":      map[string]any{"windowsQueueName": "XP-58"},
			"metadata": map[string]any{"usbRawCashDrawerPulseCertified": true},
		},
	}
	calls := 0
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		return nil, fmt.Errorf("connection reset after dispatch")
	})
	if _, err := bridge.testCashDrawer("physical"); err == nil || !strings.Contains(err.Error(), "RESULT_UNKNOWN") {
		t.Fatalf("lost acknowledgement classification = %v", err)
	}
	if calls != 1 {
		t.Fatalf("drawer request retried %d times", calls)
	}
}

func TestCashDrawerHarnessIncludesResultStatesAndLayoutRegions(t *testing.T) {
	html := appendProductiveDevicesHarness(true)
	for _, required := range []string{"RESULT_UNKNOWN", "CONFIRMED_ERROR", "drawer.ui.test.click", "drawer.ui.state", "drawer-card", "drawer-certification", "drawer-helper"} {
		if !strings.Contains(html, required) {
			t.Fatalf("drawer 7.2Q contract missing %q", required)
		}
	}
}

func TestCashDrawerSaveSnapshotsTargetAndVerifiesCanonicalState(t *testing.T) {
	html := appendProductiveDevicesHarness(true)
	for _, required := range []string{
		"var targetDeviceId=select.value",
		"var certificationEnabled=!!certInput.checked",
		"domCertificationChecked=",
		"cachedCertification=",
		"var renderSnapshot=renderId",
		"assignCashDrawer(targetDeviceId",
		"setCashDrawerCertification(targetDeviceId",
		"drawer.ui.save.click",
		"drawer.assign.start",
		"drawer.assign.success",
		"drawer.assign.error",
		"drawer.certification.start",
		"drawer.certification.success",
		"drawer.certification.error",
		"drawer.canonical.get.start",
		"drawer.canonical.get.success",
		"drawer.canonical.verify",
		"drawer.ui.save.success",
		"stage=CANONICAL_VERIFY",
		"window.__manusDrawerSaveGeneration",
	} {
		if !strings.Contains(html, required) {
			t.Fatalf("drawer save observability missing %q", required)
		}
	}
	if strings.Contains(html, "assignCashDrawer(select.value") || strings.Contains(html, "setCashDrawerCertification(select.value") {
		t.Fatal("drawer save must use one immutable targetDeviceId snapshot")
	}
	if !strings.Contains(html, "var certified=certificationEnabled") {
		t.Fatal("drawer save must persist the live checkbox snapshot")
	}
	if !strings.Contains(html, "throw error;}).then(function(){stage='CANONICAL_GET'") {
		t.Fatal("drawer save must fail before canonical success when a PATCH rejects")
	}
}

func TestCashDrawerRuntimeAndBridgeBoundaryDiagnostics(t *testing.T) {
	html := appendProductiveDevicesHarness(true)
	for _, required := range []string{
		"drawer.runtime.ready",
		"candidate=7.2T productiveHarness=true",
		"drawer.ui.render",
		"drawer.ui.save.button.created",
		"drawer.ui.save.handler.bound",
		"drawer.ui.save.click.captured",
		"drawer.ui.save.handler.enter",
		"addEventListener('click'",
	} {
		if !strings.Contains(html, required) {
			t.Fatalf("runtime drawer boundary diagnostic missing %q", required)
		}
	}
	if strings.Contains(html, "preventDefault()") || strings.Contains(html, "stopPropagation()") {
		t.Fatal("diagnostic capture observer must not control the click")
	}
	bridgeSource, err := os.ReadFile("readonly_bridge_windows.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"drawer.bridge.assign.entry",
		"drawer.bridge.assign.http.start",
		"drawer.bridge.assign.http.success",
		"drawer.bridge.assign.http.error",
		"drawer.bridge.certification.entry",
		"drawer.bridge.certification.http.start",
		"drawer.bridge.certification.http.success",
		"drawer.bridge.certification.http.error",
		"drawer.bridge.canonical.entry",
		"drawer.bridge.canonical.success",
		"drawer.bridge.canonical.error",
	} {
		if !strings.Contains(string(bridgeSource), required) {
			t.Fatalf("native bridge diagnostic missing %q", required)
		}
	}
}

func TestCashDrawerBridgeRejectsUncertifiedUsbBeforeAgentRequest(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.devices = map[string]map[string]any{
		"physical": {
			"id": "physical", "type": "PRINTER", "status": "CONNECTED", "profileId": "THERMAL_58MM",
			"usb":      map[string]any{"windowsQueueName": "XP-58"},
			"metadata": map[string]any{},
		},
	}
	called := false
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		called = true
		return nil, fmt.Errorf("unexpected request")
	})
	if _, err := bridge.testCashDrawer("physical"); err == nil || !strings.Contains(err.Error(), "no est") {
		t.Fatalf("uncertified drawer result = %v", err)
	}
	if called {
		t.Fatal("uncertified drawer must not call Agent")
	}
}

func TestCashDrawerCertificationPreservesMetadataAndTargetsParentPrinter(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.devices = map[string]map[string]any{
		"physical": {
			"id": "physical", "type": "PRINTER",
			"metadata": map[string]any{
				"cashDrawerConnectionType":  "VIA_PRINTER",
				"cashDrawerParentPrinterId": "physical",
				"manusAssignmentRole":       "PRIMARY_PRINTER",
				"physicalDetected":          true,
			},
		},
	}
	var body map[string]any
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method == http.MethodPatch {
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				return nil, err
			}
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"physical","type":"PRINTER","metadata":{"usbRawCashDrawerPulseCertified":true,"cashDrawerParentPrinterId":"physical"}}`)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.setCashDrawerCertification("physical", "local-terminal", true); err != nil {
		t.Fatal(err)
	}
	metadata, ok := body["metadata"].(map[string]any)
	if !ok || metadata["usbRawCashDrawerPulseCertified"] != true || metadata["cashDrawerParentPrinterId"] != "physical" || metadata["manusAssignmentRole"] != "PRIMARY_PRINTER" {
		t.Fatalf("certification payload did not preserve parent metadata: %#v", body)
	}
}

func TestExtractUsbVIDPIDUsesNativeIdentityWithoutModelMapping(t *testing.T) {
	vid, pid := extractUsbVIDPID(`USB\VID_0483&PID_070B\B82D3A880106`)
	if vid != "0483" || pid != "070B" {
		t.Fatalf("parsed XP-58 identity = %s/%s", vid, pid)
	}
	vid, pid = extractUsbVIDPID(`USB\VID_1FC9&PID_2016\5D2F0E663532`)
	if vid != "1FC9" || pid != "2016" {
		t.Fatalf("parsed POS-80 identity = %s/%s", vid, pid)
	}
	vid, pid = extractUsbVIDPID(`USB\UNKNOWN\DEVICE`)
	if vid != "" || pid != "" {
		t.Fatalf("missing identity = %s/%s", vid, pid)
	}
}

func TestResolvedWindowsQueueNeverTreatsPnPFriendlyNameAsQueue(t *testing.T) {
	pnpOnly := map[string]any{
		"usb":      map[string]any{"printerName": "Printer USB Printer Port"},
		"metadata": map[string]any{"physicalDetected": true, "queueInstalled": false},
	}
	if resolvedWindowsQueue(pnpOnly) {
		t.Fatal("PnP friendly name must not be used as a Windows queue")
	}
	withQueue := map[string]any{
		"usb":      map[string]any{"printerName": "XP-80", "windowsQueueName": "XP-80"},
		"metadata": map[string]any{"physicalDetected": true, "queueInstalled": true},
	}
	if !resolvedWindowsQueue(withQueue) {
		t.Fatal("resolved Windows queue should be usable")
	}
}

func TestAssociateWindowsQueueSendsCanonicalUsbField(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.devices = map[string]map[string]any{
		"physical": {"id": "physical", "type": "PRINTER", "usb": map[string]any{"deviceId": "physical", "printerName": "Printer USB Printer Port"}},
		"queue":    {"id": "queue", "type": "PRINTER", "name": "XP-58", "profileId": "THERMAL_58MM", "descriptor": map[string]any{"fingerprint": map[string]any{"source": "WINDOWS_PRINT_QUEUE"}}},
	}
	var body map[string]any
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method == http.MethodPatch {
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				return nil, err
			}
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"physical","type":"PRINTER","usb":{"deviceId":"physical","printerName":"Printer USB Printer Port","windowsQueueName":"XP-58"}}`)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.associateWindowsQueue("physical", "XP-58"); err != nil {
		t.Fatal(err)
	}
	usb, ok := body["usb"].(map[string]any)
	if !ok || usb["windowsQueueName"] != "XP-58" {
		t.Fatalf("association payload = %#v", body)
	}
}

func TestAssociateWindowsQueueBlocksOnlyRealConfiguredOwner(t *testing.T) {
	bridge := newInstallerReadOnlyBridge()
	bridge.baseURL = "http://test.local"
	bridge.devices = map[string]map[string]any{
		"target": {"id": "target", "type": "PRINTER", "usb": map[string]any{"deviceId": "target"}},
		"queue":  {"id": "queue", "type": "PRINTER", "name": "XP-80", "profileId": "THERMAL_80MM", "descriptor": map[string]any{"fingerprint": map[string]any{"source": "WINDOWS_PRINT_QUEUE"}}},
	}
	called := false
	bridge.client.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		called = true
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"target","type":"PRINTER","usb":{"deviceId":"target","windowsQueueName":"XP-80"}}`)), Header: make(http.Header)}, nil
	})
	if _, err := bridge.associateWindowsQueue("target", "XP-80"); err != nil {
		t.Fatalf("queue-only discovery row blocked explicit association: %v", err)
	}
	if !called {
		t.Fatal("valid explicit association must send PATCH")
	}

	bridge.devices["configured"] = map[string]any{
		"id": "configured", "type": "PRINTER", "profileId": "THERMAL_80MM",
		"usb":        map[string]any{"deviceId": "configured", "windowsQueueName": "XP-80"},
		"descriptor": map[string]any{"fingerprint": map[string]any{"source": "WINDOWS_PNP"}},
	}
	if _, err := bridge.associateWindowsQueue("target", "XP-80"); err == nil || !strings.Contains(err.Error(), "asociada") {
		t.Fatalf("real configured owner should block duplicate queue: %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestEmbeddedInstallerUIAssetsExcludeReference(t *testing.T) {
	for _, path := range []string{"assets/ui/index.html", "assets/ui/styles.css", "assets/ui/app.js"} {
		if _, err := embeddedAssets.ReadFile(path); err != nil {
			t.Fatalf("embedded UI asset missing: %s: %v", path, err)
		}
	}
	if _, err := embeddedAssets.ReadFile("assets/ui/reference/manus-terminal-installer-approved.html"); err == nil {
		t.Fatal("approved reference must not be a runtime UI asset")
	}
	for _, path := range []string{"assets/ui/index.runtime.html", "assets/ui/index.runtime.productive.html"} {
		runtimeHTML, err := embeddedAssets.ReadFile(path)
		if err != nil {
			t.Fatalf("runtime UI asset missing: %v", err)
		}
		content := string(runtimeHTML)
		for _, forbidden := range []string{`src="app.js"`, `href="styles.css"`, "http://", "https://"} {
			if strings.Contains(content, forbidden) {
				t.Fatalf("runtime UI contains forbidden reference: %s", forbidden)
			}
		}
		if !strings.Contains(content, "data:image/jpeg;base64,") {
			t.Fatalf("%s does not embed the Manus logo", path)
		}
		if strings.Contains(content, "LogoManus.png.jpeg") || strings.Contains(content, "file://") {
			t.Fatalf("%s contains a non-self-contained logo reference", path)
		}
		if !strings.Contains(content, `.window-bar{display:none!important;}`) {
			t.Fatalf("%s does not hide browser chrome", path)
		}
		if path == "assets/ui/index.runtime.productive.html" && !strings.Contains(content, `.prototype-nav{display:none!important;}`) {
			t.Fatal("productive runtime must hide mock nav")
		}
		if path == "assets/ui/index.runtime.html" && strings.Contains(content, `.prototype-nav{display:none!important;}`) {
			t.Fatal("spike runtime must keep mock nav")
		}
	}
}

func TestBuildLayoutUsesProgramRoots(t *testing.T) {
	t.Setenv("ProgramFiles", `C:\BuildRoot\Program Files`)
	t.Setenv("ProgramData", `C:\BuildRoot\ProgramData`)

	layout := buildLayout(installerManifest{Version: "1.2.3"})
	if got, want := layout.InstallRoot, `C:\BuildRoot\Program Files\Manus\PeripheralAgent`; got != want {
		t.Fatalf("InstallRoot = %q, want %q", got, want)
	}
	if got, want := layout.CurrentRoot, `C:\BuildRoot\Program Files\Manus\PeripheralAgent\current`; got != want {
		t.Fatalf("CurrentRoot = %q, want %q", got, want)
	}
	if got, want := layout.ConfigRoot, `C:\BuildRoot\ProgramData\Manus\PeripheralAgent\config`; got != want {
		t.Fatalf("ConfigRoot = %q, want %q", got, want)
	}
	if got, want := layout.VersionRoot, `C:\BuildRoot\Program Files\Manus\PeripheralAgent\versions\1.2.3`; got != want {
		t.Fatalf("VersionRoot = %q, want %q", got, want)
	}
}

func TestBuildServiceBinaryPathQuotesArguments(t *testing.T) {
	got := buildServiceBinaryPath(`C:\Program Files\Manus\PeripheralAgent\current\ManusTerminalSetup.exe`, "service", "--health-timeout=60")
	want := `"C:\Program Files\Manus\PeripheralAgent\current\ManusTerminalSetup.exe"` + " " + syscall.EscapeArg("service") + " " + syscall.EscapeArg("--health-timeout=60")
	if got != want {
		t.Fatalf("buildServiceBinaryPath() = %q, want %q", got, want)
	}
}

func TestBuildServiceBinaryPathDoesNotEscapeExecutableQuotes(t *testing.T) {
	got := buildServiceBinaryPath(`C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe`, "service")
	if got != `"C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe" service` {
		t.Fatalf("buildServiceBinaryPath() = %q", got)
	}
	if strings.Contains(got, `\"`) {
		t.Fatalf("buildServiceBinaryPath() contains escaped executable quotes: %q", got)
	}
}

func TestBuildServiceRegistrationUsesRawExecutableAndSeparateArgs(t *testing.T) {
	manifest := installerManifest{ServiceArgs: []string{"service", "--health-timeout=60"}}
	layout := runtimeLayout{
		ServiceExe: `C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe`,
	}

	registration := buildServiceRegistration(manifest, layout)

	if registration.Executable != layout.ServiceExe {
		t.Fatalf("Executable = %q, want %q", registration.Executable, layout.ServiceExe)
	}
	if len(registration.Args) != 2 {
		t.Fatalf("Args = %#v, want 2 args", registration.Args)
	}
	if registration.Args[0] != "service" || registration.Args[1] != "--health-timeout=60" {
		t.Fatalf("Args = %#v", registration.Args)
	}
	if strings.Contains(registration.Executable, `\"`) {
		t.Fatalf("Executable contains escaped quotes: %q", registration.Executable)
	}
	if buildServiceBinaryPath(registration.Executable, registration.Args...) != `"C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe" service --health-timeout=60` {
		t.Fatalf("buildServiceBinaryPath preview mismatch")
	}
}

func TestReadInstalledVersionParsesJSONAndText(t *testing.T) {
	dir := t.TempDir()

	jsonPath := filepath.Join(dir, "VERSION.json")
	if err := os.WriteFile(jsonPath, []byte(`{"version":"2.0.1"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, ok := readInstalledVersion(jsonPath); !ok || got != "2.0.1" {
		t.Fatalf("readInstalledVersion(json) = %q, %v", got, ok)
	}

	textPath := filepath.Join(dir, "VERSION")
	if err := os.WriteFile(textPath, []byte("2.0.2\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, ok := readInstalledVersion(textPath); !ok || got != "2.0.2" {
		t.Fatalf("readInstalledVersion(text) = %q, %v", got, ok)
	}
}

func TestRepairStagingValidationRequiresCompletePayload(t *testing.T) {
	dir := t.TempDir()
	manifest := installerManifest{Version: "0.1.1-qa.4", VersionFileName: "VERSION.json"}
	if err := os.WriteFile(filepath.Join(dir, "VERSION.json"), []byte(`{"version":"0.1.1-qa.4"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := validateRepairStaging(dir, manifest); err == nil {
		t.Fatal("incomplete repair staging accepted")
	}
	for _, path := range []string{
		filepath.Join(dir, "ManusTerminalSetup.exe"),
		filepath.Join(dir, "runtime", "node.exe"),
		filepath.Join(dir, "app", "main.js"),
	} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("test"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := validateRepairStaging(dir, manifest); err != nil {
		t.Fatalf("complete repair staging rejected: %v", err)
	}
}

func TestRepairStagingValidationRejectsWrongVersion(t *testing.T) {
	dir := t.TempDir()
	manifest := installerManifest{Version: "0.1.1-qa.4", VersionFileName: "VERSION.json"}
	if err := os.WriteFile(filepath.Join(dir, "VERSION.json"), []byte(`{"version":"0.1.1-qa.3"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := validateRepairStaging(dir, manifest); err == nil {
		t.Fatal("wrong staged version accepted")
	}
}

func TestQA4ToQA5UpgradePreflightAndServiceTarget(t *testing.T) {
	root := t.TempDir()
	t.Setenv("ProgramFiles", filepath.Join(root, "Program Files"))
	t.Setenv("ProgramData", filepath.Join(root, "ProgramData"))
	qa4 := filepath.Join(root, "Program Files", "Manus", "PeripheralAgent", "versions", "0.1.1-qa.4")
	current := filepath.Join(root, "Program Files", "Manus", "PeripheralAgent", "current")
	if err := os.MkdirAll(current, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(current, "VERSION.json"), []byte(`{"version":"0.1.1-qa.4"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	manifest := installerManifest{
		Version:         "0.1.1-qa.5",
		BundleRoot:      "assets/bundle/ManusPeripheralAgent-win-x64-0.1.1-qa.5",
		VersionFileName: "VERSION.json",
		ServiceName:     "ManusPeripheralAgent",
		ServiceArgs:     []string{"service"},
	}
	layout := buildLayout(manifest)
	previous, previousPath := currentInstalledVersion(manifest, layout)
	if previous != "0.1.1-qa.4" || previousPath != qa4 {
		t.Fatalf("previous install = %q %q, want qa.4 at %q", previous, previousPath, qa4)
	}
	staging := filepath.Join(root, "staging-qa.5")
	if err := os.MkdirAll(filepath.Join(staging, "runtime"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(staging, "app"), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{
		filepath.Join(staging, "VERSION.json"),
		filepath.Join(staging, "ManusTerminalSetup.exe"),
		filepath.Join(staging, "runtime", "node.exe"),
		filepath.Join(staging, "app", "main.js"),
	} {
		if err := os.WriteFile(path, []byte(`{"version":"0.1.1-qa.5"}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := validateRepairStaging(staging, manifest); err != nil {
		t.Fatalf("qa.5 staging rejected: %v", err)
	}
	registration := buildServiceRegistration(manifest, runtimeLayout{VersionRoot: filepath.Join(layout.VersionsRoot, manifest.Version), ServiceExe: filepath.Join(layout.VersionsRoot, manifest.Version, "ManusTerminalSetup.exe")})
	if !strings.Contains(registration.Executable, "0.1.1-qa.5") || registration.Args[0] != "service" {
		t.Fatalf("qa.5 service registration = %#v", registration)
	}
}

func TestPreflightDetectsInconsistentFootprints(t *testing.T) {
	root := t.TempDir()
	t.Setenv("ProgramFiles", filepath.Join(root, "Program Files"))
	t.Setenv("ProgramData", filepath.Join(root, "ProgramData"))
	layout := buildLayout(installerManifest{Version: "0.1.1-qa.4"})
	if err := os.MkdirAll(layout.CurrentRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if !hasInstallationFootprints(layout) {
		t.Fatal("expected installation footprint")
	}
}

func TestRepairPathsNeverAliasLiveTarget(t *testing.T) {
	layout := runtimeLayout{VersionsRoot: filepath.Join(t.TempDir(), "versions"), VersionRoot: filepath.Join(t.TempDir(), "versions", "0.1.1-qa.4")}
	staging, backup := newRepairPaths(layout)
	if staging == layout.VersionRoot || backup == layout.VersionRoot || staging == backup {
		t.Fatalf("repair paths alias live target: staging=%q backup=%q target=%q", staging, backup, layout.VersionRoot)
	}
}

func TestUninstallCleanupUsesExternalHelperArguments(t *testing.T) {
	layout := runtimeLayout{
		InstallRoot:     `C:\Program Files\Manus\PeripheralAgent`,
		ProgramDataRoot: `C:\ProgramData\Manus\PeripheralAgent`,
	}
	args := uninstallCleanupArgs(1234, layout, false)
	if strings.Contains(strings.Join(args, " "), layout.InstallRoot+"\\versions") {
		t.Fatal("cleanup args must target install root, not a live child executable")
	}
	pid, installRoot, dataRoot, _, removeData, err := parseUninstallCleanupArgs(args)
	if err != nil || pid != 1234 || installRoot != layout.InstallRoot || dataRoot != layout.ProgramDataRoot || removeData {
		t.Fatalf("cleanup args parse = %d %q %q %v %v", pid, installRoot, dataRoot, removeData, err)
	}
	if strings.HasPrefix(filepath.Clean(filepath.Dir(os.TempDir())), filepath.Clean(layout.InstallRoot)) {
		t.Fatal("test temp root unexpectedly inside Program Files")
	}
}

func TestUninstallCleanupRequiresParentAndRoots(t *testing.T) {
	if _, _, _, _, _, err := parseUninstallCleanupArgs(nil); err == nil {
		t.Fatal("incomplete cleanup arguments accepted")
	}
}

func TestPOSProcessScopeRequiresPathContainment(t *testing.T) {
	root := `C:\Program Files\Manus\POS`
	if !pathWithinRoot(`C:\Program Files\Manus\POS\current\Manus POS.exe`, root) {
		t.Fatal("POS executable under root was not accepted")
	}
	if !pathWithinRoot(`c:\program files\manus\pos\versions\0.1.0\Manus POS.exe`, root) {
		t.Fatal("case-insensitive POS path was not accepted")
	}
	for _, outside := range []string{
		`C:\Program Files\Manus\POS-other\Manus POS.exe`,
		`C:\Program Files\Other\Manus POS.exe`,
		`C:\Windows\System32\electron.exe`,
	} {
		if pathWithinRoot(outside, root) {
			t.Fatalf("outside process path accepted: %s", outside)
		}
	}
}

func TestProgramDataAloneIsNotProductiveFootprint(t *testing.T) {
	root := t.TempDir()
	layout := runtimeLayout{
		InstallRoot:     filepath.Join(root, "Program Files", "Manus", "PeripheralAgent"),
		ProgramDataRoot: filepath.Join(root, "ProgramData", "Manus", "PeripheralAgent"),
	}
	if err := os.MkdirAll(layout.ProgramDataRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if hasInstallationFootprints(layout) {
		t.Fatal("ProgramData alone must not be inconsistent")
	}
}

func TestEmptyManusParentCanBeRemovedButNonEmptyIsPreserved(t *testing.T) {
	root := filepath.Join(t.TempDir(), "Manus")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	removed, err := removeEmptyManusParent(root)
	if err != nil || !removed || exists(root) {
		t.Fatalf("empty Manus parent cleanup = removed=%v err=%v exists=%v", removed, err, exists(root))
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "other.txt"), []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}
	removed, err = removeEmptyManusParent(root)
	if err != nil || removed || !exists(root) {
		t.Fatalf("non-empty Manus parent cleanup = removed=%v err=%v exists=%v", removed, err, exists(root))
	}
}

func TestTempCleanupCommandQuotesPathsWithSpacesAndRunsFromParent(t *testing.T) {
	tempRoot := filepath.Join(os.TempDir(), "Ivan Castro", "ManusTerminalSetup-uninstall-7280")
	if err := os.MkdirAll(filepath.Dir(tempRoot), 0o755); err != nil {
		t.Fatal(err)
	}
	script, err := writeTempCleanupScript(tempRoot, filepath.Join(os.TempDir(), "logs", "installer.log"), true)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(script)
	defer os.Remove(filepath.Dir(tempRoot))
	contents, err := os.ReadFile(script)
	if err != nil || !strings.Contains(string(contents), `rmdir /s /q "%TARGET%"`) || !strings.Contains(string(contents), "1,1,12") {
		t.Fatalf("cleanup script invalid: %v %s", err, contents)
	}
	command := buildTempCleanupCommand(tempRoot)
	if !strings.Contains(command, "retries=12") {
		t.Fatalf("cleanup command = %q", command)
	}
	finalScript := filepath.Join(filepath.Dir(tempRoot), "ManusTerminalSetup-cleanup-final.cmd")
	if err := writeFinalLogCleanupScript(finalScript, filepath.Join(os.TempDir(), "Manus Terminal Setup.log")); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(finalScript)
	finalContents, err := os.ReadFile(finalScript)
	if err != nil || !strings.Contains(string(finalContents), "1,1,12") || !strings.Contains(string(finalContents), "del /q") {
		t.Fatalf("final cleanup script invalid: %v %s", err, finalContents)
	}
	if filepath.Dir(tempRoot) == tempRoot {
		t.Fatal("cleanup target must have an external working directory")
	}
}

func TestEnvDurationSecondsFallback(t *testing.T) {
	t.Setenv("MANUS_INSTALLER_HEALTH_TIMEOUT_SECONDS", "")
	if got := envDurationSeconds("MANUS_INSTALLER_HEALTH_TIMEOUT_SECONDS", 33); got != 33*time.Second {
		t.Fatalf("fallback duration = %v, want 33s", got)
	}
}

func TestRollbackRegistrationCanTargetPreviousVersionExecutable(t *testing.T) {
	manifest := installerManifest{ServiceArgs: []string{"service"}}
	layout := runtimeLayout{
		ServiceExe: `C:\Program Files\Manus\PeripheralAgent\versions\0.1.1-qa.3\ManusTerminalSetup.exe`,
	}
	rollbackPath := `C:\Program Files\Manus\PeripheralAgent\versions\0.1.0`
	registration := buildServiceRegistration(manifest, layout)
	registration.Executable = filepath.Join(rollbackPath, "ManusTerminalSetup.exe")

	if registration.Executable != `C:\Program Files\Manus\PeripheralAgent\versions\0.1.0\ManusTerminalSetup.exe` {
		t.Fatalf("rollback executable = %q", registration.Executable)
	}
}

func TestUpgradePreservesExistingConfigAndInstallationIdentity(t *testing.T) {
	root := t.TempDir()
	t.Setenv("ProgramFiles", filepath.Join(root, "Program Files"))
	t.Setenv("ProgramData", filepath.Join(root, "ProgramData"))
	layout := buildLayout(installerManifest{Version: "0.1.1-qa.3"})

	if err := ensureBaseDirectories(layout); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(layout.VersionRoot, "config"), 0o755); err != nil {
		t.Fatal(err)
	}
	seed := []byte(`{"mode":"REAL"}`)
	if err := os.WriteFile(filepath.Join(layout.VersionRoot, "config", "agent.config.local.json"), seed, 0o644); err != nil {
		t.Fatal(err)
	}

	existingConfig := []byte(`{"mode":"MOCK","marker":"preserve-me"}`)
	configPath := filepath.Join(layout.ConfigRoot, "agent.config.local.json")
	if err := os.WriteFile(configPath, existingConfig, 0o644); err != nil {
		t.Fatal(err)
	}
	identityPath := filepath.Join(layout.StateRoot, "agent-installation-id")
	identity := []byte("qa-installation-id")
	if err := os.WriteFile(identityPath, identity, 0o644); err != nil {
		t.Fatal(err)
	}

	if err := ensureLocalConfig(layout); err != nil {
		t.Fatal(err)
	}
	gotConfig, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}
	gotIdentity, err := os.ReadFile(identityPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(gotConfig) != string(existingConfig) {
		t.Fatalf("existing config changed: %s", gotConfig)
	}
	if string(gotIdentity) != string(identity) {
		t.Fatalf("installation identity changed: %s", gotIdentity)
	}
}

func TestEnsureLocalConfigSeedsOnlyMissingTrustedAgentEnrollmentSettings(t *testing.T) {
	root := t.TempDir()
	t.Setenv("ProgramFiles", filepath.Join(root, "Program Files"))
	t.Setenv("ProgramData", filepath.Join(root, "ProgramData"))
	layout := buildLayout(installerManifest{Version: "0.1.1-qa.10"})
	if err := ensureBaseDirectories(layout); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(layout.VersionRoot, "config"), 0o755); err != nil {
		t.Fatal(err)
	}
	seed := `{"mode":"REAL","enrollmentApiBaseUrl":"https://api.qa.example/api","enrollmentSigningPublicKeyPem":"PUBLIC-KEY-FIXTURE","enrollmentAudience":"manus-agent:qa","enrollmentSigningKeyId":"qa-fixture"}`
	if err := os.WriteFile(filepath.Join(layout.VersionRoot, "config", "agent.config.local.json"), []byte(seed), 0o644); err != nil {
		t.Fatal(err)
	}
	configPath := filepath.Join(layout.ConfigRoot, "agent.config.local.json")
	if err := os.WriteFile(configPath, []byte(`{"mode":"REAL","enrollmentSigningKeyId":"operator-pinned-key"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := ensureLocalConfig(layout); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatal(err)
	}
	if got["mode"] != "REAL" || got["enrollmentSigningKeyId"] != "operator-pinned-key" {
		t.Fatalf("existing Agent config or trust pin changed: %s", data)
	}
	for key, want := range map[string]string{
		"enrollmentApiBaseUrl":          "https://api.qa.example/api",
		"enrollmentSigningPublicKeyPem": "PUBLIC-KEY-FIXTURE",
		"enrollmentAudience":            "manus-agent:qa",
	} {
		if got[key] != want {
			t.Fatalf("seeded %s = %v, want trusted package value", key, got[key])
		}
	}
	if strings.Contains(string(data), "PRIVATE") || strings.Contains(string(data), "secret") {
		t.Fatal("Agent config contains private or credential material")
	}
}
