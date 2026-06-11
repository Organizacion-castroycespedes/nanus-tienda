# Evidencia - Fix runtime grants target user MVP-01.2C-FIX2

Fecha: 2026-06-11

Resultado: `QA_RUNTIME_GRANTS_TARGET_USER_FIXED`

## Objetivo

Corregir el usuario destino de `012_runtime_db_grants.sql` para que los grants apunten al usuario runtime real de API.

Evidencia recibida:

```text
DB_RUNTIME_USER=manus_qa_user
psql -U manus_user -d manus_tienda_qa
SELECT COUNT(*) FROM users;
permission denied for table users
```

## Causa

`scripts/database/bootstrap-manus-tienda-qa.sh` y `scripts/database/migrate_prd.sh` resolvian:

```bash
DB_RUNTIME_USER="${DB_RUNTIME_USER:-${APP_DB_USER:-$DB_USER}}"
```

En bootstrap QA, `DB_USER` se deriva de `DB_OWNER`.

```bash
DB_USER="${DB_USER:-${DB_OWNER:-}}"
```

Por eso, si `APP_DB_USER` y `DB_RUNTIME_USER` no estaban definidos, el runtime user caia a `manus_qa_user`. Ese es el owner, no el usuario runtime API `manus_user`.

## Fix

Nueva prioridad:

1. `APP_DB_USER`
2. `DB_RUNTIME_USER`
3. `MANUS_RUNTIME_DB_USER`
4. fallback literal `manus_user`

Regla corregida:

- `DB_USER` ya no participa en la resolucion del usuario runtime para grants QA.
- El bootstrap loguea `DB_RUNTIME_USER_SOURCE` para diagnostico.
- El env example usa `APP_DB_USER=manus_user`.
- `DB_RUNTIME_USER` y `MANUS_RUNTIME_DB_USER` quedan como aliases opcionales.

## SQL revisado

`scripts/database/012_runtime_db_grants.sql` no requirio cambio.

El SQL recibe `runtime_user` desde `migrate_prd.sh`; el bug estaba en el valor shell enviado por `-v "runtime_user=${DB_RUNTIME_USER}"`.

## Validaciones

- `bash -n scripts/database/migrate_prd.sh`: PASS.
- `bash -n scripts/database/bootstrap-manus-tienda-qa.sh`: PASS.
- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS.
- `git diff --check`: PASS con warnings LF/CRLF existentes del working copy.

## Restricciones

- No se ejecuto bootstrap.
- No se ejecutaron migraciones.
- No se toco AWS.
- No se modifico DB.
- No se hizo deploy.
- No se tocaron secretos.

## Resultado

`QA_RUNTIME_GRANTS_TARGET_USER_FIXED`
