# Certificación de facturación electrónica en main

## Promoción

- Fuente: `release/evolutivo/0.0.1` en `79e4d1ae7d0bc148735a640edc7b7c90b81058bb`.
- Main remoto antes: `4a5e8e2794d1cac5632af16df1ede8f844ada424`.
- Merge local: `3b4c5eb553cffafd5bd03d542727af50bd4fcb22`.
- Resultado: merge `--no-ff`, sin conflictos, sin push ni deploy.

## Validación

Main contiene migraciones `V072`, `V073`, `V074`, outbox/inbox, proveedor
FactuCore, normalización CASH `10`/`1`, ubicación fiscal, provider linkage,
recuperación por `externalRef` y reconciliación `ACCEPTED`/`REJECTED`.

- Billing: `143/143` pass.
- API enfocado: `131/132`, `1` skipped, `0` failures; baseline full: `565` pass, `1` skipped.
- API build: pass.
- Billing build: pass.
- Web build: pass, con warnings ESLint existentes no bloqueantes.
- Electron: baseline certificado `33/33` pass y build pass.
- OpenSpec Billing: pass.
- OpenSpec seguridad: pass.
- OpenSpec all: `87` pass, `1` fallo heredado en
  `corregir-handoff-agent-local-perifericos-electron`.

## Seguridad y operación

- Archivos inseguros trackeados: `db.env` no; dumps QA `0`; PKCS#12 `0`.
- Secret scan: pass. No hubo resurrección de archivos inseguros.
- `git diff --check`: pass. Marcadores de conflicto: ninguno.
- La deuda histórica de seguridad permanece `OPEN_ACCEPTED_RISK`; no se
  declara resuelta y sus tareas siguen abiertas.
- No hubo llamadas FactuCore/DIAN, mutaciones QA, ni workers habilitados.

## Resultado

La promoción `release/evolutivo/0.0.1` → `main` queda certificada. Main queda
listo para operación posterior según política, sin push ni deploy realizados.
