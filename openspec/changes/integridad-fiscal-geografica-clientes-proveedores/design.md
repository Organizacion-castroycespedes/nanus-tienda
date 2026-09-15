## Context

The API stores geographic references and legacy labels for customers and suppliers, while billing snapshots consume fiscal and location values. Existing records may be incomplete. The reference hierarchy is `paises` → `departamentos` → `municipios`; implementation must confirm exact keys and constraints before migration.

## Goals / Non-Goals

**Goals:**

- One server-side resolver for catalog IDs to canonical codes and labels.
- Symmetric customer and supplier validation, persistence, and Web cascading selectors.
- Dry-run first, deterministic idempotent backfill, and review classification for unresolved fiscal data.
- Fail-closed electronic-billing eligibility and immutable canonical snapshots.

**Non-Goals:**

- No guessed DIAN responsibility codes or mass assignment of `R-99-PN`.
- No FactuCore changes, provider calls, billing dispatch, or production mutation.
- No immediate strict constraints that would invalidate legitimate unresolved historical rows.

## Decisions

- Use reference-table IDs as write inputs and resolve codes inside the API transaction. This prevents client-supplied code tampering and keeps legacy labels compatible.
- Share geographic validation between customers and suppliers. Separate domain services remain responsible for their own fiscal rules and tenant scope.
- Keep fiscal backfill review-only unless an existing authoritative mapping proves the value. Geographic fields may be auto-filled only from deterministic foreign-key/catalog relationships.
- Add only the smallest migration after confirming the current latest version and existing indexes. Prefer staged checks/reporting over `NOT NULL` until the audit proves completeness.
- Keep final-consumer behavior explicit from current code. No exception is added without an existing domain rule.

## Risks / Trade-offs

- [Historical rows lack canonical references] → leave them unchanged, report `REQUIRES_FISCAL_REVIEW`, and keep billing fail-closed.
- [Catalog hierarchy is inconsistent] → reject the write and report the exact relationship error.
- [Web and API contracts drift] → test create, update, hydration, and serialized canonical fields together.
- [Backfill accidentally dispatches billing] → use a DB-only migration/report path and explicitly disable dispatcher/background settings in every runtime context.

## Migration Plan

1. Inventory schema, catalog completeness, and customer/supplier records read-only.
2. Implement and test validation/resolution and dry-run reporting.
3. Add only required non-destructive migration and verify version/checksum.
4. Run QA dry-run, review counts, then guarded deterministic geographic backfill.
5. Re-run audit and billing eligibility checks. Rollback means stopping before backfill; no destructive rollback is used.

## Open Questions

- Exact catalog primary keys and code columns must be confirmed from the live repository schema.
- Exact approved fiscal-responsibility catalog and final-consumer exception policy must be confirmed before enforcing fiscal requirements.
