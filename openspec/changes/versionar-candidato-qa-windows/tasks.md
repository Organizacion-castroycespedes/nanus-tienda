# Tasks

## 1. Version identity

- [x] 1.1 Advance the QA Agent source to `0.1.1-qa.15` and update its focused regression test; verify version resolution, QA override rejection, and unchanged production resolution with `node --test scripts/agent-version.spec.mjs` (PASS, Node 24.21.0).

## 2. Static QA build path

- [x] 2.1 Add a QA-only build orchestrator that requires verified Node 24.21.0 and Go 1.24.10 paths, packages Electron/Agent/installer, and never invokes generated EXEs; verify with static source checks and a command-plan test (PASS).
- [x] 2.2 Add static validation for QA configuration, manifests, assets, PE x64 identity, embedded markers, output hash, Authenticode status, and sanitized build manifest; test success and rejection cases using synthetic files only (12/12 PASS).
- [x] 2.3 Include the compiled Electron close-policy dependency in `app.asar`; inspect the packaged archive and reject it if `main.js` cannot resolve the module (synthetic positive/negative archive tests PASS; Build 06 static check resolved `/dist/main.js` to `/dist/window-close-policy.js`).

## 3. Governance and candidate

- [x] 3.1 Assign SINGLE_MATCH ownership to each new or changed path and pass OpenSpec and official governance STRICT checks; verify no prior scope files or user changes are overwritten (PASS; no new global OpenSpec failures).
- [x] 3.2 Run the three focused Go UI tests, isolated Agent tests, TypeScript build with Node 24.21.0, version/static-validator tests, and `git diff --check`; confirm the negative hardware guard passes (Go 3/3, Agent 28/28, TypeScript and diff check PASS).
- [x] 3.3 Build candidate `0.1.1-qa.15` in isolated Build 06 only after all gates passed; static validation PASS, 75 POS manifest files, QA `REAL` adapters enabled with startup discovery disabled, QA endpoint/audience, trust values absent, close-policy module resolved in `app.asar`, and observer absent. EXE: `D:\ManusQA-Build-06-20261114-qa15-close-policy\deliverables\ManusTerminalSetup-0.1.1-qa.15-win-x64.exe`, 487719936 bytes, SHA-256 `0896B77331327E3F70F7D3E896D6FC7F58098CC006C2E4AF242ED6F842444636`, Authenticode NotSigned. Generated executables and hardware were not run/accessed; Build 04 remains installed and unchanged.
- [x] 3.4 Advance the QA identity to `0.1.1-qa.16` for the serial discovery fix, run focused serial regression and static package validation, then build the candidate in a new isolated mirror without executing generated binaries. Serial regression 10/10 and version/static-validator tests 13/13 PASS; OpenSpec STRICT and official governance STRICT PASS; Electron and Agent builds plus POS manifest 75/75 PASS. The embedded compiled provider contains independent `Win32_SerialPort` and `Get-PnpDevice -PresentOnly` queries, `reconcileWindowsSerialDiagnostics`, and its manifest SHA-256 matches the compiled file. EXE: `%TEMP%\ManusQA-Build-07-20261114-qa16-serial\source\backend-perifericos\dist-installer\windows-x64\ManusTerminalSetup-0.1.1-qa.16-win-x64.exe`, 487723520 bytes, SHA-256 `b5ff381329619ce231f8f6d0b9359c0ae3e2ed0230714f9be20bc7785d86b42f`, Authenticode NotSigned. Static manifest confirms QA `REAL`, real adapters enabled, startup discovery disabled, QA endpoint/audience, trust values absent, `generatedExecutablesRun:false` and `hardwareAccessed:false`.

## 4. Build 08 pairing clock-skew candidate

- [x] 4.1 Advance the QA identity from installed `0.1.1-qa.16` to `0.1.1-qa.17`; keep the production package version unchanged and reject an override that tries to reuse `.16`. Evidence: version/static-builder tests 13/13 PASS; TypeScript build PASS; pairing verifier tests 5/5 PASS.
- [x] 4.2 Build `0.1.1-qa.17` from an isolated copy of the certified Build 07 source, excluding `.env` files and junction traversal, and overlay only the pairing verifier/test and QA-version files. Version/static tests 13/13 and pairing tests 5/5 PASS; Node 24.21.0 and Go 1.24.10 static pipeline PASS; POS manifest 75/75; compiled Agent bundle contains `MAX_CHALLENGE_FUTURE_SKEW_MS = 2_000` and applies it only to `issuedAt`; the package manifest hash matches the compiled module, and a read-only scan found both code markers in the final PE. Static QA config is REAL with adapters enabled, startup discovery disabled, QA endpoint/audience, and no package trust key/Key ID; generated executables were not run and hardware was not accessed. Candidate EXE: `%TEMP%\ManusQA-Build-08-20261114-qa17-pairing-skew\source\backend-perifericos\dist-installer\windows-x64\ManusTerminalSetup-0.1.1-qa.17-win-x64.exe`, 487723520 bytes, SHA-256 `f1e6d83f398d7534f8d20206c4cd1a6e0f9b1fc31023f61361120fd235b7ec7e`, Authenticode NotSigned. P0-B does not admit update from Build 07; installation not run.

## 5. qa.18 identity and CI-compatible specification

- [x] 5.1 Advance the QA identity from the built Build 08 `0.1.1-qa.17` to `0.1.1-qa.18` for the candidate that adds `EXCLUSIVE_ACQUISITION_V1`; reject `.16` and `.17` as QA overrides and keep production resolution unchanged.
- [x] 5.2 Replace `skip_specs: true` with the `qa-windows-candidate-build` tooling delta, validated STRICT with the OpenSpec CLI 1.4.0 used in CI.
- [ ] 5.3 Build the `0.1.1-qa.18` candidate with the static QA path, using verified Node 24.21.0 and Go 1.24.10, without executing generated binaries. Blocked until Go 1.24.10 is available; installation stays outside this change and requires a certified 14.4 transition.
