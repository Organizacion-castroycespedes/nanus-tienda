# Evidencia migracion suppliers FE - fase FE-2.4C

## Ambiente usado

| Item | Valor |
| --- | --- |
| DB_HOST | `localhost` |
| DB_PORT | `5432` |
| DB_NAME | `manus_tienda_prd` |
| Server addr | `::1/128` |
| PostgreSQL | `PostgreSQL 16.12, compiled by Visual C++ build 1944, 64-bit` |

Confirmacion obligatoria: la base se llama `manus_tienda_prd`, pero esta en `localhost` y fue tratada como copia local de PRD. No se ejecuto nada contra PRD real ni servidor remoto.

## Backup

Backup local creado antes de migrar:

```text
D:\Profe\manus-tienda-local-backups\manus_tienda_prd_pre_fe24c_suppliers_20260531_184036.dump
```

No se documentan credenciales ni secretos.

## Archivos probados

- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1.sql`
- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1_rollback.sql`

## Conteos antes

| Metrica | Resultado |
| --- | ---: |
| suppliers | 5 |
| suppliers con `document_number` | 5 |
| purchases | 15 |
| grupos duplicados por `tenant_id + document_number_normalized` calculado | 0 |
| columnas fiscales suppliers antes | 0 |

## Resultado migracion

La migracion se ejecuto correctamente en local/QA.

Salida resumida:

```text
BEGIN
DO
ALTER TABLE
DO
DO
CREATE INDEX
CREATE INDEX
CREATE INDEX
COMMIT
```

## Validacion columnas

Columnas nuevas encontradas: 9.

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `document_type_code` | text | YES | null |
| `document_number_normalized` | text | YES | null |
| `verification_digit` | text | YES | null |
| `legal_name` | text | YES | null |
| `fiscal_email` | text | YES | null |
| `fiscal_status` | text | NO | `'PENDING'::text` |
| `fiscal_provider` | text | YES | null |
| `fiscal_last_lookup_at` | timestamptz | YES | null |
| `fiscal_last_lookup_status` | text | YES | null |

Resultado:

- `fiscal_email` no es obligatorio.
- `document_type_code` no es obligatorio.
- `document_number_normalized` no es obligatorio.
- No se exige NIT ni documento a suppliers existentes.
- `fiscal_status` queda con default seguro `PENDING`.

## Validacion constraints

Constraints encontradas: 2.

| Constraint | Resultado |
| --- | --- |
| `chk_suppliers_fiscal_status` | Existe. |
| `chk_suppliers_fiscal_last_lookup_status` | Existe. |

Prueba controlada:

- `fiscal_status = INVALID_STATUS` fue rechazado.
- `fiscal_last_lookup_status = INVALID_STATUS` fue rechazado.

## Validacion indices

Indices encontrados: 3.

| Indice | Resultado |
| --- | --- |
| `idx_suppliers_tenant_document_number_normalized` | Existe en `(tenant_id, document_number_normalized)` con parcial `document_number_normalized IS NOT NULL`. |
| `idx_suppliers_tenant_fiscal_status` | Existe en `(tenant_id, fiscal_status)`. |
| `idx_suppliers_tenant_fiscal_last_lookup_at` | Existe en `(tenant_id, fiscal_last_lookup_at DESC)` con parcial `fiscal_last_lookup_at IS NOT NULL`. |

## Validacion compatibilidad purchases

| Metrica | Antes | Despues |
| --- | ---: | ---: |
| suppliers | 5 | 5 |
| purchases | 15 | 15 |
| purchases huerfanas por `supplier_id` | 0 | 0 |

Resultado:

- `suppliers` existentes siguieron existiendo.
- `purchases.supplier_id` siguio referenciando proveedores existentes.
- Conteo suppliers no disminuyo.
- Conteo purchases no disminuyo.
- No se alteraron compras.

## Validacion backfill

| Metrica | Resultado |
| --- | ---: |
| suppliers con `document_number` | 5 |
| suppliers con `document_number_normalized` llenado | 5 |
| grupos duplicados por documento normalizado | 0 |

Resultado:

- `document_number_normalized` se lleno para todos los suppliers que tenian `document_number`.
- No hubo errores por datos nulos.
- No se detectaron duplicados.

## Resultado rollback

Rollback local ejecutado correctamente.

Salida resumida:

```text
BEGIN
DROP INDEX
DROP INDEX
DROP INDEX
ALTER TABLE
ALTER TABLE
COMMIT
```

Validacion rollback:

| Metrica | Resultado |
| --- | ---: |
| columnas fiscales despues de rollback | 0 |
| indices fiscales despues de rollback | 0 |
| suppliers despues de rollback | 5 |
| purchases despues de rollback | 15 |

Resultado:

- Columnas nuevas ya no existian.
- Indices nuevos ya no existian.
- `suppliers` seguia existiendo.
- `purchases` seguia existiendo.
- Conteos base no bajaron.

## Resultado reaplicacion

La migracion se reaplico correctamente despues del rollback.

Estado final local:

| Metrica | Resultado |
| --- | ---: |
| columnas fiscales | 9 |
| constraints | 2 |
| indices | 3 |
| suppliers | 5 |
| suppliers con documento normalizado | 5 |
| purchases | 15 |
| purchases huerfanas | 0 |

Decision: la DB local queda migrada porque migracion, rollback y reaplicacion pasaron.

## Validaciones OpenSpec

```text
openspec.cmd validate add-electronic-invoicing-customer-backend --type change --strict --json
```

Resultado: valido, 1 item passed, 0 failed.

```text
git diff --check
```

Resultado: paso. Solo warnings LF/CRLF existentes.

## Riesgos vivos

- No se creo unique fiscal todavia; si aparecen duplicados historicos en otros ambientes, se deben limpiar antes.
- `suppliers` aun no tiene endpoints fiscales implementados.
- `backend-facturacion-electronica` aun no sincroniza contra `api/`.
- La fuente fiscal real para proveedores sigue abierta y provider-agnostic.
- Falta definir politica de sobrescritura de datos manuales.

## Proximos pasos

1. Disenar endpoints `GET/POST/PATCH /api/electronic-invoicing/suppliers`.
2. Disenar contrato interno backend FE -> `api` para upsert supplier.
3. Agregar pruebas backend para suppliers fiscales cuando se implemente.
4. Definir fuente fiscal de proveedores.
5. Definir diagnostico/limpieza antes de unique fiscal fuerte.
