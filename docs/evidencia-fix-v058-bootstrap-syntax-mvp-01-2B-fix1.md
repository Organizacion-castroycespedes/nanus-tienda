# Evidencia fix V058 bootstrap syntax MVP-01.2B-FIX1

Estado: `QA_V058_SQL_FIXED`.
Fecha: 2026-06-11.

## Alcance

- Archivo revisado: `scripts/database/migrations/V058__qa_required_catalog_seed.sql`.
- Objetivo: reparar sintaxis SQL para PostgreSQL 16.
- Restricciones respetadas: no bootstrap, no migraciones, no AWS, no DB, no deploy, no PM2.

## Hallazgo exacto

El fallo estaba en el statement:

```sql
CREATE TEMP TABLE tmp_mvp_01_2b_final_consumer_ranked ON COMMIT DROP AS
WITH candidates AS (
  ...
);
```

PostgreSQL 16 requiere que un `WITH` sea consumido por una sentencia `SELECT`, `INSERT`, `UPDATE`, `DELETE` o `MERGE`.

El `CTE` cerraba y luego terminaba con `);`, por eso el parser reporto `syntax error at or near ";"`.

## Cambio aplicado

Se agrego el `SELECT` que materializa el CTE en la tabla temporal:

```sql
)
SELECT *
FROM candidates;
```

## Revision estatica SQL

| Item | Resultado |
| --- | --- |
| `INSERT` consumidor final | PASS: columnas explicitas y `NOT EXISTS` por tenant. |
| `CTE` consumidor final | PASS: `WITH candidates AS (...) SELECT * FROM candidates`. |
| `ON CONFLICT` | PASS: V058 no usa `ON CONFLICT`; idempotencia queda en `NOT EXISTS` y normalizacion previa. |
| `DO` blocks | PASS: bloques cerrados con patron existente del repo. |
| Parentesis | PASS: CTE principal cerrado y consumido por `SELECT`. |
| Comas finales | PASS: no se detectaron listas con coma final invalida. |
| `customers.is_default` | PASS: se agrega si falta, se normaliza un unico default por tenant. |
| `units.is_active` | PASS: se agrega si falta y se activa seed minimo. |
| `taxes.is_active` | PASS: se agrega si falta y se activa seed minimo. |

## Idempotencia mantenida

- Consumidor final unico/default se normaliza antes de crear indices unicos parciales.
- Nuevos consumidores finales se insertan solo cuando el tenant activo no tiene candidato.
- Units minimas se insertan por tenant activo solo si no existe nombre o abreviatura equivalente.
- Taxes minimas se insertan por tenant activo solo si no existe nombre o combinacion `rate + is_included`.

## Validaciones

- Revision estatica SQL: PASS.
- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS (`Change 'mvp-web-hardening' is valid`).
- `git diff --check`: PASS. Solo mostro warnings LF/CRLF de working copy.
- `git status --short`: PASS para revision de estado; muestra cambios locales esperados de este fix y evidencia previa no relacionada.

## Resultado

`QA_V058_SQL_FIXED`
