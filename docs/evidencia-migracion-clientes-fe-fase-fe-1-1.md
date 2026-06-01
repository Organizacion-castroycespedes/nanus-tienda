# Evidencia migracion clientes FE - Fase FE-1.1

## Ambiente usado

- DB_HOST: `localhost`
- DB_PORT: `5432`
- DB_NAME: `manus_tienda_prd`
- DB_USER: `postgres`
- Config local: `scripts/config/db.env`
- Ambiente config: `ENVIRONMENT=dev`
- Server address reportado por PostgreSQL: `::1`

Confirmacion: la prueba se ejecuto sobre copia local de PRD en `localhost`, no sobre PRD real. No se usaron comandos remotos.

## Backup

Backup local creado antes de migrar:

```text
D:\Profe\manus-tienda-local-backups\manus_tienda_prd_pre_fe1_20260529_230448.dump
```

Tamano:

```text
591332 bytes
```

No se documentan secretos.

## Version PostgreSQL

```text
PostgreSQL 16.12, compiled by Visual C++ build 1944, 64-bit
```

## Conteos

| Momento | customers |
| --- | ---: |
| Antes de migracion | 1 |
| Despues de migracion | 1 |
| Despues de rollback | 1 |
| Despues de reaplicacion | 1 |

Resultado: `customers` no perdio datos.

## Resultado migracion

Archivo ejecutado:

```text
scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1.sql
```

Resultado:

```text
migration_result=ok
```

La extension `pgcrypto` ya existia y PostgreSQL reporto `NOTICE`, sin error.

## Validacion columnas

Columnas nuevas detectadas en `public.customers`: `9`.

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `dian_last_lookup_at` | timestamp with time zone | YES | null |
| `dian_last_lookup_status` | text | YES | null |
| `document_number_normalized` | text | YES | null |
| `document_type_code` | text | YES | null |
| `fiscal_email` | text | YES | null |
| `fiscal_status` | text | NO | `'PENDING'::text` |
| `is_final_consumer` | boolean | NO | `false` |
| `legal_name` | text | YES | null |
| `verification_digit` | text | YES | null |

Compatibilidad:

- `fiscal_email` no es obligatorio.
- `document_type_code` no es obligatorio.
- Defaults seguros presentes para `is_final_consumer` y `fiscal_status`.

## Validacion tablas

Tablas nuevas detectadas:

- `public.dian_document_types`
- `public.dian_acquirer_lookup_logs`

Conteo de filas en `dian_document_types`: `0`.

Resultado: catalogo creado sin seed inicial, como estaba definido.

## Validacion constraints

Constraints verificadas:

- `chk_customers_fiscal_status`: permite `PENDING`, `VALIDATED`, `FAILED`, `NOT_REQUIRED`.
- `chk_customers_dian_last_lookup_status`: permite `NULL`, `PENDING`, `FOUND`, `NOT_FOUND`, `ERROR`, `SKIPPED`.
- `chk_dian_acquirer_lookup_logs_status`: permite `FOUND`, `NOT_FOUND`, `ERROR`, `SKIPPED`.

Resultado: constraints esperadas existen.

## Validacion indices

Indices verificados:

- `idx_customers_tenant_document_number_normalized`
- `ux_customers_tenant_active_final_consumer`
- `ux_dian_document_types_country_code_code`
- `idx_dian_acquirer_lookup_logs_tenant_customer`
- `idx_dian_acquirer_lookup_logs_tenant_looked_up_at`

Consumidor final activo duplicado por tenant:

```text
0
```

Resultado: indice parcial de consumidor final unico activo queda implementado.

## Validacion compatibilidad

Validaciones:

- `customers` existe antes, durante rollback y despues de reaplicar.
- Conteo base de `customers` no disminuyo.
- Columnas operativas existentes no fueron eliminadas.
- No se obliga `fiscal_email`.
- No se obliga `document_type_code`.
- `/api/customers` no se probo por endpoint porque no se levanto backend en esta fase.

Conclusion: estructura SQL sigue compatible con el contrato actual de `/api/customers`, ventas, pedidos, POS y reportes.

## Resultado rollback

Archivo ejecutado:

```text
scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1_rollback.sql
```

Resultado:

```text
rollback_result=ok
```

Validaciones despues de rollback:

- `public.customers`: existe.
- `public.dian_document_types`: no existe.
- `public.dian_acquirer_lookup_logs`: no existe.
- Columnas fiscales nuevas restantes en `customers`: `0`.
- Conteo `customers`: `1`.

Resultado: rollback local validado.

## Resultado reaplicacion

Se reaplico la migracion para dejar DB local migrada.

Resultado:

```text
reapply_result=ok
```

Validaciones despues de reaplicar:

- `customers_after_reapply`: `1`
- `new_columns_after_reapply`: `9`
- `tables_after_reapply`: `2`
- `indexes_after_reapply`: `5`
- `active_final_consumer_duplicates_after_reapply`: `0`

Decision: DB local queda migrada porque migracion, rollback y reaplicacion pasaron.

## Riesgos vivos

- Falta fuente oficial/version exacta para sembrar `dian_document_types`.
- Falta definir valores fiscales exactos del consumidor final para emision real.
- No se probo `/api/customers` por endpoint porque no se levanto backend.
- No se ejecutaron builds ni tests por alcance de FE-1.1.
- La base se llama `manus_tienda_prd`, pero la prueba fue local en `localhost`.

## Proximos pasos

1. Definir fuente vigente para seed de `dian_document_types`.
2. Definir constantes fiscales exactas de consumidor final.
3. Diseñar seed de catalogo DIAN y permisos de menu.
4. Implementar modulo backend `electronic-invoicing` en fase posterior.
5. Probar `/api/customers` y POS cuando el backend se levante en una fase de QA funcional.
