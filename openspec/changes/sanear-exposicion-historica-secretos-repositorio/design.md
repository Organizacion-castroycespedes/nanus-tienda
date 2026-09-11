## Context

The current `develop` tree no longer tracks QA dumps, `scripts/config/db.env`, or `certificado.p12`. Ignore rules and a sanitized environment template are present. Historical commits and remote refs can still contain the removed material. This change is documentation and process design only; no rotation or history rewrite is performed now.

## Goals / Non-Goals

**Goals:**

- Establish an auditable path to classify, rotate, revoke, purge, and verify exposed material.
- Protect production by proving environment scope before any operational action.
- Coordinate history replacement so branches, tags, clones, worktrees, and CI do not reintroduce old history.
- Define closure evidence without exposing secret values.

**Non-Goals:**

- Rotating credentials or certificates in this change.
- Rewriting Git history, force-pushing, deleting refs, or changing release branches.
- Changing electronic-billing code or invalidating its certified E2E result.

## Decisions

- **Rotate before purge:** Credential and certificate remediation comes before history replacement. Purging an active secret without rotation does not reduce misuse risk.
- **Inventory all refs:** Branches, tags, remotes, CI clones, and worktrees are enumerated before rewriting. A single-branch cleanup is insufficient.
- **Use approved tooling only:** A future rewrite uses `git filter-repo` or an approved equivalent after backup and approval. No blind destructive command is prescribed.
- **Coordinate replacement:** Remote replacement uses `force-with-lease` under an explicit maintenance window, followed by clone refresh instructions.
- **Verify without disclosure:** Scans compare fingerprints, paths, and secret detectors without printing values, private keys, dumps, or raw fiscal payloads.

## Risks / Trade-offs

- [Old credentials remain usable] → Rotate and revoke before history purge; verify old access is rejected where testable.
- [Private key may be reused] → Determine PKCS#12 key presence and certificate status safely, then revoke or replace when applicable.
- [History rewrite breaks consumers] → Back up first, enumerate refs, coordinate CI and developers, and require fresh clones or safe ref refresh.
- [Purge misses alternate refs] → Verify all intended branches, tags, remotes, and reachable objects after replacement.
- [Cleanup removes needed local operations] → Preserve local-only configuration in approved untracked locations and use sanitized templates in Git.

## Migration Plan

1. Inventory and classify exposure and ownership.
2. Rotate/revoke active database credentials and certificate material.
3. Back up the repository and record affected refs.
4. Execute an approved, reviewed history rewrite.
5. Coordinate remote replacement with `force-with-lease`.
6. Refresh clones/worktrees and validate release refs, tests, scans, and revocation.

Rollback is a coordinated repository restore from the pre-rewrite backup only after confirming no new secret exposure is introduced.

## Open Questions

- Which QA database credentials remain active, and who owns rotation?
- Does the PKCS#12 file contain a private key, and is it active for QA or DIAN?
- Which remote refs, tags, CI caches, and clones must be included in the purge window?

