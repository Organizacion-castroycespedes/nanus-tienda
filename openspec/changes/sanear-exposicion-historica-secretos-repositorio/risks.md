## Risks

- Credential misuse before rotation.
- Certificate misuse if the PKCS#12 contains a private key.
- Accidental destructive history rewrite.
- Broken clones after remote replacement.
- Stale CI/CD clones or caches.
- Stale local worktrees.
- Release or tag divergence.
- Accidental deletion of valid history.
- Incomplete purge of alternate refs.

## Mitigations

- Rotate and revoke first.
- Create and verify a repository backup before rewrite.
- Enumerate branches, tags, remotes, clones, worktrees, and CI consumers.
- Use reviewed `force-with-lease`, not blind force push.
- Coordinate a maintenance window with developers and automation owners.
- Re-clone or safely refresh consumers after replacement.
- Run secret scans and reachability checks after purge.

