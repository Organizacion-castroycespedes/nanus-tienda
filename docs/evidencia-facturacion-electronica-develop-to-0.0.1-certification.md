# Certificación de `develop` para `0.0.1`

## Resultado

- `develop` inició en `5d9644b` y coincidía con `origin/develop` en `5d9644b`.
- El objetivo real es `release/evolutivo/0.0.1`, local y remoto en `131d959`.
- Merge base: `5a393b4`. `develop` contiene 9 commits que aún no están en `0.0.1`; la rama objetivo también contiene 9 commits no presentes en `develop`.
- No se promovió `develop` a `0.0.1` ni a `main`.

## Validación electrónica

- E2E `SETP990000007`: DIAN, FactuCore y Manus `ACCEPTED`.
- Billing: `143/143 PASS`.
- API: `565 PASS`, `1 skipped`, `0 fail`.
- Electron: `33/33 PASS`.
- API, Billing y Web build: PASS.
- Normalización `CASH` a `10/1`, ubicación fiscal, outbox/inbox, linkage y reconciliación: PASS.
- OpenSpec billing: PASS.
- OpenSpec all: `86 passed, 1 failed`; fallo heredado en `corregir-handoff-agent-local-perifericos-electron`.

## Bloqueos de release

- El delta hacia `0.0.1` incluye tres dumps QA bajo `scripts/database/backups/`. Deben excluirse antes de una promoción.
- El repositorio contiene material de certificado rastreado (`backend-facturacion-electronica/FactuCore/certificado.p12`) y configuración local rastreada (`scripts/config/db.env`). No se imprimieron valores ni se modificaron en esta tarea.
- La revisión de migraciones V072, V073 y V074 no encontró colisión ni operación destructiva.
- Los defaults de workers siguen seguros: `INTEGRATION_OUTBOX_DISPATCHER_ENABLED=false` y `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.

## Decisión

- Release candidate: `BLOCKED`.
- No limpiar artefactos ni rotar secretos dentro de esta certificación; requiere tarea de higiene de release separada.
- Workers globales de Manus y FactuCore permanecen deshabilitados.

