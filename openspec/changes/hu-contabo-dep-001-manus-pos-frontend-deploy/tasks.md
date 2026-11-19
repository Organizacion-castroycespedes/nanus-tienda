## 1. Governance and ownership

- [x] 1.1 Register HU-CONTABO-DEP-001 paths in `scripts/governance/openspec-scope.json` and verify the governance diagnostic recognizes the change without reassigning unrelated ownership
- [x] 1.2 Complete and strict-validate proposal, design, capability specification, tasks, and QA evidence for `hu-contabo-dep-001-manus-pos-frontend-deploy`

## 2. Strict TypeScript correction

- [x] 2.1 Narrow the optional `window.manusTerminal` value as `unknown` at `web/app/[tenant]/pos/page.tsx` using the existing peripheral runtime pattern and verify strict TypeScript passes without behavior changes

## 3. Frontend-only release tooling

- [x] 3.1 Implement a guarded MANUS POS web deployment/rollback script that validates staging integrity and fixed target contracts, preserves `.env*`, creates and verifies backup, restarts only `manuspos-web`, runs bounded health checks, and emits sanitized evidence; verify with `bash -n` and focused script tests
- [x] 3.2 Add focused deployment-script tests for preflight rejection, successful frontend-only replacement, environment preservation, and rollback behavior using temporary paths and mocked runtime commands

## 4. Independent GitHub Actions workflow

- [x] 4.1 Add a manual-only, master-bound workflow with minimal permissions, non-cancelling concurrency, exact branding/API build variables, lockfile install, tests, typecheck, lint, build, runtime packaging, manifest, and checksums; verify required payload and metadata checks pass locally
- [x] 4.2 Add the protected `manus-pos-production` deployment job with dedicated SSH secrets, pinned known-hosts verification, fixed Contabo target guards, staging-only transfer, remote checksum validation, automatic public-smoke rollback, and always-retained evidence; verify workflow syntax and static safety assertions

## 5. Operations documentation

- [x] 5.1 Document secret and variable names without values, GitHub Environment reviewers/protection, PR instructions, first manual execution, post-deploy verification, rollback, evidence interpretation, and hard blockers; verify every unknown value is explicitly operator-supplied
- [x] 5.2 Document dependency vulnerability findings and publication risks without changing dependency versions or running forced audit remediation

## 6. Validation and handoff

- [x] 6.1 Run focused tests, strict TypeScript, lint, production build, shell tests, workflow validation, governance diagnostic, strict OpenSpec validation, checksum simulation, `git diff --check`, and secret/path scans; record PASS, FAIL, PARTIAL, and BLOCKED honestly in QA evidence
- [x] 6.2 Review the final diff for absence of Emaus changes, database/API/reporting/FactuCore/electronic-billing/Electron/peripheral changes, automatic push deployment, secret values, and unauthorized production actions

## 7. Audit remediation

- [x] 7.1 Require an independently approved MANUS login-asset SHA-256 and fail before build/package when the asset is missing or mismatched; keep branding BLOCKED while the approved asset is unavailable
- [x] 7.2 Replace mutable privileged execution with a fixed root-owned filesystem-helper contract, keep PM2 execution owned by `ubuntu`, and document the one-time privileged provisioning blocker
- [x] 7.3 Implement versioned releases, atomic symlink activation, recoverable transaction state, restore-time backup checksum validation, explicit restart failure propagation, branding/build-identity smoke checks, and negative tests
- [x] 7.4 Pin the runner image, record runtime provenance, assess the smallest supported Next.js security upgrade, and retain dependency changes only if focused tests, lint, build, and audit pass
- [x] 7.5 Update runbook and QA evidence with the verified blockers, helper/PM2 contract, security applicability, test results, and honest GO/NO-GO status
- [x] 7.6 Run shell tests, workflow validation, lint, build, production audit, strict OpenSpec validation, governance diagnostics, scope review, secret/path scans, and `git diff --check`; distinguish preexisting failures from regressions

## 8. Environment-isolated branding remediation

- [x] 8.1 Verify the owner-supplied MANUS image SHA-256 against the tracked MANUS asset and preserve the distinct Emaús asset byte-for-byte
- [x] 8.2 Point only the MANUS workflow, manifest, integrity gates, helper, and smoke checks to `/login-bg.png`; preserve resolver defaults and the Emaús workflow
- [x] 8.3 Add focused negative coverage for wrong branding paths and checksums, then validate both Emaús fallback and MANUS configured branding
- [x] 8.4 Run focused tests, lint, MANUS production build, checksum/static workflow checks, strict OpenSpec validation, and diff hygiene; record remaining operational blockers honestly
