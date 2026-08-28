# Evidencia Fase X5 - FactuCore adapter y background worker

## Alcance

- Copia/adaptación de FactuCore al backend dedicado.
- Copia/adaptación del background worker al backend dedicado.
- Sin cutover.
- Sin activar worker productivo.

## Archivos nuevos en backend

- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/factucore.types.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/factucore.errors.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/factucore.client.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/factucore.mapper.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/factucore.provider.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/factucore.bootstrap.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/index.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/workers/electronic-billing-background.service.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/workers/index.ts`
- `backend-facturacion-electronica/test/factucore.client.spec.ts`
- `backend-facturacion-electronica/test/factucore.provider.spec.ts`
- `backend-facturacion-electronica/test/electronic-billing-background.service.spec.ts`

## Archivos modificados

- `backend-facturacion-electronica/src/modules/electronic-billing/electronic-billing.module.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/providers/index.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/index.ts`
- `backend-facturacion-electronica/.env.example`
- `openspec/changes/extraer-bounded-context-facturacion-electronica-a-backend-dedicado/tasks.md`
- `openspec/changes/extraer-bounded-context-facturacion-electronica-a-backend-dedicado/design.md`

## Decisiones

- `ElectronicBillingBackgroundService` queda registrado en el backend.
- El worker arranca deshabilitado por defecto con `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.
- La resolución de credenciales productivas sigue pendiente.
- La API sigue siendo el owner productivo hasta el cutover futuro.

## Validaciones

- `backend-facturacion-electronica` build: PASS
- `backend-facturacion-electronica` tests: PASS
- `api` electronic billing tests: PASS
- `api` build: PASS
- `openspec validate extraer-bounded-context-facturacion-electronica-a-backend-dedicado --type change --strict`: PASS
- `openspec validate integrar-facturacion-electronica-multiproveedor --type change --strict`: PASS
- `openspec validate --all --strict`: PASS
- `git diff --check`: PASS

## Leak scan

Outside `providers/factucore/` there are no production hits for:

- `FactuCore`
- `FACTUCORE`
- `x-client-key`
- `x-client-secret`
- `generate-xml`
- `originDocumentId`
- `discrepancyResponseCode`
- `VALIDATED_INTERNAL`
- `XML_GENERATED`
- `READY_TO_SEND`

Allowed provider-specific strings remain only inside the adapter folder.
