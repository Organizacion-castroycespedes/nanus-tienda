# Evidencia FASE X4 - Repositories + Electronic Billing Application Services

Fecha: 2026-08-28

## Scope

- Se movieron/copiaron al backend dedicado las piezas de persistencia y aplicación de facturación electrónica.
- La API quedó como fuente retenida temporalmente.
- No se movió `ElectronicBillingBackgroundService`.
- No se movió FactuCore runtime.
- No se tocó SaleService.

## Repository inventory

- `backend-facturacion-electronica/src/modules/electronic-billing/repositories/electronic-billing-records.ts`
- `backend-facturacion-electronica/src/modules/electronic-billing/repositories/electronic-billing.repositories.ts`
- 9 repositorios activos:
  - `ElectronicBillingProviderRepository`
  - `TenantElectronicBillingConfigRepository`
  - `ElectronicDocumentRepository`
  - `ElectronicDocumentLineRepository`
  - `ElectronicDocumentTaxRepository`
  - `ElectronicDocumentReferenceRepository`
  - `ElectronicDocumentEventRepository`
  - `ElectronicDocumentAttachmentRepository`
  - `ElectronicDocumentDeliveryRepository`

## DB adaptation

- Repositories usan `DatabaseService` del backend.
- Cada método acepta `PoolClient?` para compartir transacción.
- Bulk insert sigue en línea para líneas y taxes.
- `claimForProcessing()` y `claimDueForBackgroundSync()` mantienen `FOR UPDATE SKIP LOCKED`.

## Resolver migration

- `ElectronicBillingProviderResolver` ahora vive en backend.
- Resuelve tenant config + provider registry.
- Solo pasa `credentialReference`, no secretos.
- `CREDENTIAL STORAGE` sigue en `PENDING`.

## Service migration

- `ElectronicBillingService` vive en backend.
- `ElectronicBillingProcessingService` vive en backend.
- Se preserva:
  - idempotencia por `externalReference`
  - tenant isolation
  - provider result persistence
  - status refresh
  - retry
  - recovery

## Transaction model

- Repositories soportan `PoolClient`.
- Servicios usan transacciones cortas con `DatabaseService.getClient()`.
- Provider HTTP sigue fuera de la transacción DB.

## Provider HTTP boundary

- No se agregó provider HTTP al backend dedicado en esta fase.
- No se movió FactuCore adapter.
- No se activó worker.

## Static scans

- No hits en:
  - `FROM sales`
  - `JOIN sales`
  - `FROM inventory`
  - `JOIN inventory`
  - `FROM customers`
  - `JOIN customers`
- No hits en exact tokens:
  - `VALIDATED_INTERNAL`
  - `XML_GENERATED`
  - `SIGNED`
  - `READY_TO_SEND`
  - `x-client-key`
  - `x-client-secret`
  - `generate-xml`

## Tests

- `backend-facturacion-electronica npm test`: PASS
- `backend-facturacion-electronica npm run build`: PASS
- `api npx tsx --test src/modules/electronic-billing/**/*.spec.ts`: PASS
- `api npm run build`: PASS

## Transition ownership

- API source retained temporarily: YES
- Backend source of truth for moved layer: repositories + services + resolver
- Worker ownership: still API for now
- FactuCore ownership: still API for now
