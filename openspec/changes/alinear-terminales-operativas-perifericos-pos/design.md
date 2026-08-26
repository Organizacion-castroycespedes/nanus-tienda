## Context

`terminals` is the operational source of truth. `pos_user_sessions`,
`sales.terminal_id` and `cash_registers.terminal_id` reference it by FK.
It also owns branch scope and `device_fingerprint`.

`pos_terminals` was added later by V054 for local/QA peripheral settings. Its
unique code overlaps the terminal concept but has no FK to `terminals`.
`pos_terminal_peripheral_settings.terminal_id` correctly references the POS
configuration row, but that row is not anchored to an operational terminal.
`resolve-current` therefore receives an operational UUID, cannot find it in
`pos_terminals`, and selects `local-terminal` as branch default.

The existing XP-80 configuration is valid physical evidence, but
`local-terminal` is only a temporary bridge. This change designs the safe
transition to `TERM-001` without changing historical sales or cash records.

## Goals / Non-Goals

**Goals:**

- Make `terminals` the canonical business/operational terminal.
- Model an optional one-to-one peripheral configuration with
  `pos_terminals.operational_terminal_id -> terminals.id`.
- Keep separate identities in every contract:
  `operationalTerminalId`, `agentTerminalCode`, and peripheral `deviceId`.
- Resolve real peripherals by operational terminal first and never silently
  substitute a MOCK bridge for a valid operational terminal.
- Preserve controlled legacy and explicit-MOCK behavior during migration.

**Non-Goals:**

- No removal of `pos_terminals`, `local-terminal`, historical records, or
  current hardware configuration in this phase.
- No scanner, scale, cash drawer, sales, payment, tax, inventory, or fiscal
  changes.
- No client-type schema change. WEB/ELECTRON is distinct from peripheral mode.
- No database migration is executed against QA/production until the reviewed
  script receives separate application approval.

## Decisions

### Canonical terminal plus optional configuration profile

Keep `terminals` untouched as canonical operational identity. Add nullable
`pos_terminals.operational_terminal_id`, FK to `terminals(id)`, and a unique
partial index so one operational terminal has zero or one active configuration
profile.

`pos_terminal_peripheral_settings` remains attached to `pos_terminals.id`.
This avoids rewriting settings or historical business FKs and gives a small,
reversible bridge.

Alternative: move settings directly to `terminals`. Rejected for first step:
it needs setting-table migration, more API breakage, and makes a safe rollback
harder. It can be a later simplification after usage proves stable.

### Branch scope is not a peripheral identity

A branch can own more than one operational terminal. In QA, `TERM-001` and
`TERM-002` share tenant and branch scope but are separate operational points.
Therefore `tenant_id + branch_id` is only an isolation boundary; it is not a
safe lookup key for peripheral configuration. The bridge is always explicit:

```text
terminals.id
  -> pos_terminals.operational_terminal_id
  -> pos_terminal_peripheral_settings
```

### Three identifiers, three jobs

```text
terminals.id                 operationalTerminalId
  -> sales, POS session, cash register, branch scope

pos_terminals.code           agentTerminalCode (legacy-compatible local code)
  -> Agent job/event/log correlation only

peripheral settings.deviceId peripheral device identity
  -> discovered queue/device, e.g. USB printer descriptor
```

`pos_terminals.code` remains named `code` for backward compatibility in this
step. New API responses/documentation expose it as `agentTerminalCode`; no
consumer may treat it as a business terminal identifier once an operational
link exists.

### Resolution order and explicit outcomes

For `GET /pos-terminals/resolve-current`:

1. Given `terminalId` that is a `terminals.id`, find an active operational
   terminal in tenant/branch scope, then its linked POS configuration.
2. If the operational terminal exists but has no configuration, return a
   controlled `OPERATIONAL_UNCONFIGURED` result with no printer device. The
   caller maps print attempts to `PRINTER_NOT_CONFIGURED`.
3. Only if an explicit legacy code is requested, resolve legacy
   `pos_terminals.code`.
4. `local-terminal` MOCK fallback is allowed only under explicit MOCK/dev
   context, never after recognizing an operational terminal.

The result must include `operationalTerminalId`, `posTerminalId`,
`agentTerminalCode`, mode and features. It must not overload `terminalId` with
different kinds of ID.

### Tenant and branch integrity

The API validates that the linked `terminals` row has the same tenant and
branch as `pos_terminals`. The future DB migration adds a trigger for the same
invariant, because a simple UUID FK alone cannot enforce tenant/branch match
across two tables.

### Selected incremental migration safety

`scripts/database/migrate_prd.sh` supports an explicit
`ONLY_INCREMENTAL_MIGRATION` mode for QA operations that require one reviewed
V-style migration. The mode accepts only a basename matching
`V###__description.sql`, validates it stays in the official migrations folder,
requires `ENVIRONMENT=qa`, verifies the live database/user/schema, and refuses
database names that are not QA or contain `prd`/`prod`.

It does not run schema files, functions, seeds, fixtures, or other pending
migrations. It reuses `migrations_history` and checksum validation. A dry run
uses `ONLY_INCREMENTAL_DRY_RUN=YES` and performs only the guard, lookup and
checksum inspection.

For a selected migration only, `MIGRATION_DB_USER` and optional
`MIGRATION_DB_PASSWORD` can provide the DDL identity without changing the
runtime connection. The runner verifies `current_user` against that selected
migration user. QA uses `manus_qa_user` as table owner/DDL identity while the
API remains `manus_user`.

### WEB and Electron remain clients, not modes

No current `clientType` field was found in either terminal model. If client
classification becomes necessary, add a separate `client_type` (`WEB`,
`ELECTRON`, `HYBRID`) to a future terminal-client registration/configuration
model. Never reuse `pos_terminals.mode`: that remains peripheral behavior
(`MOCK`, `REAL`, `HYBRID`).

## Risks / Trade-offs

- [Ambiguous legacy mapping] -> no automatic mapping by branch/code alone;
  collect preflight rows and approve each mapping, including `TERM-001`.
- [Cross-tenant direct SQL link] -> API validation plus DB trigger before
  production migration.
- [Existing mocks expect `local-terminal`] -> preserve it as explicit legacy
  fixture; remove only after compatibility metrics and a separate approval.
- [Web contracts overload terminalId] -> version/extend response first, then
  migrate consumers with compatibility fields during one release.
- [Agent has in-memory device registry] -> terminal linkage persists in API DB
  but Agent discovery/registration recovery remains its own documented concern.

## Migration Plan

1. **Approved mapping.** The reviewed first bridge maps only
   `pos_terminals.e186b5bd-4873-49bb-9450-f141570cce80`
   (`local-terminal`, `HYBRID`) to
   `terminals.693921eb-d28d-4c1b-af17-087b589c6467` (`TERM-001`). No other
   row is inferred or backfilled.
2. **Additive migration, applied in QA.**
   `V071__link_pos_terminals_to_operational_terminals.sql` adds nullable
   `operational_terminal_id`, FK `ON DELETE RESTRICT`, unique partial index,
   validation trigger and lookup index. No delete, rename or settings rewrite.
3. **Approved bridge backfill.** The V071 transaction updates only that listed
   profile after validating expected IDs, codes, mode, active state, tenant and
   branch. It preserves every other legacy profile, including unmapped
   `local-terminal` rows, with a null link.
4. **API/UI rollout.** Prefer linked config in resolution. Return controlled
   unconfigured state rather than fallback mock. Keep legacy lookup behind
   explicit compatibility context.
5. **QA and observability.** Verify TERM-001 + XP-80, branch isolation,
   unconfigured error, explicit mock, sales and cash regression.
6. **Future removal decision.** After all real configurations are linked and
   monitored, deprecate default `local-terminal`; delete only in another
   approved change.

### Confirmed deployment topology

The Peripheral Agent owns physical-device access. In the validated QA topology,
the browser ran at `192.168.1.18`, Manus services and Agent ran at
`192.168.1.14`, and the XP-80 USB queue was attached to the Agent host. The
canonical terminal resolution selected the linked profile; it did not use the
legacy `local-terminal` default.

For production-like QA, the POS workstation SHALL host Browser, Peripheral
Agent and USB XP-80 together (`192.168.1.18` in the planned topology), while
Manus Web, API and Reports run remotely. Browser clients never access USB
hardware directly; the Agent remains the local transport boundary.

## Known historical migration ledger debt

In `manus_tienda_qa`, `migrations_history` records V062 through V070 while
V046 through V061 are absent. This change MUST NOT execute those versions,
backfill their history rows, or use the normal runner to catch up. The gap is
separate migration-history debt for a later audited change.

Rollback before bridge backfill is `DROP` of only new FK/index/trigger/column.
After approved backfill, rollback first nulls only the rows recorded in the
mapping manifest, then drops additive schema. It never changes sales, cash or
`terminals` rows.

## Open Questions

- Who approves the definitive mapping sheet for each branch/terminal?
- Should Agent persistence be designed before or after terminal linkage goes
  live? It is independent but affects restart UX.
- Should legacy `pos_terminals.code` be renamed only in a later API version?
