## Why

Sensitive QA credentials, PKCS#12 material, and database dumps were committed in the past. They are removed from the current `develop` tree, but remain reachable in remote Git history and require coordinated future remediation.

## What Changes

- Record historical secret and sensitive-data exposure as open security technical debt.
- Define a controlled inventory, rotation, certificate assessment, history-purge, and verification process.
- Require coordination across branches, tags, clones, worktrees, CI, and release refs before any history replacement.
- Preserve the distinction between current-tree remediation, which is done, and historical remediation, which is pending.

## Capabilities

### New Capabilities

- `repository-secret-hygiene`: Defines lifecycle controls for exposed credentials, certificate material, sensitive artifacts, and coordinated Git-history cleanup.

### Modified Capabilities

None.

## Impact

- Repository security operations, QA credential ownership, FactuCore/DIAN certificate operations, Git remote administration, CI/CD clones, release branches, and developer worktrees.
- No application runtime, billing behavior, database schema, or fiscal document behavior changes are authorized by this debt record.

