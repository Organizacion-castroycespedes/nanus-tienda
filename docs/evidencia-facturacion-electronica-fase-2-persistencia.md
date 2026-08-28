# Evidencia facturacion electronica fase 2 - persistencia base

## Objetivo

Crear la persistencia base del dominio neutral de facturacion electronica en Manus, usando `public` y nombres `electronic_billing_*` / `electronic_document_*`.

## Alcance implementado

Se agrego una migration SQL nueva en:

```text
scripts/database/migrations/V072__electronic_billing_base_persistence.sql
```

Nota de normalizacion:

- el archivo inicial manual en `api/database/2026_08_27_electronic_billing_base_persistence.sql` fue retirado como fuente ejecutable;
- la migration oficial vive ahora en el runner de Manus bajo `scripts/database/migrations/`.

Tablas creadas:

- `electronic_billing_providers`
- `tenant_electronic_billing_configs`
- `electronic_documents`
- `electronic_document_lines`
- `electronic_document_taxes`
- `electronic_document_references`
- `electronic_document_events`
- `electronic_document_attachments`
- `electronic_document_deliveries`

## Reglas de modelo

- `provider_id` y `provider_config_id` quedan separados del dominio de ventas.
- `document_type` usa `INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE`.
- `source_type` usa `SALE`, `RETURN`, `ORDER`, `MANUAL`.
- `provider_document_id` queda nullable para permitir estado previo a provider.
- `external_reference` queda como clave idempotente por tenant, provider y tipo de documento.
- `status` interno y `provider_status` quedan separados.
- `provider_line_id` queda disponible para mapeo futuro de lineas.
- `electronic_document_attachments` y `electronic_document_deliveries` guardan metadatos, no binarios.

## Integridad

Se agregaron:

- PK UUID con `gen_random_uuid()`.
- FKs entre provider/config/document/lines/taxes/references/events/attachments/deliveries.
- unique key para `code` de provider.
- unique key de idempotencia para documentos.
- unique parcial para `provider_document_id`.
- unique parcial para `provider_line_id`.
- checks para tipos y montos numericos no negativos.

## Validacion ejecutada

```powershell
C:\nvm4w\nodejs\openspec.cmd validate integrar-facturacion-electronica-multiproveedor --type change --strict
C:\nvm4w\nodejs\openspec.cmd validate --all --strict
git diff --check
```

Resultado:

- OpenSpec change: `PASS`
- OpenSpec all: `PASS`
- diff check: `PASS`

## No alcance confirmado

- No se implemento FactuCore HTTP client.
- No se implemento create invoice runtime.
- No se implemento generate XML, sign, transmit o retry.
- No se tocaron `sales` ni `returns`.
- No se ejecutaron migraciones en QA o PROD.
- No se agregaron secretos.

## Normalizacion posterior

La persistencia base quedo alineada con el mecanismo oficial de Manus y con `public.migrations_history`.

Comando oficial identificado para aplicacion puntual futura:

```bash
ONLY_INCREMENTAL_MIGRATION=V072__electronic_billing_base_persistence.sql bash scripts/database/migrate_prd.sh <safe-qa-env>
```

No se ejecuto en esta tarea.

## Riesgos vivos

- Aun falta la capa de repositorios y persistencia de codigo de aplicacion.
- Aun falta conectar esta base con el flujo real de emision.
- Aun falta decision final sobre storage de attachments.

## Siguiente paso

Fase 3: `provider abstraction + persistence repositories`.
