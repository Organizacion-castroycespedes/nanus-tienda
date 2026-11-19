# QA evidence - HU-CONTABO-DEP-001

Date: 2026-11-05

Source branch: `feature/master/hu-contabo-dep-001`

Base: `origin/master` at `d698ef5429cb6a7d855f416ff11d7b865463a707`

No commit, push, merge, GitHub Environment mutation, SSH connection, or production deployment was performed.

## Results

| Status | Control | Evidence |
|---|---|---|
| PASS | Branch/base discovery | Clean unrelated branch was left; new branch created from freshly fetched `origin/master` at the SHA above. |
| PASS | Requested branding asset | `web/public/logo-login-tablet.png` exists and is non-empty. |
| PASS | Minimal terminal bridge fix | `window.manusTerminal` is narrowed as optional `unknown` using the existing peripherals pattern. Repository-wide tsc reports zero errors for `web/app/[tenant]/pos/page.tsx`. |
| PASS | Login branding tests | `node --test web/lib/login-branding.spec.mjs`: 3 passed, 0 failed. |
| PASS | Frontend lint | `cd web && npm run lint`: no warnings or errors. |
| PASS | Clean production build | With ignored `web/.env` temporarily absent and only the five approved production build variables set, `npm run build` compiled, linted, type-checked, generated pages, and exited 0 on Node `v24.21.0` / Next `14.2.35`. |
| PASS | Deploy script syntax | `bash -n` passed for production deploy and focused test scripts. |
| PASS | Deploy script behavior | Focused temp-directory tests reject wrong target, verify intact checksums, reject corruption, replace only web, preserve `.env.production`, restart only `manuspos-web`, create/verify backup, and restore rollback. |
| PASS | Workflow YAML/static safety | `js-yaml` parses the file. Assertions confirm only `workflow_dispatch`, `contents: read`, non-cancelling concurrency, Environment `manus-pos-production`, strict host checking, no push trigger, no Emaús token, and no `ssh-keyscan`. |
| PASS | Immutable action references | Checkout, setup-node, upload-artifact, and download-artifact use full release commit SHAs rather than mutable tags. |
| PASS | Integrity design | Build exports archive SHA-256 across the job boundary; deploy compares it before SSH, verifies the companion checksum locally and remotely, then verifies every inner payload checksum and manifest commit. |
| PASS | Emaús isolation | `git diff --quiet origin/master -- .github/workflows/deploy-prod-master.yml scripts/deploy/prod-deploy-full.sh` passes. Existing Emaús deployment files are unchanged. |
| PASS | Scope review | Changed files contain no API, database, reportería, FactuCore, electronic-billing, Electron, or peripheral runtime implementation. |
| PASS | Change OpenSpec | `openspec validate hu-contabo-dep-001-manus-pos-frontend-deploy --strict` passes. |
| PASS | Governance ownership coverage | Final manifest load is valid with no manifest errors, invalid files, ambiguous files, ambiguous current ownership, or uncovered files. |
| PASS | Diff hygiene | `git diff --check` passes. No secret values are included. |
| FAIL | Repository-wide raw TypeScript command | `cd web && npx tsc --noEmit` exits 2 with 26 existing test-fixture type errors. The requested POS page has 0 matching errors, and clean Next production type-check passes. This HU does not broaden into unrelated test repairs. |
| FAIL | Production dependency audit | `npm audit --omit=dev --json` reports 4 production findings: 1 critical and 3 high. Affected packages: direct `next`; transitive `nanoid`, `postcss`, and `source-map-js`. No dependency change or forced fix was performed. Security acceptance or a separate governed upgrade is required before approval. |
| FAIL | Repository-wide governance STRICT gate | Full diagnostic exits 2 because 12 unchanged global specs fail global strict validation: `access-role-audit`, `catalog-action-focus-ux`, the deliveries capability set, `promotion-action-focus-ux`, and `soportar-productos-no-inventariables`. The HU change itself is strict-valid and its scope manifest is valid. |
| PARTIAL | Full runtime artifact execution | Packaging and checksum logic is implemented and checksum corruption is tested. The complete Linux Actions artifact has not been produced locally because the definitive runtime is built on `ubuntu-latest`. First GitHub Actions build must verify size and contents. |
| PARTIAL | Workflow platform validation | YAML parsing and repository static assertions pass. GitHub has not parsed or executed the new workflow because it is not committed or pushed. |
| BLOCKED | GitHub production Environment | Required reviewers, prevention of self-review, `master` restriction, secrets, and variables must be configured by repository administrators. |
| BLOCKED | Real server preflight | SSH user/port, staging root, backup root, public HTTPS URL, PM2 command/cwd, permissions, disk space, and host fingerprint remain unverified. They were intentionally not invented. |
| BLOCKED | Production proof | No connection to `109.123.251.8` and no real deployment occurred. Production behavior cannot be claimed. |

## Build variables validated

- `NEXT_PUBLIC_LOGIN_BRAND_NAME=MANUS POS`
- `NEXT_PUBLIC_GIN_BG_IMAGE=/logo-login-tablet.png`
- `NEXT_PUBLIC_API_BASE_URL=/api`
- `NEXT_PUBLIC_REPORTS_API_BASE_URL=/api`
- `API_PROXY_TARGET=http://127.0.0.1:4020`

## Publication decision

Code and local production build are ready for PR review. Production execution is not ready. It remains blocked by critical/high dependency findings, external GitHub Environment setup, and real MANUS POS server preflight. A reviewer must not infer production success from this evidence.

## Audit remediation - 2026-11-06

This section supersedes earlier branding, dependency, privilege, atomicity, and publication findings where they conflict. No commit, push, merge, SSH connection, privileged server mutation, or deployment was performed.

| Status | Control | Evidence |
|---|---|---|
| BLOCKED | Approved production branding asset | Visual inspection proves tracked `web/public/logo-login-tablet.png` contains Emaus branding. Other MANUS-looking repository images are not proven to be the manually approved production image. No replacement was fabricated. The workflow now requires a committed `logo-login-tablet.png.sha256`; that file is intentionally absent, so build fails before packaging. |
| PASS | Emaus branding prevention | Workflow validates the approved asset checksum before build, records it in the manifest, validates it inside staged release, and compares local/public served bytes after activation. The current Emaus image cannot become a deployable MANUS artifact. |
| PASS | Privilege separation design | SSH and PM2 are fixed to `ubuntu`. Uploaded orchestration remains unprivileged. Root-owned `/var/www` mutation is limited to a fixed, root-owned, checksum-attested helper that never executes staged code. |
| BLOCKED | Privileged production provisioning | Operations must install the reviewed helper, root-owned config, narrow sudo rule, releases root, and initial `/var/www/manuspos-web` symlink. Repository validation cannot perform or certify this privileged migration. |
| PASS | PM2 failure propagation | `restart_web` explicitly returns on `pm2 restart` or PID failure. Negative test verifies restart failure triggers helper rollback and deployment failure. PM2 name remains exactly `manuspos-web`; owner/home are `ubuntu` and `/home/ubuntu/.pm2`. |
| PASS | Backup restore integrity | Helper verifies backup after creation and runs `sha256sum --check` again immediately before fallback extraction. Negative Linux test rejects corrupted backup before restore. |
| PASS | Crash-safe activation design | Versioned releases and a single same-directory symlink rename replace the prior two-directory-rename gap. Root-owned transaction state supports recovery after prepared or activated interruption. Old release is retained. |
| PARTIAL | Linux filesystem-helper integration tests | Syntax passes. Windows Git Bash cannot create real POSIX symlinks, so helper activation/rollback/interruption/corrupt-backup tests are gated to the pinned Ubuntu Actions runner. Local non-symlink integrity and restart-failure tests pass. |
| PASS | Branding and build identity smoke design | Local and public login must contain `MANUS POS`; served login asset bytes must match approved SHA-256; active `.next/BUILD_ID` must match the signed manifest value. |
| PASS | Runner reproducibility | Both jobs use explicit `ubuntu-24.04`; Node remains exact `24.21.0`. Manifest records runner, Node, Next, build ID, asset hash, helper hash, commit, and API/branding inputs. Regular files and symlink targets are integrity-covered. |
| PASS | Supported Next.js remediation | Upgraded direct `next` and `eslint-config-next` to `15.5.29`; added narrow patched overrides `postcss@8.5.23`, `nanoid@3.3.18`, and `source-map-js@1.2.2`. Runtime tree includes `sharp@0.35.5`. |
| PASS | Production dependency audit | `npm audit --omit=dev --audit-level=high --json` reports 0 production vulnerabilities. Workflow audit is blocking and has no `continue-on-error` or forced remediation. |
| PARTIAL | Development dependency audit | Full `npm audit --json` reports 13 dev-only findings: 2 critical, 7 high, and 4 moderate. Critical paths are `vitest`/`tinypool`; other findings are lint/test/build tooling. They are absent from production `node_modules`, and the workflow never starts Vitest UI or Vite dev server. The full report is retained; a semver-major Vitest 5 migration requires separate validation. |
| PASS | Next 15 compatibility | Five server pages received only required async `params`/`searchParams` typing. `npm run lint` passes. Exact-variable Next `15.5.29` production build compiles, lints, type-checks, generates pages, and exits 0 on Node `24.21.0`. |
| PASS | Change OpenSpec | Updated proposal, design, requirements, tasks, and this QA evidence. Strict validation passes after remediation. |
| PASS | Governance ownership coverage | Focused diagnostic reports `CURRENT_SINGLE_MATCH` for the generated `web/next-env.d.ts` and no uncovered or ambiguous paths after scope update. |
| FAIL | Repository-wide raw TypeScript | Raw `tsc --noEmit --incremental false` still reports the same 26 errors in 12 unchanged `*.spec.ts` files. `git diff --quiet origin/master` passes for every error file; changed pages have no raw TypeScript error and the strict Next production build passes. This is preexisting debt, not a remediation regression. |
| FAIL | Repository-wide OpenSpec/governance gate | Global strict validation remains 121 PASS / 12 FAIL. The failing capabilities are unchanged from `origin/master`; the HU change itself is strict-valid and its scope coverage is clean. Governance also lacks external LOCAL/PRD promotion evidence, which this no-SSH task cannot supply. |
| PASS | Diff and isolation | `git diff --check` passes; Emaus production workflow/script are unchanged; no API, database, reporting, FactuCore, electronic-billing, Electron, or peripheral runtime file changed; secret-pattern scan found no value. |
| BLOCKED | Production proof | GitHub Environment, approved artwork, helper provisioning, Contabo architecture/libc/Node/PM2 contract, host fingerprint, storage, and public URL remain external. No production success is claimed. |

### Remediation publication decision

Dependency and code-level deployment blockers are remediated locally. PR remains `NO-GO` while the approved production image/checksum is unavailable. Production execution also remains `NO-GO` until privileged helper/symlink provisioning and read-only server attestations are completed by operations.

## Branding isolation remediation - 2026-11-06

This section supersedes the earlier approved-artwork blocker and old `/logo-login-tablet.png` MANUS build variable. No commit, push, merge, SSH connection, GitHub mutation, or deployment was performed.

| Status | Control | Evidence |
|---|---|---|
| PASS | Approved MANUS source | Owner-supplied `C:\Users\icast\Downloads\logo-login-tablet.png` and tracked `web/public/login-bg.png` both hash to `c04ce9b2b4c29180ac07c5b845665f342f5fa5f5b8f2cb7c88bc1e79a226822a`. No image was copied, recreated, or edited. |
| PASS | Emaús asset preserved | `web/public/logo-login-tablet.png` remains the distinct Emaús asset with SHA-256 `ec583eb86cf125bb7be35268b2350d90f042348f59b86b31bbf50c305af3e26a`. The Emaús workflow and deploy script are unchanged from `origin/master`. |
| PASS | Environment source of truth | Shared resolver default remains `/logo-login-tablet.png` plus `EMAUS POS`. MANUS workflow alone supplies `/login-bg.png` plus `MANUS POS`. Local `web/.env` uses the same MANUS image path, but is excluded from the artifact and is not the workflow authority. |
| PASS | Checksum and packaging gate | New `web/public/login-bg.png.sha256` validates with `sha256sum --check`. Workflow, release manifest, staged integrity checks, helper, local smoke, and public smoke all use the exact MANUS path and digest. The ephemeral MANUS package requires `login-bg.png` and excludes the known Emaús `logo-login-tablet.png`; repository assets are not modified. |
| PASS | Branding resolution tests | `node --test lib/login-branding.spec.mjs`: 4 passed, 0 failed. Coverage includes MANUS pair, explicit Emaús pair, absent values, and partial-value anti-mixing. |
| PASS | Deployment negative tests | Shell syntax passes. Focused tests reject corrupt payload, wrong MANUS branding path, wrong checksum, and restart failure; Windows result remains PARTIAL only for real POSIX symlink integration, which runs on pinned Ubuntu Actions. |
| PASS | MANUS build | Next `15.5.29` production build passes on Node `24.21.0`. `.next/required-server-files.json` records `/login-bg.png` and `MANUS POS`; compiled static output contains both values. |
| PASS | Emaús compatibility build | A second production build with the Emaús pair passes. `.next/required-server-files.json` records `/logo-login-tablet.png` and `EMAUS POS`; compiled static output contains both values. |
| PASS | Lint and production audit | `npm run lint` reports no warnings/errors. `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities. |
| PASS | Workflow static safety | Assertions confirm manual-only trigger, exact MANUS build pair, checksum sidecar, manifest path, path-specific public smoke, and explicit exclusion of `logo-login-tablet.png` from the ephemeral MANUS package. |
| PARTIAL | Workflow platform validation | Local YAML parser packages are unavailable after locked install, and the workflow was not pushed or executed by GitHub. Static assertions pass, but GitHub parsing and Ubuntu artifact execution remain pending. |
| PASS | Change OpenSpec and diff hygiene | Strict change validation and `git diff --check` pass. |
| BLOCKED | Production prerequisites | Protected Environment configuration, dedicated SSH material, host-key verification, root-owned helper/symlink provisioning, PM2/runtime attestation, public URL, disk space, and a real approved workflow run remain external prerequisites. |

### Branding publication decision

Branding remediation is `GO` for PR review. Production execution remains `NO-GO` until the external prerequisites pass and an authorized manual run produces real evidence.
