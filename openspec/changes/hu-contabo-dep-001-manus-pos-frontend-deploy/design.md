## Context

See `proposal.md` for motivation and `specs/manus-pos-production-web-deployment/spec.md` for the behavior contract.

The repository currently has `.github/workflows/deploy-prod-master.yml` and `scripts/deploy/prod-deploy-full.sh`. They are Emaús-specific: the workflow also runs on pushes to `master`, packages three backend binaries, uses shared `PROD_*` secrets, and the script targets Emaús paths and restarts four PM2 processes. The independent MANUS POS production target is Contabo `109.123.251.8`, frontend `/var/www/manuspos-web`, PM2 process `manuspos-web`, port `19500`, local API `127.0.0.1:4020`, and repository sentinel `/opt/manuspos/repos/nanus-tienda`.

The web app uses the committed npm lockfile and the repository production workflow pins Node `24.21.0`. `web/next.config.mjs` resolves login branding at build time and creates the `/api` rewrite from `API_PROXY_TARGET`. The branding resolver deliberately defaults to Emaús (`/logo-login-tablet.png`, `EMAUS POS`) and accepts an environment-specific pair only when both variables are present. The production owner supplied the approved MANUS source image with SHA-256 `c04ce9b2b4c29180ac07c5b845665f342f5fa5f5b8f2cb7c88bc1e79a226822a`; it is byte-identical to the already tracked MANUS asset `web/public/login-bg.png`. The distinct Emaús asset `web/public/logo-login-tablet.png` remains unchanged. The current production process definition is not stored for MANUS POS. The operator has confirmed only that PM2 is owned by `ubuntu`, so exact command and cwd remain external preflight facts.

## Goals / Non-Goals

**Goals:**

- Make release provenance, scope, checksums, backup, health, and rollback visible in one run.
- Make a wrong environment, wrong commit, wrong host, wrong path, or wrong process fail closed.
- Keep build output self-contained enough that the destination does not resolve new dependency versions during the release.
- Preserve destination `.env*` files and the existing PM2 process definition.
- Keep the Emaús workflow behavior unchanged.

**Non-Goals:**

- Define or change Nginx, DNS, TLS, PM2 ecosystem configuration, API runtime, databases, reporting, FactuCore, electronic billing, Electron, or peripheral services.
- Connect to production while developing or validating this change.
- Persist PM2 state with `pm2 save`.
- Claim production certification before an approved real execution.

## Decisions

### 1. Add a separate manual-only workflow

Create a new workflow with only `workflow_dispatch`. It validates that the run ref is `refs/heads/master`, that the supplied 40-character release SHA equals the selected workflow commit, and that the operator types an explicit MANUS POS target confirmation. It uses `permissions: contents: read` and a non-cancelling concurrency group.

Alternative considered: extend `deploy-prod-master.yml`. Rejected because that file encodes Emaús automatic and multi-service behavior; shared conditionals would increase the chance of cross-environment deployment and could alter the existing Emaús pipeline.

### 2. Separate build from protected deployment

The build job has no production Environment or SSH secrets. The deploy job depends on the build and declares the `manus-pos-production` GitHub Environment. Required reviewers, branch/tag restrictions, and prevention of self-review are configured in GitHub because YAML cannot create Environment protection rules.

Alternative considered: put the Environment on the whole workflow. Rejected because approval should protect the first production-capable job while allowing deterministic build feedback before the training window.

### 3. Build and package the complete web runtime in Actions

Use Node `24.21.0`, `npm ci`, focused Node tests, `tsc --noEmit`, lint, and `next build`. Production dependencies are created from `package-lock.json` in Actions and included with `.next`, `public`, `lib`, `package.json`, `package-lock.json`, and `next.config.mjs`. This avoids `npm install` and dependency-network drift on the production host. A JSON manifest records the full SHA and immutable build inputs; a sorted checksum file covers the payload.

Alternative considered: run `npm ci --omit=dev` on Contabo after transfer. Rejected because server-side package installation adds registry availability and mutable infrastructure to the release transaction. Alternative considered: enable Next standalone output. Rejected because the existing PM2 command is not versioned here and changing the runtime entrypoint would violate the preserve-runtime constraint.

### 4. Use environment-scoped values with hard safety guards

Secrets are limited to the SSH private key and pinned known-hosts content. Non-secret target values are GitHub Environment variables. The workflow requires all values and validates fixed contracts before SSH: host `109.123.251.8`, web path `/var/www/manuspos-web`, process `manuspos-web`, port `19500`, API target `http://127.0.0.1:4020`, and repository sentinel `/opt/manuspos/repos/nanus-tienda`. Staging root, backup root, SSH user/port, and public URL remain explicit Environment variables because their real values were not supplied and must not be invented.

SSH uses `StrictHostKeyChecking=yes`, a run-scoped known-hosts file, `BatchMode=yes`, and a dedicated identity. It never calls `ssh-keyscan` or accepts a host key dynamically.

Alternative considered: hard-code all server values. Rejected for unknown operational paths and identities. Alternative considered: trust first use with `ssh-keyscan`. Rejected because it does not authenticate the expected server key.

### 5. Stage, verify, back up, replace, and roll back within guarded paths

The archive and checksum files are copied only to a unique directory below the configured staging root. The server verifies checksums and manifest SHA before deployment. The deploy script canonicalizes paths, rejects roots and unexpected fixed contracts, confirms the repository sentinel and PM2 process, and creates the candidate beside the active web directory so the final rename stays on one filesystem.

Before replacement it captures sanitized PM2 description output and creates a compressed backup of the active web directory. `gzip -t`, archive listing, and checksum validation make the backup verifiable. Destination `.env*` files are copied into the candidate without reading or printing them. The active directory is renamed to a run-scoped previous directory, the candidate becomes active, and only `pm2 restart manuspos-web --update-env` runs. No `pm2 save` runs.

If local smoke fails, the script restores the previous directory. If the runner-side public smoke fails, it invokes the same guarded rollback command using the release identifier. Rollback also restarts only `manuspos-web` and validates local health. A lock directory prevents concurrent server mutations in addition to GitHub concurrency.

Alternative considered: overlay files with `cp -R`. Rejected because stale build files can survive. Alternative considered: `rsync --delete`. Rejected because availability is unverified and exclusion mistakes could remove `.env` files.

### 6. Produce sanitized machine-readable evidence

The deploy script writes a JSON evidence file in staging using controlled values, not shell dumps. The runner downloads it after success or failure and uploads it as a retained Actions artifact. Logs report release IDs and statuses but never secret material or `.env` contents.

### 7. Apply the existing optional bridge typing pattern

At the failing POS-page expression, narrow `window` to `Window & { manusTerminal?: unknown }` before passing the candidate to `hasElectronTerminalBridge`. This is the same strict pattern already used by `domains/peripherals/runtime-contract.ts` and `domains/peripherals/api.ts`. No global declaration and no runtime code outside the expression are needed.

### 8. Treat the MANUS production login asset as independently approved input

Commit a checksum sidecar for the existing MANUS-only asset `web/public/login-bg.png`. The build verifies it against the production-owner-supplied SHA-256 before tests or packaging and records both `/login-bg.png` and the digest in the release manifest. Local and public smoke checks fetch that exact path and hash the served bytes. The MANUS workflow supplies the complete environment pair `NEXT_PUBLIC_GIN_BG_IMAGE=/login-bg.png` and `NEXT_PUBLIC_LOGIN_BRAND_NAME=MANUS POS`.

The Emaús source of truth remains the resolver default pair `/logo-login-tablet.png` and `EMAUS POS`; its workflow, repository asset, and fallback behavior are not changed. The approved source file is byte-identical to the already tracked `login-bg.png`, so no binary is copied or recreated. The MANUS-only packaging step excludes the known Emaús `logo-login-tablet.png` from its ephemeral runtime after copying shared public assets; this does not delete or modify the repository asset or change Emaús packaging.

### 9. Separate unprivileged orchestration from fixed privileged filesystem mutation

Keep SSH and PM2 operations under `ubuntu`. A root-owned helper installed at a fixed absolute path performs only guarded filesystem preparation, atomic activation, rollback, recovery, and backup operations. It reads root-owned configuration, validates its own ownership/mode and approved checksum, and never sources or executes release payload files. The workflow may invoke only this installed helper through a narrow `sudo -n` rule; it never invokes the staged repository script as root.

The uploaded deploy script remains an unprivileged orchestrator. It validates release integrity, confirms `id -un` is `ubuntu`, validates the PM2 process from the `ubuntu` PM2 home, calls the helper, restarts only `manuspos-web`, performs smoke checks, and requests helper rollback on failure or handled interruption.

This requires one-time privileged provisioning of the helper, root-owned configuration, sudo rule, releases root, and conversion of `/var/www/manuspos-web` to the approved symlink layout. Repository work cannot perform that mutation, so production stays BLOCKED until operations completes and attests it.

### 10. Use versioned releases and atomic symlink activation

The helper copies the verified runtime into a new root-owned versioned release, preserves `.env*`, creates and verifies a backup, and records the old and new targets in root-owned transaction state. It creates a temporary symlink beside `/var/www/manuspos-web` and atomically renames that symlink over the active symlink. The old release remains intact until a later retention operation outside this deployment transaction.

Rollback atomically points the active symlink back to the recorded previous release. Archive restore is a fallback only and must re-run `sha256sum --check` immediately before extraction. An incomplete transaction is rejected until the explicit recovery action restores the recorded previous target. This avoids the previous two-rename gap where the active path could disappear.

### 11. Gate supported runtime dependencies

Pin the GitHub runner to `ubuntu-24.04` and record it in the manifest. Next.js 14 is outside upstream support and has current production advisories. Test the smallest supported security-patched Next.js 15 release with matching `eslint-config-next`. Retain the lockfile change only when focused tests, lint, strict build, and production audit pass. The workflow fails on unaccepted critical or high production advisories and never runs forced audit remediation.

## Risks / Trade-offs

- [GitHub Environment is misconfigured without required reviewers] → Document exact protection settings and treat first execution as BLOCKED until an owner verifies them in GitHub.
- [Pinned host key becomes stale after legitimate server rebuild] → Rotate the known-hosts secret through an out-of-band fingerprint verification; never bypass strict checking.
- [Artifact including production `node_modules` is large] → Use short retention and package only web production dependencies; favor integrity and offline deployment over size for this urgent phase.
- [Public base URL is not yet known] → Require it as an Environment variable and fail preflight if absent or not HTTPS; do not invent a domain.
- [SSH user, SSH port, staging root, and backup root are not yet verified] → Require explicit Environment variables and server-side canonical path guards; first execution stays blocked until operators confirm them.
- [PM2 process may have an unexpected cwd or command] → Preflight `pm2 describe manuspos-web`, preserve the process definition, and fail before replacement if it is absent.
- [Node 24 with Next 14 has regression risk despite existing repository use] → Run the complete web build and focused tests in Actions and locally; record warnings. Do not relax build errors.
- [Existing dependency vulnerabilities may remain] → Capture `npm audit --omit=dev` as non-mutating evidence, never run forced remediation in this emergency release, and track actionable findings separately.
- [Rollback can restore files but not an external dependency outage] → Distinguish rollback health from release health in evidence and escalate infrastructure failures.

## Migration Plan

1. Merge the reviewed workflow, deploy script, docs, TypeScript fix, scope manifest, and strict-valid OpenSpec through a PR into `master`.
2. Create the `manus-pos-production` Environment, restrict it to `master`, add required reviewers, prevent self-review where available, and configure the documented secrets and variables with verified real values.
3. Confirm the SSH public key is restricted to the MANUS POS host account and verify the server fingerprint out of band.
4. Perform the first `workflow_dispatch` for the current full `master` SHA, review the build artifact and approval summary, then approve the protected deployment.
5. Verify the retained evidence, local and public smoke results, PM2 status, branding, login, and `/api/system/version` through the frontend.
6. If the automated rollback reports failure, stop. Use the recorded backup path and guarded manual rollback procedure; do not modify other services.

Rollback is release-specific: restore the verified backup/previous directory for the release, restart only `manuspos-web`, and repeat local then public smoke checks. A workflow failure is not evidence of a successful rollback unless the evidence status explicitly records `rolled_back` and rollback checks pass.

## Open Questions

- The real SSH user, SSH port, staging root, backup root, and public HTTPS base URL must be supplied and verified by the operator when configuring the GitHub Environment.
- The real PM2 command/cwd and filesystem permissions must be confirmed during first-run preflight; the workflow intentionally does not rewrite them.
