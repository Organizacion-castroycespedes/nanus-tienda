# Evidencia facturacion electronica fase 4 - application service

## Objetivo

Crear el servicio de aplicacion neutral para persistir el agregado electrÃ³nico antes de cualquier provider HTTP.

## Alcance implementado

Se agregaron artefactos de codigo en:

```text
api/src/modules/electronic-billing/
```

Componentes creados:

- `ElectronicBillingService`
- `ElectronicDocumentValidationError`
- `ElectronicDocumentOriginalNotFoundError`
- `ElectronicDocumentTenantMismatchError`

## Flujo implementado

- BEGIN transaction.
- Buscar documento idempotente por tenant + document type + external reference.
- Insertar `electronic_documents`.
- Insertar `electronic_document_lines`.
- Insertar `electronic_document_taxes`.
- Insertar `electronic_document_references` para credit notes.
- Insertar `electronic_document_events`.
- COMMIT transaction.
- ROLLBACK on failure.

## Reglas aplicadas

- `provider_document_id = NULL` al crear el agregado.
- `provider_status = NULL` al crear el agregado.
- `status = PENDING` al crear el agregado.
- No se invoca ningun provider.
- No se hace HTTP.
- No se toca `sales`.
- No se toca `returns`.
- Credit note valida documento original del mismo tenant.
- Credit note valida linea original del mismo tenant.
- Idempotencia retorna agregado existente.

## Validaciones ejecutadas

- `npx tsx --test src/modules/electronic-billing/**/*.spec.ts` PASS
- `npm run build` in `api/` PASS
- `git diff --check` PASS
- `openspec validate integrar-facturacion-electronica-multiproveedor --type change --strict` PASS
- `openspec validate --all --strict` PASS

## Riesgo vivo

- The base migration has not been executed against a real local PostgreSQL database again.
- Fase 5 still needed for FactuCore HTTP adapter.
