# MANUS POS production web deployment

HU: `HU-CONTABO-DEP-001`

Scope: independent MANUS POS frontend only. This runbook does not authorize changes to Emaús, API, database, reportería, FactuCore, electronic billing, Electron, peripheral services, Nginx, DNS, TLS, or PM2 definitions.

## Safety model

The workflow is `.github/workflows/deploy-manus-pos-prod-web.yml`. It has only `workflow_dispatch`; a push cannot run it. It accepts only the current full `master` SHA plus the exact confirmation `MANUS_POS_PRD`. Build happens before production approval and has no SSH secrets.

The deploy job uses GitHub Environment `manus-pos-production`. It accepts only the Contabo MANUS POS host contract and SSH user `ubuntu`, transfers into a unique staging directory, verifies SHA-256 twice, preserves destination `.env*`, backs up the complete active release, atomically changes only the `/var/www/manuspos-web` release symlink, and restarts only `manuspos-web` as `ubuntu`.

The uploaded deploy script is always unprivileged. Root-owned `/var/www` mutation is delegated only to the preinstalled `/usr/local/sbin/manuspos-web-fs-helper`. The workflow verifies that helper against the SHA-256 of the reviewed repository source. It never uploads, installs, updates, sources, or executes that helper as root.

Branding is fail-closed and environment-isolated. The production-owner-supplied MANUS image has SHA-256 `c04ce9b2b4c29180ac07c5b845665f342f5fa5f5b8f2cb7c88bc1e79a226822a` and is byte-identical to the tracked `web/public/login-bg.png`; `web/public/login-bg.png.sha256` pins that approval. Only the MANUS workflow builds with `/login-bg.png` and `MANUS POS`. Its ephemeral package explicitly excludes the known Emaús `logo-login-tablet.png`. The Emaús fallback remains `/logo-login-tablet.png` and `EMAUS POS`; its repository image, workflow, and artifact behavior are unchanged.

The old Emaús workflow and script remain unchanged.

## GitHub Environment configuration

Repository administrators must create Environment `manus-pos-production` before the first run.

Required protection:

1. Add at least one production owner as required reviewer. Two reviewers are recommended for the training release.
2. Enable prevention of self-review when the organization plan exposes it.
3. Restrict deployment branches/tags to `master` only.
4. Keep environment secrets scoped to this Environment, not repository-wide.
5. Do not approve until the build job, manifest, dependency audit, source SHA, and target summary have been reviewed.

Required Environment secrets, names only:

- `MANUS_POS_PROD_SSH_PRIVATE_KEY`
- `MANUS_POS_PROD_SSH_KNOWN_HOSTS`

The private key must be exclusive to the MANUS POS production account. Restrict its server-side authorization where operationally possible. `MANUS_POS_PROD_SSH_KNOWN_HOSTS` must be created from a fingerprint verified out of band with the Contabo owner. Do not use an unverified `ssh-keyscan` result and do not use `StrictHostKeyChecking=accept-new`.

Required Environment variables, names only:

- `MANUS_POS_PROD_HOST`
- `MANUS_POS_PROD_SSH_USER`
- `MANUS_POS_PROD_SSH_PORT`
- `MANUS_POS_PROD_STAGING_ROOT`
- `MANUS_POS_PROD_BACKUP_ROOT`
- `MANUS_POS_PROD_PUBLIC_BASE_URL`
- `MANUS_POS_PROD_WEB_PATH`
- `MANUS_POS_PROD_PM2_PROCESS`
- `MANUS_POS_PROD_WEB_PORT`
- `MANUS_POS_PROD_API_PROXY_TARGET`
- `MANUS_POS_PROD_SERVER_REPO_PATH`

Do not commit their configured values. The workflow validates the known contracts for host, web path, PM2 name, web port, API target, and repository sentinel. The SSH user is fixed to `ubuntu`. SSH port, staging root, backup root, and public HTTPS URL must be confirmed on the real MANUS POS server before configuration.

## One-time privileged provisioning

This repository does not perform privileged provisioning. A production operator must separately review and install the exact committed `scripts/deploy/manus-pos-prod-web-fs-helper.sh` as `/usr/local/sbin/manuspos-web-fs-helper`, owned by `root:root` and not writable by group or other.

The helper reads `/etc/manuspos/manuspos-web-release.conf`. That root-owned, non-group/world-writable file defines names only:

- `DEPLOY_USER` (`ubuntu` is mandatory)
- `STAGING_ROOT` (must match `MANUS_POS_PROD_STAGING_ROOT`)
- `BACKUP_ROOT` (must match `MANUS_POS_PROD_BACKUP_ROOT`)
- `RELEASES_ROOT` (operator-approved root-owned versioned-release directory)
- `WEB_PATH` (`/var/www/manuspos-web` is mandatory)

Create a narrowly scoped `sudoers` rule allowing `ubuntu` to invoke only `/usr/local/sbin/manuspos-web-fs-helper` non-interactively. Do not grant general `sudo`, shell, `cp`, `mv`, `tar`, `rm`, package-manager, or PM2 privileges. The helper validates every action and path and never executes a staged file.

Before the first workflow run, operations must make `/var/www/manuspos-web` a root-owned symlink to an existing release directory below `RELEASES_ROOT`. Converting the current directory requires a separately approved maintenance procedure and backup. The workflow refuses the legacy directory layout and cannot perform this migration.

## Server preflight

An authorized operator must verify these facts on `vmi3704012` before the first approval. This is read-only except for preparing dedicated staging/backup directories and SSH authorization through the normal infrastructure process.

- The resolved host and verified SSH fingerprint belong to MANUS POS `109.123.251.8`.
- The dedicated SSH user is `ubuntu`, can read the repository sentinel, and can write only the approved staging directory. It does not receive write permission on `/var/www` or the root-owned backup/release roots.
- The configured staging and backup roots are explicit absolute directories, are not `/`, and do not overlap the active web directory.
- `/opt/manuspos/repos/nanus-tienda/.git` exists as the MANUS POS sentinel. The pipeline does not pull or modify this repository.
- `/var/www/manuspos-web` is a root-owned symlink whose resolved target is below the configured `RELEASES_ROOT`; the target contains the current runtime and required `.env*` files.
- `PM2_HOME=/home/ubuntu/.pm2 pm2 describe manuspos-web` succeeds as `ubuntu`. Record its current command, cwd, interpreter, and status without printing environment secrets. Cwd must continue resolving through `/var/www/manuspos-web`.
- The fixed filesystem helper, config, sudo rule, helper checksum, staging root, backup root, releases root, and active symlink have been independently attested by operations.
- `web/public/login-bg.png` validates against its committed `.sha256` file and the out-of-band owner-supplied source. `web/public/logo-login-tablet.png` remains the distinct Emaús image.
- Node/PM2 can run the packaged Next.js 15.5 runtime on the server architecture and libc. The pipeline does not replace their installation or PM2 definition.
- Local `http://127.0.0.1:19500/login` and `http://127.0.0.1:19500/api/system/version` are healthy before deployment.
- The configured public HTTPS base URL reaches this MANUS POS frontend.
- Sufficient free space exists for the staged archive, expanded runtime, active directory, previous directory, and compressed backup.

If any item is unknown or fails, status is `BLOCKED`. Do not approve the Environment job.

## PR instructions

1. Open a PR from `feature/master/hu-contabo-dep-001` to `master`.
2. Link `HU-CONTABO-DEP-001` and OpenSpec `hu-contabo-dep-001-manus-pos-frontend-deploy`.
3. List touched areas: workflow, web TypeScript, deployment script/tests, docs, governance, OpenSpec. State explicitly that no API/database/reportería/FactuCore/electronic-billing/Electron/peripheral file changed.
4. Include the local QA result table from the OpenSpec evidence and the final `git diff --stat`.
5. Require review from a repository owner and the production operator. Review host/path guards, the absence of a push trigger, action SHA pins, Environment name, PM2 scope, backup, rollback, and secret handling.
6. Merge through the normal protected-branch process. Do not push directly to `master`.

## First manual execution

1. Confirm the PR is merged and GitHub shows the intended commit at the head of `master`.
2. Copy its full 40-character SHA from GitHub. Do not use a short SHA.
3. Open Actions > `Deploy MANUS POS Production Web` > Run workflow.
4. Select branch `master`.
5. Enter the full current `master` SHA in `release_sha`.
6. Enter `MANUS_POS_PRD` in `confirm_target`.
7. Start the run. The build must pass approved branding checksum validation, focused tests, strict TypeScript, lint, Next build, production dependency audit, runtime packaging, manifest creation, and checksums.
8. Review `production-dependency-audit.json` inside the build artifact. Critical/high production findings block the build. Do not run `npm audit fix --force`.
9. At the Environment gate, compare repository, SHA, target, scope, and preflight evidence. An authorized reviewer other than the initiator should approve.
10. Watch the deploy job. It must use strict known-host verification, stage only on MANUS POS, validate the archive, create a verified backup, restart only `manuspos-web`, and run local plus public smoke checks.
11. Download `manus-pos-deployment-evidence-<run>-<attempt>` and retain it with the release ticket.

## Post-deployment verification

Treat the deployment as successful only when all checks below are PASS:

- Actions run conclusion is success.
- Evidence `release_sha` equals the approved full `master` SHA.
- Evidence target is `MANUS_POS_PRD_CONTABO_109.123.251.8`.
- Evidence component scope is only `web` and restart scope is only `manuspos-web`.
- Evidence status is `deployed`; integrity, backup, local login, local API, and public login fields are true.
- `pm2 describe manuspos-web` is online and its existing command/cwd remain unchanged.
- Public login HTML contains `MANUS POS`, the served `/login-bg.png` SHA-256 equals the approved committed value, and evidence build identity equals `.next/BUILD_ID` from the approved artifact.
- Public browser login loads and a basic authenticated navigation works for the training tenant.
- The frontend `/api/system/version` request succeeds through `/api`; no browser request targets a new API host.
- API, reportería, FactuCore/electronic billing, database, and peripheral PM2 uptimes were not restarted by this run.

Do not claim production certification from local validation alone. This repository change has not connected to Contabo.

## Rollback

The deploy script rolls back automatically if PM2 restart, local login, proxied API, branding checksum, build identity, remote public login, or runner-side branding checks fail after activation. Rollback atomically restores the recorded previous release symlink and restarts only `manuspos-web` as `ubuntu`. If the previous release is unavailable, archive restore revalidates its SHA-256 immediately before extraction.

An interrupted transaction leaves a root-owned marker. The next guarded run calls helper recovery before preparing a new release. Recovery restores the recorded previous target; it never guesses a path. A handled `INT`, `TERM`, or `HUP` also requests rollback before exiting.

Interpretation:

- `deployed`: all scripted checks passed. Continue manual post-deploy verification.
- `rolled_back`: the new frontend failed a check, the previous frontend was restored, and rollback local health passed. The workflow still fails intentionally.
- `failed_before_change`: integrity, target, path, process, or backup preflight failed before the active directory changed.
- `rollback_failed` or `evidence_unavailable`: stop. Do not retry blindly and do not touch other services.

For manual recovery, use the exact release backup path from `deployment-evidence.json`. A production operator must invoke the staged `manus-pos-prod-web-deploy.sh rollback` for the same release SHA and run ID with the same verified Environment values. Do not hand-write a broad `rm`, copy an `.env` between environments, or restore any backend. After rollback, verify local login, frontend `/api/system/version`, public login, PM2 state, and the `rolled_back` evidence status.

## Known publication risks

- Next.js 14 is unsupported upstream. The remediation tests and pins Next.js `15.5.29`, matching `eslint-config-next`, `sharp@0.35.5`, and narrow patched overrides for Next's transitive `postcss`, `nanoid`, and `source-map-js`. `npm audit --omit=dev --audit-level=high` reports zero production findings after this change. Five server-page prop signatures were minimally adapted to Next 15 async route props, and the full production build passes.
- GitHub Environment protection is external configuration. Until reviewers and `master` restriction are verified, deployment is `BLOCKED`.
- The approved MANUS artwork/checksum is available and locally verified. Production still requires the protected workflow run and public served-byte smoke check; local evidence alone is not production proof.
- Privileged helper installation, root-owned configuration, narrow sudo rule, versioned release root, initial symlink conversion, SSH port, roots, public URL, PM2 command/cwd, permissions, and free space need real-server verification. Until then, first execution is `BLOCKED`.
- The runtime artifact includes production `node_modules`; it is larger but avoids dependency installation on production. Confirm Actions and server storage limits.
- Node `24.21.0` follows the existing repository production pin and the runner is fixed to `ubuntu-24.04`. Next `15.5.29` lint and full production build pass locally; Contabo architecture, libc, Node, and PM2 command/cwd still require read-only operator attestation.
- Production audit is a blocking control. This change never performs forced audit remediation.
- Full install audit still reports 13 dev-only findings (2 critical, 7 high, 4 moderate), led by `vitest`/`tinypool` and lint/test/build tooling. The workflow records this report explicitly and asserts `vitest`, `vite`, and `tinypool` are absent from production `node_modules`. It never starts Vitest UI or a Vite development server. A tested Vitest 5 migration is separate work; these findings are not silently represented as production-runtime findings.
- A successful script cannot prove training flows, tenant data, DNS, TLS, or upstream API correctness. Manual post-deploy smoke remains required.
- Backup files contain the destination `.env*` because full recovery requires them. The backup root must have restrictive permissions and retention must be managed by production operations outside this first-phase workflow.
