# Evidencia - Runtime DB grants bootstrap MVP-01.2C-FIX1

Fecha: 2026-06-11

Resultado: `QA_RUNTIME_DB_GRANTS_VERSIONED`

## Objetivo

Versionar grants para el usuario runtime de API despues de recrear `manus_tienda_qa`.

Fallo observado en QA:

```text
permission denied for table users
```

Causa clasificada:

- El bootstrap crea objetos con owner `manus_qa_user`.
- El runtime API usa `manus_user`.
- Los grants manuales previos a `manus_user` se pierden al recrear la DB.

## Cambios

- Se creo `scripts/database/012_runtime_db_grants.sql`.
- Se agrego `DB_RUNTIME_USER`, con preferencia sobre `APP_DB_USER` y fallback a `DB_USER`.
- `scripts/database/migrate_prd.sh` aplica `012_runtime_db_grants.sql` al final del flujo.
- `scripts/database/bootstrap-manus-tienda-qa.sh` valida, loguea y exporta `DB_RUNTIME_USER`.
- `scripts/database/config/bootstrap-manus-tienda-qa.env.example` documenta `DB_RUNTIME_USER=manus_user`.
- Runbooks y manifest documentan el nuevo paso final.

## Grants versionados

`012_runtime_db_grants.sql` concede al runtime user:

- `GRANT CONNECT ON DATABASE`.
- `GRANT USAGE ON SCHEMA public`.
- `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public`.
- `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public`.
- `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public`.
- `ALTER DEFAULT PRIVILEGES` para tablas futuras.
- `ALTER DEFAULT PRIVILEGES` para secuencias futuras.
- `ALTER DEFAULT PRIVILEGES` para funciones futuras.

## Revision estatica

- El SQL usa `format('%I', ...)` para quote seguro de DB y rol.
- El rol runtime se recibe por variable psql `runtime_user`.
- Si `runtime_user` queda vacio, el script falla con error claro.
- Si el rol runtime no existe, el script falla con error claro.
- Reaplicar `GRANT` y `ALTER DEFAULT PRIVILEGES` es idempotente.
- No se ejecutaron migraciones.
- No se ejecuto bootstrap.
- No se toco AWS.
- No se modifico DB.
- No se hizo deploy.
- No se tocaron secretos.

## Validaciones

- `bash -n scripts/database/migrate_prd.sh`: PASS.
- `bash -n scripts/database/bootstrap-manus-tienda-qa.sh`: PASS.
- `openspec.cmd validate mvp-web-hardening --type change --strict`: PASS.
- `git diff --check`: PASS con warnings LF/CRLF existentes del working copy.

## Resultado

`QA_RUNTIME_DB_GRANTS_VERSIONED`
