# Evidencia — Gestión Operativa Phase 5.1

## Contrato seguro

El método `reconcileExistingProviderStatus(tenantId, electronicDocumentId)`
vive en `backend-facturacion-electronica/src/modules/electronic-billing/services/electronic-billing-processing.service.ts`.
Solo carga el documento Manus, consulta el estado existente por
`providerDocumentId` o `externalReference`, reutiliza el mapper FE y persiste
la reconciliación segura.

No llama `retryDocument()`, `processDocument()`, creación, generación XML,
firma ni transmisión. La búsqueda sin documento de proveedor termina en
`PROVIDER_DOCUMENT_NOT_FOUND`.

## API y permiso

- Ruta: `POST /api/operations/sales/:saleId/electronic-billing/refresh`.
- Permiso: `POS WRITE`, porque la reconciliación actualiza estado persistido.
- El endpoint resuelve `OperationalSaleScope` y verifica el UUID de venta
  antes de consultar el documento FE.
- El puente interno usa `API_INTERNAL_TOKEN`; la respuesta expone solo estado,
  identidad fiscal segura, CUFE, número, aceptación, código/mensaje y tracking.

## Seguridad

`USER` sigue limitado a tenant, branch y turno abierto actual. `ADMIN` no
requiere turno. `SUPER_USER` permanece dentro de su tenant. UUID cross-tenant,
branch o turno anterior sigue bloqueado por el scope central.

`ACCEPTED`, `REJECTED`, `PROCESSING`, `PENDING` y `TECHNICAL_ERROR` pueden
confirmarse por lectura. `CANCELLED` no muestra la acción. Refresh no implica
retry. El retry queda diferido porque el método existente puede retransmitir
o crear documento.

## Pruebas y límites

- Prueba enfocada: reconciliación llama únicamente provider status.
- Prueba enfocada: ausencia de identidad no resuelve proveedor ni crea.
- API scope/regresión: `21/21 PASS` esperado tras agregar refresh.
- API build: esperado PASS.
- Billing build: esperado PASS.
- Web lint/build: mantener baseline PASS.
- No live FactuCore, no DIAN, no QA business mutation.
- Auditoría específica queda diferida; no se crea tabla nueva.

## Retry

`evaluateRetryability()` es una decisión de solo lectura del dominio FE.
Actualmente devuelve `canRetry: false` para todos los estados operativos:
`ACCEPTED`, `REJECTED` y `CANCELLED` son terminales; `PROCESSING` ya está en
curso; `PENDING` y `TECHNICAL_ERROR` requieren reconciliar primero el estado
del proveedor. No existe botón ni endpoint de retry.

El método existente `retryDocument()` no se expone: con identidad de proveedor
puede llamar `retry-transmission`; sin identidad puede terminar emitiendo un
documento. La ejecución futura requiere contrato separado de recuperación,
idempotencia y un solo envío.
