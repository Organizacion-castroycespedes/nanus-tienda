# Proposal

## Why

Build 07 is installed with Agent `0.1.1-qa.16`. A candidate with changed bytes cannot safely reuse that identity under P0-B. The normal QA pipeline also ends with a validator that executes the generated installer, so it cannot be used for an isolated artifact-only build.

## What Changes

- Advance the single QA Agent version source from `0.1.1-qa.16` to `0.1.1-qa.17` for the bounded pairing-challenge clock-skew fix, preserving production version resolution.
- Add an explicit QA build path that packages Electron, Agent, and the installer, then runs static artifact checks without starting any generated executable.
- Include Electron's compiled close-policy module in the packaged `app.asar` and statically reject artifacts whose main module cannot resolve it.
- Keep the existing dynamic validation command unchanged for separately authorized contexts.
- Emit a sanitized build manifest with the candidate identity, inventory, hashes, versions, package policy, endpoint, and signing status.

## Capabilities

This is build and release tooling only. It changes no runtime protocol or product behavior and adds no product capability. The `qa-windows-candidate-build` delta records the existing tooling contract (single QA version source, non-reused candidate identity, static build without executing artifacts, fail-closed static validation, close-policy module in `app.asar`). It replaces the former `skip_specs: true`, which the OpenSpec CLI 1.4.0 pinned in CI does not accept.

## Impact

Affected files are the QA version source and its test, QA static build and validation scripts/tests, and this OpenSpec change. Build 07 remains installed and unchanged. This build work changes no production version, database, peripheral, or Windows host state. The package keeps its existing QA trust policy; it neither generates signing keys nor changes the operator-provisioned runtime trust file.
