## Why

HU-CONTABO-DEP-001 requires an urgent but controlled way to publish the MANUS POS frontend for the 6 November 2026 training. The repository only has an Emaús-oriented production workflow that deploys several services automatically from `master`, so reusing it for the independent Contabo production host would risk cross-environment changes and an oversized deployment.

## What Changes

- Add an independent, manual-only GitHub Actions workflow for the MANUS POS production frontend built from an explicitly validated `master` commit.
- Require a protected GitHub Environment approval before any SSH connection or production mutation.
- Build the Next.js frontend reproducibly with verified, environment-isolated MANUS POS branding and local `/api` proxy configuration while preserving the Emaús defaults and asset.
- Fail closed unless the exact login asset matches a separately approved SHA-256; a merely present or MANUS-looking image is not approval.
- Package only the web runtime with a commit manifest and SHA-256 checksums, then validate it before and after transfer.
- Stage and deploy only to the MANUS POS Contabo host, preserving destination runtime environment files and restarting only `manuspos-web`.
- Create a verifiable backup, perform local and public smoke checks, and automatically roll back the frontend when deployment checks fail.
- Use a preinstalled root-owned filesystem helper for the root-owned `/var/www` boundary; uploaded release scripts never execute as root, while PM2 remains owned and restarted by `ubuntu`.
- Activate versioned releases with an atomic symlink replacement, retain recoverable transaction state, and verify backup checksums again before restore.
- Move the unsupported Next.js 14 runtime to the smallest supported security-patched release that passes the existing frontend validation.
- Correct the strict TypeScript access to `window.manusTerminal` by reusing the existing peripheral bridge typing pattern without changing Electron or peripheral behavior.
- Document required GitHub secrets, variables, Environment protection, first-run procedure, evidence, rollback, and known publication risks.
- Explicitly exclude database, API, reporting, FactuCore, electronic billing, Emaús production, and automatic push deployment changes.

## Capabilities

### New Capabilities

- `manus-pos-production-web-deployment`: Manual, approval-gated, integrity-checked, frontend-only production deployment and rollback for the independent MANUS POS Contabo environment.

### Modified Capabilities

None.

## Impact

- Affected areas: `.github/workflows/`, `scripts/deploy/`, `web/app/[tenant]/pos/page.tsx`, deployment documentation, governance scope ownership, and this OpenSpec change.
- Runtime target: MANUS POS frontend at `/var/www/manuspos-web`, PM2 process `manuspos-web`, port `19500`, with API proxy target `http://127.0.0.1:4020`.
- Security boundary: the workflow must use MANUS POS-specific GitHub secrets and host-key pinning; it must not contain or consume Emaús paths, hosts, process names, or credentials.
- No API contract, database schema, reportería, FactuCore, electronic-billing, Electron, or peripheral runtime behavior changes are authorized.
