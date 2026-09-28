## 1. Branding resolver

- [ ] 1.1 Keep the atomic branding resolver and EMAUS fallback aligned with the login spec.
- [ ] 1.2 Keep Next.js public environment injection wired to the resolver result.
- [ ] 1.3 Keep login metadata and visual rendering consistent with the resolved pair.

## 2. Validation

- [ ] 2.1 Run configured, absent, and partial branding tests.
- [ ] 2.2 Run Web lint and the relevant Web typecheck.
- [ ] 2.3 Verify DEV, QA, and production Electron environment origins without generating installers.
- [ ] 2.4 Run OpenSpec strict validation and record installer version-label gaps separately.

## 3. QA installer preparation

- [ ] 3.1 Confirm the QA Web deployment receives both Manus branding variables.
- [ ] 3.2 Confirm QA installer output naming can use `MANUS_INSTALLER_OUTPUT_NAME` without changing production defaults.
- [x] 3.3 Validate QA `0.1.1-qa.13` and production `0.1.1-prd.2` metadata through the shared version resolver.
- [x] 3.4 Update the Node toolchain to the Agent engine requirement before isolated Windows x64 packaging.
