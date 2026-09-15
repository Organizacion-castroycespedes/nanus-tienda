## Context

Customers and suppliers already persist canonical geographic references and fiscal fields. The existing dry-run identifies incomplete profiles, but the result is not exposed as an operator workflow. The API already owns customer/supplier validation and menu permissions; the new workflow must reuse those authorities and remain tenant-scoped.

## Goals / Non-Goals

**Goals:**

- Provide one read-only, tenant-scoped review queue for customers and suppliers.
- Reuse existing edit pages, cascading location selectors, validation, and permission guards.
- Restrict selectable fiscal values to values already supported by the Manus domain.
- Mark human edits as `MANUAL` while keeping `is_dian_validated` false.

**Non-Goals:**

- No provider calls, billing processing, migrations, bulk fiscal assignment, or new audit subsystem.
- No new IVA-responsibility schema dimension in this change; its absence is reported as a follow-up design gap.

## Decisions

- Add a read-only review service/controller using the same missing-profile predicates as `fiscal_data_backfill_dry_run.sql`. Return customers and suppliers with classification, missing fields, reason, and canonical location. Reuse `CUSTOMERS` and `SUPPLIERS` READ permissions rather than adding a seed/migration.
- Define controlled options from existing Manus values: `NATURAL` and `JURIDICA`, `ORDINARIO`, and responsibility codes already present in the domain/tests. Existing unknown persisted values remain visible for review but are not offered as new choices.
- Keep customer and supplier create/update services as the only write authority. The review page links to their existing editors; those editors submit catalog IDs and the server resolves canonical codes.
- Do not interpret `R-99-PN` as IVA responsibility. No value is defaulted. A future nullable IVA-responsibility dimension requires separate fiscal/business approval.
- Keep final consumers out of the normal incomplete queue but expose their `NOT_REQUIRED` exception in the queue response for audit transparency.

## Risks / Trade-offs

- [Existing records contain unsupported or unknown fiscal codes] → show them as review-required and reject unsupported new values.
- [No separate IVA-responsibility field exists] → report the gap and keep billing fail-closed; do not claim provider validation.
- [Shared editor changes could affect POS lookup] → only add controlled UI options and preserve existing lookup behavior.

## Migration Plan

No database migration. Deploy API and Web together. Roll back by removing the review route/service; persisted fiscal values remain governed by existing columns.

## Open Questions

- The business-approved IVA responsibility dimension and code must be supplied before it can be represented separately from `tax_responsibilities`.
