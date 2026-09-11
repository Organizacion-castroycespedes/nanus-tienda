# Evidencia de normalizacion de migration de facturacion electronica

## Objetivo

Normalizar la persistencia base de facturacion electronica al mecanismo oficial de Manus, sin ejecutar nada contra QA ni PROD.

## Situacion encontrada

La migration inicial estaba ubicada en:

```text
api/database/2026_08_27_electronic_billing_base_persistence.sql
```

Ese directorio es SQL manual historico. No es el runner oficial de migraciones del repositorio.

## Mecanismo oficial

El runner oficial descubierto para migrations incrementales es:

```text
scripts/database/migrate_prd.sh
```

Con soporte para seleccion puntual de una sola migration mediante:

```text
ONLY_INCREMENTAL_MIGRATION
```

La carpeta oficial de migrations incrementales es:

```text
scripts/database/migrations/
```

## Migration oficial creada

La migration de facturacion electronica fue normalizada a:

```text
scripts/database/migrations/V072__electronic_billing_base_persistence.sql
```

## Motivo del movimiento

- evitar dos fuentes de verdad
- alinear la migration con el runner oficial de Manus
- permitir registro en `public.migrations_history`
- respetar el orden oficial de migrations del proyecto

## Equivalencia SQL

El contenido funcional de la migration se preservo:

- `electronic_billing_providers`
- `tenant_electronic_billing_configs`
- `electronic_documents`
- `electronic_document_lines`
- `electronic_document_taxes`
- `electronic_document_references`
- `electronic_document_events`
- `electronic_document_attachments`
- `electronic_document_deliveries`

## Estado de ejecucion

- No se ejecuto contra QA.
- No se ejecuto contra PROD.
- No se ejecuto contra una base local.

## Fuente anterior

El archivo manual anterior queda retirado como fuente ejecutable.

## Siguiente paso

La validacion futura debe usar el runner oficial con un target seguro aprobado.
