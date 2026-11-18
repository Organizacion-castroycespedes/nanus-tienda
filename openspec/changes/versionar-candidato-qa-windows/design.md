# Design

## Context

Build 07 is installed with QA Agent `0.1.1-qa.16`; the single QA version source is `scripts/agent-version.mjs`. `build-windows-installer.mjs` invokes a validator that starts the installer with `inspect` and `status`. The supported source of QA environment values is `desktop/electron/scripts/environments.mjs`. Electron main imports `window-close-policy.js`, so the QA artifact must include and inspect that compiled module in `app.asar`.

## Goals / Non-Goals

**Goals:**

- Use `0.1.1-qa.17` as the sole QA Agent and installer version for this candidate.
- Provide an explicit QA build entrypoint whose final gate reads files and hashes only.
- Check the generated installer as a PE x64 file and verify embedded QA configuration and manifests without executing it.
- Keep production versioning and the existing dynamic validation route unchanged.

**Non-Goals:**

- Do not run install, inspect, status, Agent, Electron, service, enrollment, discovery, or hardware operations as validation.
- Do not modify the installed Build 07, P0-B policy, production metadata, trust material, or device contracts.
- Do not certify functional installation or peripheral operation from static artifact checks.

## Decisions

1. Change only `QA_AGENT_VERSION`; production continues to resolve from the package version. `0.1.1-qa.17` follows the installed Build 07 identity `0.1.1-qa.16`.
2. Add a separate QA static build entrypoint rather than adding a switch to the dynamic validator. The existing `build-windows-installer.mjs` route stays intact.
3. The new entrypoint uses the verified Node and Go executables supplied by absolute path, and runs only the existing packager stages plus a new static validator. It does not invoke the generated installer or Agent.
4. Electron Builder explicitly includes `dist/window-close-policy.js`; static validation opens the packaged `app.asar`, verifies `dist/main.js` requires that module and the module exports the wired handler, and writes that result to the build manifest.
5. Static validation checks source manifests/config, version agreement, package profile, expected assets, PE x64 headers, exact embedded marker bytes, and the resulting executable hash. The report contains no secret material.
6. The candidate is identified as `0.1.1-qa.17`; a different byte identity remains a new candidate under P0-B and does not imply an update path from Build 07.

## Build 08 pairing clock-skew increment

The candidate advances the QA identity from Build 07 `0.1.1-qa.16` to `0.1.1-qa.17`. Its only new runtime source is the Agent verifier's bounded `issuedAt` tolerance plus focused tests. The QA endpoint, audience and public-trust packaging policy stay as before; the build does not create or expose signing material. Installer code preserves non-empty enrollment fields in an existing ProgramData config, but P0-B still classifies a version transition as `UNKNOWN/transition_unproven`; packaging this candidate does not accredit an upgrade or permit installation.

## Risks / Trade-offs

- Static checks cannot prove installer behavior → report the artifact as statically verified only; installation remains a separate authorized QA action.
- Go embed layout could change → check for exact embedded marker bytes and fail closed if they are not present.
- Package-level QA trust remains absent by policy; this static build does not verify runtime pairing or change the trust already provisioned on the host.
- Existing dynamic validation is not suitable for this host → leave it unchanged and expose a separate QA-only entrypoint.

## Migration Plan

Build into the isolated mirror after strict ownership and test gates pass. Preserve the generated EXE and its static manifest as a new candidate. Do not install it or alter Build 07. A later host transition requires a separately admitted transition under P0-B.

## qa.18 identity and CI-compatible specification

The next QA candidate combines the Build 08 baseline already in `develop` with `EXCLUSIVE_ACQUISITION_V1`. It advances the QA identity to `0.1.1-qa.18`, because `0.1.1-qa.17` is the built Build 08 identity and different bytes must not reuse it. Only `QA_AGENT_VERSION` and its tests change; production version resolution is unchanged.

The change previously set `skip_specs: true` to avoid inventing a product capability. The OpenSpec CLI 1.4.0 pinned in CI rejects that setting, and upgrading the CLI would change validation for every change in the repository. Instead, `specs/qa-windows-candidate-build` states the tooling contract that the scripts and their tests already implement. It adds no product behavior, and the original intent is preserved. Supporting `skip_specs` in CI remains a separate decision that needs its own evaluation.
