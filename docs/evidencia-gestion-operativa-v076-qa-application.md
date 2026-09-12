# Evidencia — Aplicación QA de V076

## Alcance

Se aplicó únicamente `scripts/database/migrations/V076__electronic_billing_processing_stage.sql`
en `manus_tienda_qa`, usando el runner incremental controlado. No se
ejecutaron otras migraciones, seeds ni cambios de autorización.

## Guardas y precheck

- Fuente de configuración: `scripts/config/db.env`.
- Entorno: `qa`.
- Base: `manus_tienda_qa`.
- Esquema: `public`.
- Identidad de aplicación: `manus_user`.
- Identidad DDL usada por el runner: `postgres`, porque `manus_user` no es
  propietario de `electronic_documents`.
- `V075__terminal_device_binding.sql`: presente en `migrations_history` con
  `success=true`.
- `V076__electronic_billing_processing_stage.sql`: pendiente antes de aplicar.
- Columnas de procesamiento: ausentes antes de aplicar.
- PROD: excluido por `ENVIRONMENT=qa`, nombre exacto de base y guardas del
  runner. No se consultó ni modificó PROD.

## Resultado

El runner aplicó solo V076 y registró `success=true` en
`public.migrations_history`. La suma SHA-256 registrada y la del archivo local
coinciden: `8ac32d72a9887fe46f188b8f0e30d494ca07e91be06fdfb0469ed4d52e704474`.

Validaciones posteriores:

- `processing_stage`: `text`, `NOT NULL`, default `UNKNOWN`.
- `processing_stage_updated_at`: `timestamptz`, `NOT NULL`, default `now()`.
- Constraint: contiene los ocho valores certificados.
- Valores inválidos o nulos: `0`.
- Backfill terminal `ACCEPTED`/`CANCELLED` a `COMPLETED`: PASS.
- Backfill `REJECTED` terminal a `COMPLETED`: PASS.
- Filas provider-linked no terminales: no hubo filas calificadas; regla queda
  cubierta por el SQL y no se inventó evidencia.
- Históricos ambiguos: `4` filas permanecen en `UNKNOWN`.

La segunda ejecución no se realizó como SQL: el modo de descubrimiento del
runner reconoce V076 como `APPLIED` y evita una ejecución duplicada.

## Seguridad

V075 no fue alterada. No hubo llamadas a FactuCore ni DIAN. No se tocaron
documentos fiscales de negocio fuera del backfill de V076. No hubo commit,
push ni deploy.
