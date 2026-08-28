# Evidencia: validacion real de V072 en PostgreSQL

Fecha: 2026-08-27

## Alcance

Validar `scripts/database/migrations/V072__electronic_billing_base_persistence.sql` usando el runner oficial de Manus:

- `scripts/database/migrate_prd.sh`
- `ONLY_INCREMENTAL_MIGRATION=V072__electronic_billing_base_persistence.sql`

## Target

- Environment: `qa`
- Database: `manus_tienda_qa`
- Schema: `public`
- Host: `54.242.102.178`
- User initial: `manus_user`
- User final for successful apply: `postgres` via `MIGRATION_DB_USER`

## Backup

- Backup required: yes
- Backup script: `scripts/database/backup.sh`
- Backup file: `scripts/database/backups/manus_tienda_qa_20260827140043.dump`

## Runner validation

### Dry run with default migration user

Status:

- `Database: manus_tienda_qa`
- `Migration user: manus_user`
- `Schema: public`
- `Status: PENDING`

### Apply attempt with default migration user

Result:

- Failed
- Error: `permission denied for table tenants`

Root cause:

- `manus_user` did not have enough privilege to create the foreign key from `tenant_electronic_billing_configs.tenant_id` to `tenants(id)` in QA.

### Apply attempt with admin migration user

Result:

- Passed

Command shape:

- `MIGRATION_DB_USER=postgres`
- `MIGRATION_DB_PASSWORD` from `scripts/config/db.env`

### Second run

Result:

- `Status: ALREADY_APPLIED`
- Dry run confirmed the runner sees V072 as already applied.

## Migration history

- `public.migrations_history` contains `V072__electronic_billing_base_persistence.sql`
- Success: `true`

## Tables validated

Found:

- `electronic_billing_providers`
- `tenant_electronic_billing_configs`
- `electronic_documents`
- `electronic_document_lines`
- `electronic_document_taxes`
- `electronic_document_references`
- `electronic_document_events`
- `electronic_document_attachments`
- `electronic_document_deliveries`

Total:

- `9/9`

## Structural validation

Verified in PostgreSQL:

- Columns
- Nullability
- Foreign keys
- Unique constraints
- Indexes
- Check constraints

Notable points:

- `provider_document_id`, `provider_status`, `cufe`, `cude`, `last_status_check_at` are nullable on `electronic_documents`
- `electronic_document_taxes` enforces `(electronic_document_id, electronic_document_line_id)` against `electronic_document_lines(electronic_document_id, id)`
- `uq_electronic_documents_idempotency` exists on `(tenant_id, provider_id, document_type, external_reference)`

## Smoke tests

All smoke checks were done inside transactions unless otherwise noted.

Passed:

- Pending document can be created with nullable provider identity fields
- Idempotency unique constraint rejects duplicate document key
- Credit note reference can point to an invoice
- Event row can be appended
- Attachment metadata can be stored without binary
- Delivery row can be stored independently from fiscal status
- Cross-row tax integrity is enforced by the FK
- `FOR UPDATE SKIP LOCKED` works for the background claim path

## Lock test

Temporary QA fixture was created and removed.

Observed:

- First session locked the row
- Second session got no row
- Cleanup removed fixture rows

## OpenSpec

Validation after migration:

- `openspec validate integrar-facturacion-electronica-multiproveedor --type change --strict` -> PASS
- `openspec validate --all --strict` -> PASS

## Git / build / tests

- `git diff --check` -> PASS with existing CRLF warning only
- `api` build -> PASS
- `api` electronic billing tests -> PASS, 69 tests

## Conclusion

`REAL POSTGRESQL VALIDATION OF V072: PASS`
